const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/kisna-inventory')
  .then(async () => {
    const BidRoom = require('./models/BidRoom');
    await BidRoom.updateMany({}, { $set: { broadcasts: [] } });
    console.log('Cleared all broadcast history from all rooms to reset state.');
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
