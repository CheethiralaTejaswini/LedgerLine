const mongoose = require('mongoose');

const ledgerEntrySchema = new mongoose.Schema(
  {
    entryReference: {
      type: String,
      required: [true, 'Entry reference is required'],
      unique: true,
      index: true
    },
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      required: [true, 'Transaction reference is required'],
      index: true
    },
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      required: [true, 'Account reference is required'],
      index: true
    },
    accountNumber: {
      type: String,
      required: true,
      index: true
    },
    transactionType: {
      type: String,
      enum: ['DEPOSIT', 'WITHDRAWAL', 'TRANSFER_DEBIT', 'TRANSFER_CREDIT', 'REFUSED_ATTEMPT'],
      required: true
    },
    debitAmount: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'Debit amount must be an integer in paise'
      }
    },
    creditAmount: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'Credit amount must be an integer in paise'
      }
    },
    balanceAfter: {
      type: Number,
      required: true,
      min: [0, 'Balance after transaction cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'Balance after transaction must be an integer in paise'
      }
    },
    initiatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ['POSTED', 'REFUSED', 'REJECTED'],
      default: 'POSTED',
      index: true
    },
    description: {
      type: String,
      default: ''
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: false // Ledger uses explicit immutable timestamp
  }
);

// Immutability Protection: Guard against any update or delete operation
const immutabilityError = () => {
  throw new Error('IMMUTABILITY_VIOLATION: Ledger entries are append-only. Modification or deletion is strictly forbidden.');
};

ledgerEntrySchema.pre('updateOne', immutabilityError);
ledgerEntrySchema.pre('updateMany', immutabilityError);
ledgerEntrySchema.pre('findOneAndUpdate', immutabilityError);
ledgerEntrySchema.pre('deleteOne', immutabilityError);
ledgerEntrySchema.pre('deleteMany', immutabilityError);
ledgerEntrySchema.pre('findOneAndDelete', immutabilityError);
ledgerEntrySchema.pre('findOneAndRemove', immutabilityError);

ledgerEntrySchema.pre('save', function (next) {
  if (!this.isNew) {
    return next(new Error('IMMUTABILITY_VIOLATION: Existing ledger entries cannot be re-saved or updated.'));
  }
  next();
});

// Indexes for high-performance audit & statement queries
ledgerEntrySchema.index({ accountId: 1, timestamp: -1 });
ledgerEntrySchema.index({ timestamp: -1 });

const LedgerEntry = mongoose.model('LedgerEntry', ledgerEntrySchema);

module.exports = LedgerEntry;

