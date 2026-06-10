import SocialAccount from '../models/socialAccount.model.js';
import AiLearningProfile from '../models/aiLearningProfile.model.js';
import { analyticsControllerInstance } from './analytics.controller.js';
import { decrypt } from '../utils/encryption.js';
import { getRedisClient } from '../config/redis.config.js';
import logger from '../utils/logger.util.js';
import dotenv from 'dotenv';

class AiSuggestionsController {
  constructor() {
    this.getSuggestions = this.getSuggestions.bind(this);
    this.getLearningProfile = this.getLearningProfile.bind(this);
    this.patchLearningProfile = this.patchLearningProfile.bind(this);
    this.deleteLearningProfile = this.deleteLearningProfile.bind(this);
  }

  // ─── Data Gathering ────────────────────────────────────────────────────────

  /**
   * Gather a real analytics snapshot by reusing the analytics controller's
   * helper feed methods. No HTTP round-trips — direct method calls.
   */
  async gatherAnalyticsSnapshot(userId, platform = 'all') {
    const accountQuery = { user: userId };
    if (platform !== 'all') accountQuery.platform = platform;
    const accounts = await SocialAccount.find(accountQuery);

    let allPosts = [];
    for (const acc of accounts) {
      try {
        const token = decrypt(acc.accessToken);
        if (acc.platform === 'facebook') {
          const feed = await analyticsControllerInstance.fetchFacebookPageFeed(acc.platformAccountId, token);
          allPosts = allPosts.concat(feed);
        } else if (acc.platform === 'instagram') {
          const feed = await analyticsControllerInstance.fetchInstagramMediaFeed(acc.platformAccountId, token);
          allPosts = allPosts.concat(feed);
        } else if (acc.platform === 'threads') {
          const feed = await analyticsControllerInstance.fetchThreadsFeed(acc.platformAccountId, token);
          allPosts = allPosts.concat(feed);
        } else if (acc.platform === 'linkedin') {
          const feed = await analyticsControllerInstance.fetchLinkedInFeed(acc.platformAccountId, token);
          allPosts = allPosts.concat(feed);
        }
      } catch (err) {
        logger.warn(`[AISuggestions] Failed to fetch feed for ${acc.platform}: ${err.message}`);
      }
    }

    return this.buildPerformanceSummary(allPosts, accounts, platform);
  }

