import { Router } from 'express';
import { adminControllerInstance } from '../../controllers/admin.controller.js';
import { requireAuth, requireRole } from '../../middlewares/auth.middleware.js';
import { ForbiddenError } from '../../utils/errors.util.js';

const router = Router();

// Middleware to check passcode header
const requireAdminPasscode = (req, res, next) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== 'taramation') {
    throw new ForbiddenError('Admin access key is invalid or missing');
  }
  next();
};

// Protect all admin endpoints
router.use(requireAuth, requireRole(['SUPER_ADMIN']), requireAdminPasscode);

router.get('/stats', adminControllerInstance.getDashboardStats);
router.get('/users', adminControllerInstance.getUsersList);
router.patch('/users/:id/role', adminControllerInstance.updateUserRole);
router.patch('/users/:id/status', adminControllerInstance.updateUserStatus);
router.patch('/users/:id/subscription', adminControllerInstance.manualOverrideSubscription);
router.get('/ai-usage', adminControllerInstance.getAIUsageStats);
router.get('/audit-logs', adminControllerInstance.getAuditLogs);

export default router;
