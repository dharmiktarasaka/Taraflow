import { Queue } from 'bullmq';
import { getBullMQConnectionOptions } from './analytics.queue.js';
import logger from '../utils/logger.util.js';

const connection = getBullMQConnectionOptions();

export const competitorQueue = new Queue('competitor-analysis-queue', {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 10000,
    },
    removeOnComplete: true,
    removeOnFail: 100, // Keep last 100 failed analyses for debugging
  },
});

competitorQueue.on('error', (err) => {
  logger.warn(`[BullMQ Queue] Queue "competitor-analysis-queue" connection error: ${err.message}`);
});

logger.info('[BullMQ] Competitor analysis queue initialized successfully.');
