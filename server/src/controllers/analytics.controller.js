import mongoose from 'mongoose';
import Post from '../models/post.model.js';
import SocialAccount from '../models/socialAccount.model.js';
import Analytics from '../models/analytics.model.js';
import AiLearningProfile from '../models/aiLearningProfile.model.js';
import { decrypt, encrypt } from '../utils/encryption.js';
import { BadRequestError } from '../utils/errors.util.js';
import logger from '../utils/logger.util.js';
import { getRedisClient } from '../config/redis.config.js';
import HistoricalAnalytics from '../models/historicalAnalytics.model.js';
import { historicalAnalyticsSyncServiceInstance } from '../services/historicalAnalyticsSync.service.js';

class AnalyticsController {
  constructor() {
    this.getOverview = this.getOverview.bind(this);
    this.getTopPosts = this.getTopPosts.bind(this);
    this.seedMetrics = this.seedMetrics.bind(this);
    this.getPostAnalysis = this.getPostAnalysis.bind(this);
    this.repostWithImprovements = this.repostWithImprovements.bind(this);
    this.getHistory = this.getHistory.bind(this);
    this.syncAccountManual = this.syncAccountManual.bind(this);
    this.syncAllAccountsManual = this.syncAllAccountsManual.bind(this);
    this.proxyMedia = this.proxyMedia.bind(this);
  }

  buildMetrics({ likes = 0, comments = 0, shares = 0, reach = null, impressions = null, clicks = null, saves = null, videoViews = null, profileVisits = null }) {
    const realReach = Number.isFinite(reach) ? reach : null;
    const realImpressions = Number.isFinite(impressions) ? impressions : null;
    const realClicks = Number.isFinite(clicks) ? clicks : null;
    const realSaves = Number.isFinite(saves) ? saves : null;
    const realVideoViews = Number.isFinite(videoViews) ? videoViews : null;
    const realProfileVisits = Number.isFinite(profileVisits) ? profileVisits : null;

    const engagementRate = realReach > 0
      ? parseFloat((((likes + comments + shares) / realReach) * 100).toFixed(2))
      : realImpressions > 0
        ? parseFloat((((likes + comments + shares) / realImpressions) * 100).toFixed(2))
        : null;

    return {
      likes,
      comments,
      shares,
      reach: realReach,
      impressions: realImpressions,
      clicks: realClicks,
      saves: realSaves,
      videoViews: realVideoViews,
      profileVisits: realProfileVisits,
      engagementRate
    };
  }

  getInsightValue(insights, names) {
    const data = insights?.data || [];
    const metric = data.find(item => names.includes(item.name));
    const value = metric?.values?.[0]?.value ?? metric?.total_value?.value;
    return Number.isFinite(value) ? value : null;
  }

  async fetchJson(url, options = {}) {
    const response = await fetch(url, options);
    const body = await response.json();
    if (!response.ok || body?.error) {
      throw new Error(body?.error?.message || `Request failed with status ${response.status}`);
    }
    return body;
  }

  async fetchInsights(endpoint, metrics, token) {
    const joinedMetrics = metrics.join(',');
    try {
      return await this.fetchJson(`${endpoint}/insights?metric=${joinedMetrics}&access_token=${token}`);
    } catch (combinedErr) {
      const data = [];
      for (const metric of metrics) {
        try {
          const metricInsights = await this.fetchJson(`${endpoint}/insights?metric=${metric}&access_token=${token}`);
          data.push(...(metricInsights.data || []));
        } catch (metricErr) {
          logger.warn(`[Analytics] Insight metric ${metric} unavailable for ${endpoint}: ${metricErr.message}`);
        }
      }
      return { data };
    }
  }

  async fetchFacebookDailyInsights(pageId, token, since, until) {
    try {
      const url = `https://graph.facebook.com/v19.0/${pageId}/insights?metric=page_impressions,page_reach,page_fans,page_actions_post_reactions_total,page_video_views,page_views_total&period=day&since=${since}&until=${until}&access_token=${token}`;
      const res = await this.fetchJson(url);
      return res.data || [];
    } catch (err) {
      logger.warn(`[Analytics API Insights] Failed to fetch Facebook daily insights for ${pageId}: ${err.message}`);
      return [];
    }
  }

  async fetchInstagramDailyInsights(igUserId, token, since, until) {
    try {
      const url = `https://graph.facebook.com/v19.0/${igUserId}/insights?metric=impressions,reach,profile_views,website_clicks,follower_count&period=day&since=${since}&until=${until}&access_token=${token}`;
      const res = await this.fetchJson(url);
      return res.data || [];
    } catch (err) {
      logger.warn(`[Analytics API Insights] Failed to fetch Instagram daily insights for ${igUserId}: ${err.message}`);
      return [];
    }
  }

  getDailyInsightValue(insightsData, metricName, targetDate) {
    const metric = insightsData?.find(item => item.name === metricName);
    if (!metric || !metric.values) return null;

    const targetTime = targetDate.getTime();
    const match = metric.values.find(v => {
      const d = new Date(v.end_time);
      // Find the insight value where the end_time is on the same calendar day (within 16 hours of targetDate)
      const diff = Math.abs(d.getTime() - targetTime);
      return diff < 16 * 60 * 60 * 1000;
    });

    return match ? match.value : null;
  }

  async fetchFacebookPostInsights(postId, token) {
    try {
      const endpoint = `https://graph.facebook.com/v19.0/${postId}`;
      const insights = await this.fetchInsights(endpoint, ['post_impressions', 'post_impressions_unique', 'post_clicks'], token);
      return {
        impressions: this.getInsightValue(insights, ['post_impressions']),
        reach: this.getInsightValue(insights, ['post_impressions_unique']),
        clicks: this.getInsightValue(insights, ['post_clicks'])
      };
    } catch (err) {
      logger.warn(`[Analytics] Failed to fetch Facebook insights for ${postId}: ${err.message}`);
      return { impressions: null, reach: null, clicks: null };
    }
  }

  async fetchInstagramMediaInsights(mediaId, token) {
    try {
      const endpoint = `https://graph.facebook.com/v19.0/${mediaId}`;
      const insights = await this.fetchInsights(endpoint, ['reach', 'impressions', 'shares', 'saved', 'plays', 'video_views'], token);
      return {
        reach: this.getInsightValue(insights, ['reach']),
        impressions: this.getInsightValue(insights, ['impressions']),
        shares: this.getInsightValue(insights, ['shares']),
        saves: this.getInsightValue(insights, ['saved']),
        videoViews: this.getInsightValue(insights, ['plays', 'video_views'])
      };
    } catch (err) {
      logger.warn(`[Analytics] Failed to fetch Instagram insights for ${mediaId}: ${err.message}`);
      return { reach: null, impressions: null, shares: null, saves: null, videoViews: null };
    }
  }

  async fetchThreadsPostInsights(postId, token) {
    try {
      const endpoint = `https://graph.threads.net/v1.0/${postId}`;
      const insights = await this.fetchInsights(endpoint, ['views', 'likes', 'replies', 'reposts', 'quotes', 'reach'], token);
      const reposts = this.getInsightValue(insights, ['reposts']) || 0;
      const quotes = this.getInsightValue(insights, ['quotes']) || 0;
      return {
        impressions: this.getInsightValue(insights, ['views']),
        reach: this.getInsightValue(insights, ['reach']),
        likes: this.getInsightValue(insights, ['likes']),
        comments: this.getInsightValue(insights, ['replies']),
        shares: reposts + quotes
      };
    } catch (err) {
      logger.warn(`[Analytics] Failed to fetch Threads insights for ${postId}: ${err.message}`);
      return { impressions: null, reach: null, likes: null, comments: null, shares: null };
    }
  }

  /**
   * Helper: Fetch real page feed and post metrics from Facebook Graph API
   */
  async fetchFacebookPageFeed(pageId, token) {
    try {
      const url = `https://graph.facebook.com/v19.0/${pageId}/feed?fields=id,message,story,created_time,shares,full_picture,permalink_url,likes.limit(0).summary(true),comments.limit(0).summary(true)&limit=50&access_token=${token}`;
      const res = await this.fetchJson(url);
      if (res && res.data) {
        return Promise.all(res.data.map(async item => {
          const likes = item.likes?.summary?.total_count || 0;
          const comments = item.comments?.summary?.total_count || 0;
          const shares = item.shares?.count || 0;
          const insights = await this.fetchFacebookPostInsights(item.id, token);
          const metrics = this.buildMetrics({ likes, comments, shares, ...insights });
          
          return {
            id: item.id,
            content: item.message || item.story || 'Facebook Post',
            platform: 'facebook',
            publishedAt: new Date(item.created_time),
            mediaUrl: item.full_picture || '',
            mediaType: 'image',
            permalink: item.permalink_url || '',
            ...metrics
          };
        }));
      }
    } catch (err) {
      logger.warn(`[Analytics] Failed to fetch Facebook page feed: ${err.message}`);
    }
    return [];
  }

