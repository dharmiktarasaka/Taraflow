import { Router } from 'express';
import { competitorControllerInstance } from '../../controllers/competitor.controller.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';

const router = Router();

// Protect all competitor endpoints
router.use(requireAuth);

// Routes
router.get('/', competitorControllerInstance.getUserAnalyses);
router.get('/detect', competitorControllerInstance.detectCompetitors);
router.post('/analyze', competitorControllerInstance.startAnalysis);
router.get('/status/:id', competitorControllerInstance.getAnalysisStatus);
router.get('/download/:id/:format', competitorControllerInstance.downloadReport);
router.post('/accept', competitorControllerInstance.acceptRecommendations);
router.delete('/:id', competitorControllerInstance.deleteAnalysis);

export default router;
