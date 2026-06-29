import crypto from 'crypto';
import bcrypt from 'bcrypt';
import Workspace from '../models/workspace.model.js';
import WorkspaceMember from '../models/workspaceMember.model.js';
import WorkspaceInvitation from '../models/workspaceInvitation.model.js';
import WorkspaceAuditLog from '../models/workspaceAuditLog.model.js';
import User from '../models/user.model.js';
import { emailServiceInstance, inviteEmailServiceInstance } from './email.service.js';
import { BadRequestError, ConflictError, NotFoundError, ForbiddenError } from '../utils/errors.util.js';
import { generateAccessToken, generateRefreshToken, hashToken } from '../utils/token.util.js';
import logger from '../utils/logger.util.js';
import { defaultRolePermissions, permissionMap } from '../middlewares/workspace.middleware.js';

// Helper to map old custom permission strings to new boolean object values
export const mapStringArrayToPermissionsObj = (arr, role) => {
  const defaults = { ...(defaultRolePermissions[role] || defaultRolePermissions['Viewer']) };
  const obj = { ...defaults };
  // Set all overrideable keys to false first if role is not Owner
  if (role !== 'Owner') {
    const allKeys = Object.keys(defaultRolePermissions['Owner']);
    for (const k of allKeys) {
      obj[k] = false;
    }
    // Set default template values for the role
    const defaultKeys = Object.keys(defaultRolePermissions[role] || defaultRolePermissions['Viewer']);
    for (const dk of defaultKeys) {
      if (defaultRolePermissions[role]?.[dk] === true) {
        obj[dk] = true;
      }
    }
  }
  // Overlay custom overrides
  for (const str of arr) {
    const key = permissionMap[str] || str;
    obj[key] = true;
  }
  return obj;
};

