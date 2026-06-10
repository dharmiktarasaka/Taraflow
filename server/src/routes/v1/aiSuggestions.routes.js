import { Router } from 'express';
import { aiSuggestionsControllerInstance } from '../../controllers/aiSuggestions.controller.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// GET  /api/v1/ai-suggestions          — Generate AI suggestions from real analytics data
// Query params: platform (all|linkedin|instagram|facebook|threads), refresh (true|false)
router.get('/', aiSuggestionsControllerInstance.getSuggestions);

// GET    /api/v1/ai-suggestions/learning-profile — Get user's learning profile (transparency)
router.get('/learning-profile', aiSuggestionsControllerInstance.getLearningProfile);

// PATCH  /api/v1/ai-suggestions/learning-profile — Toggle learningEnabled (opt-in/opt-out)
router.patch('/learning-profile', aiSuggestionsControllerInstance.patchLearningProfile);

// DELETE /api/v1/ai-suggestions/learning-profile — Hard delete (GDPR erasure)
router.delete('/learning-profile', aiSuggestionsControllerInstance.deleteLearningProfile);

export default router;
