import mongoose from 'mongoose';

const socialAccountSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    platform: {
      type: String,
      enum: ['facebook', 'instagram', 'threads', 'linkedin', 'google_business', 'pinterest'],
      required: true,
    },
    platformAccountId: {
      type: String,
      required: true,
    },
    platformUsername: {
      type: String,
      required: true,
    },
    profilePicture: {
      type: String,
    },
    accessToken: {
      type: String, // Encrypted (AES-256-CBC)
      required: true,
    },
    refreshToken: {
      type: String, // Encrypted (AES-256-CBC)
    },
    expiresAt: {
      type: Date,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate connections of the same platform account for a single user
socialAccountSchema.index({ user: 1, platform: 1, platformAccountId: 1 }, { unique: true });

const SocialAccount = mongoose.model('SocialAccount', socialAccountSchema);
export default SocialAccount;