  /**
   * Build a structured, compact performance summary from raw post data.
   * This is what gets passed to the LLM as the analytical context.
   */
  buildPerformanceSummary(posts, accounts, platform) {
    if (!posts || posts.length === 0) {
      return {
        hasData: false,
        totalPosts: 0,
        platforms: accounts.map(a => a.platform),
        platform,
        posts: []
      };
    }

    // Sort by engagement rate
    const sorted = [...posts].sort((a, b) => (b.engagementRate || 0) - (a.engagementRate || 0));
    const topPosts = sorted.slice(0, 5);
    const worstPosts = sorted.slice(-3);

    // Platform breakdown
    const byPlatform = {};
    for (const p of posts) {
      if (!byPlatform[p.platform]) {
        byPlatform[p.platform] = { count: 0, totalER: 0, totalReach: 0, totalLikes: 0, totalComments: 0, totalShares: 0 };
      }
      const b = byPlatform[p.platform];
      b.count++;
      b.totalER += p.engagementRate || 0;
      b.totalReach += p.reach || 0;
      b.totalLikes += p.likes || 0;
      b.totalComments += p.comments || 0;
      b.totalShares += p.shares || 0;
    }

    const platformStats = Object.entries(byPlatform).map(([plat, stats]) => ({
      platform: plat,
      posts: stats.count,
      avgEngagementRate: stats.count > 0 ? parseFloat((stats.totalER / stats.count).toFixed(2)) : 0,
      avgReach: stats.count > 0 ? Math.round(stats.totalReach / stats.count) : 0,
      totalLikes: stats.totalLikes,
      totalComments: stats.totalComments,
      totalShares: stats.totalShares
    }));

    // Detect best platform
    const bestPlatform = platformStats.sort((a, b) => b.avgEngagementRate - a.avgEngagementRate)[0];

    // Posting time pattern (from publishedAt)
    const hourCounts = {};
    const dayCounts = {};
    for (const p of posts) {
      if (p.publishedAt) {
        const d = new Date(p.publishedAt);
        const hour = d.getHours();
        const day = d.toLocaleDateString('en-US', { weekday: 'long' });
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        dayCounts[day] = (dayCounts[day] || 0) + 1;
      }
    }

    const topHours = Object.entries(hourCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([h]) => parseInt(h, 10));

    const topDays = Object.entries(dayCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([d]) => d);

    // Overall averages
    const avgER = posts.reduce((s, p) => s + (p.engagementRate || 0), 0) / posts.length;
    const avgReach = posts.reduce((s, p) => s + (p.reach || 0), 0) / posts.length;
    const totalImpressions = posts.reduce((s, p) => s + (p.impressions || 0), 0);
    const totalLikes = posts.reduce((s, p) => s + (p.likes || 0), 0);
    const totalComments = posts.reduce((s, p) => s + (p.comments || 0), 0);
    const totalShares = posts.reduce((s, p) => s + (p.shares || 0), 0);
    const totalSaves = posts.reduce((s, p) => s + (p.saves || 0), 0);
    const totalClicks = posts.reduce((s, p) => s + (p.clicks || 0), 0);
    const totalVideoViews = posts.reduce((s, p) => s + (p.videoViews || 0), 0);

    // Data quality tier
    let analysisQuality = 'insufficient';
    if (posts.length >= 20) analysisQuality = 'excellent';
    else if (posts.length >= 10) analysisQuality = 'good';
    else if (posts.length >= 3) analysisQuality = 'fair';

    return {
      hasData: true,
      totalPosts: posts.length,
      platforms: accounts.map(a => a.platform),
      platform,
      analysisQuality,
      overallAvgEngagementRate: parseFloat(avgER.toFixed(2)),
      overallAvgReach: Math.round(avgReach),
      totalImpressions,
      totalLikes,
      totalComments,
      totalShares,
      totalSaves,
      totalClicks,
      totalVideoViews,
      bestPlatform: bestPlatform?.platform || null,
      platformStats,
      topHours,
      topDays,
      topPosts: topPosts.map(p => ({
        platform: p.platform,
        contentPreview: (p.content || '').slice(0, 120),
        engagementRate: p.engagementRate,
        reach: p.reach,
        likes: p.likes,
        comments: p.comments,
        shares: p.shares
      })),
      worstPosts: worstPosts.map(p => ({
        platform: p.platform,
        contentPreview: (p.content || '').slice(0, 80),
        engagementRate: p.engagementRate,
        reach: p.reach
      }))
    };
  }

  // ─── LLM Integration ───────────────────────────────────────────────────────

