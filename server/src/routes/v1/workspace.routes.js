import { Router } from 'express';
import { workspaceControllerInstance } from '../../controllers/workspace.controller.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { requireWorkspaceMember } from '../../middlewares/workspace.middleware.js';

const router = Router();

// Public routes for accepting invitations
router.get('/invite/:token', workspaceControllerInstance.getInvitationDetails);
router.post('/invite/:token/accept', workspaceControllerInstance.acceptInvitation);

// Authenticated workspace routes
router.post('/', requireAuth, workspaceControllerInstance.createWorkspace);
router.get('/', requireAuth, workspaceControllerInstance.getWorkspaces);

// Workspace membership routes (Require active workspace membership)
router.get('/:workspaceId/members', requireAuth, requireWorkspaceMember(), workspaceControllerInstance.getWorkspaceMembers);
router.post('/:workspaceId/invite', requireAuth, requireWorkspaceMember('Manage Members'), workspaceControllerInstance.inviteMember);
router.post('/:workspaceId/invite/resend', requireAuth, requireWorkspaceMember('Manage Members'), workspaceControllerInstance.resendInvitation);
router.delete('/:workspaceId/members/:memberId', requireAuth, requireWorkspaceMember('Manage Members'), workspaceControllerInstance.removeMember);
router.put('/:workspaceId/members/:memberId/role', requireAuth, requireWorkspaceMember('Manage Members'), workspaceControllerInstance.changeRole);
router.put('/:workspaceId/members/:memberId/permissions', requireAuth, requireWorkspaceMember('Manage Members'), workspaceControllerInstance.updateCustomPermissions);
router.put('/:workspaceId/members/:memberId/suspend', requireAuth, requireWorkspaceMember('Manage Members'), workspaceControllerInstance.suspendMember);

// Settings, Audit Logs & Session Management routes
router.put('/:workspaceId/settings', requireAuth, requireWorkspaceMember('Workspace Settings'), workspaceControllerInstance.updateSettings);
router.get('/:workspaceId/audit-logs', requireAuth, requireWorkspaceMember('Workspace Settings'), workspaceControllerInstance.getAuditLogs);
router.get('/:workspaceId/sessions/:userId', requireAuth, requireWorkspaceMember(), (req, res, next) => {
  // Allow user to get their own sessions, or Admin/Owner with Workspace Settings permission to view others
  if (req.user.id.toString() !== req.params.userId && !req.workspacePermissions.includes('Workspace Settings')) {
    return res.status(430).json({ success: false, message: 'Forbidden' });
  }
  next();
}, workspaceControllerInstance.getSessions);

router.post('/:workspaceId/sessions/:userId/revoke', requireAuth, requireWorkspaceMember(), (req, res, next) => {
  // Allow user to revoke their own sessions, or Admin/Owner with Workspace Settings permission to revoke others
  if (req.user.id.toString() !== req.params.userId && !req.workspacePermissions.includes('Workspace Settings')) {
    return res.status(430).json({ success: false, message: 'Forbidden' });
  }
  next();
}, workspaceControllerInstance.revokeSession);

export default router;
