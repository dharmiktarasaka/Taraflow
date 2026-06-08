import { createClient } from 'redis';
import logger from '../utils/logger.util.js';
import net from 'net';

let redisClient = null;

const checkRedisPort = (host, port) => {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port, timeout: 1000 });
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('error', () => {
      resolve(false);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
  });
};

export const connectRedis = async () => {
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    
    // Parse host and port for availability pre-check
    let host = '127.0.0.1';
    let port = 6379;
    try {
      const parsed = new URL(redisUrl);
      host = parsed.hostname || '127.0.0.1';
      port = parsed.port ? parseInt(parsed.port, 10) : 6379;
    } catch (e) {
      // Ignore parsing errors and default to local defaults
    }

    // Fast check: if port is closed, skip connection to prevent 12s delay and ECONNREFUSED log spam
    const isRedisAvailable = await checkRedisPort(host, port);
    if (!isRedisAvailable) {
      logger.warn(`Redis is not running at ${host}:${port}. Operating without Redis caching.`);
      redisClient = null;
      return null;
    }

    redisClient = createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 5) {
            logger.warn('Redis reconnection failed after 5 attempts. Operating without Redis caching.');
            return false; // Stop retrying
          }
          return Math.min(retries * 1000, 3000); // Backoff retry delay
        }
      }
    });

    redisClient.on('connect', () => {
      logger.info('Redis client connecting...');
    });

    redisClient.on('ready', () => {
      logger.info('Redis client connected and ready');
    });

    redisClient.on('error', (err) => {
      logger.error(`Redis error: ${err}`);
    });

    redisClient.on('end', () => {
      logger.warn('Redis connection closed');
    });

    await redisClient.connect();
    return redisClient;
  } catch (error) {
    logger.error(`Failed to connect to Redis: ${error.message}`);
    return null;
  }
};

export const getRedisClient = () => redisClient;
