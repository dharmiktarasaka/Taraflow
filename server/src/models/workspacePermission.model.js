import mongoose from 'mongoose';

const workspacePermissionSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      default: null, // Null indicates a global system role permission mapping
      index: true,
    },
    roleName: {
      type: String,
      required: true,
    },
    permissions: [
      {
        type: String,
      },
    ],
  },
  {
    timestamps: true,
  }
);

workspacePermissionSchema.index({ workspaceId: 1, roleName: 1 }, { unique: true });

const WorkspacePermission = mongoose.model('WorkspacePermission', workspacePermissionSchema);
export default WorkspacePermission;
