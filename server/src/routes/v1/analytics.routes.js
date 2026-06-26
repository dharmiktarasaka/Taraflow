import { Router } from 'express';
import { analyticsControllerInstance } from '../../controllers/analytics.controller.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';

const router = Router();

// Public media proxy to bypass CORS/Hotlinking referer blocks on standard img tags
router.get('/proxy-media', analyticsControllerInstance.proxyMedia);

// Protect all other endpoints
router.use(requireAuth);

router.get('/overview', analyticsControllerInstance.getOverview);
router.get('/top-posts', analyticsControllerInstance.getTopPosts);
router.get('/posts/:id/analysis', analyticsControllerInstance.getPostAnalysis);
router.post('/posts/:id/repost', analyticsControllerInstance.repostWithImprovements);
router.post('/seed', analyticsControllerInstance.seedMetrics);

// Historical Analytics routes
router.get('/history', analyticsControllerInstance.getHistory);
router.post('/sync/:accountId', analyticsControllerInstance.syncAccountManual);
router.post('/sync-all', analyticsControllerInstance.syncAllAccountsManual);

export default router;
