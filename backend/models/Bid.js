const mongoose = require('mongoose');

const bidSchema = new mongoose.Schema({
  room: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BidRoom',
    required: true
  },
  vendor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  isAutoBid: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

module.exports = mongoose.model('Bid', bidSchema);
