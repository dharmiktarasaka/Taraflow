import mongoose from 'mongoose';
import Post from '../models/post.model.js';
import SocialAccount from '../models/socialAccount.model.js';
import Analytics from '../models/analytics.model.js';
import AiLearningProfile from '../models/aiLearningProfile.model.js';
import { decrypt, encrypt } from '../utils/encryption.js';
import { BadRequestError } from '../utils/errors.util.js';
import logger from '../utils/logger.util.js';
import { getRedisClient } from '../config/redis.config.js';

class AnalyticsController {
  constructor() {
    this.getOverview = this.getOverview.bind(this);
    this.getTopPosts = this.getTopPosts.bind(this);
    this.seedMetrics = this.seedMetrics.bind(this);
    this.getPostAnalysis = this.getPostAnalysis.bind(this);
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
      const insights = await this.fetchInsights(endpoint, ['reach', 'views', 'shares', 'saved', 'plays'], token);
      return {
        reach: this.getInsightValue(insights, ['reach']),
        impressions: this.getInsightValue(insights, ['views']),
        shares: this.getInsightValue(insights, ['shares']),
        saves: this.getInsightValue(insights, ['saved']),
        videoViews: this.getInsightValue(insights, ['plays'])
      };
    } catch (err) {
      logger.warn(`[Analytics] Failed to fetch Instagram insights for ${mediaId}: ${err.message}`);
      return { reach: null, impressions: null, shares: null, saves: null, videoViews: null };
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
      const url = `https://graph.facebook.com/v19.0/${pageId}/feed?fields=id,message,story,created_time,shares,likes.limit(0).summary(true),comments.limit(0).summary(true)&limit=50&access_token=${token}`;
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
      const url = `https://graph.threads.net/v1.0/me/threads?fields=id,text,timestamp,like_count,reply_count,repost_count&limit=50&access_token=${token}`;
      const res = await this.fetchJson(url);
      if (res && res.data) {
        return Promise.all(res.data.map(async item => {
          const insights = await this.fetchThreadsPostInsights(item.id, token);
          const likes = insights.likes ?? item.like_count ?? 0;
          const comments = insights.comments ?? item.reply_count ?? 0;
          const shares = insights.shares ?? item.repost_count ?? 0;
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

  async fetchPostLiveAnalytics(platform, platformPostId, token) {
    let likes = 0;
    let comments = 0;
    let shares = 0;
    let reach = 0;
    let impressions = 0;
    let clicks = 0;
    let saves = 0;
    let videoViews = 0;
    let profileVisits = 0;
    let caption = '';
    let mediaUrl = '';
    let mediaType = 'image';
    let publishedAt = new Date();
    let permalink = '';

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
          reach = insights.reach || 0;
          impressions = insights.impressions || 0;
          clicks = insights.clicks || 0;
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
          reach = insights.reach || 0;
          impressions = insights.impressions || 0;
          shares = insights.shares || 0;
          saves = insights.saves || 0;
          videoViews = insights.videoViews || 0;
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
          impressions = insights.impressions || 0;
        }
      } else if (platform === 'linkedin') {
        try {
          const metadataUrl = `https://api.linkedin.com/rest/socialMetadata/${encodeURIComponent(platformPostId)}`;
          const liPost = await fetch(metadataUrl, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'LinkedIn-Version': '202406',
              'X-Restli-Protocol-Version': '2.0.0'
            }
          }).then(r => r.json());
          if (liPost && !liPost.error) {
            likes = liPost.reactionsSummary?.totalFirstLevelReactions || 0;
            comments = liPost.commentsSummary?.totalComments || 0;
            shares = liPost.sharesSummary?.totalShares || 0;
          }
        } catch (err) {
          logger.warn(`[Analytics Post] LinkedIn socialMetadata fetch failed: ${err.message}`);
        }
      }
    } catch (err) {
      logger.warn(`[Analytics Post] Live API fetch failed for post ${platformPostId}: ${err.message}`);
    }

    const engagementRate = reach > 0
      ? parseFloat((((likes + comments + shares) / reach) * 100).toFixed(2))
      : impressions > 0
        ? parseFloat((((likes + comments + shares) / impressions) * 100).toFixed(2))
        : 0;

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
      permalink
    };
  }

  async getPostAnalysis(req, res, next) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const { platform: queryPlatform } = req.query;

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
      if (account && !platformPostId.startsWith('mock_post_')) {
        const token = decrypt(account.accessToken);
        liveMetrics = await this.fetchPostLiveAnalytics(platform, platformPostId, token);
      }

      // 3. Construct post details combining DB and live metadata
      const isMock = platformPostId.startsWith('mock_post_');
      const caption = liveMetrics.caption || post?.content || (isMock ? 'Mock post caption content topic #marketing #growth' : '');
      const mediaUrl = liveMetrics.mediaUrl || post?.media?.[0]?.url || '';
      const mediaType = liveMetrics.mediaType || post?.media?.[0]?.type || 'image';
      const publishedAt = liveMetrics.publishedAt || post?.publishedAt || post?.createdAt || new Date();
      const permalink = liveMetrics.permalink || `https://www.${platform}.com/post/${platformPostId}`;

      const likes = liveMetrics.likes ?? post?.likes ?? (isMock ? Math.floor(Math.random() * 50) + 5 : 0);
      const comments = liveMetrics.comments ?? post?.comments ?? (isMock ? Math.floor(Math.random() * 10) + 1 : 0);
      const shares = liveMetrics.shares ?? post?.shares ?? (isMock ? Math.floor(Math.random() * 5) : 0);
      const reach = liveMetrics.reach ?? post?.reach ?? (isMock ? Math.floor(Math.random() * 500) + 50 : 0);
      const impressions = liveMetrics.impressions ?? post?.impressions ?? (isMock ? Math.floor(Math.random() * 800) + 100 : 0);
      const clicks = liveMetrics.clicks ?? post?.clicks ?? (isMock ? Math.floor(Math.random() * 20) : 0);
      const saves = liveMetrics.saves ?? post?.saves ?? (isMock ? Math.floor(Math.random() * 15) : 0);
      const videoViews = liveMetrics.videoViews ?? post?.videoViews ?? (isMock && mediaType === 'video' ? Math.floor(Math.random() * 300) : 0);
      const profileVisits = liveMetrics.profileVisits ?? post?.profileVisits ?? (isMock ? Math.floor(Math.random() * 8) : 0);

      const engagementRate = reach > 0
        ? parseFloat((((likes + comments + shares) / reach) * 100).toFixed(2))
        : impressions > 0
          ? parseFloat((((likes + comments + shares) / impressions) * 100).toFixed(2))
          : 0;

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
        engagementRate
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

  async fetchImageBase64(url) {
    if (!url) return null;
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      return { base64, contentType };
    } catch (err) {
      logger.warn(`[Gemini Analysis] Failed to fetch image: ${err.message}`);
      return null;
    }
  }

  /**
   * Get aggregated performance stats and timeline charts from real platform feed data
   */
  async getOverview(req, res, next) {
    try {
      const userId = req.user.id;
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
      const accounts = await SocialAccount.find({ user: userId });

      // 2. Fetch recent post feeds from all connected social networks
      let allRealPosts = [];
      let totalLiveFollowers = 0;
      const connectedPlatforms = new Set(accounts.map(acc => acc.platform));

      const liveFollowersMap = {
        facebook: 0,
        instagram: 0,
        linkedin: 0,
        threads: 0
      };

      for (const acc of accounts) {
        const token = decrypt(acc.accessToken);
        
        // Fetch follower/page counts dynamically
        try {
          if (platform === 'all' || acc.platform === platform) {
            if (acc.platform === 'facebook') {
              const fbRes = await fetch(`https://graph.facebook.com/v19.0/${acc.platformAccountId}?fields=fan_count,followers_count`, {
                headers: { Authorization: `Bearer ${token}` }
              }).then(r => r.json());
              if (fbRes && !fbRes.error) {
                const fbFollowers = fbRes.followers_count || fbRes.fan_count || 0;
                totalLiveFollowers += fbFollowers;
                liveFollowersMap.facebook = fbFollowers;
              }
            } else if (acc.platform === 'instagram') {
              const igRes = await fetch(`https://graph.facebook.com/v19.0/${acc.platformAccountId}?fields=followers_count`, {
                headers: { Authorization: `Bearer ${token}` }
              }).then(r => r.json());
              if (igRes && !igRes.error) {
                const igFollowers = igRes.followers_count || 0;
                totalLiveFollowers += igFollowers;
                liveFollowersMap.instagram = igFollowers;
              }
            } else if (acc.platform === 'linkedin') {
              const author = acc.platformAccountId.startsWith('urn:li:') ? acc.platformAccountId : `urn:li:person:${acc.platformAccountId}`;
              const liRes = await fetch(`https://api.linkedin.com/v2/networkSizes/${author}?edgeType=CompanyFollowed`, {
                headers: { Authorization: `Bearer ${token}` }
              }).then(r => r.json());
              if (liRes && !liRes.error) {
                const liFollowers = liRes.firstDegreeSize || 0;
                totalLiveFollowers += liFollowers;
                liveFollowersMap.linkedin = liFollowers;
              }
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

      // Add mock follower count for unconnected platforms if mock data exists
      const mockFollowersMap = {
        facebook: 15420,
        instagram: 28910,
        linkedin: 12150,
        threads: 4830
      };

      const hasMockPosts = await Post.exists({
        createdBy: userId,
        platformPostId: { $regex: /^mock_post_/ }
      });

      if (hasMockPosts) {
        const platformsToCheck = platform === 'all'
          ? ['facebook', 'instagram', 'linkedin', 'threads']
          : [platform];

        for (const p of platformsToCheck) {
          if (!connectedPlatforms.has(p) && mockFollowersMap[p]) {
            totalLiveFollowers += mockFollowersMap[p];
            liveFollowersMap[p] = mockFollowersMap[p];
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
        const exists = allRealPosts.some(rp => {
          if (rp.id === tp.platformPostId) return true;
          if (tp.platform === 'facebook' && rp.id.endsWith(`_${tp.platformPostId}`)) return true;
          if (tp.platform === 'facebook' && tp.platformPostId.endsWith(`_${rp.id}`)) return true;
          return false;
        });
        const isSeededMock = /^mock_post_/.test(tp.platformPostId || '');
        const shouldInclude = !exists && (!isSeededMock || !connectedPlatforms.has(tp.platform));
        if (shouldInclude) {
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
          dailyMap[dateStr] = { impressions: 0, reach: 0, likes: 0, comments: 0, shares: 0, clicks: 0, saves: 0, videoViews: 0 };
        }
        dailyMap[dateStr].impressions += p.impressions || 0;
        dailyMap[dateStr].reach += p.reach || 0;
        dailyMap[dateStr].likes += p.likes || 0;
        dailyMap[dateStr].comments += p.comments || 0;
        dailyMap[dateStr].shares += p.shares || 0;
        dailyMap[dateStr].clicks += p.clicks || 0;
        dailyMap[dateStr].saves += p.saves || 0;
        dailyMap[dateStr].videoViews += p.videoViews || 0;
      });

      // Retrieve historical daily analytics records (including followers)
      const historicalAnalytics = await Analytics.find({
        userId,
        date: { $gte: startDate }
      });

      const historicalMap = {};
      historicalAnalytics.forEach(record => {
        const dateStr = new Date(record.date).toISOString().split('T')[0];
        if (!historicalMap[dateStr]) {
          historicalMap[dateStr] = {};
        }
        historicalMap[dateStr][record.platform] = record.followers;
      });

      const getFollowersForDate = (dateStr, plat) => {
        // 1. Check if exact date exists
        if (historicalMap[dateStr] && typeof historicalMap[dateStr][plat] === 'number') {
          return historicalMap[dateStr][plat];
        }
        // 2. Find closest date with a record for this platform
        const datesWithRecord = Object.keys(historicalMap).filter(d => typeof historicalMap[d][plat] === 'number');
        if (datesWithRecord.length > 0) {
          const targetTime = new Date(dateStr).getTime();
          datesWithRecord.sort((a, b) => {
            return Math.abs(new Date(a).getTime() - targetTime) - Math.abs(new Date(b).getTime() - targetTime);
          });
          return historicalMap[datesWithRecord[0]][plat];
        }
        // 3. Fallback to today's live/mock followers
        return liveFollowersMap[plat] || 0;
      };

      const blendedTimeline = [];
      for (let i = numDays - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        
        const dayData = dailyMap[dateStr] || { impressions: 0, reach: 0, likes: 0, comments: 0, shares: 0, clicks: 0, saves: 0, videoViews: 0 };
        const dailyEngagementRate = dayData.reach > 0 
          ? parseFloat((((dayData.likes + dayData.comments + dayData.shares) / dayData.reach) * 100).toFixed(2))
          : 0;

        let dayFollowers = 0;
        const platformsToQuery = platform === 'all'
          ? ['facebook', 'instagram', 'linkedin', 'threads']
          : [platform];

        platformsToQuery.forEach(plat => {
          dayFollowers += getFollowersForDate(dateStr, plat);
        });

        blendedTimeline.push({
          date: dateStr,
          impressions: dayData.impressions,
          reach: dayData.reach,
          followers: dayFollowers,
          likes: dayData.likes,
          comments: dayData.comments,
          shares: dayData.shares,
          clicks: dayData.clicks,
          saves: dayData.saves,
          videoViews: dayData.videoViews,
          engagementRate: dailyEngagementRate
        });
      }

      // 5. Aggregate summary stats and period change metrics
      const totalImpressions = blendedTimeline.reduce((sum, item) => sum + item.impressions, 0);
      const totalReach = blendedTimeline.reduce((sum, item) => sum + item.reach, 0);
      const totalLikes = blendedTimeline.reduce((sum, item) => sum + item.likes, 0);
      const totalComments = blendedTimeline.reduce((sum, item) => sum + item.comments, 0);
      const totalShares = blendedTimeline.reduce((sum, item) => sum + item.shares, 0);
      const totalClicks = blendedTimeline.reduce((sum, item) => sum + item.clicks, 0);
      const totalSaves = blendedTimeline.reduce((sum, item) => sum + item.saves, 0);
      const totalVideoViews = blendedTimeline.reduce((sum, item) => sum + item.videoViews, 0);

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

      const firstHalfFollowers = firstHalf.reduce((sum, i) => sum + i.followers, 0) / firstHalf.length;
      const secondHalfFollowers = secondHalf.reduce((sum, i) => sum + i.followers, 0) / secondHalf.length;
      const followersChange = firstHalfFollowers > 0
        ? (((secondHalfFollowers - firstHalfFollowers) / firstHalfFollowers) * 100).toFixed(1)
        : '0.0';

      const responseData = {
        success: true,
        hasData: rangePosts.length > 0 || totalLiveFollowers > 0,
        summary: {
          impressions: totalImpressions,
          reach: totalReach,
          followers: totalLiveFollowers,
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
      const userId = req.user.id;
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
        platformPostId: { $exists: true, $ne: null }
      };
      if (platform !== 'all') {
        postQuery.platform = platform;
      }
      const taraflowPosts = await Post.find(postQuery);
      const connectedPlatforms = new Set(accounts.map(acc => acc.platform));

      taraflowPosts.forEach(tp => {
        const exists = allRealPosts.some(rp => {
          if (rp.id === tp.platformPostId) return true;
          if (tp.platform === 'facebook' && rp.id.endsWith(`_${tp.platformPostId}`)) return true;
          if (tp.platform === 'facebook' && tp.platformPostId.endsWith(`_${rp.id}`)) return true;
          return false;
        });
        const isSeededMock = /^mock_post_/.test(tp.platformPostId || '');
        const shouldInclude = !exists && (!isSeededMock || !connectedPlatforms.has(tp.platform));
        if (shouldInclude) {
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
      const userId = req.user.id;
      const accounts = await SocialAccount.find({ user: userId });

      // 1. Sync live metrics for any real connected platforms
      for (const acc of accounts) {
        const token = decrypt(acc.accessToken);
        const posts = await Post.find({ createdBy: userId, platform: acc.platform, status: 'PUBLISHED', platformPostId: { $exists: true, $ne: null } });

        for (const post of posts) {
          try {
            if (acc.platform === 'facebook') {
              const fbPost = await this.fetchJson(`https://graph.facebook.com/v19.0/${post.platformPostId}?fields=shares,likes.limit(0).summary(true),comments.limit(0).summary(true)&access_token=${token}`);
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
              const threadPost = await this.fetchJson(`https://graph.threads.net/v1.0/${post.platformPostId}?fields=like_count,reply_count,repost_count&access_token=${token}`);
              if (threadPost && !threadPost.error) {
                const insights = await this.fetchThreadsPostInsights(post.platformPostId, token);
                const metrics = this.buildMetrics({
                  likes: insights.likes ?? threadPost.like_count ?? 0,
                  comments: insights.comments ?? threadPost.reply_count ?? 0,
                  shares: insights.shares ?? threadPost.repost_count ?? 0,
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

      // 3. Seed historical daily Analytics records for all platforms
      // First, get all posts (mock posts + real published posts)
      const allPosts = await Post.find({ createdBy: userId, status: 'PUBLISHED' });

      const liveFollowersMap = {
        facebook: 0,
        instagram: 0,
        linkedin: 0,
        threads: 0
      };

      const mockFollowersMap = {
        facebook: 15420,
        instagram: 28910,
        linkedin: 12150,
        threads: 4830
      };

      const connectedPlatforms = new Set(accounts.map(acc => acc.platform));

      for (const acc of accounts) {
        const token = decrypt(acc.accessToken);
        try {
          if (acc.platform === 'facebook') {
            const fbRes = await fetch(`https://graph.facebook.com/v19.0/${acc.platformAccountId}?fields=fan_count,followers_count`, {
              headers: { Authorization: `Bearer ${token}` }
            }).then(r => r.json());
            if (fbRes && !fbRes.error) {
              liveFollowersMap.facebook = fbRes.followers_count || fbRes.fan_count || 0;
            }
          } else if (acc.platform === 'instagram') {
            const igRes = await fetch(`https://graph.facebook.com/v19.0/${acc.platformAccountId}?fields=followers_count`, {
              headers: { Authorization: `Bearer ${token}` }
            }).then(r => r.json());
            if (igRes && !igRes.error) {
              liveFollowersMap.instagram = igRes.followers_count || 0;
            }
          } else if (acc.platform === 'linkedin') {
            const author = acc.platformAccountId.startsWith('urn:li:') ? acc.platformAccountId : `urn:li:person:${acc.platformAccountId}`;
            const liRes = await fetch(`https://api.linkedin.com/v2/networkSizes/${author}?edgeType=CompanyFollowed`, {
              headers: { Authorization: `Bearer ${token}` }
            }).then(r => r.json());
            if (liRes && !liRes.error) {
              liveFollowersMap.linkedin = liRes.firstDegreeSize || 0;
            }
          }
        } catch (followerErr) {
          logger.warn(`[Analytics Seed] Failed to fetch followers for ${acc.platform}: ${followerErr.message}`);
        }
      }

      // If a platform is not connected, use the mock default follower baseline
      const platformsList = ['facebook', 'instagram', 'threads', 'linkedin'];
      platformsList.forEach(plat => {
        if (!connectedPlatforms.has(plat)) {
          liveFollowersMap[plat] = mockFollowersMap[plat];
        }
      });

      const dailyFollowersHistory = {};
      platformsList.forEach(plat => {
        const baseline = liveFollowersMap[plat];
        const history = new Array(30);
        let current = baseline;
        history[29] = current; // today
        for (let i = 28; i >= 0; i--) {
          if (current <= 2) {
            current = Math.max(0, current - 1);
          } else {
            const percentChange = (Math.random() * 0.06) - 0.02; // -2% to +4% change
            current = Math.round(current / (1 + percentChange));
            if (current < 0) current = 0;
          }
          history[i] = current;
        }
        dailyFollowersHistory[plat] = history;
      });

      // Clear existing daily analytics trend records for the user
      await Analytics.deleteMany({ userId });

      const analyticsRecords = [];
      for (const plat of platformsList) {
        for (let i = 29; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          date.setHours(0, 0, 0, 0);

          const dateStr = date.toISOString().split('T')[0];
          const dayPosts = allPosts.filter(p => {
            if (p.platform !== plat) return false;
            const pDateStr = new Date(p.publishedAt || p.createdAt).toISOString().split('T')[0];
            return pDateStr === dateStr;
          });

          let sumLikes = 0;
          let sumComments = 0;
          let sumShares = 0;
          let sumImpressions = 0;
          let sumReach = 0;
          let sumClicks = 0;
          let sumSaves = 0;
          let sumVideoViews = 0;

          dayPosts.forEach(dp => {
            sumLikes += dp.likes || 0;
            sumComments += dp.comments || 0;
            sumShares += dp.shares || 0;
            sumImpressions += dp.impressions || 0;
            sumReach += dp.reach || 0;
            sumClicks += dp.clicks || 0;
            sumSaves += dp.saves || 0;
            sumVideoViews += dp.videoViews || 0;
          });

          const engagementRate = sumReach > 0
            ? parseFloat((((sumLikes + sumComments + sumShares) / sumReach) * 100).toFixed(2))
            : 0;

          analyticsRecords.push({
            userId,
            date,
            platform: plat,
            followers: dailyFollowersHistory[plat][29 - i],
            impressions: sumImpressions,
            reach: sumReach,
            likes: sumLikes,
            comments: sumComments,
            shares: sumShares,
            clicks: sumClicks,
            saves: sumSaves,
            videoViews: sumVideoViews,
            engagementRate
          });
        }
      }

      await Analytics.insertMany(analyticsRecords);

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
        message: 'Live social feeds synchronized and high-fidelity mock metrics seeded successfully!'
      });
    } catch (error) {
      next(error);
    }
  }
}

export const analyticsControllerInstance = new AnalyticsController();
export default analyticsControllerInstance;
