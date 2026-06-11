import Post from '../models/post.model.js';
import SocialAccount from '../models/socialAccount.model.js';
import Analytics from '../models/analytics.model.js';
import PostAnalyticsSnapshot from '../models/postAnalyticsSnapshot.model.js';
import { analyticsControllerInstance } from '../controllers/analytics.controller.js';
import { decrypt } from '../utils/encryption.js';
import logger from '../utils/logger.util.js';
import { syncAccountQueue } from '../queues/analytics.queue.js';
import { getRedisClient } from '../config/redis.config.js';

class AnalyticsSyncService {
  /**
   * Scan all users and connected accounts, then enqueue them for background sync.
   */
  async syncAllUsers() {
    try {
      logger.info('[Analytics Sync] Starting background scan for all social accounts...');
      const accounts = await SocialAccount.find({});
      
      if (accounts.length === 0) {
        logger.info('[Analytics Sync] No social accounts found to sync.');
        return;
      }

      for (const account of accounts) {
        await syncAccountQueue.add(`sync-account-${account._id}`, {
          accountId: account._id.toString()
        });
      }

      logger.info(`[Analytics Sync] Enqueued ${accounts.length} social accounts for background metrics sync.`);
    } catch (err) {
      logger.error('[Analytics Sync] Failed to scan and enqueue account syncs:', err);
    }
  }

