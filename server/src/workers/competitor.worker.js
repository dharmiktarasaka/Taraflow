import { Worker } from 'bullmq';
import { getBullMQConnectionOptions } from '../queues/analytics.queue.js';
import competitorIntelligenceServiceInstance from '../services/competitorIntelligence.service.js';
import logger from '../utils/logger.util.js';

const connection = getBullMQConnectionOptions();

export const competitorWorker = new Worker(
  'competitor-analysis-queue',
  async (job) => {
    logger.info(`[BullMQ Worker] Processing competitor analysis job ${job.name} (ID: ${job.id})`);
    const { analysisId } = job.data;
    if (!analysisId) {
      throw new Error('Missing analysisId in competitor-analysis-queue job payload');
    }
    
    // Process the analysis
    await competitorIntelligenceServiceInstance.runFullAnalysis(analysisId);
  },
  {
    connection,
    concurrency: 2, // Allow 2 concurrent competitor analysis processes (heavy LLM/scraping)
  }
);

competitorWorker.on('failed', async (job, err) => {
  logger.error(`[BullMQ Worker] Worker competitor-analysis-queue job ${job?.id || 'unknown'} failed: ${err.message}`, err);
  // Attempt to mark the analysis as failed in the database
  try {
    const { analysisId } = job?.data || {};
    if (analysisId) {
      await competitorIntelligenceServiceInstance.markAsFailed(analysisId, err.message);
    }
  } catch (dbErr) {
    logger.error('[BullMQ Worker] Failed to mark competitor analysis as failed in DB:', dbErr);
  }
});

competitorWorker.on('error', (err) => {
  logger.error(`[BullMQ Worker] Worker competitor-analysis-queue encountered global error: ${err.message}`, err);
});

logger.info('[BullMQ Workers] Competitor background worker started successfully.');
export default competitorWorker;
