import { Router } from 'express';
import { aiSuggestionsControllerInstance } from '../../controllers/aiSuggestions.controller.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { requireWorkspaceMember } from '../../middlewares/workspace.middleware.js';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// GET  /api/v1/ai-suggestions          — Generate AI suggestions from real analytics data
router.get('/', requireWorkspaceMember('Approve AI'), aiSuggestionsControllerInstance.getSuggestions);

// GET    /api/v1/ai-suggestions/learning-profile — Get user's learning profile
router.get('/learning-profile', requireWorkspaceMember(), aiSuggestionsControllerInstance.getLearningProfile);

// PATCH  /api/v1/ai-suggestions/learning-profile — Toggle learningEnabled
router.patch('/learning-profile', requireWorkspaceMember('Workspace Settings'), aiSuggestionsControllerInstance.patchLearningProfile);

// DELETE /api/v1/ai-suggestions/learning-profile — Hard delete (GDPR erasure)
router.delete('/learning-profile', requireWorkspaceMember('Workspace Settings'), aiSuggestionsControllerInstance.deleteLearningProfile);

export default router;
