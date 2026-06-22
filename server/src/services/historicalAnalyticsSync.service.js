import SocialAccount from '../models/socialAccount.model.js';
import HistoricalAnalytics from '../models/historicalAnalytics.model.js';
import Post from '../models/post.model.js';
import { decrypt } from '../utils/encryption.js';
import logger from '../utils/logger.util.js';

// Standard fetch helper that handles API errors and maps token expiration
async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.json();
  if (!response.ok || body?.error) {
    const errorMsg = body?.error?.message || `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }
  return body;
}

class HistoricalAnalyticsSyncService {
  /**
   * Sync historical or daily analytics for a single social account.
   * @param {string} accountId - Social account database ID
   * @param {boolean} isHistorical - True if syncing history (first connect), false for daily cron sync
   */
  async syncAccountAnalytics(accountId, isHistorical = false) {
    const account = await SocialAccount.findById(accountId);
    if (!account) {
      throw new Error(`Social account ${accountId} not found.`);
    }

    const platform = account.platform;
    const userId = account.user;

    // Skip LinkedIn as it is publishing-only
    if (platform === 'linkedin') {
      logger.info(`[Analytics Sync] LinkedIn account ${account.platformUsername} is publishing-only, skipping API sync.`);
      // Aggregate local post history instead if available
      await this.syncPostAggregatesOnly(account, isHistorical);
      return;
    }

    const token = decrypt(account.accessToken);
    const now = new Date();
    const numDays = 30; // Sync 30 days of data
    const since = Math.floor((Date.now() - numDays * 24 * 60 * 60 * 1000) / 1000);
    const until = Math.floor(Date.now() / 1000);

    try {
      if (platform === 'facebook') {
        await this.syncFacebookAnalytics(account, token, since, until, isHistorical);
      } else if (platform === 'instagram') {
        await this.syncInstagramAnalytics(account, token, since, until, isHistorical);
      } else {
        // Fallback for Threads / other platforms that don't support Insights API
        await this.syncPostAggregatesOnly(account, isHistorical);
      }

      // Reset reconnect flag on success
      if (account.metadata?.needsReconnect) {
        account.metadata.needsReconnect = false;
        account.markModified('metadata');
        await account.save();
      }
    } catch (err) {
      logger.error(`[Analytics Sync Error] Failed for ${platform} (${account.platformUsername}): ${err.message}`);
      
      // If auth token validation fails, flag account for reconnection
      const isAuthError = err.message.includes('token') || 
                          err.message.includes('OAuth') || 
                          err.message.includes('session') || 
                          err.message.includes('validate') || 
                          err.message.includes('deauthorized') ||
                          err.message.includes('deleted');
                          
      if (isAuthError) {
        account.metadata = account.metadata || {};
        account.metadata.needsReconnect = true;
        account.markModified('metadata');
        await account.save();
        logger.warn(`[Analytics Sync] Marked ${platform} account ${account.platformUsername} as needs reconnect.`);
      }
      throw err;
    }
  }

  /**
   * Facebook Insights sync
   */
  async syncFacebookAnalytics(account, token, since, until, isHistorical) {
    const pageId = account.platformAccountId;
    const url = `https://graph.facebook.com/v19.0/${pageId}/insights?metric=page_impressions,page_reach,page_fans,page_actions_post_reactions_total,page_video_views,page_views_total&period=day&since=${since}&until=${until}&access_token=${token}`;
    
    const insightsResponse = await fetchJson(url);
    const insightsData = insightsResponse.data || [];

    // Map Facebook metrics
    const metricMapping = {
      page_impressions: 'impressions',
      page_reach: 'reach',
      page_fans: 'followers',
      page_actions_post_reactions_total: 'engagement',
      page_video_views: 'videoViews',
      page_views_total: 'clicks'
    };

    const records = [];
    
    for (const metricObj of insightsData) {
      const dbMetricName = metricMapping[metricObj.name];
      if (!dbMetricName) continue;

      for (const valObj of metricObj.values || []) {
        const metricDate = new Date(valObj.end_time);
        
        records.push({
          userId: account.user,
          accountId: account._id,
          platform: 'facebook',
          metricName: dbMetricName,
          metricValue: valObj.value || 0,
          metricDate,
          source: 'platform_api',
          isHistorical,
          isAfterConnection: !isHistorical,
          rawApiResponse: valObj
        });
      }
    }

    // Upsert to DB
    for (const r of records) {
      await HistoricalAnalytics.findOneAndUpdate(
        { accountId: r.accountId, metricName: r.metricName, metricDate: r.metricDate },
        { $set: r },
        { upsert: true, new: true }
      );
    }

    logger.info(`[Analytics Sync] Successfully upserted ${records.length} Facebook historical analytics records.`);
  }

  /**
   * Instagram Insights sync
   */
  async syncInstagramAnalytics(account, token, since, until, isHistorical) {
    const igUserId = account.platformAccountId;
    const url = `https://graph.facebook.com/v19.0/${igUserId}/insights?metric=impressions,reach,profile_views,website_clicks,follower_count&period=day&since=${since}&until=${until}&access_token=${token}`;

    const insightsResponse = await fetchJson(url);
    const insightsData = insightsResponse.data || [];

    // Fetch current follower count for IG
    const profileUrl = `https://graph.facebook.com/v19.0/${igUserId}?fields=followers_count&access_token=${token}`;
    const profileResponse = await fetchJson(profileUrl);
    const liveFollowers = profileResponse.followers_count || 0;

    const followerChangeMetric = insightsData.find(item => item.name === 'follower_count');
    const otherMetrics = insightsData.filter(item => item.name !== 'follower_count');

    const records = [];

    // 1. Store other direct metrics (impressions, reach, profile_views, website_clicks)
    const metricMapping = {
      impressions: 'impressions',
      reach: 'reach',
      profile_views: 'clicks',
      website_clicks: 'clicks'
    };

    for (const metricObj of otherMetrics) {
      const dbMetricName = metricMapping[metricObj.name];
      if (!dbMetricName) continue;

      for (const valObj of metricObj.values || []) {
        const metricDate = new Date(valObj.end_time);

        records.push({
          userId: account.user,
          accountId: account._id,
          platform: 'instagram',
          metricName: dbMetricName,
          metricValue: valObj.value || 0,
          metricDate,
          source: 'platform_api',
          isHistorical,
          isAfterConnection: !isHistorical,
          rawApiResponse: valObj
        });
      }
    }

    // 2. Compute historical daily followers walk back from live followers
    if (followerChangeMetric && followerChangeMetric.values) {
      // Sort changes descending by time to walk backward
      const sortedChanges = [...followerChangeMetric.values].sort(
        (a, b) => new Date(b.end_time).getTime() - new Date(a.end_time).getTime()
      );

      let runningFollowers = liveFollowers;

      for (const changeObj of sortedChanges) {
        const metricDate = new Date(changeObj.end_time);
        
        records.push({
          userId: account.user,
          accountId: account._id,
          platform: 'instagram',
          metricName: 'followers',
          metricValue: runningFollowers,
          metricDate,
          source: 'platform_api',
          isHistorical,
          isAfterConnection: !isHistorical,
          rawApiResponse: changeObj
        });

        // Subtract the change to find the count before this day
        const change = changeObj.value || 0;
        runningFollowers = Math.max(0, runningFollowers - change);
      }
    } else {
      // If follower change metrics are not available, store a baseline record of current followers
      records.push({
        userId: account.user,
        accountId: account._id,
        platform: 'instagram',
        metricName: 'followers',
        metricValue: liveFollowers,
        metricDate: new Date(),
        source: 'platform_api',
        isHistorical,
        isAfterConnection: !isHistorical,
        rawApiResponse: profileResponse
      });
    }

    // Upsert to DB
    for (const r of records) {
      await HistoricalAnalytics.findOneAndUpdate(
        { accountId: r.accountId, metricName: r.metricName, metricDate: r.metricDate },
        { $set: r },
        { upsert: true, new: true }
      );
    }

    logger.info(`[Analytics Sync] Successfully upserted ${records.length} Instagram historical analytics records.`);
  }

  /**
   * Aggregate posts by date for other platforms as fallback
   */
  async syncPostAggregatesOnly(account, isHistorical) {
    const userId = account.user;
    const userPosts = await Post.find({
      createdBy: userId,
      platform: account.platform,
      status: 'PUBLISHED'
    });

    const dailyPostMetrics = {};
    userPosts.forEach(post => {
      const postDate = post.publishedAt || post.createdAt;
      if (!postDate) return;
      
      const dateKey = new Date(postDate);
      dateKey.setHours(12, 0, 0, 0); // normalize hour
      const dateStr = dateKey.toISOString().split('T')[0];

      if (!dailyPostMetrics[dateStr]) {
        dailyPostMetrics[dateStr] = {
          date: dateKey,
          likes: 0,
          comments: 0,
          shares: 0,
          reach: 0,
          impressions: 0,
          clicks: 0,
          videoViews: 0
        };
      }

      dailyPostMetrics[dateStr].likes += post.likes || 0;
      dailyPostMetrics[dateStr].comments += post.comments || 0;
      dailyPostMetrics[dateStr].shares += post.shares || 0;
      dailyPostMetrics[dateStr].reach += post.reach || 0;
      dailyPostMetrics[dateStr].impressions += post.impressions || 0;
      dailyPostMetrics[dateStr].clicks += post.clicks || 0;
      dailyPostMetrics[dateStr].videoViews += post.videoViews || 0;
    });

    const records = [];
    const metricsToSave = ['impressions', 'reach', 'likes', 'comments', 'shares', 'clicks', 'videoViews'];

    Object.values(dailyPostMetrics).forEach(dayData => {
      const engagementCount = dayData.likes + dayData.comments + dayData.shares;
      
      metricsToSave.forEach(metricName => {
        let value = 0;
        if (metricName === 'engagement') value = engagementCount;
        else value = dayData[metricName] || 0;

        records.push({
          userId,
          accountId: account._id,
          platform: account.platform,
          metricName,
          metricValue: value,
          metricDate: dayData.date,
          source: 'post_aggregate',
          isHistorical,
          isAfterConnection: !isHistorical,
          rawApiResponse: {}
        });
      });
    });

    // Upsert
    for (const r of records) {
      await HistoricalAnalytics.findOneAndUpdate(
        { accountId: r.accountId, metricName: r.metricName, metricDate: r.metricDate },
        { $set: r },
        { upsert: true, new: true }
      );
    }

    logger.info(`[Analytics Sync] Successfully aggregated post metrics for ${account.platform} account: ${account.platformUsername} (${records.length} metrics).`);
  }

  /**
   * Sync all connected accounts. Called by repeatable scheduler.
   */
  async syncAllAccounts() {
    logger.info('[Analytics Sync Job] Starting daily scheduled sync for all accounts...');
    const accounts = await SocialAccount.find({});
    
    for (const account of accounts) {
      try {
        await this.syncAccountAnalytics(account._id, false);
      } catch (err) {
        logger.error(`[Analytics Sync Job] Failed for account ${account._id}: ${err.message}`);
      }
    }
    logger.info('[Analytics Sync Job] Finished scheduled sync for all accounts.');
  }
}

export const historicalAnalyticsSyncServiceInstance = new HistoricalAnalyticsSyncService();
export default historicalAnalyticsSyncServiceInstance;
