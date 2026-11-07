const mongoose = require('mongoose');
const passportLocalMongoose = require('passport-local-mongoose');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      lowercase: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [30, 'Username cannot exceed 30 characters']
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      maxlength: [100, 'Full name cannot exceed 100 characters']
    },
    phone: {
      type: String,
      trim: true,
      default: ''
    },
    role: {
      type: String,
      enum: {
        values: ['ADMIN', 'ACCOUNT_HOLDER', 'AUDITOR'],
        message: '{VALUE} is not a valid role'
      },
      default: 'ACCOUNT_HOLDER',
      required: true
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'SUSPENDED'],
      default: 'ACTIVE'
    },
    lastLoginAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

// Indexes
userSchema.index({ role: 1 });

// Integrate Passport-Local-Mongoose for secure password hashing and authentication
userSchema.plugin(passportLocalMongoose, {
  usernameField: 'username',
  attemptsField: 'failedLoginAttempts',
  maxAttempts: 5,
  errorMessages: {
    UserExistsError: 'A user with the given username is already registered'
  }
});

const User = mongoose.model('User', userSchema);

module.exports = User;
