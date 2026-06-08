import { Router } from 'express';
import { socialControllerInstance } from '../../controllers/social.controller.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';

const router = Router();

// Protect all social routes with requireAuth
router.use(requireAuth);

router.get('/accounts', socialControllerInstance.getAccounts);
router.get('/connect/:platform', socialControllerInstance.getConnectUrl);
router.get('/reconnect/:platform', socialControllerInstance.reconnectAccount);
router.post('/callback/:platform', socialControllerInstance.callback);
router.delete('/accounts/:id', socialControllerInstance.disconnectAccount);

export default router;
