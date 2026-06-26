import { authServiceInstance } from '../services/auth.service.js';

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

function parseRequestSession(req) {
  const ua = req.headers['user-agent'] || '';
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
  
  let browser = 'Unknown Browser';
  let device = 'Desktop';
  
  if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Safari')) browser = 'Safari';
  else if (ua.includes('Edge')) browser = 'Edge';
  else if (ua.includes('Opera') || ua.includes('OPR')) browser = 'Opera';
  
  if (ua.includes('Mobile') || ua.includes('Android') || ua.includes('iPhone')) {
    device = 'Mobile';
  } else if (ua.includes('Tablet') || ua.includes('iPad')) {
    device = 'Tablet';
  }
  
  let location = 'San Francisco, CA (Approximate)';
  if (ip.includes('127.0.0.1') || ip === '::1' || ip === '::ffff:127.0.0.1' || ip === '127.0.0.1') {
    location = 'Localhost Network';
  }
  
  return {
    userAgent: ua.substring(0, 200),
    ipAddress: ip,
    device,
    browser,
    location
  };
}

export class AuthController {
  async signup(req, res, next) {
    try {
      const user = await authServiceInstance.signup(req.body);
      res.status(201).json({
        success: true,
        message: 'Registration successful. Please check your email to verify your account.',
        data: { user },
      });
    } catch (error) {
      next(error);
    }
  }

  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const sessionDetails = parseRequestSession(req);
      const { tokens, user } = await authServiceInstance.login(email, password, sessionDetails);

      res.cookie('refreshToken', tokens.refreshToken, cookieOptions);
      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          accessToken: tokens.accessToken,
          user,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async googleOAuth(req, res, next) {
    try {
      const { idToken } = req.body;
      const sessionDetails = parseRequestSession(req);
      const { tokens, user } = await authServiceInstance.googleOAuth(idToken, sessionDetails);

      res.cookie('refreshToken', tokens.refreshToken, cookieOptions);
      res.status(200).json({
        success: true,
        message: 'Google login successful',
        data: {
          accessToken: tokens.accessToken,
          user,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async refreshToken(req, res, next) {
    try {
      const token = req.cookies.refreshToken || req.body.refreshToken;
      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'Refresh token is missing',
        });
      }

      const sessionDetails = parseRequestSession(req);
      const { accessToken, refreshToken } = await authServiceInstance.refreshToken(token, sessionDetails);

      res.cookie('refreshToken', refreshToken, cookieOptions);
      res.status(200).json({
        success: true,
        data: { accessToken },
      });
    } catch (error) {
      next(error);
    }
  }

  async logout(req, res, next) {
    try {
      const token = req.cookies.refreshToken || req.body.refreshToken;
      await authServiceInstance.logout(token);

      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
      });
      res.status(200).json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async verifyEmail(req, res, next) {
    try {
      const { token } = req.body;
      const result = await authServiceInstance.verifyEmail(token);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;
      const result = await authServiceInstance.requestPasswordReset(email);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req, res, next) {
    try {
      const { token, password } = req.body;
      const result = await authServiceInstance.resetPassword(token, password);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const authControllerInstance = new AuthController();
export default authControllerInstance;
