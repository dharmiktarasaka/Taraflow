import nodemailer from 'nodemailer';
import logger from '../utils/logger.util.js';

// ─── General Email Service ──────────────────────────────────────────────────
// Used for: password reset, account verification, and other system emails.
// Configured via EMAIL_* environment variables.
class EmailService {
  constructor() {
    const port = parseInt(process.env.EMAIL_PORT || '2525', 10);
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.mailtrap.io',
      port: port,
      secure: process.env.EMAIL_SECURE === 'true' || port === 465,
      auth: {
        user: process.env.EMAIL_USER || '',
        pass: process.env.EMAIL_PASS || '',
      },
      tls: {
        rejectUnauthorized: process.env.EMAIL_TLS_REJECT_UNAUTHORIZED !== 'false'
      }
    });
  }

  async sendEmail({ to, subject, html }) {
    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM || 'noreply@taraflow.ai',
        to,
        subject,
        html,
      };
      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`[General Email] Dispatched: ${info.messageId}`);
      return info;
    } catch (error) {
      logger.error(`[General Email] Failed to send to ${to}: ${error.message}`);
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Email delivery failed');
      }
    }
  }

  async sendVerificationEmail(email, name, token) {
    const verificationUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/verify-email?token=${token}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #6366F1; text-align: center;">Welcome to Taraflow, ${name}!</h2>
        <p>Thank you for signing up. To complete your registration and secure your account, please verify your email address by clicking the link below:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" style="background-color: #6366F1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Verify Email Address</a>
        </div>
        <p>This verification link will expire in 24 hours.</p>
        <p>If you did not create this account, please ignore this email.</p>
        <hr style="border: 0; border-top: 1px solid #eeeeee; margin-top: 30px;">
        <p style="font-size: 12px; color: #777777; text-align: center;">Taraflow Automation Team</p>
      </div>
    `;
    return this.sendEmail({ to: email, subject: 'Verify your Taraflow account', html });
  }

  async sendPasswordResetEmail(email, name, token) {
    const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/reset-password?token=${token}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #6366F1; text-align: center;">Reset your Password</h2>
        <p>Hello ${name},</p>
        <p>We received a request to reset your password. Click the button below to choose a new password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #6366F1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Reset Password</a>
        </div>
        <p>This reset link will expire in 1 hour.</p>
        <p>If you did not request a password reset, please ignore this email and secure your account.</p>
        <hr style="border: 0; border-top: 1px solid #eeeeee; margin-top: 30px;">
        <p style="font-size: 12px; color: #777777; text-align: center;">Taraflow Automation Team</p>
      </div>
    `;
    return this.sendEmail({ to: email, subject: 'Reset your Taraflow password', html });
  }
}

// ─── Invite Email Service ───────────────────────────────────────────────────
// Used EXCLUSIVELY for: workspace collaboration invitation emails.
// Configured via INVITE_EMAIL_* environment variables (separate Gmail account).
class InviteEmailService {
  constructor() {
    this.resendKey = process.env.RESEND_API_KEY || '';

    if (this.resendKey) {
      this.configured = true;
      this.useResend = true;
      this.from = process.env.INVITE_EMAIL_FROM || 'onboarding@resend.dev';
      logger.info(`[Invite Email] Configured via Resend API — sending from: ${this.from}`);
    } else {
      const port = parseInt(process.env.INVITE_EMAIL_PORT || '465', 10);
      this.from = process.env.INVITE_EMAIL_FROM || process.env.INVITE_EMAIL_USER || 'noreply@taraflow.ai';
      this.configured = !!(process.env.INVITE_EMAIL_USER && process.env.INVITE_EMAIL_PASS);
      this.useResend = false;

      if (this.configured) {
        this.transporter = nodemailer.createTransport({
          host: process.env.INVITE_EMAIL_HOST || 'smtp.gmail.com',
          port: port,
          secure: process.env.INVITE_EMAIL_SECURE === 'true' || port === 465,
          auth: {
            user: process.env.INVITE_EMAIL_USER,
            pass: process.env.INVITE_EMAIL_PASS,
          },
          tls: {
            rejectUnauthorized: process.env.INVITE_EMAIL_TLS_REJECT_UNAUTHORIZED !== 'false'
          }
        });
        logger.info(`[Invite Email] Configured via SMTP — sending from: ${this.from}`);
      } else {
        logger.warn('[Invite Email] Neither RESEND_API_KEY nor SMTP credentials are set.');
      }
    }
  }

  async sendEmail({ to, subject, html }) {
    if (!this.configured) {
      const errorMsg = 'Invite email service is not configured. Please set RESEND_API_KEY or INVITE_EMAIL_USER and INVITE_EMAIL_PASS.';
      logger.error(`[Invite Email] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    if (this.useResend) {
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.resendKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: this.from,
            to,
            subject,
            html
          })
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || `HTTP ${response.status}`);
        }

        logger.info(`[Invite Email] Dispatched via Resend to ${to}: ${data.id}`);
        return { messageId: data.id };
      } catch (error) {
        logger.error(`[Invite Email] Failed to send via Resend to ${to}: ${error.message}`);
        throw error;
      }
    } else {
      try {
        const info = await this.transporter.sendMail({ from: this.from, to, subject, html });
        logger.info(`[Invite Email] Dispatched via SMTP to ${to}: ${info.messageId}`);
        return info;
      } catch (error) {
        logger.error(`[Invite Email] Failed to send via SMTP to ${to}: ${error.message}`);
        throw error;
      }
    }
  }
}

export const emailServiceInstance = new EmailService();
export const inviteEmailServiceInstance = new InviteEmailService();

