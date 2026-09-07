
require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const cron = require('node-cron');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const BidRoom = require('./models/BidRoom');
const Vendor = require('./models/Vendor');
const emailService = require('./services/emailService');

connectDB();

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const io = new Server(server, { cors: { origin: '*', methods: ['GET','POST'] } });

app.get('/api/health', (req, res) => res.status(200).json({ status: 'ok', message: 'Server is awake' }));

app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/vendor', require('./routes/vendorRoutes'));

app.use((err, req, res, next) => {
  console.error('GLOBAL ERROR:', err);
  res.status(500).json({ message: err.message || 'Internal Server Error' });
});

require('./services/socketService')(io);

// ── Auto status transitions (every 10s) ─────────────────────────────────────
setInterval(async () => {
  try {
    const now = new Date();

    // Find scheduled rooms that should now be active (before updating)
    const toActivate = await BidRoom.find({ status: 'scheduled', startTime: { $lte: now } });
    for (const room of toActivate) {
      await BidRoom.findByIdAndUpdate(room._id, { status: 'active' });
      // Notify all vendors in this room to transition from waiting room to live auction
      const grandTotal = room.grandTotalContractValue || (room.basePrice * (room.quantity || 1));
      io.to(room._id.toString()).emit('auctionStarted', {
        currentLowestBid: room.currentLowestBid || grandTotal,
        grandTotalContractValue: grandTotal,
        itemLowestBids: room.itemLowestBids || [],
        endTime: room.endTime,
        status: 'active'
      });
    }

    // Mark completed and send end emails
    const toComplete = await BidRoom.find({ status: 'active', endTime: { $lte: now }, endEmailSent: { $ne: true } }).populate('product').populate('winner', 'companyName email contactPerson phone');
    for (const room of toComplete) {
      await BidRoom.findByIdAndUpdate(room._id, { status: 'completed', endEmailSent: true });
      io.to(room._id.toString()).emit('auctionEnded', { message: 'Auction has ended.' });
      
      const isMulti = room.items && room.items.length > 1;
      const productName = isMulti ? `Basket of ${room.items.length} Items` : (room.product ? room.product.name : 'Unknown Product');
      const qty = isMulti ? room.items.reduce((s, it) => s + (it.quantity || 1), 0) : room.quantity;

      for (const code of room.vendorAccessCodes) {
        const vendor = await Vendor.findById(code.vendor).select('-password');
        if (!vendor) continue;
        const isWinner = room.winner && room.winner._id.toString() === vendor._id.toString();
        emailService.sendAuctionEnded({ vendor, product: productName, quantity: qty, isWinner, winningBid: room.currentLowestBid });
      }
    }
  } catch (error) { console.error('Status update error:', error); }
}, 10000);

// ── 5-minute reminder cron (runs every minute) ───────────────────────────────
cron.schedule('* * * * *', async () => {
  try {
    const now = new Date();
    const fiveMin = new Date(now.getTime() + 5 * 60000);
    const fourMin = new Date(now.getTime() + 4 * 60000);

    // Rooms starting in 4-5 minutes that haven't had reminder sent
    const rooms = await BidRoom.find({
      status: 'scheduled',
      startTime: { $gte: fourMin, $lte: fiveMin },
      reminderSent: { $ne: true }
    }).populate('product');

    for (const room of rooms) {
      await BidRoom.findByIdAndUpdate(room._id, { reminderSent: true });
      
      const isMulti = room.items && room.items.length > 1;
      const productName = isMulti ? `Basket of ${room.items.length} Items` : (room.product ? room.product.name : 'Unknown Product');
      const loginUrl = (process.env.FRONTEND_URL || 'http://localhost:5173') + '/vendor/login';

      // Check if auction was created within 5 min of start (skip reminder if so - invite was enough)
      const createdAt = new Date(room.createdAt);
      const start = new Date(room.startTime);
      const minsFromCreateToStart = (start - createdAt) / 60000;

      if (minsFromCreateToStart <= 5) continue; // only one email was needed

      for (const code of room.vendorAccessCodes) {
        const vendor = await Vendor.findById(code.vendor).select('-password');
        if (!vendor) continue;
        emailService.sendAuctionReminder({ vendor, room, product: productName, accessPassword: code.plainPassword, loginUrl });
      }
    }
  } catch (err) { console.error('Reminder cron error:', err); }
});

// ── Verify email on startup ──────────────────────────────────────────────────
emailService.verifyConnection();

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log('Server running on port ' + PORT));

module.exports = { app, server, io };
