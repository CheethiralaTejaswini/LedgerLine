const mongoose = require('mongoose');

const idempotencyRecordSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: [true, 'Idempotency key is required'],
      unique: true,
      index: true,
      trim: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true
    },
    endpoint: {
      type: String,
      required: true
    },
    requestHash: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['PENDING', 'COMPLETED', 'FAILED'],
      default: 'PENDING',
      index: true
    },
    responseCode: {
      type: Number,
      default: null
    },
    responseBody: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    transactionReference: {
      type: String,
      default: null
    },
    lockedAt: {
      type: Date,
      default: Date.now
    },
    completedAt: {
      type: Date,
      default: null
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours TTL
      index: { expires: 0 } // MongoDB TTL index to auto-expire
    }
  },
  {
    timestamps: true
  }
);

idempotencyRecordSchema.index({ key: 1, userId: 1 });

const IdempotencyRecord = mongoose.model('IdempotencyRecord', idempotencyRecordSchema);

module.exports = IdempotencyRecord;

