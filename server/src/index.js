import 'dotenv/config';
import app from './app.js';
import { connectDB } from './config/db.config.js';
import { connectRedis } from './config/redis.config.js';
import logger from './utils/logger.util.js';
import mongoose from 'mongoose';
import { getRedisClient } from './config/redis.config.js';
import { refreshExpiringTokens } from './services/socialRefresh.service.js';
import { startSchedulerWorker } from './services/scheduler.worker.js';

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  // 1. Connect MongoDB
  await connectDB();

  // 2. Connect Redis
  await connectRedis();

  // 3. Start Express Listener
  const server = app.listen(PORT, async () => {
    logger.info(`Server successfully started on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);

    const redisClient = getRedisClient();
    if (redisClient) {
      try {
        // Import queues and workers to register them
        const { syncAllUsersQueue, refreshTokenQueue } = await import('./queues/analytics.queue.js');
        await import('./workers/analytics.worker.js');

        // Schedule repeating background job: Sync all users' metrics (every 6 hours)
        await syncAllUsersQueue.add('sync-all-users-repeatable-job', {}, {
          repeat: {
            pattern: '0 */6 * * *'
          }
        });

        // Schedule repeating background job: Token refresh (every 24 hours / daily)
        await refreshTokenQueue.add('refresh-tokens-repeatable-job', {}, {
          repeat: {
            pattern: '0 0 * * *'
          }
        });

        logger.info('[BullMQ Scheduler] Repeatable background sync and token refresh jobs scheduled.');
        
        // Trigger initial scan on startup
        await syncAllUsersQueue.add('startup-sync-all-users', {});
        await refreshTokenQueue.add('startup-refresh-tokens', {});
      } catch (queueErr) {
        logger.error('[BullMQ Scheduler] Failed to schedule repeatable queue jobs:', queueErr);
      }
    } else {
      logger.warn('[BullMQ Scheduler] Redis is offline. Background sync queue scheduler is disabled.');
    }

    // Start background scheduled posts processor (checks every 30s)
    startSchedulerWorker();
  });

  // Set HTTP server timeout to 5 minutes to handle long-running LLM completion tasks
  server.timeout = 300000;

  // Graceful Shutdown Handler
  const shutdown = async (signal) => {
    logger.warn(`${signal} received. Initiating graceful shutdown...`);
    
    server.close(async () => {
      logger.info('HTTP server closed.');
      
      try {
        // Close MongoDB connection
        await mongoose.connection.close(false);
        logger.info('MongoDB connection closed.');

        // Close Redis connection
        const redisClient = getRedisClient();
        if (redisClient) {
          await redisClient.quit();
          logger.info('Redis connection closed.');
        }

        logger.info('Graceful shutdown completed successfully.');
        process.exit(0);
      } catch (err) {
        logger.error(`Error during graceful shutdown: ${err.message}`);
        process.exit(1);
      }
    });

    // Force close server after 10s timeout
    setTimeout(() => {
      logger.error('Graceful shutdown timed out. Forcing process exit.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

startServer().catch((error) => {
  logger.error(`Critical startup failure: ${error.message}`);
  process.exit(1);
});
