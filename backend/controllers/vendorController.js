
const Vendor = require('../models/Vendor');
const BidRoom = require('../models/BidRoom');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const generateToken = (payload) => jwt.sign(payload, process.env.JWT_SECRET || 'secret', { expiresIn: '12h' });

// Vendor login via auction credentials only
exports.loginVendor = async (req, res) => {
  const { email, password } = req.body;
  try {
    const vendor = await Vendor.findOne({ email });
    if (!vendor) return res.status(401).json({ message: 'Invalid email or password.' });

    // Find all rooms where this vendor has an access code
    const rooms = await BidRoom.find({ invitedVendors: vendor._id }).populate('product');
    if (!rooms.length) return res.status(401).json({ message: 'No auctions found for these credentials.' });

    // Check which room's access code matches the given password
    let matchedRoom = null;
    let matchedCode = null;
    for (const room of rooms) {
      for (const code of room.vendorAccessCodes) {
        if (code.vendor.toString() === vendor._id.toString()) {
          const match = await bcrypt.compare(password, code.hashedPassword);
          if (match) { matchedRoom = room; matchedCode = code; break; }
        }
      }
      if (matchedRoom) break;
    }

    if (!matchedRoom) return res.status(401).json({ message: 'Invalid email or password.' });

    // Time gate: only allow login within 5 minutes before start or after start (but not after end)
    const now = new Date();
    const start = new Date(matchedRoom.startTime);
    const end = new Date(matchedRoom.endTime);
    const minutesToStart = (start - now) / 60000;

    if (now > end) {
      return res.status(403).json({ message: 'This auction has already ended.' });
    }
    if (minutesToStart > 5) {
      return res.status(403).json({
        message: 'The auction has not started yet. You may login within 5 minutes of the start time.',
        minutesToStart: Math.ceil(minutesToStart),
        startTime: matchedRoom.startTime
      });
    }

    const token = generateToken({ vendorId: vendor._id, roomId: matchedRoom._id, role: 'vendor' });

    res.json({
      token,
      vendor: { _id: vendor._id, companyName: vendor.companyName, email: vendor.email, contactPerson: vendor.contactPerson },
      room: {
        _id: matchedRoom._id,
        product: matchedRoom.product,
        basePrice: matchedRoom.basePrice,
        decrementValue: matchedRoom.decrementValue,
        startTime: matchedRoom.startTime,
        endTime: matchedRoom.endTime,
        status: matchedRoom.status
      },
      waitingRoom: minutesToStart > 0 && minutesToStart <= 5
    });
  } catch (error) {
    console.error('loginVendor error:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.getRoomDetails = async (req, res) => {
  try {
    const room = await BidRoom.findById(req.params.id).populate('product');
    if (!room) return res.status(404).json({ message: 'Room not found' });
    res.json({
      _id: room._id, product: room.product, basePrice: room.basePrice,
      decrementValue: room.decrementValue, startTime: room.startTime,
      endTime: room.endTime, status: room.status, currentLowestBid: room.currentLowestBid || room.basePrice
    });
  } catch (error) { res.status(500).json({ message: error.message }); }
};

exports.getVendorDashboard = async (req, res) => {
  try {
    const { vendorId } = req.query;
    if (!vendorId) return res.status(400).json({ message: 'Vendor ID is required' });
    const rooms = await BidRoom.find({ invitedVendors: vendorId }).populate('product', 'name').sort({ startTime: 1 });
    res.json(rooms);
  } catch (error) { res.status(500).json({ message: error.message }); }
};

// Legacy — kept for compatibility
exports.registerVendor = async (req, res) => {
  res.status(400).json({ message: 'Vendor registration is managed by the admin. Please contact your procurement team.' });
};
