import { authServiceInstance } from '../services/auth.service.js';

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

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
      const { tokens, user } = await authServiceInstance.login(email, password);

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
      const { tokens, user } = await authServiceInstance.googleOAuth(idToken);

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

      const { accessToken, refreshToken } = await authServiceInstance.refreshToken(token);

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
