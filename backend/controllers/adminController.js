
require('dotenv').config();
const Admin = require('../models/Admin');
const Vendor = require('../models/Vendor');
const Product = require('../models/Product');
const BidRoom = require('../models/BidRoom');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cloudinary = require('../config/cloudinary');
const emailService = require('../services/emailService');

const generateToken = (id, role) => jwt.sign({ id, role }, process.env.JWT_SECRET || 'secret', { expiresIn: '30d' });

const genPassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let p = '';
  for (let i = 0; i < 5; i++) p += chars[Math.floor(Math.random() * chars.length)];
  return p;
};

exports.loginAdmin = async (req, res) => {
  const { username, password } = req.body;
  try {
    const admin = await Admin.findOne({ username });
    if (admin && (await admin.comparePassword(password))) {
      res.json({ _id: admin._id, username: admin.username, token: generateToken(admin._id, 'admin') });
    } else {
      res.status(401).json({ message: 'Invalid username or password' });
    }
  } catch (error) { res.status(500).json({ message: error.message }); }
};

exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Not authorized' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    const admin = await Admin.findById(decoded.id);
    if (admin && (await admin.comparePassword(currentPassword))) {
      admin.password = newPassword;
      await admin.save();
      res.json({ message: 'Password updated successfully' });
    } else {
      res.status(401).json({ message: 'Invalid current password' });
    }
  } catch (error) { res.status(500).json({ message: error.message }); }
};

exports.approveVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });
    vendor.status = 'approved';
    await vendor.save();
    res.json({ message: 'Vendor approved', vendor });
  } catch (error) { res.status(500).json({ message: error.message }); }
};

exports.getVendors = async (req, res) => {
  try {
    const vendors = await Vendor.find({}).select('-password');
    res.json(vendors);
  } catch (error) { res.status(500).json({ message: error.message }); }
};

exports.createVendor = async (req, res) => {
  try {
    const { companyName, email, phone, contactPerson, password } = req.body;
    const exists = await Vendor.findOne({ email });
    if (exists) return res.status(400).json({ message: 'Vendor with this email already exists' });

    const documents = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        documents.push({ name: file.originalname, url: file.path, type: file.mimetype });
      }
    }

    const vendor = await Vendor.create({ companyName, email, phone, contactPerson, password, documents, status: 'pending' });
    res.status(201).json({ _id: vendor._id, companyName: vendor.companyName, email: vendor.email, status: vendor.status });
  } catch (error) { res.status(500).json({ message: error.message }); }
};

exports.updateVendor = async (req, res) => {
  try {
    const { companyName, email, phone, contactPerson, password } = req.body;
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });
    
    vendor.companyName = companyName || vendor.companyName;
    vendor.email = email || vendor.email;
    vendor.phone = phone || vendor.phone;
    vendor.contactPerson = contactPerson || vendor.contactPerson;
    if (password) vendor.password = password;

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        vendor.documents.push({ name: file.originalname, url: file.path, type: file.mimetype });
      }
    }
    await vendor.save();
    res.json({ _id: vendor._id, companyName: vendor.companyName, email: vendor.email, status: vendor.status });
  } catch (error) { res.status(500).json({ message: error.message }); }
};

exports.deleteVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findByIdAndDelete(req.params.id);
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });
    res.json({ message: 'Vendor deleted successfully' });
  } catch (error) { res.status(500).json({ message: error.message }); }
};

exports.getRooms = async (req, res) => {
  try {
    const rooms = await BidRoom.find().populate('product').populate('winner', 'companyName email');
    res.json(rooms);
  } catch (error) { res.status(500).json({ message: error.message }); }
};

exports.createRoom = async (req, res) => {
  try {
    const { product, basePrice, decrementValue, quantity, startTime, endTime, vendors: vendorIds } = req.body;

    const productDoc = new (require('../models/Product'))({ name: product.name, documentUrl: product.documentUrl || '' });
    const savedProduct = await productDoc.save();

    const documents = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        documents.push({ name: file.originalname, url: file.path, type: file.mimetype });
      }
    }

    const vendorList = Array.isArray(vendorIds) ? vendorIds : (typeof vendorIds === 'string' ? JSON.parse(vendorIds) : []);

    // Generate per-vendor access codes
    const vendorAccessCodes = [];
    for (const vid of vendorList) {
      const plain = genPassword();
      const hashed = await bcrypt.hash(plain, 10);
      vendorAccessCodes.push({ vendor: vid, hashedPassword: hashed, plainPassword: plain });
    }

    const room = await BidRoom.create({
      product: savedProduct._id,
      basePrice: Number(basePrice),
      decrementValue: Number(decrementValue),
      quantity: Number(quantity) || 1,
      startTime,
      endTime,
      invitedVendors: vendorList,
      vendorAccessCodes,
      status: 'scheduled'
    });

    // Send invitation emails
    const loginUrl = (process.env.FRONTEND_URL || 'http://localhost:5173') + '/vendor/login';
    const productName = product.name;
    const now = new Date();
    const start = new Date(startTime);
    const minutesToStart = (start - now) / 60000;

    for (const code of vendorAccessCodes) {
      const vendor = await Vendor.findById(code.vendor).select('-password');
      if (!vendor) continue;
      // If creation is within 5 min of start, send only one email; otherwise send invite
      await emailService.sendAuctionInvite({ vendor, room, product: productName, accessPassword: code.plainPassword, loginUrl });
    }

    res.status(201).json(room);
  } catch (error) {
    console.error('createRoom error:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.createProduct = async (req, res) => {
  try {
    const product = new (require('../models/Product'))(req.body);
    const created = await product.save();
    res.status(201).json(created);
  } catch (error) { res.status(500).json({ message: error.message }); }
};

exports.getRoomById = async (req, res) => {
  try {
    const room = await BidRoom.findById(req.params.id)
      .populate('product')
      .populate('invitedVendors', 'companyName email phone contactPerson status')
      .populate('winner', 'companyName email');

    if (!room) return res.status(404).json({ message: 'Room not found' });

    const Bid = require('../models/Bid');
    const bids = await Bid.find({ room: req.params.id })
      .populate('vendor', 'companyName email')
      .sort({ createdAt: -1 });

    res.json({
      room,
      bids: bids.map(b => ({
        _id: b._id,
        vendor: b.vendor ? { _id: b.vendor._id, companyName: b.vendor.companyName, email: b.vendor.email } : { companyName: 'Unknown' },
        amount: b.amount,
        createdAt: b.createdAt
      }))
    });
  } catch (error) { res.status(500).json({ message: error.message }); }
};

exports.getReports = async (req, res) => {
  try {
    const completedRooms = await BidRoom.find({ status: 'completed' }).populate('product').populate('winner', 'companyName email');
    let totalSavings = 0;
    const events = completedRooms.map(room => {
      const saving = room.basePrice - (room.currentLowestBid || room.basePrice);
      totalSavings += saving;
      return {
        room: room._id,
        product: room.product ? room.product.name : 'Unknown',
        basePrice: room.basePrice,
        winningBid: room.currentLowestBid || room.basePrice,
        saving,
        winner: room.winner ? room.winner.companyName : 'No Winner',
        endTime: room.endTime,
        startTime: room.startTime
      };
    });
    res.json({ totalSavings, events });
  } catch (error) { res.status(500).json({ message: error.message }); }
};
