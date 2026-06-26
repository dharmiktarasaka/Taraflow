import mongoose from 'mongoose';

const workspaceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    logoUrl: {
      type: String,
      default: '',
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    billingOwner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    connectedSocialAccounts: [
      {
        type: String,
      },
    ],
    aiCredits: {
      type: Number,
      default: 1000,
    },
    storageUsedBytes: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const Workspace = mongoose.model('Workspace', workspaceSchema);
export default Workspace;
