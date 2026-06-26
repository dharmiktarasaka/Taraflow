import workspaceServiceInstance from '../services/workspace.service.js';
import { BadRequestError } from '../utils/errors.util.js';

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

export class WorkspaceController {
  async createWorkspace(req, res, next) {
    try {
      const { name, logoUrl } = req.body;
      if (!name || typeof name !== 'string' || !name.trim()) {
        throw new BadRequestError('Workspace name is required');
      }
      const userId = req.user.id;
      const workspace = await workspaceServiceInstance.createWorkspace(userId, name, logoUrl, req);
      
      res.status(201).json({
        success: true,
        message: 'Workspace created successfully',
        workspace
      });
    } catch (error) {
      next(error);
    }
  }

  async getWorkspaces(req, res, next) {
    try {
      const userId = req.user.id;
      const workspaces = await workspaceServiceInstance.getWorkspaces(userId);
      res.status(200).json({
        success: true,
        workspaces
      });
    } catch (error) {
      next(error);
    }
  }

  async getWorkspaceMembers(req, res, next) {
    try {
      const { workspaceId } = req.params;
      const members = await workspaceServiceInstance.getWorkspaceMembers(workspaceId);
      res.status(200).json({
        success: true,
        members
      });
    } catch (error) {
      next(error);
    }
  }

  async inviteMember(req, res, next) {
    try {
      const { workspaceId } = req.params;
      const { email, role, customPermissions, expirationHours } = req.body;
      const inviterId = req.user.id;

      if (!email || typeof email !== 'string') {
        throw new BadRequestError('Email address is required');
      }
      if (!role) {
        throw new BadRequestError('Assigned role is required');
      }

      const result = await workspaceServiceInstance.inviteMember(
        workspaceId,
        inviterId,
        { email, role, customPermissions, expirationHours: expirationHours ? Number(expirationHours) : 24 },
        req
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getInvitationDetails(req, res, next) {
    try {
      const { token } = req.params;
      const invite = await workspaceServiceInstance.getInvitationDetails(token);
      res.status(200).json({
        success: true,
        invitation: {
          id: invite._id,
          inviteeEmail: invite.inviteeEmail,
          role: invite.role,
          expiresAt: invite.expiresAt,
          workspaceId: invite.workspaceId?._id || invite.workspaceId,
          workspaceName: invite.workspaceId?.name,
          workspaceLogo: invite.workspaceId?.logoUrl,
          inviterName: `${invite.inviterId?.firstName} ${invite.inviterId?.lastName}`,
          inviterEmail: invite.inviterId?.email
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async acceptInvitation(req, res, next) {
    try {
      const { token } = req.params;
      const result = await workspaceServiceInstance.acceptInvitation(token, req.body, req);
      if (result.tokens) {
        res.cookie('refreshToken', result.tokens.refreshToken, cookieOptions);
      }
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async removeMember(req, res, next) {
    try {
      const { workspaceId, memberId } = req.params;
      const actorId = req.user.id;
      const result = await workspaceServiceInstance.removeMember(workspaceId, memberId, actorId, req);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async changeRole(req, res, next) {
    try {
      const { workspaceId, memberId } = req.params;
      const { role } = req.body;
      const actorId = req.user.id;

      if (!role) {
        throw new BadRequestError('Role is required');
      }

      const result = await workspaceServiceInstance.changeRole(workspaceId, memberId, role, actorId, req);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async updateCustomPermissions(req, res, next) {
    try {
      const { workspaceId, memberId } = req.params;
      const { customPermissions } = req.body;
      const actorId = req.user.id;

      if (!Array.isArray(customPermissions)) {
        throw new BadRequestError('customPermissions must be an array of permissions');
      }

      const result = await workspaceServiceInstance.updateCustomPermissions(workspaceId, memberId, customPermissions, actorId, req);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async suspendMember(req, res, next) {
    try {
      const { workspaceId, memberId } = req.params;
      const { suspend } = req.body;
      const actorId = req.user.id;

      const result = await workspaceServiceInstance.suspendMember(workspaceId, memberId, suspend === true, actorId, req);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getAuditLogs(req, res, next) {
    try {
      const { workspaceId } = req.params;
      const logs = await workspaceServiceInstance.getAuditLogs(workspaceId);
      res.status(200).json({
        success: true,
        auditLogs: logs
      });
    } catch (error) {
      next(error);
    }
  }

  async getSessions(req, res, next) {
    try {
      const { workspaceId, userId } = req.params;
      const sessions = await workspaceServiceInstance.getSessions(workspaceId, userId);
      res.status(200).json({
        success: true,
        sessions
      });
    } catch (error) {
      next(error);
    }
  }

  async revokeSession(req, res, next) {
    try {
      const { workspaceId, userId } = req.params;
      const { tokenHash } = req.body;
      const actorId = req.user.id;

      if (!tokenHash) {
        throw new BadRequestError('tokenHash is required to revoke a session');
      }

      const result = await workspaceServiceInstance.revokeSession(workspaceId, userId, tokenHash, actorId, req);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async updateSettings(req, res, next) {
    try {
      const { workspaceId } = req.params;
      const { name, logoUrl } = req.body;
      const actorId = req.user.id;

      const workspace = await workspaceServiceInstance.updateSettings(workspaceId, name, logoUrl, actorId, req);
      res.status(200).json({
        success: true,
        message: 'Workspace settings updated successfully',
        workspace
      });
    } catch (error) {
      next(error);
    }
  }

  async resendInvitation(req, res, next) {
    try {
      const { workspaceId } = req.params;
      const { email, role, customPermissions, expirationHours } = req.body;
      const inviterId = req.user.id;

      if (!email || typeof email !== 'string') {
        throw new BadRequestError('Email address is required');
      }

      const result = await workspaceServiceInstance.resendInvitation(
        workspaceId,
        inviterId,
        { email, role, customPermissions, expirationHours: expirationHours ? Number(expirationHours) : 24 },
        req
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const workspaceControllerInstance = new WorkspaceController();
export default workspaceControllerInstance;
