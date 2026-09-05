
const mongoose = require('mongoose');

const bidRoomSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  basePrice: { type: Number, required: true },
  decrementValue: { type: Number, required: true },
  quantity: { type: Number, required: true, default: 1 },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  status: { type: String, enum: ['scheduled','active','completed'], default: 'scheduled' },
  invitedVendors: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' }],
  vendorAccessCodes: [{
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
    hashedPassword: { type: String },
    plainPassword: { type: String }
  }],
  settings: {
    softCloseMinutes: { type: Number, default: 3 },
    softCloseTriggerWindow: { type: Number, default: 3 },
    reservePrice: { type: Number },
    softCloseExecuted: { type: Boolean, default: false }
  },
  currentLowestBid: { type: Number },
  autoBids: [{
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
    floorAmount: { type: Number }
  }],
  winner: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
  reminderSent: { type: Boolean, default: false },
  endEmailSent: { type: Boolean, default: false },
  broadcasts: [{
    message: String,
    createdAt: { type: Date, default: Date.now }
  }],
  extensions: [{
    minutes: Number,
    reason: { type: String, default: 'Manual' },
    createdAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

module.exports = mongoose.model('BidRoom', bidRoomSchema);
