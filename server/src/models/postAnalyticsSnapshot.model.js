import mongoose from 'mongoose';

const postAnalyticsSnapshotSchema = new mongoose.Schema(
  {
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
      index: true
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    },
    likes: { type: Number, default: 0 },
    comments: { type: Number, default: 0 },
    shares: { type: Number, default: 0 },
    impressions: { type: Number, default: 0 },
    reach: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    saves: { type: Number, default: 0 },
    videoViews: { type: Number, default: 0 }
  },
  {
    timestamps: true
  }
);

// Create compound index for sorting historical snapshots for a specific post
postAnalyticsSnapshotSchema.index({ postId: 1, timestamp: -1 });

const PostAnalyticsSnapshot = mongoose.model('PostAnalyticsSnapshot', postAnalyticsSnapshotSchema);
export default PostAnalyticsSnapshot;
