import mongoose from 'mongoose';
import Workspace from '../models/workspace.model.js';
import WorkspaceMember from '../models/workspaceMember.model.js';
import WorkspaceAuditLog from '../models/workspaceAuditLog.model.js';
import User from '../models/user.model.js';
import { ForbiddenError, NotFoundError, UnauthorizedError } from '../utils/errors.util.js';
import logger from '../utils/logger.util.js';

// Default role permission matrices
export const defaultRolePermissions = {
  Owner: {
    contentStudio: true,
    aiWriter: true,
    imageGenerator: true,
    contentCalendar: true,
    postScheduling: true,
    connectedAccounts: true,
    analytics: true,
    competitorAI: true,
    reports: true,
    seo: true,
    googleBusiness: true,
    reviewManagement: true,
    emailAutomation: true,
    whatsappAutomation: true,
    workspace: true,
    team: true,
    billing: true,
    subscription: true,
    settings: true,
    apiKeys: true,
    integrations: true,
    developerTools: true,
    adminDashboard: true,
    transferOwnership: true,
    deleteWorkspace: true,
    billingOwner: true,
    approvals: true,
    mediaLibrary: true,
    readOnly: false
  },
  Admin: {
    contentStudio: true,
    aiWriter: true,
    imageGenerator: true,
    contentCalendar: true,
    postScheduling: true,
    connectedAccounts: true,
    analytics: true,
    competitorAI: true,
    reports: true,
    seo: true,
    googleBusiness: true,
    reviewManagement: true,
    emailAutomation: true,
    whatsappAutomation: true,
    workspace: true,
    team: true,
    billing: true,
    subscription: true,
    settings: true,
    apiKeys: true,
    integrations: true,
    developerTools: true,
    adminDashboard: true,
    transferOwnership: false,
    deleteWorkspace: false,
    billingOwner: false,
    approvals: true,
    mediaLibrary: true,
    readOnly: false
  },
  Manager: {
    contentStudio: true,
    aiWriter: false,
    imageGenerator: false,
    contentCalendar: false,
    postScheduling: false,
    connectedAccounts: false,
    analytics: true,
    competitorAI: true,
    reports: true,
    seo: false,
    googleBusiness: false,
    reviewManagement: false,
    emailAutomation: false,
    whatsappAutomation: false,
    workspace: false,
    team: false,
    billing: false,
    subscription: false,
    settings: false,
    apiKeys: false,
    integrations: false,
    developerTools: false,
    adminDashboard: true,
    transferOwnership: false,
    deleteWorkspace: false,
    billingOwner: false,
    approvals: true,
    mediaLibrary: false,
    readOnly: false
  },
  'Content Creator': {
    contentStudio: true,
    aiWriter: true,
    imageGenerator: true,
    contentCalendar: false,
    postScheduling: true,
    connectedAccounts: false,
    analytics: false,
    competitorAI: false,
    reports: false,
    seo: false,
    googleBusiness: false,
    reviewManagement: false,
    emailAutomation: false,
    whatsappAutomation: false,
    workspace: false,
    team: false,
    billing: false,
    subscription: false,
    settings: false,
    apiKeys: false,
    integrations: false,
    developerTools: false,
    adminDashboard: true,
    transferOwnership: false,
    deleteWorkspace: false,
    billingOwner: false,
    approvals: false,
    mediaLibrary: true,
    readOnly: false
  },
  Analyst: {
    contentStudio: false,
    aiWriter: false,
    imageGenerator: false,
    contentCalendar: false,
    postScheduling: false,
    connectedAccounts: false,
    analytics: true,
    competitorAI: true,
    reports: true,
    seo: false,
    googleBusiness: false,
    reviewManagement: false,
    emailAutomation: false,
    whatsappAutomation: false,
    workspace: false,
    team: false,
    billing: false,
    subscription: false,
    settings: false,
    apiKeys: false,
    integrations: false,
    developerTools: false,
    adminDashboard: true,
    transferOwnership: false,
    deleteWorkspace: false,
    billingOwner: false,
    approvals: false,
    mediaLibrary: false,
    readOnly: false
  },
  Viewer: {
    contentStudio: false,
    aiWriter: false,
    imageGenerator: false,
    contentCalendar: false,
    postScheduling: false,
    connectedAccounts: false,
    analytics: true,
    competitorAI: false,
    reports: true,
    seo: false,
    googleBusiness: false,
    reviewManagement: false,
    emailAutomation: false,
    whatsappAutomation: false,
    workspace: false,
    team: false,
    billing: false,
    subscription: false,
    settings: false,
    apiKeys: false,
    integrations: false,
    developerTools: false,
    adminDashboard: true,
    transferOwnership: false,
    deleteWorkspace: false,
    billingOwner: false,
    approvals: false,
    mediaLibrary: false,
    readOnly: true
  }
};

