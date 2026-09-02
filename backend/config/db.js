const mongoose = require('mongoose');

const { MongoMemoryServer } = require('mongodb-memory-server');

const connectDB = async () => {
  try {
    let uri = process.env.MONGO_URI;
    
    if (process.env.USE_IN_MEMORY_DB === 'true') {
      console.log('Starting in-memory MongoDB server for local testing...');
      const mongoServer = await MongoMemoryServer.create();
      uri = mongoServer.getUri();
    }

    const conn = await mongoose.connect(uri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
