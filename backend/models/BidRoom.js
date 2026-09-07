
const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  imageUrl: { type: String, default: '' },
  documents: [{ name: String, url: String, fileType: String }],
  basePrice: { type: Number, required: true },
  quantity: { type: Number, required: true, default: 1 },
  decrementValue: { type: Number, required: true },
  itemTotalValue: { type: Number }
}, { _id: true });

const bidRoomSchema = new mongoose.Schema({
  // ── Multi-item support ──────────────────────────────────────────────────
  items: [itemSchema],
  grandTotalContractValue: { type: Number },

  // ── Legacy single-item fields (kept for backward compat) ───────────────
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  basePrice: { type: Number },
  decrementValue: { type: Number },
  quantity: { type: Number, default: 1 },

  // ── Common fields ───────────────────────────────────────────────────────
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
  // itemLowestBids tracks per-item current lowest: [{ itemId, amount }]
  itemLowestBids: [{ itemId: mongoose.Schema.Types.ObjectId, amount: Number }],
  autoBids: [{ vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' }, floorAmount: { type: Number } }],
  winner: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
  reminderSent: { type: Boolean, default: false },
  endEmailSent: { type: Boolean, default: false },
  broadcasts: [{ message: String, createdAt: { type: Date, default: Date.now } }],
  extensions: [{ minutes: Number, reason: { type: String, default: 'Manual' }, createdAt: { type: Date, default: Date.now } }]
}, { timestamps: true });

module.exports = mongoose.model('BidRoom', bidRoomSchema);
