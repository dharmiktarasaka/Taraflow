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
  const server = app.listen(PORT, () => {
    logger.info(`Server successfully started on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
    
    // Start background social token refresh worker (checks daily)
    refreshExpiringTokens();
    setInterval(refreshExpiringTokens, 24 * 60 * 60 * 1000);

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
