import mongoose from 'mongoose';

const workspaceInvitationSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    inviterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    inviteeEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['Owner', 'Admin', 'Manager', 'Content Creator', 'Analyst', 'Viewer', 'Custom Role'],
      required: true,
    },
    permissionSet: [
      {
        type: String,
      },
    ],
    invitationTokenHash: {
      type: String,
      required: true,
      index: true,
    },
    otpHash: {
      type: String,
      required: true,
    },
    otpAttempts: {
      type: Number,
      default: 0,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'expired', 'invalidated', 'failed_locked'],
      default: 'pending',
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to prevent multiple concurrent pending invites to the same email in the same workspace
workspaceInvitationSchema.index({ workspaceId: 1, inviteeEmail: 1, status: 1 });

const WorkspaceInvitation = mongoose.model('WorkspaceInvitation', workspaceInvitationSchema);
export default WorkspaceInvitation;