  /**
   * Helper: Fetch real media feed and metrics from Instagram Graph API
   */
  async fetchInstagramMediaFeed(igUserId, token) {
    try {
      const url = `https://graph.facebook.com/v19.0/${igUserId}/media?fields=id,caption,timestamp,like_count,comments_count,media_url,media_type,permalink,thumbnail_url&limit=50&access_token=${token}`;
      const res = await this.fetchJson(url);
      if (res && res.data) {
        return Promise.all(res.data.map(async item => {
          const likes = item.like_count || 0;
          const comments = item.comments_count || 0;
          const insights = await this.fetchInstagramMediaInsights(item.id, token);
          const shares = insights.shares || 0;
          const metrics = this.buildMetrics({
            likes,
            comments,
            shares,
            reach: insights.reach,
            impressions: insights.impressions,
            saves: insights.saves,
            videoViews: insights.videoViews
          });

          return {
            id: item.id,
            content: item.caption || 'Instagram Media',
            platform: 'instagram',
            publishedAt: new Date(item.timestamp),
            mediaUrl: item.media_url || item.thumbnail_url || '',
            mediaType: item.media_type === 'VIDEO' ? 'video' : 'image',
            permalink: item.permalink || '',
            ...metrics
          };
        }));
      }
    } catch (err) {
      logger.warn(`[Analytics] Failed to fetch Instagram media feed: ${err.message}`);
    }
    return [];
  }

  /**
   * Helper: Fetch real post thread feed and metrics from Threads API
   */
  async fetchThreadsFeed(threadsUserId, token) {
    try {
      const url = `https://graph.threads.net/v1.0/me/threads?fields=id,text,timestamp,like_count,reply_count,repost_count,media_url,media_type,permalink&limit=50&access_token=${token}`;
      const res = await this.fetchJson(url);
      if (res && res.data) {
        return Promise.all(res.data.map(async item => {
          const insights = await this.fetchThreadsPostInsights(item.id, token);
          const likes = insights.likes ?? item.like_count ?? 0;
          const comments = insights.comments ?? item.reply_count ?? 0;
          const shares = insights.shares ?? item.repost_count ?? 0;
          const metrics = this.buildMetrics({ likes, comments, shares, impressions: insights.impressions, reach: insights.reach });

          return {
            id: item.id,
            content: item.text || 'Threads Post',
            platform: 'threads',
            publishedAt: new Date(item.timestamp),
            mediaUrl: item.media_url || '',
            mediaType: item.media_type === 'VIDEO' ? 'video' : 'image',
            permalink: item.permalink || '',
            ...metrics
          };
        }));
      }
    } catch (err) {
      logger.warn(`[Analytics] Failed to fetch Threads feed: ${err.message}`);
    }
    return [];
  }

