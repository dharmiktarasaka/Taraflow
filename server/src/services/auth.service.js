import { OAuth2Client } from 'google-auth-library';
import { userRepositoryInstance } from '../repositories/user.repository.js';
import { emailServiceInstance } from './email.service.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  generateRandomToken,
  hashToken,
} from '../utils/token.util.js';
import {
  BadRequestError,
  UnauthorizedError,
  ConflictError,
  NotFoundError,
  ForbiddenError,
} from '../utils/errors.util.js';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

class AuthService {
  async signup(data) {
    const { firstName, lastName, email, password } = data;

    const existingUser = await userRepositoryInstance.findByEmail(email);
    if (existingUser) {
      throw new ConflictError('Email already in use');
    }

    const verificationToken = generateRandomToken();
    const verificationTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const user = await userRepositoryInstance.create({
      firstName,
      lastName,
      email,
      password,
      verificationToken: hashToken(verificationToken),
      verificationTokenExpiresAt,
    });

    // Send verification email asynchronously
    emailServiceInstance.sendVerificationEmail(
      user.email,
      `${user.firstName} ${user.lastName}`,
      verificationToken
    ).catch(() => {}); // catch silent local smtp failure

    return {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified,
    };
  }

  async login(email, password) {
    const user = await userRepositoryInstance.findByEmail(email, '+password');
    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    if (user.isLocked()) {
      const lockTimeRemaining = Math.ceil((user.lockUntil - Date.now()) / 60000);
      throw new UnauthorizedError(`Account is temporarily locked. Try again in ${lockTimeRemaining} minutes.`);
    }

    // Support email login only if the account has a password
    if (!user.password) {
      throw new BadRequestError('This account is configured for social login. Please login with Google.');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      await userRepositoryInstance.incrementLoginAttempts(user);
      throw new UnauthorizedError('Invalid credentials');
    }

    await userRepositoryInstance.resetLoginAttempts(user);

    const accessToken = generateAccessToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id, user.role);

    const hashedRefreshToken = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Keep session limits clean: limit to 10 concurrent sessions, drop oldest
    user.refreshTokens = user.refreshTokens.filter(t => t.expiresAt > new Date());
    if (user.refreshTokens.length >= 10) {
      user.refreshTokens.shift();
    }
    user.refreshTokens.push({ tokenHash: hashedRefreshToken, expiresAt });
    await userRepositoryInstance.save(user);

    return {
      tokens: { accessToken, refreshToken },
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
        isVerified: user.isVerified,
      },
    };
  }

  async refreshToken(token) {
    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch (err) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    const user = await userRepositoryInstance.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedError('User session not found');
    }

    const incomingHash = hashToken(token);
    const tokenIndex = user.refreshTokens.findIndex(t => t.tokenHash === incomingHash);

    // Refresh Token Reuse Detection
    if (tokenIndex === -1) {
      // Security alarm: Old refresh token reuse detected!
      // Revoke all current tokens for safety and force re-login
      user.refreshTokens = [];
      await userRepositoryInstance.save(user);
      throw new ForbiddenError('Security breach: session reuse detected. Revoking all sessions.');
    }

    // Remove the used refresh token
    user.refreshTokens.splice(tokenIndex, 1);

    // Generate new pair
    const newAccessToken = generateAccessToken(user._id, user.role);
    const newRefreshToken = generateRefreshToken(user._id, user.role);

    const newHashedToken = hashToken(newRefreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    user.refreshTokens.push({ tokenHash: newHashedToken, expiresAt });
    await userRepositoryInstance.save(user);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout(token) {
    if (!token) return;
    try {
      const payload = verifyRefreshToken(token);
      const user = await userRepositoryInstance.findById(payload.sub);
      if (user) {
        const incomingHash = hashToken(token);
        user.refreshTokens = user.refreshTokens.filter(t => t.tokenHash !== incomingHash);
        await userRepositoryInstance.save(user);
      }
    } catch (err) {
      // Fail silently for logouts
    }
  }

  async verifyEmail(token) {
    const hashed = hashToken(token);
    const user = await userRepositoryInstance.findByVerificationToken(hashed);

    if (!user) {
      throw new BadRequestError('Invalid or expired verification token');
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpiresAt = undefined;
    await userRepositoryInstance.save(user);

    return { success: true, message: 'Email verified successfully' };
  }

  async requestPasswordReset(email) {
    const user = await userRepositoryInstance.findByEmail(email);
    if (!user) {
      // Security best practice: don't reveal if user doesn't exist
      return { success: true, message: 'If this email exists, a reset link has been sent.' };
    }

    const resetToken = generateRandomToken();
    const resetPasswordExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    user.resetPasswordToken = hashToken(resetToken);
    user.resetPasswordExpiresAt = resetPasswordExpiresAt;
    await userRepositoryInstance.save(user);

    // Send reset email asynchronously
    emailServiceInstance.sendPasswordResetEmail(
      user.email,
      `${user.firstName} ${user.lastName}`,
      resetToken
    ).catch(() => {}); // catch silent local smtp failure

    return { success: true, message: 'If this email exists, a reset link has been sent.' };
  }

  async resetPassword(token, newPassword) {
    const hashed = hashToken(token);
    const user = await userRepositoryInstance.findByResetPasswordToken(hashed);

    if (!user) {
      throw new BadRequestError('Invalid or expired password reset token');
    }

    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpiresAt = undefined;
    await userRepositoryInstance.resetLoginAttempts(user);
    await userRepositoryInstance.save(user);

    return { success: true, message: 'Password has been reset successfully' };
  }

  async googleOAuth(idToken) {
    let ticket;
    try {
      ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
    } catch (error) {
      throw new BadRequestError('Invalid Google identity token');
    }

    const payload = ticket.getPayload();
    const { sub: googleId, email, given_name: firstName, family_name: lastName, picture: avatarUrl } = payload;

    let user = await userRepositoryInstance.findByEmail(email);

    if (user) {
      // If user exists but is not linked to Google, link them
      if (!user.googleId) {
        user.googleId = googleId;
        user.isVerified = true; // Auto-verify since Google verified it
        if (avatarUrl && !user.avatarUrl) user.avatarUrl = avatarUrl;
        await userRepositoryInstance.save(user);
      }
    } else {
      // Check if another account has the same googleId
      user = await userRepositoryInstance.findByGoogleId(googleId);
      if (!user) {
        // Create new user
        user = await userRepositoryInstance.create({
          firstName: firstName || 'Google',
          lastName: lastName || 'User',
          email,
          googleId,
          isVerified: true,
          avatarUrl,
        });
      }
    }

    const accessToken = generateAccessToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id, user.role);

    const hashedRefreshToken = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    user.refreshTokens = user.refreshTokens.filter(t => t.expiresAt > new Date());
    user.refreshTokens.push({ tokenHash: hashedRefreshToken, expiresAt });
    await userRepositoryInstance.save(user);

    return {
      tokens: { accessToken, refreshToken },
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
        isVerified: user.isVerified,
      },
    };
  }
}

export const authServiceInstance = new AuthService();
