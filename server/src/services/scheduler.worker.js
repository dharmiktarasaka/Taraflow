import Post from '../models/post.model.js';
import { postPublisherServiceInstance } from './postPublisher.service.js';
import logger from '../utils/logger.util.js';

let intervalId = null;

export const checkAndPublishScheduledPosts = async () => {
  try {
    const now = new Date();
    // Find all scheduled posts that should be published by now
    const pendingPosts = await Post.find({
      status: 'SCHEDULED',
      scheduledAt: { $lte: now },
    });

    if (pendingPosts.length === 0) return;

    logger.info(`[Scheduler Worker] Found ${pendingPosts.length} scheduled posts pending execution. Processing...`);

    for (const post of pendingPosts) {
      try {
        post.status = 'PUBLISHING';
        await post.save();

        const publishResult = await postPublisherServiceInstance.publish(post);

        post.status = 'PUBLISHED';
        post.publishedAt = new Date();
        post.platformPostId = publishResult.platformPostId;
        post.publishError = null;
        await post.save();

        logger.info(`[Scheduler Worker] Successfully published post ${post._id} to ${post.platform}`);
      } catch (err) {
        post.status = 'FAILED';
        post.publishError = err.message || 'Unknown publishing error';
        await post.save();

        logger.error(`[Scheduler Worker] Failed to publish post ${post._id} to ${post.platform}: ${err.message}`);
      }
    }
  } catch (error) {
    logger.error('[Scheduler Worker] Error in scheduled post scan job:', error);
  }
};

export const startSchedulerWorker = () => {
  if (intervalId) {
    logger.warn('[Scheduler Worker] Worker is already running');
    return;
  }

  logger.info('[Scheduler Worker] Initializing periodic scheduled post scanner (30s interval)...');
  
  // Run initial scan immediately
  checkAndPublishScheduledPosts();

  // Schedule subsequent scans
  intervalId = setInterval(checkAndPublishScheduledPosts, 30000);
};

export const stopSchedulerWorker = () => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info('[Scheduler Worker] Stopped background scanner');
  }
};
