import { Worker } from 'bullmq';
import { getBullMQConnectionOptions } from '../queues/analytics.queue.js';
import analyticsSyncServiceInstance from '../services/analyticsSync.service.js';
import historicalAnalyticsSyncServiceInstance from '../services/historicalAnalyticsSync.service.js';
import { refreshExpiringTokens } from '../services/socialRefresh.service.js';
import logger from '../utils/logger.util.js';

const connection = getBullMQConnectionOptions();

// Initialize worker for scanning and enqueuing users
export const syncAllUsersWorker = new Worker(
  'sync-all-users-queue',
  async (job) => {
    logger.info(`[BullMQ Worker] Processing job ${job.name} (ID: ${job.id})`);
    await analyticsSyncServiceInstance.syncAllUsers();
  },
  {
    connection,
    concurrency: 1 // Only one manager job running at a time
  }
);

// Initialize worker for syncing individual account metrics
export const syncAccountWorker = new Worker(
  'sync-account-queue',
  async (job) => {
    logger.info(`[BullMQ Worker] Processing job ${job.name} (ID: ${job.id})`);
    const { accountId } = job.data;
    if (!accountId) {
      throw new Error('Missing accountId in sync-account-queue job payload');
    }
    // 1. Sync feed posts and update database post metrics
    await analyticsSyncServiceInstance.syncAccount(accountId);
    // 2. Sync daily page and account metrics to HistoricalAnalytics
    await historicalAnalyticsSyncServiceInstance.syncAccountAnalytics(accountId, false);
  },
  {
    connection,
    concurrency: 5 // Allow 5 concurrent account fetches (non-blocking async requests)
  }
);

// Initialize worker for periodic token refreshes
export const refreshTokenWorker = new Worker(
  'refresh-token-queue',
  async (job) => {
    logger.info(`[BullMQ Worker] Processing job ${job.name} (ID: ${job.id})`);
    await refreshExpiringTokens();
  },
  {
    connection,
    concurrency: 1
  }
);

// Global Error Event Listeners
[syncAllUsersWorker, syncAccountWorker, refreshTokenWorker].forEach((worker) => {
  worker.on('failed', (job, err) => {
    logger.error(`[BullMQ Worker] Worker ${worker.name} job ${job?.id || 'unknown'} failed: ${err.message}`, err);
  });

  worker.on('error', (err) => {
    logger.error(`[BullMQ Worker] Worker ${worker.name} encountered global error: ${err.message}`, err);
  });
});

logger.info('[BullMQ Workers] Background workers started successfully.');
