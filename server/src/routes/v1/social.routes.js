import { Router } from 'express';
import { socialControllerInstance } from '../../controllers/social.controller.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { requireWorkspaceMember } from '../../middlewares/workspace.middleware.js';

const router = Router();

// Protect all social routes with requireAuth
router.use(requireAuth);

router.get('/accounts', requireWorkspaceMember(), socialControllerInstance.getAccounts);
router.get('/connect/:platform', requireWorkspaceMember('Connect Social Accounts'), socialControllerInstance.getConnectUrl);
router.get('/reconnect/:platform', requireWorkspaceMember('Connect Social Accounts'), socialControllerInstance.reconnectAccount);
router.post('/callback/:platform', requireWorkspaceMember('Connect Social Accounts'), socialControllerInstance.callback);
router.delete('/accounts/:id', requireWorkspaceMember('Disconnect Accounts'), socialControllerInstance.disconnectAccount);

export default router;
