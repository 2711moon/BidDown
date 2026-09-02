const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const vendorSchema = new mongoose.Schema({
  companyName: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  phone: {
    type: String,
    required: true
  },
  contactPerson: {
    type: String,
    required: true
  },
  password: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  documents: [{
    name: String,
    url: String,
    type: { type: String, default: 'file' }
  }]
}, { timestamps: true });

vendorSchema.pre('save', async function() {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

vendorSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('Vendor', vendorSchema);
