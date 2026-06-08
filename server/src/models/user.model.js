import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      // Optional for Google OAuth users, required for email signups
      required: function () {
        return !this.googleId;
      },
    },
    role: {
      type: String,
      enum: ['SUPER_ADMIN', 'USER'],
      default: 'USER',
    },
    avatarUrl: {
      type: String,
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationToken: {
      type: String,
      select: false,
    },
    verificationTokenExpiresAt: {
      type: Date,
      select: false,
    },
    resetPasswordToken: {
      type: String,
      select: false,
    },
    resetPasswordExpiresAt: {
      type: Date,
      select: false,
    },
    loginAttempts: {
      type: Number,
      default: 0,
      required: true,
    },
    lockUntil: {
      type: Date,
    },
    refreshTokens: [
      {
        tokenHash: { type: String, required: true },
        expiresAt: { type: Date, required: true },
      },
    ],
    subscription: {
      plan: { 
        type: String, 
        enum: ['free', 'starter', 'professional', 'agency'], 
        default: 'free' 
      },
      status: { 
        type: String, 
        enum: ['active', 'trialing', 'past_due', 'canceled', 'unpaid', 'none'], 
        default: 'none' 
      },
      gateway: { 
        type: String, 
        enum: ['stripe', 'razorpay', 'none'], 
        default: 'none' 
      },
      customerId: { type: String },
      subscriptionId: { type: String },
      currentPeriodEnd: { type: Date }
    },
    isActive: {
      type: Boolean,
      default: true
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save middleware to hash password
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Compare passwords
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

// Check if account is locked
userSchema.methods.isLocked = function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

const User = mongoose.model('User', userSchema);
export default User;
