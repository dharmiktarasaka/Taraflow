import mongoose from 'mongoose';

const postSchema = new mongoose.Schema(
  {
    content: {
      type: String,
      required: true,
    },
    media: [
      {
        url: { type: String },
        type: { type: String, enum: ['image', 'video'], default: 'image' },
      },
    ],
    status: {
      type: String,
      enum: ['DRAFT', 'SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'FAILED'],
      default: 'DRAFT',
      index: true,
    },
    platform: {
      type: String,
      enum: ['facebook', 'instagram', 'threads', 'linkedin'],
      required: true,
      index: true,
    },
    scheduledAt: { type: Date, index: true },
    publishedAt: { type: Date },
    publishError: { type: String },
    platformPostId: { type: String },
    likes: { type: Number, default: 0 },
    comments: { type: Number, default: 0 },
    shares: { type: Number, default: 0 },
    impressions: { type: Number },
    reach: { type: Number },
    clicks: { type: Number },
    saves: { type: Number },
    videoViews: { type: Number },
    profileVisits: { type: Number },
    engagementRate: { type: Number },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

const Post = mongoose.model('Post', postSchema);
export default Post;
