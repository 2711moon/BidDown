require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('./models/Admin');

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    const adminCount = await Admin.countDocuments();
    if (adminCount === 0) {
      await Admin.create({
        username: 'admin@biddown.com',
        password: '12345'
      });
      console.log('Admin user created successfully: admin@biddown.com / 12345');
    } else {
      console.log('Admin user already exists.');
    }
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
