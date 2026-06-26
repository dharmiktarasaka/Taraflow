import { Router } from 'express';
import { analyticsControllerInstance } from '../../controllers/analytics.controller.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { requireWorkspaceMember } from '../../middlewares/workspace.middleware.js';

const router = Router();

// Public media proxy to bypass CORS/Hotlinking referer blocks on standard img tags
router.get('/proxy-media', analyticsControllerInstance.proxyMedia);

// Protect all other endpoints
router.use(requireAuth);

router.get('/overview', requireWorkspaceMember('Analytics'), analyticsControllerInstance.getOverview);
router.get('/top-posts', requireWorkspaceMember('Analytics'), analyticsControllerInstance.getTopPosts);
router.get('/posts/:id/analysis', requireWorkspaceMember('Analytics'), analyticsControllerInstance.getPostAnalysis);
router.post('/posts/:id/repost', requireWorkspaceMember('Create Posts'), analyticsControllerInstance.repostWithImprovements);
router.post('/seed', requireWorkspaceMember('Workspace Settings'), analyticsControllerInstance.seedMetrics);

// Historical Analytics routes
router.get('/history', requireWorkspaceMember('Analytics'), analyticsControllerInstance.getHistory);
router.post('/sync/:accountId', requireWorkspaceMember('Analytics'), analyticsControllerInstance.syncAccountManual);
router.post('/sync-all', requireWorkspaceMember('Analytics'), analyticsControllerInstance.syncAllAccountsManual);

export default router;