  async fetchLinkedInMediaUrl(mediaUrn, token) {
    if (!mediaUrn) return '';
    try {
      const parts = mediaUrn.split(':');
      const id = parts[parts.length - 1];
      const type = parts[2]; // 'image', 'video', or 'digitalmediaAsset'
      
      let endpoint = `https://api.linkedin.com/v2/images/${id}`;
      if (type === 'video') {
        endpoint = `https://api.linkedin.com/v2/videos/${id}`;
      } else if (type === 'digitalmediaAsset') {
        endpoint = `https://api.linkedin.com/v2/images/${id}`;
      }
      
      const res = await this.fetchJson(endpoint, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Restli-Protocol-Version': '2.0.0'
        }
      });
      return res.downloadUrl || '';
    } catch (err) {
      logger.warn(`[Analytics] Failed to fetch LinkedIn media URL for ${mediaUrn}: ${err.message}`);
      return '';
    }
  }



  /**
   * Helper: Fetch real post feed and metrics from LinkedIn API
   */
  async fetchLinkedInFeed(platformAccountId, token) {
    try {
      const author = platformAccountId.startsWith('urn:li:') ? platformAccountId : `urn:li:person:${platformAccountId}`;
      const url = `https://api.linkedin.com/rest/posts?author=${encodeURIComponent(author)}&q=author&count=50`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'LinkedIn-Version': '202606',
          'X-Restli-Protocol-Version': '2.0.0',
        }
      });
      const res = await response.json();
      if (!response.ok || res?.error) {
        throw new Error(res?.message || res?.error?.message || `Request failed with status ${response.status}`);
      }

      if (res && res.elements) {
        // Build IDs query for batch socialMetadata to fetch real engagement metrics
        const ids = res.elements.map(item => item.id);
        let socialData = {};

        if (ids.length > 0) {
          try {
            const metadataUrl = `https://api.linkedin.com/rest/socialMetadata?ids=List(${ids.map(id => encodeURIComponent(id)).join(',')})`;
            const metadataRes = await fetch(metadataUrl, {
              headers: {
                'Authorization': `Bearer ${token}`,
                'LinkedIn-Version': '202606',
                'X-Restli-Protocol-Version': '2.0.0'
              }
            }).then(r => r.json());
            if (metadataRes && metadataRes.results) {
              socialData = metadataRes.results;
            }
          } catch (metadataErr) {
            logger.warn(`[Analytics] Failed to fetch LinkedIn socialMetadata batch: ${metadataErr.message}`);
          }
        }

        // Fetch name and pictureUrl to enrich real posts
        let name = 'Dharmik Rathod';
        let pictureUrl = '';
        try {
          const account = await SocialAccount.findOne({ platformAccountId, platform: 'linkedin' });
          if (account) {
            if (account.platformUsername) name = account.platformUsername;
            if (account.profilePicture) pictureUrl = account.profilePicture;
          }
        } catch (dbErr) {
          logger.warn(`[Analytics] Failed to fetch SocialAccount details for LinkedIn real feed: ${dbErr.message}`);
        }

        const enrichedPosts = await Promise.all(res.elements.map(async item => {
          const postMetadata = socialData[item.id] || {};
          const likes = postMetadata.reactionsSummary?.totalFirstLevelReactions || 0;
          const comments = postMetadata.commentsSummary?.totalComments || 0;
          const shares = postMetadata.sharesSummary?.totalShares || 0;
          const metrics = this.buildMetrics({ likes, comments, shares });

          let mediaUrl = '';
          let mediaType = 'image';
          
          let mediaUrn = item.content?.media?.id || item.content?.multiImage?.images?.[0]?.id || '';
          if (mediaUrn) {
            mediaUrl = await this.fetchLinkedInMediaUrl(mediaUrn, token);
            if (mediaUrn.includes(':video:')) {
              mediaType = 'video';
            }
          } else if (item.content?.article?.source) {
            mediaUrl = item.content.article.source;
          }

          const permalink = `https://www.linkedin.com/feed/update/${item.id}`;

          return {
            id: item.id,
            content: item.commentary || 'LinkedIn Post',
            platform: 'linkedin',
            publishedAt: new Date(item.createdAt || Date.now()),
            mediaUrl,
            mediaType,
            permalink,
            authorName: name,
            authorPicture: pictureUrl,
            ...metrics
          };
        }));

        return enrichedPosts;
      }
    } catch (err) {
      logger.warn(`[Analytics] Failed to fetch LinkedIn feed: ${err.message}. Returning empty feed.`);
      return [];
    }
  }

  async fetchPostLiveAnalytics(platform, platformPostId, token) {
    let likes = null;
    let comments = null;
    let shares = null;
    let reach = null;
    let impressions = null;
    let clicks = null;
    let saves = null;
    let videoViews = null;
    let profileVisits = null;
    let caption = '';
    let mediaUrl = '';
    let mediaType = 'image';
    let publishedAt = new Date();
    let permalink = '';
    let isDeleted = false;

    try {
      if (platform === 'facebook') {
        const fbPost = await this.fetchJson(`https://graph.facebook.com/v19.0/${platformPostId}?fields=message,story,created_time,shares,likes.limit(0).summary(true),comments.limit(0).summary(true),full_picture,permalink_url&access_token=${token}`);
        if (fbPost) {
          caption = fbPost.message || fbPost.story || '';
          mediaUrl = fbPost.full_picture || '';
          publishedAt = new Date(fbPost.created_time);
          permalink = fbPost.permalink_url || '';
          likes = fbPost.likes?.summary?.total_count || 0;
          comments = fbPost.comments?.summary?.total_count || 0;
          shares = fbPost.shares?.count || 0;

          const insights = await this.fetchFacebookPostInsights(platformPostId, token);
          reach = insights.reach ?? null;
          impressions = insights.impressions ?? null;
          clicks = insights.clicks ?? null;
        }
      } else if (platform === 'instagram') {
        const igMedia = await this.fetchJson(`https://graph.facebook.com/v19.0/${platformPostId}?fields=caption,timestamp,like_count,comments_count,media_url,media_type,permalink&access_token=${token}`);
        if (igMedia) {
          caption = igMedia.caption || '';
          mediaUrl = igMedia.media_url || '';
          mediaType = igMedia.media_type === 'VIDEO' ? 'video' : 'image';
          publishedAt = new Date(igMedia.timestamp);
          permalink = igMedia.permalink || '';
          likes = igMedia.like_count || 0;
          comments = igMedia.comments_count || 0;

          const insights = await this.fetchInstagramMediaInsights(platformPostId, token);
          reach = insights.reach ?? null;
          impressions = insights.impressions ?? null;
          shares = insights.shares ?? null;
          saves = insights.saves ?? null;
          videoViews = insights.videoViews ?? null;
        }
      } else if (platform === 'threads') {
        const threadPost = await this.fetchJson(`https://graph.threads.net/v1.0/${platformPostId}?fields=text,timestamp,like_count,reply_count,repost_count,media_url,media_type,permalink&access_token=${token}`);
        if (threadPost) {
          caption = threadPost.text || '';
          mediaUrl = threadPost.media_url || '';
          mediaType = threadPost.media_type === 'VIDEO' ? 'video' : 'image';
          publishedAt = new Date(threadPost.timestamp);
          permalink = threadPost.permalink || '';
          likes = threadPost.like_count || 0;
          comments = threadPost.reply_count || 0;
          shares = threadPost.repost_count || 0;

          const insights = await this.fetchThreadsPostInsights(platformPostId, token);
          impressions = insights.impressions ?? null;
          reach = insights.reach ?? null;
        }
      } else if (platform === 'linkedin') {
        try {
          const postUrl = `https://api.linkedin.com/rest/posts/${encodeURIComponent(platformPostId)}`;
          const liPostDetail = await this.fetchJson(postUrl, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'LinkedIn-Version': '202606',
              'X-Restli-Protocol-Version': '2.0.0'
            }
          });
          
          if (liPostDetail) {
            caption = liPostDetail.commentary || '';
            publishedAt = new Date(liPostDetail.createdAt || Date.now());
            permalink = `https://www.linkedin.com/feed/update/${platformPostId}`;
            
            let mediaUrn = liPostDetail.content?.media?.id || liPostDetail.content?.multiImage?.images?.[0]?.id || '';
            if (mediaUrn) {
              mediaUrl = await this.fetchLinkedInMediaUrl(mediaUrn, token);
              mediaType = mediaUrn.includes(':video:') ? 'video' : 'image';
            } else if (liPostDetail.content?.article?.source) {
              mediaUrl = liPostDetail.content.article.source;
            }
          }
        } catch (err) {
          logger.warn(`[Analytics Post] LinkedIn post details fetch failed: ${err.message}`);
          const msg = err.message || '';
          if (msg.includes('404') || msg.toLowerCase().includes('not found')) {
            isDeleted = true;
          }
        }

        try {
          const metadataUrl = `https://api.linkedin.com/rest/socialMetadata/${encodeURIComponent(platformPostId)}`;
          const liPost = await fetch(metadataUrl, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'LinkedIn-Version': '202606',
              'X-Restli-Protocol-Version': '2.0.0'
            }
          }).then(r => r.json());
          if (liPost && !liPost.error) {
            likes = liPost.reactionsSummary?.totalFirstLevelReactions ?? 0;
            comments = liPost.commentsSummary?.totalComments ?? 0;
            shares = liPost.sharesSummary?.totalShares ?? 0;
          } else if (liPost?.error) {
            const errMsg = liPost.error.message || '';
            if (errMsg.includes('404') || errMsg.toLowerCase().includes('not found')) {
              isDeleted = true;
            }
          }
        } catch (err) {
          logger.warn(`[Analytics Post] LinkedIn socialMetadata fetch failed: ${err.message}`);
          const msg = err.message || '';
          if (msg.includes('404') || msg.toLowerCase().includes('not found')) {
            isDeleted = true;
          }
        }
      }
    } catch (err) {
      logger.warn(`[Analytics Post] Live API fetch failed for post ${platformPostId}: ${err.message}`);
      const msg = err.message || '';
      if (
        msg.includes('404') ||
        msg.includes('does not exist') ||
        msg.includes('Unsupported get request') ||
        msg.toLowerCase().includes('not found')
      ) {
        isDeleted = true;
      }
    }

    const engagementRate = reach > 0
      ? parseFloat(((((likes || 0) + (comments || 0) + (shares || 0)) / reach) * 100).toFixed(2))
      : impressions > 0
        ? parseFloat(((((likes || 0) + (comments || 0) + (shares || 0)) / impressions) * 100).toFixed(2))
        : null;

    return {
      likes,
      comments,
      shares,
      reach,
      impressions,
      clicks,
      saves,
      videoViews,
      profileVisits,
      engagementRate,
      caption,
      mediaUrl,
      mediaType,
      publishedAt,
      permalink,
      isDeleted
    };
  }

  async getPostAnalysis(req, res, next) {
    try {
      const userId = req.workspace ? req.workspace.ownerId : req.user.id;
      const { id } = req.params;
      const { platform: queryPlatform, mediaUrl: queryMediaUrl, mediaType: queryMediaType } = req.query;

      // 1. Locate the post in database
      let post = await Post.findOne({
        createdBy: userId,
        $or: [
          { _id: mongoose.Types.ObjectId.isValid(id) ? id : null },
          { platformPostId: id }
        ]
      });

      let platform = post?.platform || queryPlatform;
      let platformPostId = post?.platformPostId || id;

      if (!platform) {
        throw new BadRequestError('Platform query parameter is required if post is not tracked in local database.');
      }

      // 2. Fetch live metrics from corresponding social API if account connected
      let liveMetrics = {};
      const account = await SocialAccount.findOne({ user: userId, platform });
      if (!account && !platformPostId.startsWith('mock_post_')) {
        throw new BadRequestError(`Please connect your ${platform} account to analyze this post.`);
      }
      if (account && !platformPostId.startsWith('mock_post_')) {
        const token = decrypt(account.accessToken);
        liveMetrics = await this.fetchPostLiveAnalytics(platform, platformPostId, token);

        if (liveMetrics.isDeleted) {
          if (post) {
            post.status = 'FAILED';
            post.publishError = 'This post was deleted on the social media platform.';
            await post.save();
          }
          throw new BadRequestError('This post was deleted on the social media platform.');
        }

        // Synchronize live metrics back to the database post record
        if (post) {
          post.likes = liveMetrics.likes ?? post.likes;
          post.comments = liveMetrics.comments ?? post.comments;
          post.shares = liveMetrics.shares ?? post.shares;
          post.reach = liveMetrics.reach ?? post.reach;
          post.impressions = liveMetrics.impressions ?? post.impressions;
          post.clicks = liveMetrics.clicks ?? post.clicks;
          post.saves = liveMetrics.saves ?? post.saves;
          post.videoViews = liveMetrics.videoViews ?? post.videoViews;
          post.profileVisits = liveMetrics.profileVisits ?? post.profileVisits;
          post.engagementRate = liveMetrics.engagementRate ?? post.engagementRate;
          
          if (liveMetrics.mediaUrl) {
            post.media = [{ url: liveMetrics.mediaUrl, type: liveMetrics.mediaType || 'image' }];
          }
          if (liveMetrics.caption) {
            post.content = liveMetrics.caption;
          }
          if (liveMetrics.permalink) {
            post.permalink = liveMetrics.permalink;
          }
          if (liveMetrics.publishedAt) {
            post.publishedAt = liveMetrics.publishedAt;
          }
          await post.save();
        }
      }

      // 3. Construct post details combining DB and live metadata
      const caption = liveMetrics.caption || post?.content || '';
      const mediaUrl = liveMetrics.mediaUrl || post?.media?.[0]?.url || queryMediaUrl || '';
      const mediaType = liveMetrics.mediaType || post?.media?.[0]?.type || queryMediaType || 'image';
      const publishedAt = liveMetrics.publishedAt || post?.publishedAt || post?.createdAt || new Date();
      const permalink = liveMetrics.permalink || post?.permalink || `https://www.${platform}.com/post/${platformPostId}`;

      const likes = liveMetrics.likes ?? post?.likes ?? 0;
      const comments = liveMetrics.comments ?? post?.comments ?? 0;
      const shares = liveMetrics.shares ?? post?.shares ?? 0;
      const reach = liveMetrics.reach ?? post?.reach ?? null;
      const impressions = liveMetrics.impressions ?? post?.impressions ?? null;
      const clicks = liveMetrics.clicks ?? post?.clicks ?? null;
      const saves = liveMetrics.saves ?? post?.saves ?? null;
      const videoViews = liveMetrics.videoViews ?? post?.videoViews ?? null;
      const profileVisits = liveMetrics.profileVisits ?? post?.profileVisits ?? null;

      const engagementRate = reach > 0
        ? parseFloat(((((likes || 0) + (comments || 0) + (shares || 0)) / reach) * 100).toFixed(2))
        : impressions > 0
          ? parseFloat(((((likes || 0) + (comments || 0) + (shares || 0)) / impressions) * 100).toFixed(2))
          : null;

      const postDetails = {
        platform,
        platformPostId,
        caption,
        mediaUrl,
        mediaType,
        publishedAt,
        permalink,
        likes,
        comments,
        shares,
        reach,
        impressions,
        clicks,
        saves,
        videoViews,
        profileVisits,
        engagementRate,
        authorName: account?.platformUsername || 'Dharmik Rathod',
        authorPicture: account?.profilePicture || ''
      };

      // 4. Download and convert image to base64 if available, for multimodal visual analysis
      let imageBuffer = null;
      let mimeType = null;
      if (mediaType === 'image' && mediaUrl && !mediaUrl.startsWith('data:')) {
        const imageResult = await this.fetchImageBase64(mediaUrl);
        if (imageResult) {
          imageBuffer = imageResult.base64;
          mimeType = imageResult.contentType;
        }
      }

      // 5. Call Gemini to perform AI Post Analysis
      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (!geminiApiKey) {
        throw new Error('Gemini API key is not configured.');
      }

      const prompt = `You are a world-class social media strategist and AI strategist.
Analyze the following post performance data and return a deep, actionable, personalized analysis in JSON format.

Post Details:
- Platform: ${platform}
- Publish Date: ${publishedAt}
- Caption: "${caption}"
- Media Type: ${mediaType}
- Permalink: ${permalink}
- Current Date/Time: ${new Date().toISOString()}

Real Post Performance Metrics:
- Reach: ${reach}
- Impressions: ${impressions}
- Engagement Rate: ${engagementRate}%
- Likes: ${likes}
- Comments: ${comments}
- Shares: ${shares}
- Saves: ${saves}
- Link Clicks: ${clicks}
- Profile Visits: ${profileVisits}

STRICT INSTRUCTIONS:
1. Content Analysis: Evaluate caption quality, length, CTA effectiveness, hashtag quality/relevance, structure, and topic.
2. Visual Analysis: Analyze visual content (if image is attached, describe design/effectiveness, composition, branding, type).
3. Engagement Analysis: Explain why the post performed well/poorly, and what drove or reduced engagement.
4. Audience Analysis: Detail audience response patterns, interaction behavior, and resonance.
5. AI Score Breakdown: Give scores between 0 and 100 for Content, Engagement, Caption, Hashtag, Visual, and Growth Potential.
6. Improvement Suggestions: Generate specific captions, hooks, CTAs, hashtags, posting times, structure, and strategies based on this data. No generic advice!
7. AI Rewrite: Generate an improved caption, improved hashtags list, improved CTA, and improved content strategy.
8. Learning Integration: Identify successful traits (content, hashtag, posting, engagement) that can be reused in future generations.
9. Return ONLY a valid JSON object matching the requested schema. Do not wrap in markdown tags or explanation.
10. Be concise but highly actionable. Limit each description/analysis text property to 2-3 sentences max. Do not exceed 100 words per property.
11. Generate nextBestPostingTime in suggestions matching the next optimal time to post this content to maximize reach. Format this nextBestPostingTime strictly as a valid ISO 8601 Date String (e.g. '2026-06-12T15:30:00.000Z') which MUST be in the future relative to the Current Date/Time.

JSON Schema:
{
  "contentAnalysis": {
    "captionQuality": "...",
    "captionLength": "...",
    "ctaEffectiveness": "...",
    "hashtagQuality": "...",
    "hashtagRelevance": "...",
    "contentStructure": "...",
    "topicRelevance": "..."
  },
  "visualAnalysis": {
    "imageQuality": "...",
    "visualComposition": "...",
    "brandingConsistency": "...",
    "contentType": "...",
    "designEffectiveness": "..."
  },
  "engagementAnalysis": {
    "performedWell": "...",
    "performedPoorly": "...",
    "droveEngagement": "...",
    "reducedEngagement": "..."
  },
  "audienceAnalysis": {
    "responsePatterns": "...",
    "interactionBehavior": "...",
    "contentResonance": "..."
  },
  "scores": {
    "contentScore": 0-100,
    "engagementScore": 0-100,
    "captionScore": 0-100,
    "hashtagScore": 0-100,
    "visualScore": 0-100,
    "growthPotentialScore": 0-100
  },
  "suggestions": {
    "betterCaptions": ["Example 1", "Example 2"],
    "betterHooks": ["Hook 1", "Hook 2"],
    "betterCTAs": ["CTA 1", "CTA 2"],
    "hashtagStrategy": "...",
    "imageRecommendations": "...",
    "postingTimeRecommendations": "...",
    "nextBestPostingTime": "ISO Date String (e.g. 2026-06-12T15:30:00.000Z)",
    "contentStructure": "...",
    "engagementStrategy": "..."
  },
  "rewrite": {
    "improvedCaption": "...",
    "improvedHashtags": ["#tag1", "#tag2"],
    "improvedCTA": "...",
    "improvedContentStrategy": "..."
  },
  "learningTraits": {
    "successfulTraits": ["Trait 1", "Trait 2"],
    "successfulHashtagPatterns": ["Pattern 1"],
    "successfulPostingPatterns": ["Pattern 1"],
    "successfulEngagementPatterns": ["Pattern 1"]
  }
}`;

      let responseText = '';
      const modelsToTry = ['gemini-2.5-flash', 'gemini-3.1-flash-lite', 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-flash-latest'];
      let lastError = null;

      for (const model of modelsToTry) {
        try {
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;
          const body = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 8192,
              responseMimeType: 'application/json'
            }
          };

          if (imageBuffer && mimeType) {
            body.contents[0].parts.push({
              inlineData: {
                mimeType,
                data: imageBuffer
              }
            });
          }

          const resGem = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });

          if (resGem.ok) {
            const resJson = await resGem.json();
            responseText = resJson.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (responseText) {
              logger.info(`[Gemini Post Analysis] Success using model ${model}`);
              break;
            }
          } else {
            const errText = await resGem.text();
            logger.warn(`[Gemini Post Analysis] Model ${model} failed: ${resGem.status} ${errText}`);
            lastError = new Error(`API responded with ${resGem.status}: ${errText}`);
          }
        } catch (err) {
          logger.warn(`[Gemini Post Analysis] Request failed for model ${model}: ${err.message}`);
          lastError = err;
        }
      }

      if (!responseText) {
        throw lastError || new Error('Failed to contact Gemini API models.');
      }

      // 6. Clean and Parse response
      let cleanJson = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
      let aiData;
      try {
        aiData = JSON.parse(cleanJson);
      } catch (parseErr) {
        logger.error(`[Gemini Post Analysis] JSON parse failed. Raw response: ${responseText}`);
        throw new Error(`Failed to parse AI Analysis JSON response: ${parseErr.message}`);
      }

      // 7. Personalization & GDPR opt-in check: Save learned traits
      const profile = await AiLearningProfile.findOne({ userId });
      if (aiData.learningTraits && (!profile || profile.learningEnabled !== false)) {
        let existingLearnings = {
          successfulContentTraits: [],
          successfulHashtagPatterns: [],
          successfulPostingPatterns: [],
          successfulEngagementPatterns: []
        };

        if (profile && profile.encryptedPostLearnings) {
          const decrypted = decrypt(profile.encryptedPostLearnings);
          if (decrypted) {
            try {
              existingLearnings = JSON.parse(decrypted);
            } catch (err) { /* ignore */ }
          }
        }

        const merge = (arr1, arr2) => [...new Set([...(arr1 || []), ...(arr2 || [])])].slice(0, 15);

        const updatedLearnings = {
          successfulContentTraits: merge(existingLearnings.successfulContentTraits, aiData.learningTraits.successfulTraits),
          successfulHashtagPatterns: merge(existingLearnings.successfulHashtagPatterns, aiData.learningTraits.successfulHashtagPatterns),
          successfulPostingPatterns: merge(existingLearnings.successfulPostingPatterns, aiData.learningTraits.successfulPostingPatterns),
          successfulEngagementPatterns: merge(existingLearnings.successfulEngagementPatterns, aiData.learningTraits.successfulEngagementPatterns)
        };

        const encrypted = encrypt(JSON.stringify(updatedLearnings));
        await AiLearningProfile.findOneAndUpdate(
          { userId },
          {
            $set: { encryptedPostLearnings: encrypted },
            $setOnInsert: { learningEnabled: true }
          },
          { upsert: true }
        );
        logger.info(`[Gemini Post Analysis] Successfully updated encrypted learning profile for user ${userId}`);
      }

      res.status(200).json({
        success: true,
        post: postDetails,
        aiAnalysis: {
          contentAnalysis: aiData.contentAnalysis,
          visualAnalysis: aiData.visualAnalysis,
          engagementAnalysis: aiData.engagementAnalysis,
          audienceAnalysis: aiData.audienceAnalysis
        },
        aiScores: aiData.scores,
        aiSuggestions: aiData.suggestions,
        aiRewrite: aiData.rewrite
      });
    } catch (error) {
      next(error);
    }
  }

  async repostWithImprovements(req, res, next) {
    try {
      const userId = req.workspace ? req.workspace.ownerId : req.user.id;
      const { id } = req.params;
      const { content, scheduledAt } = req.body;

      if (!content) {
        throw new BadRequestError('Content is required to repost.');
      }

      // 1. Locate the original post in database
      const originalPost = await Post.findOne({
        createdBy: userId,
        $or: [
          { _id: mongoose.Types.ObjectId.isValid(id) ? id : null },
          { platformPostId: id }
        ]
      });

      if (!originalPost) {
        throw new BadRequestError('Original post not found in database to copy media/platform details.');
      }

      // 2. Create the new scheduled post using the improvements and original media
      const newPost = new Post({
        content,
        media: originalPost.media || [],
        platform: originalPost.platform,
        status: 'SCHEDULED',
        scheduledAt: scheduledAt ? new Date(scheduledAt) : new Date(Date.now() + 24 * 60 * 60 * 1000),
        createdBy: userId
      });

      await newPost.save();

      logger.info(`[Repost] Created new scheduled post ${newPost._id} for platform ${newPost.platform} at ${newPost.scheduledAt}`);

      res.status(201).json({
        success: true,
        message: `Post successfully scheduled for ${newPost.platform} at ${newPost.scheduledAt.toISOString()}`,
        post: newPost
      });
    } catch (error) {
      next(error);
    }
  }

  async proxyMedia(req, res, next) {
    try {
      const { url } = req.query;
      if (!url || !url.startsWith('http')) {
        return res.status(400).send('Invalid url parameter');
      }

      logger.info(`[Media Proxy] Proxying remote media URL: ${url}`);
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      
      if (!response.ok) {
        logger.warn(`[Media Proxy] Failed to fetch remote media: ${response.status} ${response.statusText}`);
        return res.status(response.status).send(`Failed to fetch remote media: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.startsWith('image/') && !contentType.startsWith('video/')) {
        return res.status(400).send('Invalid content type');
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
      return res.send(buffer);
    } catch (error) {
      logger.error(`[Media Proxy] Error proxying media: ${error.message}`);
      next(error);
    }
  }

  async fetchImageBase64(url) {
    if (!url) return null;
    try {
      let fetchUrl = url;
      if (fetchUrl.startsWith('/') || !fetchUrl.startsWith('http')) {
        const hostUrl = process.env.BACKEND_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:5000';
        fetchUrl = `${hostUrl.replace(/\/$/, '')}${fetchUrl.startsWith('/') ? '' : '/'}${fetchUrl}`;
      }
      const response = await fetch(fetchUrl);
      if (!response.ok) return null;
      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      return { base64, contentType };
    } catch (err) {
      logger.warn(`[Gemini Analysis] Failed to fetch image ${url}: ${err.message}`);
      return null;
    }
  }

  /**
   * Get aggregated performance stats and timeline charts from real platform feed data
   */
  async getOverview(req, res, next) {
    try {
      const userId = req.workspace ? req.workspace.ownerId : req.user.id;
      const { platform = 'all', days = 30 } = req.query;

      const numDays = parseInt(days, 10) || 30;

      // Check Redis Cache
      const redisClient = getRedisClient();
      const cacheKey = `user:analytics:${userId}:${platform}:${numDays}`;
      if (redisClient) {
        try {
          const cachedData = await redisClient.get(cacheKey);
          if (cachedData) {
            logger.info(`[Analytics Cache] Hit for key: ${cacheKey}`);
            return res.status(200).json(JSON.parse(cachedData));
          }
        } catch (cacheErr) {
          logger.warn(`[Analytics Cache] Failed to read cache: ${cacheErr.message}`);
        }
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - numDays);
      startDate.setHours(0, 0, 0, 0);

      // 1. Fetch connected platform accounts
      const allAccounts = await SocialAccount.find({ user: userId });
      const connectedPlatforms = new Set(allAccounts.map(acc => acc.platform));

      // In strict mode, if a specific platform is requested but is not connected,
      // return a clean empty/no-data response instead of displaying mock/stale data.
      if (platform !== 'all' && !connectedPlatforms.has(platform)) {
        const emptyResponse = {
          success: true,
          hasData: false,
          summary: {
            impressions: 0,
            reach: 0,
            followers: 0,
            engagementRate: 0,
            clicks: 0,
            saves: 0,
            videoViews: 0,
            changeImpressions: '+0.0%',
            changeReach: '+0.0%',
            changeFollowers: '+0.0%',
            changeEngagement: '+0.0%'
          },
          timeline: []
        };
        if (redisClient) {
          try {
            await redisClient.set(cacheKey, JSON.stringify(emptyResponse), { EX: 900 });
          } catch (_) {}
        }
        return res.status(200).json(emptyResponse);
      }

      // 2. Fetch historical snapshots within range
      const analyticsQuery = {
        userId,
        date: { $gte: startDate }
      };
      if (platform !== 'all') {
        analyticsQuery.platform = platform;
      } else {
        // Enforce strict mode: only fetch snapshots for platforms that are actually connected.
        analyticsQuery.platform = { $in: Array.from(connectedPlatforms) };
      }
      const historicalAnalytics = await Analytics.find(analyticsQuery).sort({ date: 1 });

      const formatTimestamp = (dateObj) => {
        const d = new Date(dateObj);
        return d.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
      };

      const getRoundedTimestamp = (dateObj) => {
        const d = new Date(dateObj);
        const minutes = d.getMinutes();
        const roundedMinutes = Math.round(minutes / 15) * 15;
        d.setMinutes(roundedMinutes, 0, 0);
        return d.getTime();
      };

      let blendedTimeline = [];

      if (historicalAnalytics.length > 0) {
        if (platform !== 'all') {
          // Direct mapping for single platform
          blendedTimeline = historicalAnalytics.map(record => ({
            date: formatTimestamp(record.date),
            impressions: record.impressions || 0,
            reach: record.reach || 0,
            followers: record.followers || 0,
            likes: record.likes || 0,
            comments: record.comments || 0,
            shares: record.shares || 0,
            clicks: record.clicks || 0,
            saves: record.saves || 0,
            videoViews: record.videoViews || 0,
            engagementRate: record.engagementRate || 0
          }));
        } else {
          // Align and sum across platforms
          const platformSnapshots = {
            facebook: [],
            instagram: [],
            threads: [],
            linkedin: []
          };
          const allTimeSlotsSet = new Set();

          historicalAnalytics.forEach(record => {
            if (platformSnapshots[record.platform]) {
              const roundedTime = getRoundedTimestamp(record.date);
              allTimeSlotsSet.add(roundedTime);
              platformSnapshots[record.platform].push({
                time: roundedTime,
                record
              });
            }
          });

          const sortedTimeSlots = Array.from(allTimeSlotsSet).sort((a, b) => a - b);

          const lastSeenState = {
            facebook: { followers: 0, impressions: 0, reach: 0, likes: 0, comments: 0, shares: 0, clicks: 0, saves: 0, videoViews: 0 },
            instagram: { followers: 0, impressions: 0, reach: 0, likes: 0, comments: 0, shares: 0, clicks: 0, saves: 0, videoViews: 0 },
            threads: { followers: 0, impressions: 0, reach: 0, likes: 0, comments: 0, shares: 0, clicks: 0, saves: 0, videoViews: 0 },
            linkedin: { followers: 0, impressions: 0, reach: 0, likes: 0, comments: 0, shares: 0, clicks: 0, saves: 0, videoViews: 0 }
          };

          sortedTimeSlots.forEach(slotTime => {
            const slotData = {
              date: formatTimestamp(new Date(slotTime)),
              impressions: 0,
              reach: 0,
              followers: 0,
              likes: 0,
              comments: 0,
              shares: 0,
              clicks: 0,
              saves: 0,
              videoViews: 0
            };

            ['facebook', 'instagram', 'threads', 'linkedin'].forEach(plat => {
              const match = platformSnapshots[plat].find(s => s.time === slotTime);
              if (match) {
                lastSeenState[plat] = {
                  followers: match.record.followers || 0,
                  impressions: match.record.impressions || 0,
                  reach: match.record.reach || 0,
                  likes: match.record.likes || 0,
                  comments: match.record.comments || 0,
                  shares: match.record.shares || 0,
                  clicks: match.record.clicks || 0,
                  saves: match.record.saves || 0,
                  videoViews: match.record.videoViews || 0
                };
              }

              slotData.followers += lastSeenState[plat].followers;
              slotData.impressions += lastSeenState[plat].impressions;
              slotData.reach += lastSeenState[plat].reach;
              slotData.likes += lastSeenState[plat].likes;
              slotData.comments += lastSeenState[plat].comments;
              slotData.shares += lastSeenState[plat].shares;
              slotData.clicks += lastSeenState[plat].clicks;
              slotData.saves += lastSeenState[plat].saves;
              slotData.videoViews += lastSeenState[plat].videoViews;
            });

            slotData.engagementRate = slotData.reach > 0
              ? parseFloat((((slotData.likes + slotData.comments + slotData.shares) / slotData.reach) * 100).toFixed(2))
              : slotData.impressions > 0
                ? parseFloat((((slotData.likes + slotData.comments + slotData.shares) / slotData.impressions) * 100).toFixed(2))
                : 0;

            blendedTimeline.push(slotData);
          });
        }
      }

      // If empty, return no data available state cleanly without placeholders
      if (blendedTimeline.length === 0) {
        const emptyResponse = {
          success: true,
          hasData: false,
          summary: {
            impressions: 0,
            reach: 0,
            followers: 0,
            engagementRate: 0,
            clicks: 0,
            saves: 0,
            videoViews: 0,
            changeImpressions: '+0.0%',
            changeReach: '+0.0%',
            changeFollowers: '+0.0%',
            changeEngagement: '+0.0%'
          },
          timeline: []
        };
        if (redisClient) {
          try {
            await redisClient.set(cacheKey, JSON.stringify(emptyResponse), { EX: 900 });
          } catch (_) {}
        }
        return res.status(200).json(emptyResponse);
      }

      // If there is only 1 data point in the timeline, we just use it directly (as no dummy/simulated data is allowed).

      // Summary stats: use latest snapshot from timeline
      const latestEntry = blendedTimeline[blendedTimeline.length - 1];

      const totalImpressions = latestEntry.impressions;
      const totalReach = latestEntry.reach;
      const totalFollowers = latestEntry.followers;
      const avgEngagementRate = latestEntry.engagementRate;
      const totalClicks = latestEntry.clicks;
      const totalSaves = latestEntry.saves;
      const totalVideoViews = latestEntry.videoViews;

      // Comparative growth stats comparing second half to first half of window
      const midPoint = Math.floor(blendedTimeline.length / 2);
      const firstHalf = blendedTimeline.slice(0, midPoint);
      const secondHalf = blendedTimeline.slice(midPoint);

      const getHalfAvg = (half, key) => half.reduce((sum, item) => sum + (item[key] || 0), 0) / (half.length || 1);

      const firstHalfReach = getHalfAvg(firstHalf, 'reach');
      const secondHalfReach = getHalfAvg(secondHalf, 'reach');
      const reachChange = firstHalfReach > 0
        ? (((secondHalfReach - firstHalfReach) / firstHalfReach) * 100).toFixed(1)
        : '0.0';

      const firstHalfImpressions = getHalfAvg(firstHalf, 'impressions');
      const secondHalfImpressions = getHalfAvg(secondHalf, 'impressions');
      const impressionsChange = firstHalfImpressions > 0
        ? (((secondHalfImpressions - firstHalfImpressions) / firstHalfImpressions) * 100).toFixed(1)
        : '0.0';

      const firstHalfEngagement = getHalfAvg(firstHalf, 'engagementRate');
      const secondHalfEngagement = getHalfAvg(secondHalf, 'engagementRate');
      const engagementChange = firstHalfEngagement > 0
        ? (((secondHalfEngagement - firstHalfEngagement) / firstHalfEngagement) * 100).toFixed(1)
        : '0.0';

      const firstHalfFollowers = getHalfAvg(firstHalf, 'followers');
      const secondHalfFollowers = getHalfAvg(secondHalf, 'followers');
      const followersChange = firstHalfFollowers > 0
        ? (((secondHalfFollowers - firstHalfFollowers) / firstHalfFollowers) * 100).toFixed(1)
        : '0.0';

      const responseData = {
        success: true,
        hasData: historicalAnalytics.length > 0,
        summary: {
          impressions: totalImpressions,
          reach: totalReach,
          followers: totalFollowers,
          engagementRate: avgEngagementRate,
          clicks: totalClicks,
          saves: totalSaves,
          videoViews: totalVideoViews,
          changeImpressions: `${parseFloat(impressionsChange) >= 0 ? '+' : ''}${impressionsChange}%`,
          changeReach: `${parseFloat(reachChange) >= 0 ? '+' : ''}${reachChange}%`,
          changeFollowers: `${parseFloat(followersChange) >= 0 ? '+' : ''}${followersChange}%`,
          changeEngagement: `${parseFloat(engagementChange) >= 0 ? '+' : ''}${engagementChange}%`
        },
        timeline: blendedTimeline
      };

      if (redisClient) {
        try {
          await redisClient.set(cacheKey, JSON.stringify(responseData), { EX: 900 }); // Cache for 15 minutes
          logger.info(`[Analytics Cache] Written key: ${cacheKey}`);
        } catch (cacheErr) {
          logger.warn(`[Analytics Cache] Failed to write cache: ${cacheErr.message}`);
        }
      }

      res.status(200).json(responseData);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get top performing content lists directly from actual feeds
   */
  async getTopPosts(req, res, next) {
    try {
      const userId = req.workspace ? req.workspace.ownerId : req.user.id;
      const { limit = 5, sortBy = 'engagementRate', platform = 'all' } = req.query;

      // Check Redis Cache
      const redisClient = getRedisClient();
      const cacheKey = `user:topposts:${userId}:${platform}:${sortBy}:${limit}`;
      if (redisClient) {
        try {
          const cachedData = await redisClient.get(cacheKey);
          if (cachedData) {
            logger.info(`[Analytics Cache] Hit for key: ${cacheKey}`);
            return res.status(200).json(JSON.parse(cachedData));
          }
        } catch (cacheErr) {
          logger.warn(`[Analytics Cache] Failed to read cache: ${cacheErr.message}`);
        }
      }

      const accountQuery = { user: userId };
      if (platform !== 'all') {
        accountQuery.platform = platform;
      }
      const accounts = await SocialAccount.find(accountQuery);
      let allRealPosts = [];

      for (const acc of accounts) {
        const token = decrypt(acc.accessToken);
        let feedPosts = [];
        if (acc.platform === 'facebook') {
          feedPosts = await analyticsControllerInstance.fetchFacebookPageFeed(acc.platformAccountId, token);
        } else if (acc.platform === 'instagram') {
          feedPosts = await analyticsControllerInstance.fetchInstagramMediaFeed(acc.platformAccountId, token);
        } else if (acc.platform === 'threads') {
          feedPosts = await analyticsControllerInstance.fetchThreadsFeed(acc.platformAccountId, token);
        } else if (acc.platform === 'linkedin') {
          feedPosts = await analyticsControllerInstance.fetchLinkedInFeed(acc.platformAccountId, token);
        }

        // Mark deleted posts in the database:
        if (feedPosts && feedPosts.length > 0) {
          const oldestFeedDate = new Date(Math.min(...feedPosts.map(p => new Date(p.publishedAt).getTime())));
          const dbPostsToCheck = await Post.find({
            createdBy: userId,
            platform: acc.platform,
            status: 'PUBLISHED',
            platformPostId: { $exists: true, $ne: null, $nin: ['', 'linkedin_published'] },
            $or: [
              { publishedAt: { $gte: oldestFeedDate } },
              { createdAt: { $gte: oldestFeedDate } }
            ]
          });

          for (const tp of dbPostsToCheck) {
            const isPresentInFeed = feedPosts.some(rp => {
              if (rp.id === tp.platformPostId) return true;
              if (tp.platform === 'facebook' && rp.id.endsWith(`_${tp.platformPostId}`)) return true;
              if (tp.platform === 'facebook' && tp.platformPostId && tp.platformPostId.endsWith(`_${rp.id}`)) return true;
              return false;
            });

            if (!isPresentInFeed && !tp.platformPostId.startsWith('mock_post_')) {
              tp.status = 'FAILED';
              tp.publishError = 'This post was deleted on the social media platform.';
              await tp.save();
              logger.info(`[Analytics Sync] Marked post ${tp._id} (platform ID: ${tp.platformPostId}) as FAILED because it was deleted on ${acc.platform}`);
            }
          }
        }
        
        const enriched = feedPosts.map(p => ({
          ...p,
          authorName: p.authorName || acc.platformUsername,
          authorPicture: p.authorPicture || acc.profilePicture
        }));
        allRealPosts = allRealPosts.concat(enriched);
      }

      // Clean up any stale posts with placeholder platform IDs
      await Post.updateMany(
        {
          createdBy: userId,
          status: 'PUBLISHED',
          platformPostId: 'linkedin_published'
        },
        {
          $set: {
            status: 'FAILED',
            publishError: 'This post does not have a valid social media platform ID.'
          }
        }
      );

      // Merge direct Taraflow posts
      const allAccounts = await SocialAccount.find({ user: userId });
      const connectedPlatforms = new Set(allAccounts.map(acc => acc.platform));
      const accountMap = new Map(allAccounts.map(acc => [acc.platform, acc]));

      const postQuery = {
        createdBy: userId,
        status: 'PUBLISHED',
        platformPostId: { $exists: true, $ne: null }
      };
      if (platform !== 'all') {
        postQuery.platform = platform;
      } else {
        // Enforce strict mode: only search posts for platforms that are actually connected
        postQuery.platform = { $in: Array.from(connectedPlatforms) };
      }
      const taraflowPosts = await Post.find(postQuery);

      taraflowPosts.forEach(tp => {
        const matchingAcc = accountMap.get(tp.platform);
        const authorName = matchingAcc?.platformUsername || 'Dharmik Rathod';
        const authorPicture = matchingAcc?.profilePicture || '';

        const dbPostId = (tp.platformPostId && tp.platformPostId !== 'linkedin_published') ? tp.platformPostId : tp._id.toString();
        const existingIndex = allRealPosts.findIndex(rp => {
          if (rp.platform !== tp.platform) return false;
          if (rp.id === dbPostId) return true;
          if (tp.platformPostId && tp.platformPostId !== 'linkedin_published' && rp.id === tp.platformPostId) return true;
          if (tp.platform === 'facebook' && rp.id.endsWith(`_${tp.platformPostId}`)) return true;
          if (tp.platform === 'facebook' && tp.platformPostId && tp.platformPostId.endsWith(`_${rp.id}`)) return true;
          if (tp.platform === 'instagram' && rp.id === tp.platformPostId) return true;
          return false;
        });
        const isSeededMock = /^mock_post_/.test(tp.platformPostId || '');
        const shouldInclude = existingIndex === -1 && (!isSeededMock || !connectedPlatforms.has(tp.platform));
        
        const likes = tp.likes || 0;
        const comments = tp.comments || 0;
        const shares = tp.shares || 0;
        const metrics = this.buildMetrics({
          likes,
          comments,
          shares,
          reach: tp.reach || null,
          impressions: tp.impressions || null,
          clicks: tp.clicks || null,
          saves: tp.saves || null,
          videoViews: tp.videoViews || null
        });

        const dbMediaUrl = tp.media?.[0]?.url || '';
        const dbMediaType = tp.media?.[0]?.type || 'image';

        if (existingIndex >= 0) {
          allRealPosts[existingIndex].mediaUrl = allRealPosts[existingIndex].mediaUrl || dbMediaUrl;
          allRealPosts[existingIndex].mediaType = allRealPosts[existingIndex].mediaType || dbMediaType;
          allRealPosts[existingIndex].content = tp.content || allRealPosts[existingIndex].content;
          allRealPosts[existingIndex].publishedAt = tp.publishedAt || tp.updatedAt || allRealPosts[existingIndex].publishedAt;
          
          const live = allRealPosts[existingIndex];
          live.likes = live.likes ?? tp.likes ?? 0;
          live.comments = live.comments ?? tp.comments ?? 0;
          live.shares = live.shares ?? tp.shares ?? 0;
          live.reach = live.reach ?? tp.reach ?? null;
          live.impressions = live.impressions ?? tp.impressions ?? null;
          live.clicks = live.clicks ?? tp.clicks ?? null;
          live.saves = live.saves ?? tp.saves ?? null;
          live.videoViews = live.videoViews ?? tp.videoViews ?? null;
          live.profileVisits = live.profileVisits ?? tp.profileVisits ?? null;
          live.authorName = live.authorName || authorName;
          live.authorPicture = live.authorPicture || authorPicture;
          live.engagementRate = live.reach > 0
            ? parseFloat((((live.likes + live.comments + live.shares) / live.reach) * 100).toFixed(2))
            : live.impressions > 0
              ? parseFloat((((live.likes + live.comments + live.shares) / live.impressions) * 100).toFixed(2))
              : 0;
        } else if (shouldInclude) {
          allRealPosts.push({
            id: dbPostId,
            content: tp.content,
            platform: tp.platform,
            publishedAt: tp.publishedAt || tp.updatedAt || new Date(),
            mediaUrl: dbMediaUrl,
            mediaType: dbMediaType,
            authorName,
            authorPicture,
            ...metrics
          });
        }
      });

      // Filter by platform if not 'all'
      if (platform !== 'all') {
        allRealPosts = allRealPosts.filter(p => p.platform === platform);
      }

      // Sort
      const validSorts = ['engagementRate', 'reach', 'likes', 'impressions'];
      const sortField = validSorts.includes(sortBy) ? sortBy : 'engagementRate';

      allRealPosts.sort((a, b) => (b[sortField] || 0) - (a[sortField] || 0));

      const responseData = {
        success: true,
        posts: allRealPosts.slice(0, parseInt(limit, 10) || 5)
      };

      if (redisClient) {
        try {
          await redisClient.set(cacheKey, JSON.stringify(responseData), { EX: 900 }); // Cache for 15 minutes
          logger.info(`[Analytics Cache] Written key: ${cacheKey}`);
        } catch (cacheErr) {
          logger.warn(`[Analytics Cache] Failed to write cache: ${cacheErr.message}`);
        }
      }

      res.status(200).json(responseData);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Refactored: Synchronization trigger to pull feed changes on demand and seed mock data
   */
  async seedMetrics(req, res, next) {
    try {
      const userId = req.workspace ? req.workspace.ownerId : req.user.id;
      const accounts = await SocialAccount.find({ user: userId });

      // 1. Delete all existing mock posts for this user
      await Post.deleteMany({
        createdBy: userId,
        platformPostId: { $regex: /^mock_post_/ }
      });

      // 2. Delete all existing analytics snapshot records for this user to purge mock data
      await Analytics.deleteMany({ userId });

      // 3. Import sync service dynamically to avoid circular imports, and sync connected accounts to get today's live data
      const { analyticsSyncServiceInstance } = await import('../services/analyticsSync.service.js');
      for (const acc of accounts) {
        try {
          await analyticsSyncServiceInstance.syncAccount(acc._id);
        } catch (syncErr) {
          logger.warn(`[Analytics Seed] Failed to sync live metrics for account ${acc._id}: ${syncErr.message}`);
        }
      }

      // 4. Seed historical snapshots backwards from today's real live data
      const seededRecords = [];
      const now = new Date();
      const since = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
      const until = Math.floor(Date.now() / 1000);

      for (const acc of accounts) {
        // Fetch daily page/user insights from Graph API if account has a token
        let apiDailyInsights = [];
        const token = decrypt(acc.accessToken);
        if (acc.platform === 'facebook') {
          apiDailyInsights = await this.fetchFacebookDailyInsights(acc.platformAccountId, token, since, until);
        } else if (acc.platform === 'instagram') {
          apiDailyInsights = await this.fetchInstagramDailyInsights(acc.platformAccountId, token, since, until);
        }

        // Fetch the fresh live snapshot we just created for today
        const todaySnapshot = await Analytics.findOne({
          userId,
          platform: acc.platform,
          date: { $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) }
        }).sort({ date: -1 });

        const baseFollowers = (todaySnapshot && typeof todaySnapshot.followers === 'number') ? todaySnapshot.followers : 0;

        // Fetch the user's actual posts published in the last 30 days
        const userPosts = await Post.find({
          createdBy: userId,
          platform: acc.platform,
          status: 'PUBLISHED'
        });

        // Group posts by publication date (normalized to YYYY-MM-DD)
        const dailyPostMetrics = {};
        userPosts.forEach(post => {
          const postDate = post.publishedAt || post.createdAt;
          if (!postDate) return;
          const dateStr = new Date(postDate).toISOString().split('T')[0];
          if (!dailyPostMetrics[dateStr]) {
            dailyPostMetrics[dateStr] = {
              likes: 0, comments: 0, shares: 0, reach: 0, impressions: 0, clicks: 0, videoViews: 0, profileVisits: 0
            };
          }
          dailyPostMetrics[dateStr].likes += post.likes || 0;
          dailyPostMetrics[dateStr].comments += post.comments || 0;
          dailyPostMetrics[dateStr].shares += post.shares || 0;
          dailyPostMetrics[dateStr].reach += post.reach || 0;
          dailyPostMetrics[dateStr].impressions += post.impressions || 0;
          dailyPostMetrics[dateStr].clicks += post.clicks || 0;
          dailyPostMetrics[dateStr].videoViews += post.videoViews || 0;
          dailyPostMetrics[dateStr].profileVisits += post.profileVisits || 0;
        });

        const dailyFollowersMap = {};
        let followersAccumulator = baseFollowers;

        if (apiDailyInsights.length > 0) {
          // Walk backward from yesterday (Day -1) to 30 days ago (Day -30) to compute exact history
          for (let i = 1; i <= 30; i++) {
            const recordDate = new Date(now);
            recordDate.setDate(recordDate.getDate() - i);
            recordDate.setHours(12, 0, 0, 0);
            const recordDateStr = recordDate.toISOString().split('T')[0];

            if (acc.platform === 'facebook') {
              const fans = this.getDailyInsightValue(apiDailyInsights, 'page_fans', recordDate);
              if (fans !== null) {
                dailyFollowersMap[recordDateStr] = fans;
              }
            } else if (acc.platform === 'instagram') {
              const followerChange = this.getDailyInsightValue(apiDailyInsights, 'follower_count', recordDate) || 0;
              dailyFollowersMap[recordDateStr] = followersAccumulator;
              followersAccumulator = Math.max(0, followersAccumulator - followerChange);
            }
          }
        }

        for (let i = 30; i >= 1; i--) {
          const recordDate = new Date(now);
          recordDate.setDate(recordDate.getDate() - i);
          recordDate.setHours(12, 0, 0, 0);

          const recordDateStr = recordDate.toISOString().split('T')[0];
          const postAgg = dailyPostMetrics[recordDateStr] || {
            likes: 0, comments: 0, shares: 0, reach: 0, impressions: 0, clicks: 0, videoViews: 0, profileVisits: 0
          };

          let dayImpressions = null;
          let dayReach = null;
          let dayFollowers = dailyFollowersMap[recordDateStr] ?? null;
          let dayLikes = null;
          let dayComments = null;
          let dayShares = null;
          let dayClicks = null;
          let dayVideoViews = null;
          let dayProfileVisits = null;

          if (apiDailyInsights.length > 0) {
            if (acc.platform === 'facebook') {
              dayImpressions = this.getDailyInsightValue(apiDailyInsights, 'page_impressions', recordDate);
              dayReach = this.getDailyInsightValue(apiDailyInsights, 'page_reach', recordDate);
              dayLikes = this.getDailyInsightValue(apiDailyInsights, 'page_actions_post_reactions_total', recordDate);
              dayVideoViews = this.getDailyInsightValue(apiDailyInsights, 'page_video_views', recordDate);
              dayProfileVisits = this.getDailyInsightValue(apiDailyInsights, 'page_views_total', recordDate);
            } else if (acc.platform === 'instagram') {
              dayImpressions = this.getDailyInsightValue(apiDailyInsights, 'impressions', recordDate);
              dayReach = this.getDailyInsightValue(apiDailyInsights, 'reach', recordDate);
              dayProfileVisits = this.getDailyInsightValue(apiDailyInsights, 'profile_views', recordDate);
              dayClicks = this.getDailyInsightValue(apiDailyInsights, 'website_clicks', recordDate);
            }
          }

          // Fallback to real post-level metrics aggregates if daily insights are empty/missing
          if (dayImpressions === null) dayImpressions = postAgg.impressions;
          if (dayReach === null) dayReach = postAgg.reach;
          if (dayFollowers === null) dayFollowers = baseFollowers;
          if (dayLikes === null) dayLikes = postAgg.likes;
          if (dayComments === null) dayComments = postAgg.comments;
          if (dayShares === null) dayShares = postAgg.shares;
          if (dayClicks === null) dayClicks = postAgg.clicks;
          if (dayVideoViews === null) dayVideoViews = postAgg.videoViews;
          if (dayProfileVisits === null) dayProfileVisits = postAgg.profileVisits;

          const sumEngagements = dayLikes + dayComments + dayShares;
          const engagementRate = dayReach > 0
            ? parseFloat(((sumEngagements / dayReach) * 100).toFixed(2))
            : dayImpressions > 0
              ? parseFloat(((sumEngagements / dayImpressions) * 100).toFixed(2))
              : 0;

          seededRecords.push({
            userId,
            date: recordDate,
            platform: acc.platform,
            followers: dayFollowers,
            impressions: dayImpressions,
            reach: dayReach,
            likes: dayLikes,
            comments: dayComments,
            shares: dayShares,
            clicks: dayClicks,
            saves: 0,
            videoViews: dayVideoViews,
            profileVisits: dayProfileVisits,
            engagementRate
          });
        }
      }

      if (seededRecords.length > 0) {
        await Analytics.insertMany(seededRecords);
      }

      // Invalidate Redis caches for this user
      const redisClient = getRedisClient();
      if (redisClient) {
        try {
          const keys = await redisClient.keys(`user:analytics:${userId}:*`);
          const topPostKeys = await redisClient.keys(`user:topposts:${userId}:*`);
          const allKeys = [...keys, ...topPostKeys];
          if (allKeys.length > 0) {
            await redisClient.del(allKeys);
            logger.info(`[Analytics Seed Cache] Invalidated ${allKeys.length} cache keys for user ${userId}`);
          }
        } catch (cacheErr) {
          logger.warn(`[Analytics Seed Cache] Failed to invalidate cache for user ${userId}: ${cacheErr.message}`);
        }
      }

      res.status(200).json({
        success: true,
        message: 'Social accounts synchronized successfully!'
      });
    } catch (error) {
      next(error);
    }
  }

  async getHistory(req, res, next) {
    try {
      const { platform, accountId, metricName, startDate, endDate } = req.query;

      if (!platform || !accountId || !metricName) {
        return res.status(400).json({
          success: false,
          message: 'platform, accountId, and metricName are required parameters.'
        });
      }

      // Enforce security
      const account = await SocialAccount.findById(accountId);
      if (!account) {
        return res.status(404).json({ success: false, message: 'Social account not found.' });
      }

      // Check access rights: normal users can only access their own accounts
      const ownerId = req.workspace ? req.workspace.ownerId : req.user.id;
      if (req.user.role !== 'SUPER_ADMIN' && account.user.toString() !== ownerId.toString()) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }

      const query = {
        accountId: new mongoose.Types.ObjectId(accountId),
        platform,
        metricName
      };

      if (startDate || endDate) {
        query.metricDate = {};
        if (startDate) query.metricDate.$gte = new Date(startDate);
        if (endDate) query.metricDate.$lte = new Date(endDate);
      }

      const historyData = await HistoricalAnalytics.find(query)
        .sort({ metricDate: 1 })
        .lean();

      // Enrich output - remove rawApiResponse for non-admin/debug users
      const isAdminMode = req.user.role === 'SUPER_ADMIN' && req.query.debug === 'true';
      const cleanedData = historyData.map(item => {
        const { rawApiResponse, ...rest } = item;
        return isAdminMode ? item : rest;
      });

      // Find the connection date to return to the frontend for the visual marker
      const connectionDate = account.createdAt;

      res.status(200).json({
        success: true,
        data: cleanedData,
        connectionDate
      });
    } catch (error) {
      next(error);
    }
  }

  async syncAccountManual(req, res, next) {
    try {
      const { accountId } = req.params;
      
      const account = await SocialAccount.findById(accountId);
      if (!account) {
        return res.status(404).json({ success: false, message: 'Social account not found.' });
      }

      // Check access rights
      const ownerId = req.workspace ? req.workspace.ownerId : req.user.id;
      if (req.user.role !== 'SUPER_ADMIN' && account.user.toString() !== ownerId.toString()) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }

      // Run sync (isHistorical = false for manual sync of current/yesterday's data)
      await historicalAnalyticsSyncServiceInstance.syncAccountAnalytics(accountId, false);

      res.status(200).json({
        success: true,
        message: 'Social account analytics synced successfully!'
      });
    } catch (error) {
      next(error);
    }
  }

  async syncAllAccountsManual(req, res, next) {
    try {
      // Enforce admin permission
      if (req.user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ success: false, message: 'Access denied. Administrator privileges required.' });
      }

      // Run sync all
      await historicalAnalyticsSyncServiceInstance.syncAllAccounts();

      res.status(200).json({
        success: true,
        message: 'Triggered global daily sync for all connected accounts successfully.'
      });
    } catch (error) {
      next(error);
    }
  }
}

export const analyticsControllerInstance = new AnalyticsController();
export default analyticsControllerInstance;
