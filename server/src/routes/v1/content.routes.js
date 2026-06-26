import { Router } from 'express';
import { contentControllerInstance } from '../../controllers/content.controller.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { requireWorkspaceMember } from '../../middlewares/workspace.middleware.js';

const router = Router();

// Public media endpoint (no requireAuth)
router.get('/posts/:id/media', contentControllerInstance.getPostMediaPublic);

// Protect all content endpoints
router.use(requireAuth);

// Content Ideas Routes
router.get('/ideas', requireWorkspaceMember(), contentControllerInstance.getContentIdeas);
router.post('/ideas', requireWorkspaceMember('Create Posts'), contentControllerInstance.createContentIdea);
router.get('/ideas/:id', requireWorkspaceMember(), contentControllerInstance.getContentIdeaById);
router.put('/ideas/:id', requireWorkspaceMember('Create Posts'), contentControllerInstance.updateContentIdea);
router.delete('/ideas/:id', requireWorkspaceMember('Delete Posts'), contentControllerInstance.deleteContentIdea);
router.post('/ideas/:id/schedule', requireWorkspaceMember('Create Posts'), contentControllerInstance.scheduleContentIdea);

// Posts Routes
router.get('/posts', requireWorkspaceMember(), contentControllerInstance.getPosts);
router.post('/posts', requireWorkspaceMember('Create Posts'), contentControllerInstance.createPost);
router.get('/posts/:id', requireWorkspaceMember(), contentControllerInstance.getPostById);
router.put('/posts/:id', requireWorkspaceMember('Create Posts'), contentControllerInstance.updatePost);
router.delete('/posts/:id', requireWorkspaceMember('Delete Posts'), contentControllerInstance.deletePost);
router.post('/posts/:id/publish-now', requireWorkspaceMember('Create Posts'), contentControllerInstance.publishPostNow);

export default router;
