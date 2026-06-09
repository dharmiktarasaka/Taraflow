import mongoose from 'mongoose';

const analyticsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    platform: {
      type: String,
      enum: ['facebook', 'instagram', 'threads', 'linkedin', 'all'],
      default: 'all',
      index: true,
    },
    followers: { type: Number, default: 0 },
    impressions: { type: Number, default: 0 },
    reach: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    comments: { type: Number, default: 0 },
    shares: { type: Number, default: 0 },
    engagementRate: { type: Number, default: 0 }
  },
  {
    timestamps: true,
  }
);

// Create compound unique index to prevent duplicate records per day per platform per user
analyticsSchema.index({ userId: 1, date: 1, platform: 1 }, { unique: true });

const Analytics = mongoose.model('Analytics', analyticsSchema);
export default Analytics;