  /**
   * Sync a single social account's post feeds, engagement metrics, and daily followers.
   */
  async syncAccount(accountId) {
    try {
      const account = await SocialAccount.findById(accountId);
      if (!account) {
        logger.warn(`[Analytics Sync] Social account ${accountId} not found in database.`);
        return;
      }

      logger.info(`[Analytics Sync] Syncing metrics for ${account.platform} account: ${account.platformUsername || account.platformAccountId}`);

      const token = decrypt(account.accessToken);
      let feedPosts = [];
      let totalLiveFollowers = 0;

      // 1. Fetch live metrics from official API feeds
      if (account.platform === 'facebook') {
        feedPosts = await analyticsControllerInstance.fetchFacebookPageFeed(account.platformAccountId, token);
        try {
          const fbRes = await fetch(`https://graph.facebook.com/v19.0/${account.platformAccountId}?fields=fan_count,followers_count`, {
            headers: { Authorization: `Bearer ${token}` }
          }).then(r => r.json());
          if (fbRes && !fbRes.error) {
            totalLiveFollowers = fbRes.followers_count || fbRes.fan_count || 0;
          }
        } catch (err) {
          logger.warn(`[Analytics Sync] Failed to fetch Facebook followers: ${err.message}`);
        }
      } else if (account.platform === 'instagram') {
        feedPosts = await analyticsControllerInstance.fetchInstagramMediaFeed(account.platformAccountId, token);
        try {
          const igRes = await fetch(`https://graph.facebook.com/v19.0/${account.platformAccountId}?fields=followers_count`, {
            headers: { Authorization: `Bearer ${token}` }
          }).then(r => r.json());
          if (igRes && !igRes.error) {
            totalLiveFollowers = igRes.followers_count || 0;
          }
        } catch (err) {
          logger.warn(`[Analytics Sync] Failed to fetch Instagram followers: ${err.message}`);
        }
      } else if (account.platform === 'threads') {
        feedPosts = await analyticsControllerInstance.fetchThreadsFeed(account.platformAccountId, token);
        // Threads API currently does not expose followers count
        totalLiveFollowers = 0;
      } else if (account.platform === 'linkedin') {
        feedPosts = await analyticsControllerInstance.fetchLinkedInFeed(account.platformAccountId, token);
        try {
          const author = account.platformAccountId.startsWith('urn:li:') ? account.platformAccountId : `urn:li:person:${account.platformAccountId}`;
          const liRes = await fetch(`https://api.linkedin.com/v2/networkSizes/${author}?edgeType=CompanyFollowed`, {
            headers: { Authorization: `Bearer ${token}` }
          }).then(r => r.json());
          if (liRes && !liRes.error) {
            totalLiveFollowers = liRes.firstDegreeSize || 0;
          }
        } catch (err) {
          logger.warn(`[Analytics Sync] Failed to fetch LinkedIn followers: ${err.message}`);
        }
      }

      if (!feedPosts || feedPosts.length === 0) {
        logger.info(`[Analytics Sync] No recent posts found for ${account.platform} account ${account._id}`);
      }

      // 2. Map and update local Post records and save Post Analytics snapshots
      let sumLikes = 0;
      let sumComments = 0;
      let sumShares = 0;
      let sumImpressions = 0;
      let sumReach = 0;
      let sumClicks = 0;
      let sumSaves = 0;
      let sumVideoViews = 0;

      for (const item of feedPosts) {
        sumLikes += item.likes || 0;
        sumComments += item.comments || 0;
        sumShares += item.shares || 0;
        sumImpressions += item.impressions || 0;
        sumReach += item.reach || 0;
        sumClicks += item.clicks || 0;
        sumSaves += item.saves || 0;
        sumVideoViews += item.videoViews || 0;

        // Try to update any existing published posts in our DB
        const postIdOptions = [item.id];
        if (account.platform === 'facebook' && item.id.includes('_')) {
          postIdOptions.push(item.id.split('_')[1]);
        }
        if (account.platform === 'instagram') {
          postIdOptions.push(item.id);
        }
        const post = await Post.findOne({
          createdBy: account.user,
          platform: account.platform,
          platformPostId: { $in: postIdOptions }
        });

        if (post) {
          post.likes = item.likes ?? post.likes;
          post.comments = item.comments ?? post.comments;
          post.shares = item.shares ?? post.shares;
          post.impressions = item.impressions ?? post.impressions;
          post.reach = item.reach ?? post.reach;
          post.clicks = item.clicks ?? post.clicks;
          post.saves = item.saves ?? post.saves;
          post.videoViews = item.videoViews ?? post.videoViews;
          post.engagementRate = item.engagementRate ?? post.engagementRate;
          if (item.publishedAt) {
            post.publishedAt = item.publishedAt;
          }
          await post.save();

          // Save timeline trend snapshot
          await PostAnalyticsSnapshot.create({
            postId: post._id,
            likes: post.likes,
            comments: post.comments,
            shares: post.shares,
            impressions: post.impressions,
            reach: post.reach,
            clicks: post.clicks,
            saves: post.saves,
            videoViews: post.videoViews
          });
        }
      }

      // 3. Persist Daily Aggregated Metrics for Trend analysis
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await Analytics.findOneAndUpdate(
        { userId: account.user, date: today, platform: account.platform },
        {
          followers: totalLiveFollowers,
          impressions: sumImpressions,
          reach: sumReach,
          likes: sumLikes,
          comments: sumComments,
          shares: sumShares,
          clicks: sumClicks,
          saves: sumSaves,
          videoViews: sumVideoViews,
          engagementRate: sumReach > 0 ? parseFloat((((sumLikes + sumComments + sumShares) / sumReach) * 100).toFixed(2)) : 0
        },
        { upsert: true, new: true }
      );

      // Invalidate Redis caches for this user
      const redisClient = getRedisClient();
      if (redisClient) {
        try {
          const keys = await redisClient.keys(`user:analytics:${account.user}:*`);
          const topPostKeys = await redisClient.keys(`user:topposts:${account.user}:*`);
          const allKeys = [...keys, ...topPostKeys];
          if (allKeys.length > 0) {
            await redisClient.del(allKeys);
            logger.info(`[Analytics Cache] Invalidated ${allKeys.length} cache keys for user ${account.user}`);
          }
        } catch (cacheErr) {
          logger.warn(`[Analytics Cache] Failed to invalidate cache for user ${account.user}: ${cacheErr.message}`);
        }
      }

      logger.info(`[Analytics Sync] Successfully synced metrics for ${account.platform} (${account.platformAccountId}). Followers: ${totalLiveFollowers}, Posts parsed: ${feedPosts.length}`);
    } catch (err) {
      logger.error(`[Analytics Sync] Failed syncing account ${accountId}:`, err);
      throw err;
    }
  }
}

export const analyticsSyncServiceInstance = new AnalyticsSyncService();
export default analyticsSyncServiceInstance;
