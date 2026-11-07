const mongoose = require('mongoose');

let isReplicaSet = false;

/**
 * Connect to MongoDB with robust connection management and replica set detection.
 */
async function connectDB() {
  const mongoUrl = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/ledgerline';

  try {
    const conn = await mongoose.connect(mongoUrl, {
      autoIndex: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
    });

    console.log(`[LedgerLine DB] Connected to MongoDB: ${conn.connection.host}/${conn.connection.name}`);

    // Detect if connected cluster is a replica set (required for multi-document ACID transactions)
    try {
      const adminDb = conn.connection.db.admin();
      const status = await adminDb.command({ replSetGetStatus: 1 }).catch(() => null);
      if (status && status.ok === 1) {
        isReplicaSet = true;
        console.log(`[LedgerLine DB] Replica set detected: ${status.set}. Multi-document ACID transactions enabled.`);
      } else {
        isReplicaSet = false;
        console.log('[LedgerLine DB] Running in standalone MongoDB mode. Optimistic/pessimistic balance locks enabled.');
      }
    } catch {
      isReplicaSet = false;
    }

    return conn;
  } catch (error) {
    console.error(`[LedgerLine DB Error] MongoDB connection failed: ${error.message}`);
    throw error;
  }
}

function hasReplicaSet() {
  return isReplicaSet;
}

module.exports = {
  connectDB,
  hasReplicaSet
};

