import { Router } from 'express';
import { aiControllerInstance } from '../../controllers/ai.controller.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { requireWorkspaceMember } from '../../middlewares/workspace.middleware.js';

const router = Router();

// Protect all AI endpoints
router.use(requireAuth);

// Content generation route
router.post('/generate', requireWorkspaceMember('Create Posts'), aiControllerInstance.generateContent);

export default router;
