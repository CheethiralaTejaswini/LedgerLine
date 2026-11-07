const mongoose = require('mongoose');

const TEST_MONGO_URL = process.env.TEST_MONGO_URL || 'mongodb://127.0.0.1:27017/ledgerline_test';

async function setupTestDB() {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(TEST_MONGO_URL, {
      autoIndex: true
    });
  }
}

async function clearTestDB() {
  if (mongoose.connection.readyState !== 0) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  }
}

async function teardownTestDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
}

module.exports = {
  setupTestDB,
  clearTestDB,
  teardownTestDB
};