  /**
   * Build a compact, structured text representation of the performance data
   * to pass as context to the LLM.
   */
  buildLLMContext(summary) {
    const lines = [
      `=== SOCIAL MEDIA PERFORMANCE REPORT ===`,
      `Analysis Quality: ${summary.analysisQuality} (${summary.totalPosts} posts analyzed)`,
      `Connected Platforms: ${summary.platforms.join(', ')}`,
      ``,
      `OVERALL METRICS:`,
      `- Average Engagement Rate: ${summary.overallAvgEngagementRate}%`,
      `- Average Reach per Post: ${summary.overallAvgReach}`,
      `- Total Impressions: ${summary.totalImpressions}`,
      `- Total Likes: ${summary.totalLikes} | Comments: ${summary.totalComments} | Shares: ${summary.totalShares}`,
      `- Total Saves: ${summary.totalSaves} | Clicks: ${summary.totalClicks} | Video Views: ${summary.totalVideoViews}`,
      ``,
      `PLATFORM BREAKDOWN:`
    ];

    for (const ps of summary.platformStats) {
      lines.push(`- ${ps.platform.toUpperCase()}: ${ps.posts} posts | Avg ER: ${ps.avgEngagementRate}% | Avg Reach: ${ps.avgReach}`);
    }

    if (summary.topHours.length > 0) {
      const hourLabels = summary.topHours.map(h => {
        const ampm = h < 12 ? 'AM' : 'PM';
        const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
        return `${hour12} ${ampm}`;
      });
      lines.push(``, `POSTING PATTERNS:`, `- Most common posting hours: ${hourLabels.join(', ')}`);
      if (summary.topDays.length > 0) {
        lines.push(`- Most common posting days: ${summary.topDays.join(', ')}`);
      }
    }

    if (summary.topPosts.length > 0) {
      lines.push(``, `TOP PERFORMING POSTS:`);
      summary.topPosts.forEach((p, i) => {
        lines.push(`${i + 1}. [${p.platform}] ER: ${p.engagementRate}% | Reach: ${p.reach} | Content: "${p.contentPreview}"`);
      });
    }

    if (summary.worstPosts.length > 0) {
      lines.push(``, `LOWEST PERFORMING POSTS:`);
      summary.worstPosts.forEach((p, i) => {
        lines.push(`${i + 1}. [${p.platform}] ER: ${p.engagementRate}% | Reach: ${p.reach} | Content: "${p.contentPreview}"`);
      });
    }

    return lines.join('\n');
  }

  /**
   * Resolve the correct Qwen API base URL — matching qwen.service.js logic.
   * NVIDIA NIM keys (nvapi-*) use a different endpoint.
   */
  resolveQwenApiBase() {
    const apiKey = process.env.QWEN_API_KEY || '';
    const defaultBase = apiKey.startsWith('nvapi-')
      ? 'https://integrate.api.nvidia.com/v1'
      : 'https://dashscope.aliyuncs.com/compatible-mode/v1';
    return process.env.QWEN_API_BASE || defaultBase;
  }

