import mongoose from 'mongoose';

const contentIdeaSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['idea', 'approved', 'scheduled', 'published', 'rejected'],
      default: 'idea',
      index: true,
    },
    platform: {
      type: String,
      enum: ['facebook', 'instagram', 'threads', 'linkedin'],
      index: true,
    },
    contentType: {
      type: String,
      enum: ['post', 'carousel', 'video', 'story', 'reel'],
      index: true,
    },
    aiGenerated: {
      type: Boolean,
      default: false,
    },
    tags: [{ type: String }],
    scheduledFor: { type: Date },
    publishedAt: { type: Date },
    promptUsed: { type: String },
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

const ContentIdea = mongoose.model('ContentIdea', contentIdeaSchema);
export default ContentIdea;
