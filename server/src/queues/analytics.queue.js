import { Queue } from 'bullmq';
import logger from '../utils/logger.util.js';

// Parse Redis URL for BullMQ (uses ioredis compatible options)
export const getBullMQConnectionOptions = () => {
  const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
  try {
    const parsed = new URL(redisUrl);
    return {
      host: parsed.hostname || '127.0.0.1',
      port: parsed.port ? parseInt(parsed.port, 10) : 6379,
      username: parsed.username || undefined,
      password: parsed.password || undefined,
      tls: parsed.protocol === 'rediss:' ? {} : undefined, // Enable TLS for secure connections (e.g., production Redis)
    };
  } catch (e) {
    logger.warn('[BullMQ] Failed to parse REDIS_URL, falling back to local defaults');
    return { host: '127.0.0.1', port: 6379 };
  }
};

const connection = getBullMQConnectionOptions();

// Initialize Queues
export const syncAllUsersQueue = new Queue('sync-all-users-queue', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000
    },
    removeOnComplete: true,
    removeOnFail: 100 // Keep last 100 failed jobs for debugging
  }
});

export const syncAccountQueue = new Queue('sync-account-queue', {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 10000
    },
    removeOnComplete: true,
    removeOnFail: 100
  }
});

export const refreshTokenQueue = new Queue('refresh-token-queue', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 60000
    },
    removeOnComplete: true,
    removeOnFail: 100
  }
});

// Register error handlers on all queues to prevent unhandled Redis connection failures from crashing the process
[syncAllUsersQueue, syncAccountQueue, refreshTokenQueue].forEach((queue) => {
  queue.on('error', (err) => {
    logger.warn(`[BullMQ Queue] Queue "${queue.name}" connection error: ${err.message}`);
  });
});

logger.info('[BullMQ] Queues initialized successfully.');
