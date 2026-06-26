import { Router } from 'express';
import { competitorControllerInstance } from '../../controllers/competitor.controller.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { requireWorkspaceMember } from '../../middlewares/workspace.middleware.js';

const router = Router();

// Protect all competitor endpoints
router.use(requireAuth);

// Routes
router.get('/', requireWorkspaceMember('Competitor Analysis'), competitorControllerInstance.getUserAnalyses);
router.get('/detect', requireWorkspaceMember('Competitor Analysis'), competitorControllerInstance.detectCompetitors);
router.post('/analyze', requireWorkspaceMember('Competitor Analysis'), competitorControllerInstance.startAnalysis);
router.get('/status/:id', requireWorkspaceMember('Competitor Analysis'), competitorControllerInstance.getAnalysisStatus);
router.get('/download/:id/:format', requireWorkspaceMember('Competitor Analysis'), competitorControllerInstance.downloadReport);
router.post('/accept', requireWorkspaceMember('Competitor Analysis'), competitorControllerInstance.acceptRecommendations);
router.delete('/:id', requireWorkspaceMember('Competitor Analysis'), competitorControllerInstance.deleteAnalysis);

export default router;
