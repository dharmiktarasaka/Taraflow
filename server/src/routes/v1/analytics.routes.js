import { Router } from 'express';
import { analyticsControllerInstance } from '../../controllers/analytics.controller.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';

const router = Router();

// Protect all endpoints
router.use(requireAuth);

router.get('/overview', analyticsControllerInstance.getOverview);
router.get('/top-posts', analyticsControllerInstance.getTopPosts);
router.post('/seed', analyticsControllerInstance.seedMetrics);

export default router;