// Legacy string to new key-based permission mapping
export const permissionMap = {
  'Manage Members': 'team',
  'Connect Social Accounts': 'connectedAccounts',
  'Disconnect Accounts': 'connectedAccounts',
  'Create Posts': 'contentStudio',
  'Delete Posts': 'contentStudio',
  'Approve AI': 'approvals',
  'Generate AI Reports': 'reports',
  'Competitor Analysis': 'competitorAI',
  'Billing': 'billing',
  'Workspace Settings': 'settings',
  'AI Credits': 'billing',
  'Export Reports': 'reports',
  'Analytics': 'analytics',
  'GMB': 'googleBusiness',
  'SEO': 'seo',
  'Email Automation': 'emailAutomation',
  'WhatsApp Automation': 'whatsappAutomation',
  'Review Management': 'reviewManagement'
};

// Helper to log audit events within middleware without circular dependencies
const logWorkspaceAction = async (workspaceId, actorId, action, details, req = null) => {
  try {
    const user = await User.findById(actorId);
    const ip = req ? (req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '') : '';
    const ua = req ? (req.headers['user-agent'] || '') : '';
    
    await WorkspaceAuditLog.create({
      workspaceId,
      actorId,
      actorEmail: user ? user.email : 'system@taraflow.ai',
      action,
      details,
      ipAddress: ip,
      userAgent: ua
    });
  } catch (err) {
    logger.error(`[WorkspaceMiddleware] Failed to write audit log: ${err.message}`);
  }
};

/**
 * Middleware to check if the authenticated user is a valid member of the requested workspace
 * and possesses a specific permission.
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
        // Log unauthorized access attempt
        await logWorkspaceAction(workspaceId, req.user.id, 'Unauthorized Attempt', `Access denied: User is not a member of the workspace.`, req);
        throw new ForbiddenError('You are not a member of this workspace');
      }

      if (member.status === 'suspended') {
        // Log unauthorized suspended access attempt
        await logWorkspaceAction(workspaceId, req.user.id, 'Unauthorized Attempt', `Access denied: User membership is suspended.`, req);
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

      // Calculate permissions: Owner role has everything, otherwise load defaults + overrides
      let permissions = {};
      if (member.role === 'Owner') {
        permissions = { ...defaultRolePermissions['Owner'] };
      } else {
        const defaults = { ...(defaultRolePermissions[member.role] || defaultRolePermissions['Viewer']) };
        const savedPerms = member.permissions instanceof Map ? Object.fromEntries(member.permissions) : (member.permissions || {});
        permissions = { ...defaults, ...savedPerms };
      }

      // Check required permission
      if (requiredPermission && member.role !== 'Owner') {
        const key = permissionMap[requiredPermission] || requiredPermission;
        if (permissions[key] !== true) {
          // Log access denied event
          await logWorkspaceAction(workspaceId, req.user.id, 'Access Denied', `Access denied: requires "${requiredPermission}" (mapped to key "${key}").`, req);
          throw new ForbiddenError(`Permission denied: requires "${requiredPermission}"`);
        }
      }

      // Attach context to request object
      req.workspace = workspace;
      req.workspace.ownerId = workspace.owner;
      req.workspaceMember = member;
      req.workspaceRole = member.role;
      req.workspacePermissions = permissions;

      next();
    } catch (err) {
      next(err);
    }
  };
};
