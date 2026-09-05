
const BidRoom = require('../models/BidRoom');
const Bid = require('../models/Bid');
const Vendor = require('../models/Vendor');

// Track which sockets are admin observers: socketId -> roomId
const adminSockets = new Map();
// Track participant count: roomId -> Set<socketId>
const roomParticipants = new Map();

async function evaluateAutoBids(roomId, io) {
  let keepChecking = true;
  let iterations = 0;

  while (keepChecking && iterations < 50) {
    iterations++;
    keepChecking = false;

    const room = await BidRoom.findById(roomId);
    if (!room || room.status !== 'active') break;

    const totalBasePrice = room.basePrice * (room.quantity || 1);
    const currentLowest = room.currentLowestBid || totalBasePrice;
    const currentWinnerStr = room.winner ? room.winner.toString() : null;

    // Find eligible auto-bidders (not the current winner, and floor <= next bid amount)
    const nextBidAmount = currentLowest - room.decrementValue;
    
    const eligibleAutoBids = room.autoBids.filter(ab => 
      ab.vendor.toString() !== currentWinnerStr &&
      ab.floorAmount <= nextBidAmount
    );

    if (eligibleAutoBids.length > 0) {
      // Sort by floor amount (lowest floor wins). If tie, the array order acts as tiebreaker
      eligibleAutoBids.sort((a, b) => a.floorAmount - b.floorAmount);
      const bestAutoBid = eligibleAutoBids[0];

      // 1. Create Bid
      const newBid = new Bid({ room: room._id, vendor: bestAutoBid.vendor, amount: nextBidAmount, isAutoBid: true });
      await newBid.save();

      // 2. Update room
      room.currentLowestBid = nextBidAmount;
      room.winner = bestAutoBid.vendor;

      // 3. Soft close
      const now = new Date();
      const endTime = new Date(room.endTime);
      const timeRemainingMs = endTime.getTime() - now.getTime();
      const triggerWindowMs = room.settings.softCloseTriggerWindow * 60 * 1000;
      if (timeRemainingMs <= triggerWindowMs && !room.settings.softCloseExecuted) {
        const extensionMs = room.settings.softCloseMinutes * 60 * 1000;
        room.endTime = new Date(endTime.getTime() + extensionMs);
        room.settings.softCloseExecuted = true;
        io.to(roomId.toString()).emit('timeExtended', {
          newEndTime: room.endTime,
          message: 'Auction time extended due to a late auto-bid!'
        });
      }

      await room.save();

      // 4. Emit to sockets
      const vendorObj = await Vendor.findById(bestAutoBid.vendor).select('companyName email');
      const sockets = await io.in(roomId.toString()).fetchSockets();
      for (const s of sockets) {
        if (adminSockets.get(s.id) === roomId.toString()) {
          s.emit('adminNewBid', {
            _id: newBid._id,
            vendor: vendorObj ? { _id: vendorObj._id, companyName: vendorObj.companyName, email: vendorObj.email } : { companyName: 'Unknown' },
            amount: nextBidAmount,
            createdAt: newBid.createdAt,
            isAutoBid: true
          });
        } else {
          s.emit('newLowestBid', { amount: nextBidAmount });
        }
      }

      keepChecking = true; // Run another iteration to see if someone else's auto-bid counters this one!
    }
  }
}