class WorkspaceService {
  /**
   * Helper to write workspace audit logs
   */
  async logAction(workspaceId, actorId, action, details, req = null) {
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
      logger.error(`[WorkspaceService] Failed to write audit log: ${err.message}`);
    }
  }

  /**
   * Create a new workspace and assign owner
   */
  async createWorkspace(userId, name, logoUrl = '', req = null) {
    const workspace = await Workspace.create({
      name,
      logoUrl,
      owner: userId,
      billingOwner: userId
    });

    await WorkspaceMember.create({
      workspaceId: workspace._id,
      userId,
      role: 'Owner',
      permissions: { ...defaultRolePermissions['Owner'] },
      status: 'active'
    });

    await this.logAction(workspace._id, userId, 'Workspace created', `Workspace "${name}" was created successfully.`, req);
    
    return workspace;
  }

  /**
   * List user's workspaces
   */
  async getWorkspaces(userId) {
    const memberships = await WorkspaceMember.find({ userId, status: 'active' }).populate('workspaceId');
    return memberships
      .filter(m => m.workspaceId !== null)
      .map(m => {
        let permissions = {};
        if (m.role === 'Owner') {
          permissions = { ...defaultRolePermissions['Owner'] };
        } else {
          const defaults = { ...(defaultRolePermissions[m.role] || defaultRolePermissions['Viewer']) };
          const savedPerms = m.permissions instanceof Map ? Object.fromEntries(m.permissions) : (m.permissions || {});
          permissions = { ...defaults, ...savedPerms };
        }

        return {
          ...m.workspaceId.toObject(),
          role: m.role,
          permissions: permissions
        };
      });
  }

  /**
   * List workspace members
   */
  async getWorkspaceMembers(workspaceId) {
    const members = await WorkspaceMember.find({ workspaceId }).populate('userId', 'firstName lastName email avatarUrl isActive');
    return members;
  }

  /**
   * Invite team member
   */
  async inviteMember(workspaceId, inviterId, payload, req = null) {
    const { email, role, customPermissions = [], expirationHours = 24 } = payload;
    const cleanEmail = email.trim().toLowerCase();

    // Verify workspace active
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) throw new NotFoundError('Workspace not found');

    // Check if invitee is already a member
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      const isMember = await WorkspaceMember.findOne({ workspaceId, userId: existingUser._id });
      if (isMember) {
        throw new ConflictError(`User ${cleanEmail} is already a member of this workspace.`);
      }
    }

    // Check for pending invitation
    const pendingInvite = await WorkspaceInvitation.findOne({
      workspaceId,
      inviteeEmail: cleanEmail,
      status: 'pending',
      expiresAt: { $gt: new Date() }
    });
    if (pendingInvite) {
      throw new ConflictError(`A pending invitation already exists for ${cleanEmail}.`);
    }

    // Cryptographic Token & OTP Generation
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const rawOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(rawOtp, 10);

    const expiresAt = new Date(Date.now() + expirationHours * 60 * 60 * 1000);

    // Create invitation record
    const invitation = await WorkspaceInvitation.create({
      workspaceId,
      inviterId,
      inviteeEmail: cleanEmail,
      role,
      permissionSet: customPermissions,
      invitationTokenHash: tokenHash,
      otpHash,
      expiresAt
    });

    // Fetch inviter name
    const inviter = await User.findById(inviterId);
    const inviterName = inviter ? `${inviter.firstName} ${inviter.lastName}` : 'Workspace Administrator';
    
    // Construct invitation url
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const inviteUrl = `${clientUrl}/workspace/invite/${rawToken}`;

    // Send invitation email using the dedicated INVITE_EMAIL_* transporter
    try {
      await inviteEmailServiceInstance.sendEmail({
        to: cleanEmail,
        subject: `Invitation to collaborate on ${workspace.name} at Taraflow`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <h2 style="color: #4F46E5; text-align: center;">Join the Workspace!</h2>
            <p>Hello,</p>
            <p><strong>${inviterName}</strong> has invited you to collaborate on their workspace <strong>${workspace.name}</strong> as a <strong>${role}</strong>.</p>
            <p>Please click the button below to accept your invitation:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${inviteUrl}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Accept Invitation</a>
            </div>
            <p style="font-size: 13px; color: #555555; background-color: #f3f4f6; padding: 12px; border-radius: 6px;">
              <strong>🔐 Secure Verification Code (OTP):</strong> <span style="font-size: 18px; font-family: monospace; font-weight: bold; letter-spacing: 2px; color: #4F46E5;">${rawOtp}</span>
            </p>
            <p style="font-size: 12px; color: #777777;">This invitation and verification code are valid for 24 hours. For security, please do not share this email or OTP code with anyone.</p>
            <hr style="border: 0; border-top: 1px solid #eeeeee; margin-top: 30px;">
            <p style="font-size: 11px; color: #999999; text-align: center;">Taraflow Enterprise SaaS Security Team</p>
          </div>
        `
      });
    } catch (emailErr) {
      await WorkspaceInvitation.deleteOne({ _id: invitation._id });
      logger.error(`[WorkspaceService] Failed to send invitation email: ${emailErr.message}`);
      throw new BadRequestError(`Failed to send invitation email: ${emailErr.message}`);
    }

    await this.logAction(workspaceId, inviterId, 'Member invited', `Invited "${cleanEmail}" as ${role}.`, req);

    return {
      success: true,
      message: 'Invitation sent successfully.',
      invitationId: invitation._id
    };
  }

  /**
   * Resend invitation — cancel pending invite and re-issue a fresh one
   */
  async resendInvitation(workspaceId, inviterId, payload, req = null) {
    const { email, role = 'Viewer', customPermissions = [], expirationHours = 24 } = payload;
    const cleanEmail = email.trim().toLowerCase();

    // Cancel any existing pending invite for this email in this workspace
    await WorkspaceInvitation.updateMany(
      { workspaceId, inviteeEmail: cleanEmail, status: 'pending' },
      { $set: { status: 'cancelled' } }
    );

    // Issue a brand new invitation
    return this.inviteMember(workspaceId, inviterId, { email: cleanEmail, role, customPermissions, expirationHours }, req);
  }

  /**
   * Get public details of an invitation by token
   */
  async getInvitationDetails(rawToken) {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const invite = await WorkspaceInvitation.findOne({
      invitationTokenHash: tokenHash
    }).populate('workspaceId', 'name logoUrl').populate('inviterId', 'firstName lastName email');

    if (!invite) {
      throw new NotFoundError('Workspace invitation not found or invalid link.');
    }

    if (invite.status !== 'pending') {
      throw new BadRequestError(`Invitation cannot be accepted. Status is: ${invite.status}`);
    }

    if (invite.expiresAt < new Date()) {
      invite.status = 'expired';
      await invite.save();
      throw new BadRequestError('Invitation has expired.');
    }

    return invite;
  }

  /**
   * Join workspace by accepting invitation token & verifying OTP
   */
  async acceptInvitation(rawToken, payload, req = null) {
    const { otp, firstName, lastName, password } = payload;
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const invite = await WorkspaceInvitation.findOne({ invitationTokenHash: tokenHash });
    if (!invite) throw new NotFoundError('Invitation not found.');

    if (invite.status === 'failed_locked') {
      throw new ForbiddenError('This invitation has been locked due to excessive invalid OTP attempts.');
    }

    if (invite.status !== 'pending') {
      throw new BadRequestError(`Invitation has already been ${invite.status}.`);
    }

    if (invite.expiresAt < new Date()) {
      invite.status = 'expired';
      await invite.save();
      throw new BadRequestError('Invitation has expired.');
    }

    // Verify OTP brute-force limits
    if (invite.otpAttempts >= 5) {
      invite.status = 'failed_locked';
      await invite.save();
      throw new ForbiddenError('Brute-force lockout triggered: 5 incorrect OTP attempts. The invitation is now locked.');
    }

    const isOtpValid = await bcrypt.compare(otp, invite.otpHash);
    if (!isOtpValid) {
      invite.otpAttempts += 1;
      await invite.save();
      throw new BadRequestError(`Invalid OTP verification code. Attempts remaining: ${5 - invite.otpAttempts}`);
    }

    // Verify workspace active
    const workspace = await Workspace.findById(invite.workspaceId);
    if (!workspace || !workspace.isActive) {
      throw new ForbiddenError('The target workspace is no longer active or has been suspended.');
    }

    // Check if user exists
    let user = await User.findOne({ email: invite.inviteeEmail });

    if (!user) {
      // Create user if they do not exist
      if (!password || !firstName || !lastName) {
        throw new BadRequestError('Account details (firstName, lastName, password) are required for new signups.');
      }
      user = await User.create({
        firstName,
        lastName,
        email: invite.inviteeEmail,
        password,
        isVerified: true // Auto verify as they confirmed via invite OTP
      });
    } else {
      // User exists, verify password
      if (!password) {
        throw new BadRequestError('Password is required for existing accounts.');
      }
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        throw new BadRequestError('Incorrect password. Please verify your credentials.');
      }
    }

    // Ensure they are not already a member
    const existingMember = await WorkspaceMember.findOne({ workspaceId: invite.workspaceId, userId: user._id });
    if (existingMember) {
      invite.status = 'accepted';
      await invite.save();
      return { success: true, message: 'You are already a member of this workspace.', userId: user._id, workspaceId: invite.workspaceId };
    }

    // Add to workspace
    await WorkspaceMember.create({
      workspaceId: invite.workspaceId,
      userId: user._id,
      role: invite.role,
      customPermissions: invite.permissionSet,
      permissions: mapStringArrayToPermissionsObj(invite.permissionSet, invite.role),
      status: 'active'
    });

    // Mark invitation accepted
    invite.status = 'accepted';
    await invite.save();

    // Log action
    await this.logAction(invite.workspaceId, user._id, 'Member Added', `User joined workspace as ${invite.role}.`, req);

    // Generate login tokens for immediate login
    const accessToken = generateAccessToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id, user.role);
    const hashedRefreshToken = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Save to user sessions
    user.refreshTokens = user.refreshTokens || [];
    user.refreshTokens.push({
      tokenHash: hashedRefreshToken,
      expiresAt,
      userAgent: req ? req.headers['user-agent'] || '' : '',
      ipAddress: req ? req.ip || '' : '',
      device: 'Desktop',
      browser: 'Browser',
      location: 'Localhost Network',
      createdAt: new Date(),
      lastActive: new Date()
    });
    await user.save();

    // Notify owner
    try {
      const owner = await User.findById(workspace.owner);
      if (owner && owner.email) {
        await emailServiceInstance.sendEmail({
          to: owner.email,
          subject: `Member joined workspace: ${workspace.name}`,
          html: `<p>Hi ${owner.firstName},</p><p>We wanted to let you know that <strong>${user.firstName} ${user.lastName}</strong> (${user.email}) has accepted your invitation and joined your workspace as a <strong>${invite.role}</strong>.</p>`
        });
      }
    } catch (ownerErr) {
      logger.error(`[WorkspaceService] Failed to send join notification: ${ownerErr.message}`);
    }

    return {
      success: true,
      message: 'Workspace joined successfully.',
      userId: user._id,
      workspaceId: invite.workspaceId,
      tokens: { accessToken, refreshToken },
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role
      }
    };
  }

  /**
   * Remove member
   */
  async removeMember(workspaceId, memberId, actorId, req = null) {
    const member = await WorkspaceMember.findOne({ workspaceId, _id: memberId });
    if (!member) throw new NotFoundError('Member record not found in workspace.');

    if (member.role === 'Owner') {
      throw new BadRequestError('Workspace Owners cannot be removed. You must transfer ownership first.');
    }

    await WorkspaceMember.findByIdAndDelete(memberId);
    await this.logAction(workspaceId, actorId, 'Member Removed', `Member (${member.userId}) was removed.`, req);

    // Notify owner
    try {
      const workspace = await Workspace.findById(workspaceId);
      const owner = await User.findById(workspace.owner);
      const targetUser = await User.findById(member.userId);
      if (owner && owner.email && targetUser) {
        await emailServiceInstance.sendEmail({
          to: owner.email,
          subject: `Member removed from workspace: ${workspace.name}`,
          html: `<p>Hi ${owner.firstName},</p><p>Member <strong>${targetUser.firstName} ${targetUser.lastName}</strong> (${targetUser.email}) has been removed from the workspace.</p>`
        });
      }
    } catch (ownerErr) {
      logger.error(`[WorkspaceService] Failed to send removal email: ${ownerErr.message}`);
    }

    return { success: true, message: 'Member removed successfully.' };
  }

  /**
   * Update role
   */
  async changeRole(workspaceId, memberId, newRole, actorId, req = null) {
    const member = await WorkspaceMember.findOne({ workspaceId, _id: memberId });
    if (!member) throw new NotFoundError('Member not found.');

    if (member.role === 'Owner') {
      throw new BadRequestError('Workspace Owner role cannot be changed directly. Ownership must be transferred.');
    }

    if (newRole === 'Owner') {
      throw new BadRequestError('To assign a new owner, please initiate an Ownership Transfer operation.');
    }

    member.role = newRole;
    member.permissions = mapStringArrayToPermissionsObj([], newRole);
    member.customPermissions = Object.keys(member.permissions).filter(k => member.permissions[k] === true);
    await member.save();

    await this.logAction(workspaceId, actorId, 'Role Changed', `Changed role for member (${member.userId}) to ${newRole}.`, req);

    return { success: true, message: `Role changed to ${newRole} successfully.` };
  }

  /**
   * Update custom permissions
   */
  async updateCustomPermissions(workspaceId, memberId, permissionsInput, actorId, req = null) {
    const member = await WorkspaceMember.findOne({ workspaceId, _id: memberId });
    if (!member) throw new NotFoundError('Member not found.');

    if (member.role === 'Owner') {
      throw new BadRequestError('Workspace Owners have all permissions and cannot have modified custom permission lists.');
    }

    let resolvedPermissions = {};
    if (Array.isArray(permissionsInput)) {
      resolvedPermissions = mapStringArrayToPermissionsObj(permissionsInput, member.role);
    } else if (typeof permissionsInput === 'object') {
      resolvedPermissions = permissionsInput;
    } else {
      throw new BadRequestError('Invalid permissions format');
    }

    member.permissions = resolvedPermissions;
    member.customPermissions = Object.keys(resolvedPermissions).filter(k => resolvedPermissions[k] === true);
    await member.save();

    await this.logAction(workspaceId, actorId, 'Permission Changed', `Modified permissions list for member (${member.userId}).`, req);

    return { success: true, message: 'Custom permissions updated successfully.' };
  }

  /**
   * Suspend member
   */
  async suspendMember(workspaceId, memberId, suspend, actorId, req = null) {
    const member = await WorkspaceMember.findOne({ workspaceId, _id: memberId });
    if (!member) throw new NotFoundError('Member not found.');

    if (member.role === 'Owner') {
      throw new BadRequestError('Workspace Owners cannot be suspended.');
    }

    member.status = suspend ? 'suspended' : 'active';
    await member.save();

    const actionText = suspend ? 'Member suspended' : 'Member reactivated';
    await this.logAction(workspaceId, actorId, actionText, `Member (${member.userId}) status set to ${member.status}.`, req);

    return { success: true, message: `Member ${suspend ? 'suspended' : 'reactivated'} successfully.` };
  }

  /**
   * Get audit logs
   */
  async getAuditLogs(workspaceId) {
    return await WorkspaceAuditLog.find({ workspaceId }).sort({ timestamp: -1 }).limit(100);
  }

  /**
   * Get active user sessions from User refreshTokens
   */
  async getSessions(workspaceId, userId) {
    // Ensure user is member
    const member = await WorkspaceMember.findOne({ workspaceId, userId });
    if (!member) throw new ForbiddenError('Access Denied');

    const userObj = await User.findById(userId, '+refreshTokens');
    if (!userObj) throw new NotFoundError('User not found');

    return userObj.refreshTokens.map(t => ({
      tokenHash: t.tokenHash,
      device: t.device,
      browser: t.browser,
      ipAddress: t.ipAddress,
      location: t.location,
      createdAt: t.createdAt,
      lastActive: t.lastActive
    }));
  }

  /**
   * Revoke individual session by tokenHash
   */
  async revokeSession(workspaceId, userId, tokenHash, actorId, req = null) {
    const member = await WorkspaceMember.findOne({ workspaceId, userId });
    if (!member) throw new ForbiddenError('Access Denied');

    const userObj = await User.findById(userId);
    if (!userObj) throw new NotFoundError('User not found');

    // Filter out the session
    const lengthBefore = userObj.refreshTokens.length;
    userObj.refreshTokens = userObj.refreshTokens.filter(t => t.tokenHash !== tokenHash);
    
    if (userObj.refreshTokens.length === lengthBefore) {
      throw new NotFoundError('Session token not found or already revoked.');
    }

    await userObj.save();
    await this.logAction(workspaceId, actorId, 'Session revoked', `Revoked session (${tokenHash.substring(0, 10)}...) for user (${userId}).`, req);

    return { success: true, message: 'Session revoked successfully.' };
  }

  /**
   * Update workspace settings
   */
  async updateSettings(workspaceId, name, logoUrl, actorId, req = null) {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) throw new NotFoundError('Workspace not found');

    workspace.name = name || workspace.name;
    if (logoUrl !== undefined) workspace.logoUrl = logoUrl;
    await workspace.save();

    await this.logAction(workspaceId, actorId, 'Workspace settings updated', `Name updated to "${workspace.name}".`, req);

    return workspace;
  }
}

export const workspaceServiceInstance = new WorkspaceService();
export default workspaceServiceInstance;
