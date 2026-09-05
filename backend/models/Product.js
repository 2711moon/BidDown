const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  imageUrl: {
    type: String
  },
  documents: [{
    name: String,
    url: String,
    fileType: String
  }],
  billingParameters: {
    paymentTerms: String,
    deliveryTerms: String,
    warranty: String,
    other: String
  }
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);
