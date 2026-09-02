const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  imageUrl: {
    type: String
  },
  documents: [{
    name: String,
    url: String, // Cloudinary or S3 URL
    type: String // e.g., 'pdf', 'doc'
  }],
  billingParameters: {
    paymentTerms: String,
    deliveryTerms: String,
    warranty: String,
    other: String
  }
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);
