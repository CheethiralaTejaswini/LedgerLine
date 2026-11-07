const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema(
  {
    accountNumber: {
      type: String,
      required: [true, 'Account number is required'],
      unique: true,
      index: true,
      trim: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Account holder reference is required'],
      index: true
    },
    accountType: {
      type: String,
      enum: {
        values: ['SAVINGS', 'CURRENT', 'BUSINESS'],
        message: '{VALUE} is not a valid account type'
      },
      default: 'SAVINGS',
      required: true
    },
    balance: {
      type: Number,
      required: [true, 'Balance is required'],
      default: 0,
      min: [0, 'Account balance cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'Balance must be an integer representing currency in paise'
      }
    },
    currency: {
      type: String,
      default: 'INR',
      uppercase: true,
      trim: true
    },
    status: {
      type: String,
      enum: {
        values: ['ACTIVE', 'FROZEN', 'CLOSED'],
        message: '{VALUE} is not a valid account status'
      },
      default: 'ACTIVE',
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Compound index for user account lookups
accountSchema.index({ userId: 1, status: 1 });

const Account = mongoose.model('Account', accountSchema);

module.exports = Account;

