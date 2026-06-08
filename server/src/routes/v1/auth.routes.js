import { Router } from 'express';
import { authControllerInstance } from '../../controllers/auth.controller.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { validateBody } from '../../middlewares/validation.middleware.js';
import { authRateLimiter, passwordResetRateLimiter } from '../../middlewares/rateLimit.middleware.js';
import { userRepositoryInstance } from '../../repositories/user.repository.js';
import {
  signupSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  googleOAuthSchema,
} from '../../validators/auth.validator.js';

const router = Router();

router.post('/register', authRateLimiter, validateBody(signupSchema), authControllerInstance.signup);
router.post('/login', authRateLimiter, validateBody(loginSchema), authControllerInstance.login);
router.post('/google', authRateLimiter, validateBody(googleOAuthSchema), authControllerInstance.googleOAuth);
router.post('/refresh-token', authControllerInstance.refreshToken);
router.post('/logout', authControllerInstance.logout);
router.post('/verify-email', validateBody(verifyEmailSchema), authControllerInstance.verifyEmail);

// Password resets rate limits are more restrictive
router.post('/forgot-password', passwordResetRateLimiter, validateBody(forgotPasswordSchema), authControllerInstance.forgotPassword);
router.post('/reset-password', passwordResetRateLimiter, validateBody(resetPasswordSchema), authControllerInstance.resetPassword);

// Get current user profile details
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await userRepositoryInstance.findById(req.user.id);
    res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
