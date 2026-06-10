import Post from '../models/post.model.js';
import SocialAccount from '../models/socialAccount.model.js';
import { decrypt } from '../utils/encryption.js';
import { BadRequestError } from '../utils/errors.util.js';
import logger from '../utils/logger.util.js';

class AnalyticsController {
  buildMetrics({ likes = 0, comments = 0, shares = 0, reach = null, impressions = null }) {
    const realReach = Number.isFinite(reach) ? reach : null;
    const realImpressions = Number.isFinite(impressions) ? impressions : null;
    const engagementRate = realReach > 0
      ? parseFloat((((likes + comments + shares) / realReach) * 100).toFixed(2))
      : null;

    return {
      likes,
      comments,
      shares,
      reach: realReach,
      impressions: realImpressions,
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

  async fetchFacebookPostInsights(postId, token) {
    try {
      const endpoint = `https://graph.facebook.com/v19.0/${postId}`;
      const insights = await this.fetchInsights(endpoint, ['post_impressions', 'post_impressions_unique'], token);
      return {
        impressions: this.getInsightValue(insights, ['post_impressions']),
        reach: this.getInsightValue(insights, ['post_impressions_unique'])
      };
    } catch (err) {
      logger.warn(`[Analytics] Failed to fetch Facebook insights for ${postId}: ${err.message}`);
      return { impressions: null, reach: null };
    }
  }

  async fetchInstagramMediaInsights(mediaId, token) {
    try {
      const endpoint = `https://graph.facebook.com/v19.0/${mediaId}`;
      const insights = await this.fetchInsights(endpoint, ['reach', 'views', 'shares'], token);
      return {
        reach: this.getInsightValue(insights, ['reach']),
        impressions: this.getInsightValue(insights, ['views']),
        shares: this.getInsightValue(insights, ['shares'])
      };
    } catch (err) {
      logger.warn(`[Analytics] Failed to fetch Instagram insights for ${mediaId}: ${err.message}`);
      return { reach: null, impressions: null, shares: null };
    }
  }

  async fetchThreadsPostInsights(postId, token) {
    try {
      const endpoint = `https://graph.threads.net/v1.0/${postId}`;
      const insights = await this.fetchInsights(endpoint, ['views', 'likes', 'replies', 'reposts', 'quotes'], token);
      const reposts = this.getInsightValue(insights, ['reposts']) || 0;
      const quotes = this.getInsightValue(insights, ['quotes']) || 0;
      return {
        impressions: this.getInsightValue(insights, ['views']),
        likes: this.getInsightValue(insights, ['likes']),
        comments: this.getInsightValue(insights, ['replies']),
        shares: reposts + quotes
      };
    } catch (err) {
      logger.warn(`[Analytics] Failed to fetch Threads insights for ${postId}: ${err.message}`);
      return { impressions: null, likes: null, comments: null, shares: null };
    }
  }

  /**
   * Helper: Fetch real page feed and post metrics from Facebook Graph API
   */
  async fetchFacebookPageFeed(pageId, token) {
    try {
      const url = `https://graph.facebook.com/v19.0/${pageId}/feed?fields=id,message,story,created_time,shares,likes.summary(true),comments.summary(true)&limit=50&access_token=${token}`;
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
      const url = `https://graph.facebook.com/v19.0/${igUserId}/media?fields=id,caption,timestamp,like_count,comments_count&limit=50&access_token=${token}`;
      const res = await this.fetchJson(url);
      if (res && res.data) {
        return Promise.all(res.data.map(async item => {
          const likes = item.like_count || 0;
          const comments = item.comments_count || 0;
          const insights = await this.fetchInstagramMediaInsights(item.id, token);
          const shares = insights.shares || 0;
          const metrics = this.buildMetrics({ likes, comments, shares, reach: insights.reach, impressions: insights.impressions });

          return {
            id: item.id,
            content: item.caption || 'Instagram Media',
            platform: 'instagram',
            publishedAt: new Date(item.timestamp),
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
      const url = `https://graph.threads.net/v1.0/me/threads?fields=id,text,timestamp,like_count,reply_count&limit=50&access_token=${token}`;
      const res = await this.fetchJson(url);
      if (res && res.data) {
        return Promise.all(res.data.map(async item => {
          const insights = await this.fetchThreadsPostInsights(item.id, token);
          const likes = insights.likes ?? item.like_count ?? 0;
          const comments = insights.comments ?? item.reply_count ?? 0;
          const shares = insights.shares ?? 0;
          const metrics = this.buildMetrics({ likes, comments, shares, impressions: insights.impressions });

          return {
            id: item.id,
            content: item.text || 'Threads Post',
            platform: 'threads',
            publishedAt: new Date(item.timestamp),
            ...metrics
          };
        }));
      }
    } catch (err) {
      logger.warn(`[Analytics] Failed to fetch Threads feed: ${err.message}`);
    }
    return [];
  }

  /**
   * Helper: Fetch real post feed and metrics from LinkedIn API
   */
  async fetchLinkedInFeed(platformAccountId, token) {
    try {
      const author = platformAccountId.startsWith('urn:li:') ? platformAccountId : `urn:li:person:${platformAccountId}`;
      const url = `https://api.linkedin.com/v2/posts?author=${encodeURIComponent(author)}&q=author&count=50`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
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
                'LinkedIn-Version': '202406',
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

        return res.elements.map(item => {
          const postMetadata = socialData[item.id] || {};
          const likes = postMetadata.reactionsSummary?.totalFirstLevelReactions || 0;
          const comments = postMetadata.commentsSummary?.totalComments || 0;
          const shares = postMetadata.sharesSummary?.totalShares || 0;
          const metrics = this.buildMetrics({ likes, comments, shares });

          return {
            id: item.id,
            content: item.commentary || 'LinkedIn Post',
            platform: 'linkedin',
            publishedAt: new Date(item.createdAt || Date.now()),
            ...metrics
          };
        });
      }
    } catch (err) {
      logger.warn(`[Analytics] Failed to fetch LinkedIn feed: ${err.message}`);
    }
    return [];
  }

  /**
   * Get aggregated performance stats and timeline charts from real platform feed data
   */
  async getOverview(req, res, next) {
    try {
      const userId = req.user.id;
      const { platform = 'all', days = 30 } = req.query;

      const numDays = parseInt(days, 10) || 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - numDays);
      startDate.setHours(0, 0, 0, 0);

      // 1. Fetch connected platform accounts
      const accounts = await SocialAccount.find({ user: userId });

      // 2. Fetch recent post feeds from all connected social networks
      let allRealPosts = [];
      let totalLiveFollowers = 0;

      for (const acc of accounts) {
        const token = decrypt(acc.accessToken);
        
        // Fetch follower/page counts dynamically
        try {
          if (acc.platform === 'facebook') {
            const fbRes = await fetch(`https://graph.facebook.com/v19.0/${acc.platformAccountId}?fields=fan_count,followers_count`, {
              headers: { Authorization: `Bearer ${token}` }
            }).then(r => r.json());
            if (fbRes && !fbRes.error) {
              totalLiveFollowers += (fbRes.followers_count || fbRes.fan_count || 0);
            }
          } else if (acc.platform === 'instagram') {
            const igRes = await fetch(`https://graph.facebook.com/v19.0/${acc.platformAccountId}?fields=followers_count`, {
              headers: { Authorization: `Bearer ${token}` }
            }).then(r => r.json());
            if (igRes && !igRes.error) {
              totalLiveFollowers += (igRes.followers_count || 0);
            }
          } else if (acc.platform === 'linkedin') {
            const author = acc.platformAccountId.startsWith('urn:li:') ? acc.platformAccountId : `urn:li:person:${acc.platformAccountId}`;
            const liRes = await fetch(`https://api.linkedin.com/v2/networkSizes/${author}?edgeType=CompanyFollowed`, {
              headers: { Authorization: `Bearer ${token}` }
            }).then(r => r.json());
            if (liRes && !liRes.error) {
              totalLiveFollowers += (liRes.firstDegreeSize || 0);
            }
          }
        } catch (followerErr) {
          logger.warn(`[Analytics] Failed to fetch followers for ${acc.platform}: ${followerErr.message}`);
        }

        // Fetch feed posts
        if (platform === 'all' || acc.platform === platform) {
          if (acc.platform === 'facebook') {
            const fbFeed = await analyticsControllerInstance.fetchFacebookPageFeed(acc.platformAccountId, token);
            allRealPosts = allRealPosts.concat(fbFeed);
          } else if (acc.platform === 'instagram') {
            const igFeed = await analyticsControllerInstance.fetchInstagramMediaFeed(acc.platformAccountId, token);
            allRealPosts = allRealPosts.concat(igFeed);
          } else if (acc.platform === 'threads') {
            const threadsFeed = await analyticsControllerInstance.fetchThreadsFeed(acc.platformAccountId, token);
            allRealPosts = allRealPosts.concat(threadsFeed);
          } else if (acc.platform === 'linkedin') {
            const liFeed = await analyticsControllerInstance.fetchLinkedInFeed(acc.platformAccountId, token);
            allRealPosts = allRealPosts.concat(liFeed);
          }
        }
      }

      // 3. Merge direct Taraflow published posts (avoid duplicate counts)
      const postQuery = {
        createdBy: userId,
        status: 'PUBLISHED'
      };
      if (platform !== 'all') {
        postQuery.platform = platform;
      }
      const taraflowPosts = await Post.find(postQuery);
      
      taraflowPosts.forEach(tp => {
        const exists = allRealPosts.some(rp => rp.id === tp.platformPostId);
        const isSeededMock = /^mock_post_/.test(tp.platformPostId || '');
        if (!exists && !isSeededMock) {
          const likes = tp.likes || 0;
          const comments = tp.comments || 0;
          const shares = tp.shares || 0;
          const metrics = this.buildMetrics({
            likes,
            comments,
            shares,
            reach: tp.reach || null,
            impressions: tp.impressions || null
          });

          allRealPosts.push({
            id: tp.platformPostId || tp._id.toString(),
            content: tp.content,
            platform: tp.platform,
            publishedAt: tp.publishedAt || tp.updatedAt || new Date(),
            ...metrics
          });
        }
      });

      // Filter merged list to date range
      const rangePosts = allRealPosts.filter(p => new Date(p.publishedAt) >= startDate);

      // 4. Construct a daily contiguous timeline aggregating real metrics per day
      const dailyMap = {};
      rangePosts.forEach(p => {
        const dateStr = new Date(p.publishedAt).toISOString().split('T')[0];
        if (!dailyMap[dateStr]) {
          dailyMap[dateStr] = { impressions: 0, reach: 0, likes: 0, comments: 0, shares: 0 };
        }
        dailyMap[dateStr].impressions += p.impressions || 0;
        dailyMap[dateStr].reach += p.reach || 0;
        dailyMap[dateStr].likes += p.likes || 0;
        dailyMap[dateStr].comments += p.comments || 0;
        dailyMap[dateStr].shares += p.shares || 0;
      });

      const blendedTimeline = [];
      for (let i = numDays - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        
        const dayData = dailyMap[dateStr] || { impressions: 0, reach: 0, likes: 0, comments: 0, shares: 0 };
        const dailyEngagementRate = dayData.reach > 0 
          ? parseFloat((((dayData.likes + dayData.comments + dayData.shares) / dayData.reach) * 100).toFixed(2))
          : 0;

        blendedTimeline.push({
          date: dateStr,
          impressions: dayData.impressions,
          reach: dayData.reach,
          followers: totalLiveFollowers,
          likes: dayData.likes,
          comments: dayData.comments,
          shares: dayData.shares,
          engagementRate: dailyEngagementRate
        });
      }

      // 5. Aggregate summary stats and period change metrics
      const totalImpressions = blendedTimeline.reduce((sum, item) => sum + item.impressions, 0);
      const totalReach = blendedTimeline.reduce((sum, item) => sum + item.reach, 0);
      const totalLikes = blendedTimeline.reduce((sum, item) => sum + item.likes, 0);
      const totalComments = blendedTimeline.reduce((sum, item) => sum + item.comments, 0);
      const totalShares = blendedTimeline.reduce((sum, item) => sum + item.shares, 0);

      const avgEngagementRate = totalReach > 0
        ? parseFloat((((totalLikes + totalComments + totalShares) / totalReach) * 100).toFixed(2))
        : 0;

      // Comparative growth stats comparing second half to first half of window
      const midPoint = Math.floor(blendedTimeline.length / 2);
      const firstHalf = blendedTimeline.slice(0, midPoint);
      const secondHalf = blendedTimeline.slice(midPoint);

      const firstHalfReach = firstHalf.reduce((sum, i) => sum + i.reach, 0);
      const secondHalfReach = secondHalf.reduce((sum, i) => sum + i.reach, 0);
      const reachChange = firstHalfReach > 0
        ? (((secondHalfReach - firstHalfReach) / firstHalfReach) * 100).toFixed(1)
        : '0.0';

      const firstHalfImpressions = firstHalf.reduce((sum, i) => sum + i.impressions, 0);
      const secondHalfImpressions = secondHalf.reduce((sum, i) => sum + i.impressions, 0);
      const impressionsChange = firstHalfImpressions > 0
        ? (((secondHalfImpressions - firstHalfImpressions) / firstHalfImpressions) * 100).toFixed(1)
        : '0.0';

      const firstHalfEngagement = firstHalf.reduce((sum, i) => sum + i.engagementRate, 0) / firstHalf.length;
      const secondHalfEngagement = secondHalf.reduce((sum, i) => sum + i.engagementRate, 0) / secondHalf.length;
      const engagementChange = firstHalfEngagement > 0
        ? (((secondHalfEngagement - firstHalfEngagement) / firstHalfEngagement) * 100).toFixed(1)
        : '0.0';

      res.status(200).json({
        success: true,
        hasData: rangePosts.length > 0 || totalLiveFollowers > 0,
        summary: {
          impressions: totalImpressions,
          reach: totalReach,
          followers: totalLiveFollowers,
          engagementRate: avgEngagementRate,
          changeImpressions: `${parseFloat(impressionsChange) >= 0 ? '+' : ''}${impressionsChange}%`,
          changeReach: `${parseFloat(reachChange) >= 0 ? '+' : ''}${reachChange}%`,
          changeFollowers: '+0.0%', // Followers change constant over daily fetch
          changeEngagement: `${parseFloat(engagementChange) >= 0 ? '+' : ''}${engagementChange}%`
        },
        timeline: blendedTimeline
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get top performing content lists directly from actual feeds
   */
  async getTopPosts(req, res, next) {
    try {
      const userId = req.user.id;
      const { limit = 5, sortBy = 'engagementRate', platform = 'all' } = req.query;

      const accountQuery = { user: userId };
      if (platform !== 'all') {
        accountQuery.platform = platform;
      }
      const accounts = await SocialAccount.find(accountQuery);
      let allRealPosts = [];

      for (const acc of accounts) {
        const token = decrypt(acc.accessToken);
        if (acc.platform === 'facebook') {
          const fbFeed = await analyticsControllerInstance.fetchFacebookPageFeed(acc.platformAccountId, token);
          allRealPosts = allRealPosts.concat(fbFeed);
        } else if (acc.platform === 'instagram') {
          const igFeed = await analyticsControllerInstance.fetchInstagramMediaFeed(acc.platformAccountId, token);
          allRealPosts = allRealPosts.concat(igFeed);
        } else if (acc.platform === 'threads') {
          const threadsFeed = await analyticsControllerInstance.fetchThreadsFeed(acc.platformAccountId, token);
          allRealPosts = allRealPosts.concat(threadsFeed);
        } else if (acc.platform === 'linkedin') {
          const liFeed = await analyticsControllerInstance.fetchLinkedInFeed(acc.platformAccountId, token);
          allRealPosts = allRealPosts.concat(liFeed);
        }
      }

      // Merge direct Taraflow posts
      const postQuery = {
        createdBy: userId,
        status: 'PUBLISHED',
        platformPostId: { $exists: true, $ne: null, $not: /^mock_post_/ }
      };
      if (platform !== 'all') {
        postQuery.platform = platform;
      }
      const taraflowPosts = await Post.find(postQuery);
      taraflowPosts.forEach(tp => {
        const exists = allRealPosts.some(rp => rp.id === tp.platformPostId);
        if (!exists) {
          const likes = tp.likes || 0;
          const comments = tp.comments || 0;
          const shares = tp.shares || 0;
          const metrics = this.buildMetrics({
            likes,
            comments,
            shares,
            reach: tp.reach || null,
            impressions: tp.impressions || null
          });

          allRealPosts.push({
            id: tp.platformPostId || tp._id.toString(),
            content: tp.content,
            platform: tp.platform,
            publishedAt: tp.publishedAt || tp.updatedAt || new Date(),
            ...metrics
          });
        }
      });

      // Sort
      const validSorts = ['engagementRate', 'reach', 'likes', 'impressions'];
      const sortField = validSorts.includes(sortBy) ? sortBy : 'engagementRate';

      allRealPosts.sort((a, b) => (b[sortField] || 0) - (a[sortField] || 0));

      res.status(200).json({
        success: true,
        posts: allRealPosts.slice(0, parseInt(limit, 10) || 5)
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Refactored: Synchronization trigger to pull feed changes on demand and seed mock data
   */
  async seedMetrics(req, res, next) {
    try {
      const userId = req.user.id;
      const accounts = await SocialAccount.find({ user: userId });

      // 1. Sync live metrics for any real connected platforms
      for (const acc of accounts) {
        const token = decrypt(acc.accessToken);
        const posts = await Post.find({ createdBy: userId, platform: acc.platform, status: 'PUBLISHED', platformPostId: { $exists: true, $ne: null } });

        for (const post of posts) {
          try {
            if (acc.platform === 'facebook') {
              const fbPost = await this.fetchJson(`https://graph.facebook.com/v19.0/${post.platformPostId}?fields=shares,likes.summary(true),comments.summary(true)&access_token=${token}`);
              if (fbPost && !fbPost.error) {
                const insights = await this.fetchFacebookPostInsights(post.platformPostId, token);
                const metrics = this.buildMetrics({
                  likes: fbPost.likes?.summary?.total_count || 0,
                  comments: fbPost.comments?.summary?.total_count || 0,
                  shares: fbPost.shares?.count || 0,
                  ...insights
                });
                Object.assign(post, metrics);
                await post.save();
              }
            } else if (acc.platform === 'instagram') {
              const igMedia = await this.fetchJson(`https://graph.facebook.com/v19.0/${post.platformPostId}?fields=like_count,comments_count&access_token=${token}`);
              if (igMedia && !igMedia.error) {
                const insights = await this.fetchInstagramMediaInsights(post.platformPostId, token);
                const metrics = this.buildMetrics({
                  likes: igMedia.like_count || 0,
                  comments: igMedia.comments_count || 0,
                  shares: insights.shares || 0,
                  reach: insights.reach,
                  impressions: insights.impressions
                });
                Object.assign(post, metrics);
                await post.save();
              }
            } else if (acc.platform === 'threads') {
              const threadPost = await this.fetchJson(`https://graph.threads.net/v1.0/${post.platformPostId}?fields=like_count,reply_count&access_token=${token}`);
              if (threadPost && !threadPost.error) {
                const insights = await this.fetchThreadsPostInsights(post.platformPostId, token);
                const metrics = this.buildMetrics({
                  likes: insights.likes ?? threadPost.like_count ?? 0,
                  comments: insights.comments ?? threadPost.reply_count ?? 0,
                  shares: insights.shares ?? 0,
                  impressions: insights.impressions
                });
                Object.assign(post, metrics);
                await post.save();
              }
            } else if (acc.platform === 'linkedin') {
              const metadataUrl = `https://api.linkedin.com/rest/socialMetadata/${encodeURIComponent(post.platformPostId)}`;
              const liPost = await fetch(metadataUrl, {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'LinkedIn-Version': '202406',
                  'X-Restli-Protocol-Version': '2.0.0'
                }
              }).then(r => r.json());
              if (liPost && !liPost.error) {
                const metrics = this.buildMetrics({
                  likes: liPost.reactionsSummary?.totalFirstLevelReactions || 0,
                  comments: liPost.commentsSummary?.totalComments || 0,
                  shares: liPost.sharesSummary?.totalShares || 0
                });
                Object.assign(post, metrics);
                await post.save();
              }
            }
          } catch (syncErr) {
            logger.warn(`[Analytics Sync] Failed to sync live metrics for post ${post._id}: ${syncErr.message}`);
          }
        }
      }

      // 2. Seed mock posts spread over the last 30 days for rich visualization
      // Always delete old seeded mock posts to allow resetting/re-seeding
      await Post.deleteMany({
        createdBy: userId,
        platformPostId: { $regex: /^mock_post_/ }
      });

      const mockPosts = [];
      const platforms = ['facebook', 'instagram', 'threads', 'linkedin'];
      const topics = [
        "10 Coding Tips to Boost Productivity in 2026! 🚀 #programming #productivity",
        "Behind the scenes of building Taraflow: Our journey to 10k users. 📈 #startup #saas",
        "Which CSS framework is your go-to? Tailwind, Bootstrap, or Vanilla CSS? 🎨 #webdev #css",
        "Our latest feature release is officially live! Check out the brand-new analytics dashboard. 📊",
        "How to prepare for your next technical interview - a complete walkthrough. 💻 #careers #tech",
        "Designing premium dark mode interfaces: What we've learned. 🌙 #uiux #design",
        "Reflecting on our milestones this quarter. Huge thanks to our amazing community! ❤️",
        "A quick guide to deploying full-stack web applications with Render and Vercel. 🚀"
      ];

      for (let i = 0; i < 15; i++) {
        const platform = platforms[i % platforms.length];
        const content = topics[i % topics.length];
        
        // Random metrics
        const likes = Math.floor(Math.random() * 150) + 10;
        const comments = Math.floor(Math.random() * 40) + 2;
        const shares = platform === 'threads' ? 0 : Math.floor(likes * (0.05 + Math.random() * 0.1));
        const reach = (likes * 8) + (comments * 18) + (shares * 35) + 5;
        const impressions = (likes * 12) + (comments * 25) + (shares * 45) + 10;
        const engagementRate = reach > 0 ? parseFloat((((likes + comments + shares) / reach) * 100).toFixed(2)) : 0;
        
        // Random date in the last 30 days
        const publishedAt = new Date();
        publishedAt.setDate(publishedAt.getDate() - Math.floor(Math.random() * 28) - 1);

        mockPosts.push({
          content,
          platform,
          status: 'PUBLISHED',
          likes,
          comments,
          shares,
          reach,
          impressions,
          engagementRate,
          publishedAt,
          platformPostId: `mock_post_${platform}_${i}_${Date.now()}`,
          createdBy: userId
        });
      }

      await Post.insertMany(mockPosts);

      res.status(200).json({
        success: true,
        message: 'Live social feeds synchronized and high-fidelity mock metrics seeded successfully!'
      });
    } catch (error) {
      next(error);
    }
  }
}

export const analyticsControllerInstance = new AnalyticsController();
export default analyticsControllerInstance;
