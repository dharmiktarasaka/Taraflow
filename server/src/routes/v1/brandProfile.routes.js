import { Router } from 'express';
import { brandProfileControllerInstance } from '../../controllers/brandProfile.controller.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { requireWorkspaceMember } from '../../middlewares/workspace.middleware.js';

const router = Router();

// Protect all brand profile endpoints
router.use(requireAuth);

router.get('/', requireWorkspaceMember(), brandProfileControllerInstance.getProfile);
router.post('/', requireWorkspaceMember('Workspace Settings'), brandProfileControllerInstance.saveProfile);

export default router;
