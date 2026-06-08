import { Router } from 'express';
import { brandProfileControllerInstance } from '../../controllers/brandProfile.controller.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';

const router = Router();

// Protect all brand profile endpoints
router.use(requireAuth);

router.get('/', brandProfileControllerInstance.getProfile);
router.post('/', brandProfileControllerInstance.saveProfile);

export default router;