  /**
   * Call LLM (Gemini preferred, falls back to Qwen) to generate structured
   * AI Suggestions from the performance context.
   */
  async callLLMForSuggestions(performanceSummary) {
    dotenv.config({ override: true });

    const contextText = this.buildLLMContext(performanceSummary);

    const systemPrompt = `You are an expert social media growth strategist and analytics consultant.
You will receive real performance data from a user's connected social media accounts.
Analyze this data deeply and return actionable, data-driven recommendations.

STRICT RULES:
1. Base ALL recommendations on the actual numbers provided. Reference specific metrics.
2. Do NOT use generic advice. Every suggestion must be tied to the data.
3. If data is insufficient (fewer than 3 posts), say so in the performanceSummary and still provide general suggestions.
4. Keep all text concise and direct. No filler language.
5. Hashtag suggestions must be specific to the user's niche based on content previews.
6. Return ONLY valid JSON. No markdown fences, no explanation outside the JSON.

Return a JSON object with EXACTLY this structure:
{
  "performanceSummary": "2-3 sentence narrative summarizing current performance with specific numbers.",
  "growthOpportunities": [
    {"title": "...", "description": "...", "metric": "..."}
  ],
  "contentRecommendations": [
    {"type": "Format|Topic|Length|Style", "suggestion": "...", "reason": "..."}
  ],
  "captionRecommendations": {
    "style": "...",
    "length": "short|medium|long",
    "hooks": ["hook example 1", "hook example 2", "hook example 3"],
    "toneAdvice": "..."
  },
  "hashtagRecommendations": {
    "strategy": "...",
    "suggestedHashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5", "#tag6", "#tag7", "#tag8"],
    "frequency": "..."
  },
  "audienceInsights": [
    {"insight": "...", "actionable": "..."}
  ],
  "postingStrategy": {
    "bestDays": ["Day1", "Day2"],
    "bestHours": "...",
    "frequency": "...",
    "rationale": "..."
  },
  "priorityActions": [
    {"priority": "high", "action": "...", "impact": "..."},
    {"priority": "medium", "action": "...", "impact": "..."},
    {"priority": "low", "action": "...", "impact": "..."}
  ]
}`;

    const userPrompt = `Analyze this social media performance data and generate recommendations:\n\n${contextText}`;

    // ── Try Qwen / NVIDIA NIM first (since user has active QWEN_API_KEY) ──
    const qwenApiKey = process.env.QWEN_API_KEY;
    const qwenApiBase = this.resolveQwenApiBase();
    const qwenModel = process.env.QWEN_MODEL || 'qwen-plus';

    if (qwenApiKey) {
      try {
        const endpoint = `${qwenApiBase.replace(/\/$/, '')}/chat/completions`;
        logger.info(`[AISuggestions] Calling Qwen at ${endpoint} with model ${qwenModel}`);
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${qwenApiKey}` },
          body: JSON.stringify({
            model: qwenModel,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            temperature: 0.4,
            max_tokens: 2500
          })
        });
        if (response.ok) {
          const data = await response.json();
          const text = data.choices?.[0]?.message?.content?.trim();
          if (text) {
            const parsed = this.parseJsonSafely(text);
            if (parsed) {
              logger.info('[AISuggestions] Qwen generated suggestions successfully.');
              return { success: true, suggestions: parsed };
            }
            logger.warn('[AISuggestions] Qwen returned text but JSON parsing failed. Raw text length: ' + text.length);
          }
        } else {
          const errBody = await response.text().catch(() => '');
          logger.warn(`[AISuggestions] Qwen API returned status ${response.status}: ${errBody.slice(0, 300)}`);
        }
      } catch (err) {
        logger.warn(`[AISuggestions] Qwen suggestions failed: ${err.message}`);
      }
    }

    // ── Fall back to Gemini ──
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (geminiApiKey) {
      try {
        const geminiModel = 'gemini-2.0-flash';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`;
        logger.info(`[AISuggestions] Calling Gemini model ${geminiModel}`);
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
            generationConfig: { temperature: 0.4, maxOutputTokens: 2500 }
          })
        });
        if (response.ok) {
          const data = await response.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (text) {
            const parsed = this.parseJsonSafely(text);
            if (parsed) {
              logger.info('[AISuggestions] Gemini generated suggestions successfully.');
              return { success: true, suggestions: parsed };
            }
            logger.warn('[AISuggestions] Gemini returned text but JSON parsing failed. Raw text length: ' + text.length);
          }
        } else {
          const errBody = await response.text().catch(() => '');
          logger.warn(`[AISuggestions] Gemini API returned status ${response.status}: ${errBody.slice(0, 300)}`);
        }
      } catch (err) {
        logger.warn(`[AISuggestions] Gemini suggestions failed: ${err.message}`);
      }
    }

    logger.error('[AISuggestions] Both Qwen and Gemini failed to generate suggestions. Check API keys.');
    return { success: false, suggestions: null };
  }

  /**
   * Safely parse LLM JSON output, stripping any markdown fences.
   */
  parseJsonSafely(text) {
    try {
      const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      return JSON.parse(cleaned);
    } catch {
      // Try to find JSON object within the text
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          return JSON.parse(match[0]);
        } catch { /* ignore */ }
      }
      logger.warn('[AISuggestions] Failed to parse LLM JSON response.');
      return null;
    }
  }

  // ─── Learning Profile Update ────────────────────────────────────────────────

  /**
   * Async update of the learning profile using real performance summary.
   * Never throws — runs silently in background.
   */
  async updateLearningProfileAsync(userId, summary) {
    try {
      const profile = await AiLearningProfile.findOne({ userId });
      if (profile && !profile.learningEnabled) return; // Respect opt-out

      const platformsByER = [...(summary.platformStats || [])].sort((a, b) => b.avgEngagementRate - a.avgEngagementRate);
      const bestPlatforms = platformsByER.slice(0, 2).map(p => p.platform);

      const engagementByFormat = {};
      for (const ps of (summary.platformStats || [])) {
        engagementByFormat[ps.platform] = ps.avgEngagementRate;
      }

      // Build weekly metric for current week
      const now = new Date();
      const weekNum = Math.ceil((now.getDate() + new Date(now.getFullYear(), now.getMonth(), 1).getDay()) / 7);
      const weekKey = `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;

      const newWeekEntry = {
        week: weekKey,
        avgEngagementRate: summary.overallAvgEngagementRate || 0,
        avgReach: summary.overallAvgReach || 0,
        postsCount: summary.totalPosts || 0
      };

      const updateData = {
        bestPlatforms,
        bestPostingHours: summary.topHours || [],
        bestPostingDays: summary.topDays || [],
        avgEngagementByFormat: engagementByFormat,
        'audienceBehavior.mostResponsivePlatform': summary.bestPlatform || null,
        'audienceBehavior.avgEngagementRate': summary.overallAvgEngagementRate || 0,
        'audienceBehavior.peakEngagementHour': summary.topHours?.[0] ?? 18,
        'lastSnapshotSummary.totalPosts': summary.totalPosts || 0,
        'lastSnapshotSummary.avgEngagementRate': summary.overallAvgEngagementRate || 0,
        'lastSnapshotSummary.avgReach': summary.overallAvgReach || 0,
        'lastSnapshotSummary.topPlatform': summary.bestPlatform || null,
        'lastSnapshotSummary.analysisQuality': summary.analysisQuality || 'insufficient',
        lastSyncedAt: new Date()
      };

      await AiLearningProfile.findOneAndUpdate(
        { userId },
        {
          $set: updateData,
          $push: {
            contentPerformanceHistory: {
              $each: [newWeekEntry],
              $slice: -52  // Keep last 52 weeks (1 year)
            }
          },
          $setOnInsert: { learningEnabled: true }
        },
        { upsert: true, new: true }
      );

      logger.info(`[AISuggestions] Learning profile updated for user ${userId}`);
    } catch (err) {
      logger.warn(`[AISuggestions] Failed to update learning profile: ${err.message}`);
    }
  }

  // ─── Route Handlers ─────────────────────────────────────────────────────────

  /**
   * GET /api/v1/ai-suggestions
   * Generate AI suggestions from real analytics data.
   */
  async getSuggestions(req, res, next) {
    try {
      const userId = req.user.id;
      const { platform = 'all', refresh = 'false' } = req.query;
      const forceRefresh = refresh === 'true';

      // Check Redis cache (skip if force refresh)
      const redisClient = getRedisClient();
      const cacheKey = `user:aisuggestions:${userId}:${platform}`;

      if (!forceRefresh && redisClient) {
        try {
          const cached = await redisClient.get(cacheKey);
          if (cached) {
            logger.info(`[AISuggestions] Cache hit for ${cacheKey}`);
            return res.status(200).json(JSON.parse(cached));
          }
        } catch (cacheErr) {
          logger.warn(`[AISuggestions] Cache read failed: ${cacheErr.message}`);
        }
      }

      // Gather real analytics data
      const summary = await this.gatherAnalyticsSnapshot(userId, platform);

      if (!summary.hasData) {
        return res.status(200).json({
          success: true,
          hasData: false,
          message: 'No analytics data found. Please connect your social accounts and sync analytics first.',
          suggestions: null,
          summary: { totalPosts: 0, platform }
        });
      }

      // Call LLM
      const { success, suggestions } = await this.callLLMForSuggestions(summary);

      if (!success || !suggestions) {
        return res.status(200).json({
          success: true,
          hasData: true,
          llmUnavailable: true,
          message: 'Analytics data loaded but AI engine is currently unavailable. Please ensure your API key is configured.',
          summary: {
            totalPosts: summary.totalPosts,
            avgEngagementRate: summary.overallAvgEngagementRate,
            bestPlatform: summary.bestPlatform,
            platform
          },
          suggestions: null
        });
      }

      const responseData = {
        success: true,
        hasData: true,
        llmUnavailable: false,
        summary: {
          totalPosts: summary.totalPosts,
          avgEngagementRate: summary.overallAvgEngagementRate,
          avgReach: summary.overallAvgReach,
          bestPlatform: summary.bestPlatform,
          analysisQuality: summary.analysisQuality,
          platform,
          platformStats: summary.platformStats
        },
        suggestions
      };

      // Cache for 60 minutes
      if (redisClient) {
        try {
          await redisClient.set(cacheKey, JSON.stringify(responseData), { EX: 3600 });
        } catch (cacheErr) {
          logger.warn(`[AISuggestions] Cache write failed: ${cacheErr.message}`);
        }
      }

      // Async: update learning profile in background (don't await)
      this.updateLearningProfileAsync(userId, summary).catch(() => {});

      res.status(200).json(responseData);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/ai-suggestions/learning-profile
   * Returns the user's current learning profile for transparency.
   */
  async getLearningProfile(req, res, next) {
    try {
      const userId = req.user.id;
      const profile = await AiLearningProfile.findOne({ userId }).select('-__v');

      res.status(200).json({
        success: true,
        profile: profile || null,
        hasProfile: !!profile,
        learningEnabled: profile?.learningEnabled ?? true
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/ai-suggestions/learning-profile
   * Toggle learningEnabled (opt-in / opt-out).
   */
  async patchLearningProfile(req, res, next) {
    try {
      const userId = req.user.id;
      const { learningEnabled } = req.body;

      if (typeof learningEnabled !== 'boolean') {
        return res.status(400).json({ success: false, message: 'learningEnabled must be a boolean.' });
      }

      const profile = await AiLearningProfile.findOneAndUpdate(
        { userId },
        { $set: { learningEnabled } },
        { upsert: true, new: true }
      );

      // If disabling, invalidate cached suggestions
      if (!learningEnabled) {
        const redisClient = getRedisClient();
        if (redisClient) {
          try {
            const keys = await redisClient.keys(`user:aisuggestions:${userId}:*`);
            if (keys.length > 0) await redisClient.del(keys);
          } catch { /* ignore */ }
        }
      }

      res.status(200).json({
        success: true,
        learningEnabled: profile.learningEnabled,
        message: learningEnabled
          ? 'AI learning enabled. Your performance insights will be used to personalize future content.'
          : 'AI learning disabled. Your performance data will no longer be collected or used.'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/ai-suggestions/learning-profile
   * GDPR erasure — hard delete the user's learning profile.
   */
  async deleteLearningProfile(req, res, next) {
    try {
      const userId = req.user.id;
      const result = await AiLearningProfile.deleteOne({ userId });

      // Purge cached suggestions
      const redisClient = getRedisClient();
      if (redisClient) {
        try {
          const keys = await redisClient.keys(`user:aisuggestions:${userId}:*`);
          if (keys.length > 0) await redisClient.del(keys);
        } catch { /* ignore */ }
      }

      res.status(200).json({
        success: true,
        deleted: result.deletedCount > 0,
        message: result.deletedCount > 0
          ? 'Your AI learning data has been permanently deleted.'
          : 'No learning profile found to delete.'
      });
    } catch (error) {
      next(error);
    }
  }
}

export const aiSuggestionsControllerInstance = new AiSuggestionsController();
export default aiSuggestionsControllerInstance;
