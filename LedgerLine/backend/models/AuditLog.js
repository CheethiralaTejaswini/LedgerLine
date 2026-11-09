const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: [true, 'Action is required'],
      enum: [
        'LOGIN_SUCCESS',
        'LOGIN_FAILED',
        'LOGOUT',
        'USER_REGISTERED',
        'ACCOUNT_CREATED',
        'ACCOUNT_STATUS_CHANGED',
        'HIGH_VALUE_TRANSFER',
        'RECONCILIATION_RUN',
        'SECURITY_ALERT'
      ],
      index: true
    },
    severity: {
      type: String,
      enum: ['INFO', 'WARN', 'CRITICAL'],
      default: 'INFO',
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    username: {
      type: String,
      default: 'ANONYMOUS'
    },
    ipAddress: {
      type: String,
      default: 'UNKNOWN'
    },
    userAgent: {
      type: String,
      default: 'UNKNOWN'
    },
    details: {
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
    timestamps: false
  }
);

// Append-only immutability protection for compliance logs
const auditImmutabilityError = () => {
  throw new Error('AUDIT_IMMUTABILITY_VIOLATION: Security audit logs cannot be modified or deleted.');
};

auditLogSchema.pre('updateOne', auditImmutabilityError);
auditLogSchema.pre('updateMany', auditImmutabilityError);
auditLogSchema.pre('findOneAndUpdate', auditImmutabilityError);
auditLogSchema.pre('deleteOne', auditImmutabilityError);
auditLogSchema.pre('deleteMany', auditImmutabilityError);
auditLogSchema.pre('findOneAndDelete', auditImmutabilityError);
auditLogSchema.pre('findOneAndRemove', auditImmutabilityError);

auditLogSchema.pre('save', function (next) {
  if (!this.isNew) {
    return next(new Error('AUDIT_IMMUTABILITY_VIOLATION: Existing audit records cannot be re-saved.'));
  }
  next();
});

auditLogSchema.index({ timestamp: -1, severity: 1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = AuditLog;
