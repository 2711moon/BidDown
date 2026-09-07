const mongoose = require('mongoose');

const bidSchema = new mongoose.Schema({
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'BidRoom', required: true },
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
  amount: { type: Number, required: true }, // Grand Total bid
  // Line-item breakdown — one entry per item in the basket
  itemBids: [{
    itemId: { type: mongoose.Schema.Types.ObjectId },
    itemName: { type: String },
    amount: { type: Number }
  }],
  isAutoBid: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Bid', bidSchema);
