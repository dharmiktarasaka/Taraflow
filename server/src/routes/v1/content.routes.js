import { Router } from 'express';
import { contentControllerInstance } from '../../controllers/content.controller.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';

const router = Router();

// Protect all content endpoints
router.use(requireAuth);

// Content Ideas Routes
router.get('/ideas', contentControllerInstance.getContentIdeas);
router.post('/ideas', contentControllerInstance.createContentIdea);
router.get('/ideas/:id', contentControllerInstance.getContentIdeaById);
router.put('/ideas/:id', contentControllerInstance.updateContentIdea);
router.delete('/ideas/:id', contentControllerInstance.deleteContentIdea);
router.post('/ideas/:id/schedule', contentControllerInstance.scheduleContentIdea);

// Posts Routes
router.get('/posts', contentControllerInstance.getPosts);
router.post('/posts', contentControllerInstance.createPost);
router.get('/posts/:id', contentControllerInstance.getPostById);
router.put('/posts/:id', contentControllerInstance.updatePost);
router.delete('/posts/:id', contentControllerInstance.deletePost);
router.post('/posts/:id/publish-now', contentControllerInstance.publishPostNow);

export default router;
