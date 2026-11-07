const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    transactionReference: {
      type: String,
      required: [true, 'Transaction reference is required'],
      unique: true,
      index: true,
      trim: true
    },
    type: {
      type: String,
      enum: {
        values: ['DEPOSIT', 'WITHDRAWAL', 'TRANSFER'],
        message: '{VALUE} is not a valid transaction type'
      },
      required: [true, 'Transaction type is required'],
      index: true
    },
    status: {
      type: String,
      enum: {
        values: ['PENDING', 'SUCCESS', 'FAILED', 'REJECTED'],
        message: '{VALUE} is not a valid transaction status'
      },
      default: 'PENDING',
      index: true
    },
    sourceAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      default: null,
      index: true
    },
    destinationAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      default: null,
      index: true
    },
    sourceAccountNumber: {
      type: String,
      default: null,
      trim: true
    },
    destinationAccountNumber: {
      type: String,
      default: null,
      trim: true
    },
    amount: {
      type: Number,
      required: [true, 'Transaction amount is required'],
      min: [1, 'Amount must be at least 1 paise'],
      validate: {
        validator: Number.isInteger,
        message: 'Amount must be an integer in paise'
      }
    },
    currency: {
      type: String,
      default: 'INR',
      uppercase: true
    },
    idempotencyKey: {
      type: String,
      index: true,
      trim: true
    },
    initiatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Initiating user is required'],
      index: true
    },
    description: {
      type: String,
      maxlength: [255, 'Description cannot exceed 255 characters'],
      default: ''
    },
    failureReason: {
      type: String,
      default: null
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

transactionSchema.index({ createdAt: -1 });
transactionSchema.index({ sourceAccount: 1, destinationAccount: 1, createdAt: -1 });

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;