module.exports = function(io) {
  io.on('connection', (socket) => {
    console.log('Socket connected: ' + socket.id);

    // ── Join Room ──────────────────────────────────────────────────────────
    socket.on('joinRoom', async ({ roomId, vendorId, role }) => {
      try {
        socket.join(roomId);
        const room = await BidRoom.findById(roomId).populate('product').populate('invitedVendors', 'companyName email');
        if (!room) { socket.emit('error', { message: 'Room not found' }); return; }

        if (role === 'admin') {
          adminSockets.set(socket.id, roomId);
          console.log('Admin joined room ' + roomId + ' as observer');

          const bids = await Bid.find({ room: roomId })
            .populate('vendor', 'companyName email')
            .sort({ createdAt: -1 });

          socket.emit('adminRoomState', {
            room: {
              _id: room._id,
              product: room.product,
              basePrice: room.basePrice,
              decrementValue: room.decrementValue,
              quantity: room.quantity,
              startTime: room.startTime,
              endTime: room.endTime,
              status: room.status,
              currentLowestBid: room.currentLowestBid || (room.basePrice * (room.quantity || 1)),
              settings: room.settings,
              winner: room.winner,
              invitedVendors: room.invitedVendors,
              vendorAccessCodes: room.vendorAccessCodes
            },
            bids: bids.map(b => ({
              _id: b._id,
              vendor: b.vendor ? { _id: b.vendor._id, companyName: b.vendor.companyName, email: b.vendor.email } : { companyName: 'Unknown' },
              amount: b.amount,
              createdAt: b.createdAt,
              isAutoBid: b.isAutoBid
            }))
          });
        } else {
          console.log('Vendor ' + vendorId + ' joined room ' + roomId);
          const now = new Date();
          const startTime = new Date(room.startTime);
          if (now < startTime) {
            socket.emit('waitingRoom', { message: 'Waiting for auction to start', startTime: room.startTime });
          } else {
            // Find if this vendor has an auto-bid
            const ab = room.autoBids.find(a => a.vendor.toString() === vendorId);
            socket.emit('auctionState', {
              currentLowestBid: room.currentLowestBid || (room.basePrice * (room.quantity || 1)),
              endTime: room.endTime,
              status: room.status,
              myAutoBidFloor: ab ? ab.floorAmount : null
            });
          }
        }
        // Track participants for this room
        if (!roomParticipants.has(roomId)) {
          roomParticipants.set(roomId, new Set());
        }
        roomParticipants.get(roomId).add(socket.id);
        
        // Track specific vendor IDs for presence badge
        if (role !== 'admin' && vendorId && vendorId !== 'anonymous') {
          if (!socket.data) socket.data = {};
          socket.data.vendorId = vendorId;
          socket.data.roomId = roomId;
        }
        
        // Broadcast updated participant count and present vendors to admins
        const participantsCount = roomParticipants.get(roomId).size;
        
        // Find all unique vendor IDs currently connected to this room
        const presentVendors = new Set();
        const roomSockets = io.sockets.adapter.rooms.get(roomId);
        if (roomSockets) {
          for (const sId of roomSockets) {
            const s = io.sockets.sockets.get(sId);
            if (s && s.data && s.data.vendorId) {
              presentVendors.add(s.data.vendorId);
            }
          }
        }
        const presentVendorsArray = Array.from(presentVendors);

        for (const [sId, rId] of adminSockets.entries()) {
          if (rId === roomId) {
            io.to(sId).emit('participantUpdate', { count: participantsCount, presentVendors: presentVendorsArray });
          }
        }
      } catch (err) { console.error('Error joining room:', err); }
    });

    // ── Setup Auto Bid ───────────────────────────────────────────────────────
    socket.on('setupAutoBid', async ({ roomId, vendorId, floorAmount }) => {
      try {
        const room = await BidRoom.findById(roomId);
        if (!room) return;

        if (room.status !== 'active') {
          socket.emit('bidError', { message: 'Bidding is not currently active.' });
          return;
        }

        const floor = Number(floorAmount);
        if (isNaN(floor) || floor <= 0) {
          socket.emit('bidError', { message: 'Invalid floor amount' });
          return;
        }

        const totalBasePrice = room.basePrice * (room.quantity || 1);
        const currentLowest = room.currentLowestBid || totalBasePrice;
        if (floor > currentLowest - room.decrementValue) {
          socket.emit('bidError', { message: 'Your floor price must be at least one decrement step lower than the current price.' });
          return;
        }

        // Add or update autoBid array
        const existingIdx = room.autoBids.findIndex(ab => ab.vendor.toString() === vendorId);
        if (existingIdx >= 0) {
          room.autoBids[existingIdx].floorAmount = floor;
        } else {
          room.autoBids.push({ vendor: vendorId, floorAmount: floor });
        }

        await room.save();
        socket.emit('autoBidSuccess', { floorAmount: floor });

        // Instantly evaluate to see if this new auto-bid triggers a counter!
        await evaluateAutoBids(roomId, io);
      } catch (err) {
        console.error('Error setting up auto bid:', err);
        socket.emit('bidError', { message: 'Server error setting up auto bid' });
      }
    });

    // ── Place Bid ──────────────────────────────────────────────────────────
    socket.on('placeBid', async ({ roomId, vendorId, amount }) => {
      try {
        const room = await BidRoom.findById(roomId);
        if (!room) return;

        const now = new Date();
        const startTime = new Date(room.startTime);
        const endTime = new Date(room.endTime);

        if (now < startTime || now > endTime || room.status !== 'active') {
          socket.emit('bidError', { message: 'Bidding is not currently active.' });
          return;
        }

        const totalBasePrice = room.basePrice * (room.quantity || 1);
        const currentLowest = room.currentLowestBid || totalBasePrice;
        if (amount > currentLowest - room.decrementValue) {
          socket.emit('bidError', {
            message: 'Bid must be at least Rs.' + room.decrementValue + ' lower than the current price of Rs.' + currentLowest
          });
          return;
        }

        // Save bid
        const newBid = new Bid({ room: roomId, vendor: vendorId, amount });
        await newBid.save();

        // Update room
        room.currentLowestBid = amount;
        room.winner = vendorId;

        // Soft close
        const timeRemainingMs = endTime.getTime() - now.getTime();
        const triggerWindowMs = room.settings.softCloseTriggerWindow * 60 * 1000;
        if (timeRemainingMs <= triggerWindowMs && !room.settings.softCloseExecuted) {
          const extensionMs = room.settings.softCloseMinutes * 60 * 1000;
          room.endTime = new Date(endTime.getTime() + extensionMs);
          room.settings.softCloseExecuted = true;
          room.extensions.push({ minutes: room.settings.softCloseMinutes, reason: 'Late Bid Soft Close' });
          console.log('Soft close triggered for room ' + roomId);
          io.to(roomId).emit('timeExtended', {
            newEndTime: room.endTime,
            message: 'Auction time extended due to a late bid!',
            extendedBy: room.settings.softCloseMinutes
          });
        }

        await room.save();

        // Fetch vendor details for admin broadcast
        const vendor = await Vendor.findById(vendorId).select('companyName email');

        // To vendors: anonymous price only
        // To admin: full details
        const sockets = await io.in(roomId).fetchSockets();
        for (const s of sockets) {
          if (adminSockets.get(s.id) === roomId) {
            // Admin socket
            s.emit('adminNewBid', {
              _id: newBid._id,
              vendor: vendor ? { _id: vendor._id, companyName: vendor.companyName, email: vendor.email } : { companyName: 'Unknown' },
              amount,
              createdAt: newBid.createdAt
            });
          } else {
            // Vendor socket
            s.emit('newLowestBid', { amount });
          }
        }

        // Now trigger auto-bid evaluation!
        await evaluateAutoBids(roomId, io);

      } catch (err) {
        console.error('Error placing bid:', err);
        socket.emit('bidError', { message: 'Server error placing bid' });
      }
    });

    // ── Admin: Manual Time Extension ───────────────────────────────────────
    socket.on('adminManualExtend', async ({ roomId, minutes }) => {
      try {
        const room = await BidRoom.findById(roomId);
        if (!room || room.status !== 'active') return;
        const addMs = Number(minutes) * 60 * 1000;
        room.endTime = new Date(new Date(room.endTime).getTime() + addMs);
        room.settings.softCloseExecuted = false; // reset so soft-close can fire again if needed
        room.extensions.push({ minutes, reason: 'Manual Admin Extension' });
        await room.save();
        const message = 'The administrator has extended the auction by ' + minutes + ' minute' + (minutes > 1 ? 's' : '') + '. New end time: ' + new Date(room.endTime).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
        io.to(roomId).emit('timeExtended', { newEndTime: room.endTime, message, extendedBy: minutes });
        console.log('Admin extended room ' + roomId + ' by ' + minutes + ' minutes');
      } catch (err) { console.error('adminManualExtend error:', err); }
    });

    // ── Admin: Broadcast Message ───────────────────────────────────────────
    socket.on('adminBroadcast', async ({ roomId, message }) => {
      try {
        const room = await BidRoom.findById(roomId);
        if (room) {
          room.broadcasts.push({ message });
          await room.save();
        }
      } catch (err) { console.error('adminBroadcast save error:', err); }
      io.to(roomId).emit('broadcastReceived', { message });
      console.log(`Admin broadcasted to room ${roomId}: ${message}`);
    });

    // ── Admin: Manual End Auction ──────────────────────────────────────────
    socket.on('adminEndAuction', async ({ roomId }) => {
      try {
        const room = await BidRoom.findById(roomId);
        if (!room) return;
        room.status = 'completed';
        room.endTime = new Date();
        await room.save();
        io.to(roomId).emit('auctionEnded', { message: 'Auction has been closed by the admin.' });
        console.log('Admin manually ended room ' + roomId);
      } catch (err) { console.error('adminEndAuction error:', err); }
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected: ' + socket.id);
      
      const roomId = socket.data?.roomId;

      if (adminSockets.has(socket.id)) {
        adminSockets.delete(socket.id);
      }
      for (const [rId, sockets] of roomParticipants.entries()) {
        if (sockets.has(socket.id)) {
          sockets.delete(socket.id);
          const newCount = sockets.size;
          
          const presentVendors = new Set();
          const roomSockets = io.sockets.adapter.rooms.get(rId);
          if (roomSockets) {
            for (const sId of roomSockets) {
              const s = io.sockets.sockets.get(sId);
              if (s && s.data && s.data.vendorId) {
                presentVendors.add(s.data.vendorId);
              }
            }
          }
          const presentVendorsArray = Array.from(presentVendors);

          for (const [aId, aRoom] of adminSockets.entries()) {
            if (aRoom === rId) io.to(aId).emit('participantUpdate', { count: newCount, presentVendors: presentVendorsArray });
          }
        }
      }
    });
  });
};
