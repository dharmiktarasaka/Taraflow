import mongoose from 'mongoose';
import Workspace from '../models/workspace.model.js';
import WorkspaceMember from '../models/workspaceMember.model.js';
import { ForbiddenError, NotFoundError, UnauthorizedError } from '../utils/errors.util.js';

export const defaultPermissions = {
  'Owner': [
    'Manage Members', 'Connect Social Accounts', 'Disconnect Accounts', 'Create Posts', 'Delete Posts',
    'Approve AI', 'Generate AI Reports', 'Competitor Analysis', 'Billing', 'Workspace Settings',
    'AI Credits', 'Export Reports', 'Analytics', 'GMB', 'SEO', 'Email Automation', 'WhatsApp Automation',
    'Review Management'
  ],
  'Admin': [
    'Manage Members', 'Connect Social Accounts', 'Disconnect Accounts', 'Create Posts', 'Delete Posts',
    'Approve AI', 'Generate AI Reports', 'Competitor Analysis', 'Workspace Settings',
    'AI Credits', 'Export Reports', 'Analytics', 'GMB', 'SEO', 'Email Automation', 'WhatsApp Automation',
    'Review Management'
  ],
  'Manager': [
    'Connect Social Accounts', 'Create Posts', 'Approve AI', 'Generate AI Reports', 'Competitor Analysis',
    'Export Reports', 'Analytics', 'GMB', 'SEO', 'Email Automation', 'WhatsApp Automation', 'Review Management'
  ],
  'Content Creator': [
    'Create Posts', 'Approve AI', 'GMB', 'SEO', 'Review Management'
  ],
  'Analyst': [
    'Generate AI Reports', 'Competitor Analysis', 'Export Reports', 'Analytics'
  ],
  'Viewer': []
};

/**
 * Middleware to check if the authenticated user is a valid member of the requested workspace
 * and (optionally) possesses a specific permission.
 */
export const requireWorkspaceMember = (requiredPermission = null) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication is required');
      }

      const workspaceId = req.headers['x-workspace-id'] || req.query.workspaceId || req.params.workspaceId;

      if (!workspaceId) {
        throw new ForbiddenError('Workspace context is missing');
      }

      if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
        throw new ForbiddenError('Invalid workspace ID format');
      }

      // Fetch member mapping
      const member = await WorkspaceMember.findOne({
        workspaceId,
        userId: req.user.id
      });

      if (!member) {
        throw new ForbiddenError('You are not a member of this workspace');
      }

      if (member.status === 'suspended') {
        throw new ForbiddenError('Your membership in this workspace has been suspended');
      }

      // Fetch workspace status
      const workspace = await Workspace.findById(workspaceId);
      if (!workspace) {
        throw new NotFoundError('Workspace not found');
      }

      if (!workspace.isActive) {
        throw new ForbiddenError('This workspace is suspended');
      }

      // Calculate permissions: Owner role bypasses checks, otherwise check default + custom
      let permissions = [];
      if (member.role === 'Owner') {
        permissions = defaultPermissions['Owner'];
      } else {
        const defaultRolePerms = defaultPermissions[member.role] || [];
        permissions = Array.from(new Set([...defaultRolePerms, ...(member.customPermissions || [])]));
      }

      // Check required permission
      if (requiredPermission && member.role !== 'Owner') {
        if (!permissions.includes(requiredPermission)) {
          throw new ForbiddenError(`Permission denied: requires "${requiredPermission}"`);
        }
      }

      // Attach context to request object
      req.workspace = workspace;
      req.workspaceMember = member;
      req.workspaceRole = member.role;
      req.workspacePermissions = permissions;

      next();
    } catch (err) {
      next(err);
    }
  };
};
