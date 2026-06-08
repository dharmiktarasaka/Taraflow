import { Router } from 'express';
import authRoutes from './v1/auth.routes.js';
import contentRoutes from './v1/content.routes.js';
import socialRoutes from './v1/social.routes.js';
import aiRoutes from './v1/ai.routes.js';
import brandProfileRoutes from './v1/brandProfile.routes.js';
import analyticsRoutes from './v1/analytics.routes.js';
import billingRoutes from './v1/billing.routes.js';
import adminRoutes from './v1/admin.routes.js';

const router = Router();

// Mount all v1 sub-routers
router.use('/auth', authRoutes);
router.use('/content', contentRoutes);
router.use('/social', socialRoutes);
router.use('/ai', aiRoutes);
router.use('/brand-profile', brandProfileRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/billing', billingRoutes);
router.use('/admin', adminRoutes);

export default router;
