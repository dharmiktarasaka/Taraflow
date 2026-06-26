import BrandProfile from '../models/brandProfile.model.js';
import CompetitorAnalysis from '../models/competitorAnalysis.model.js';
import Post from '../models/post.model.js';
import Analytics from '../models/analytics.model.js';
import User from '../models/user.model.js';
import SocialAccount from '../models/socialAccount.model.js';
import { emailServiceInstance } from './email.service.js';
import logger from '../utils/logger.util.js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, HeadingLevel } from 'docx';

class CompetitorIntelligenceService {
  constructor() {
    this.openrouterApiKey = process.env.OPENROUTER_API_KEY;
    this.claudeApiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
  }

  async callGemini(systemPrompt, userPrompt, responseMimeType = null) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not defined in environment variables.');
    }

    const models = [
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-flash-latest'
    ];
    let lastError;

    for (const model of models) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
      
      const payload = {
        contents: [
          {
            parts: [
              { text: `${systemPrompt}\n\n${userPrompt}` }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 8192
        }
      };

      if (responseMimeType === 'application/json') {
        payload.generationConfig.responseMimeType = 'application/json';
      }

      let attempts = 0;
      const maxAttempts = 2;

      while (attempts < maxAttempts) {
        try {
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (response.status === 429 || response.status === 503) {
            attempts++;
            if (attempts < maxAttempts) {
              logger.warn(`[CompetitorIntelligence] Gemini fallback model ${model} failed with ${response.status}. Retrying in 1.5s (attempt ${attempts}/${maxAttempts})...`);
              await new Promise(resolve => setTimeout(resolve, 1500));
              continue;
            }
          }

          if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Gemini model ${model} failed with status ${response.status}: ${errText}`);
          }

          const data = await response.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
          if (text) {
            logger.info(`[CompetitorIntelligence] Gemini fallback succeeded using model ${model}`);
            return { text, model };
          }
          break;
        } catch (err) {
          attempts++;
          if (attempts < maxAttempts && (err.message.includes('fetch') || err.message.includes('timeout') || err.message.includes('429') || err.message.includes('503'))) {
            logger.warn(`[CompetitorIntelligence] Gemini model ${model} exception: ${err.message}. Retrying in 1.5s...`);
            await new Promise(resolve => setTimeout(resolve, 1500));
            continue;
          }
          logger.warn(`[CompetitorIntelligence] Gemini fallback model ${model} failed: ${err.message}`);
          lastError = err;
          break;
        }
      }
    }
    
    throw lastError || new Error('All fallback Gemini models failed.');
  }

  async callClaude(systemPrompt, userPrompt, responseMimeType = null) {
    let directClaudeError = null;
    let openRouterClaudeError = null;
    let openRouterFreeError = null;

    // Helper to check if an error is credit/billing related
    const isCreditError = (err) => {
      if (!err) return false;
      const msg = (err.message || '').toLowerCase();
      return (
        msg.includes('402') ||
        msg.includes('400') ||
        msg.includes('credit') ||
        msg.includes('balance') ||
        msg.includes('quota') ||
        msg.includes('overlimit') ||
        msg.includes('payment') ||
        msg.includes('afford') ||
        msg.includes('insufficient')
      );
    };

    // 1. Try Direct Anthropic Claude if key is configured
    if (this.claudeApiKey) {
      try {
        logger.info('[CompetitorIntelligence] Attempting direct Claude call...');
        const url = 'https://api.anthropic.com/v1/messages';
        const payload = {
          model: 'claude-3-5-sonnet-latest',
          system: systemPrompt,
          messages: [
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.4,
          max_tokens: 1800
        };

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.claudeApiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Anthropic Claude API error ${response.status}: ${errText}`);
        }

        const data = await response.json();
        const text = data.content?.[0]?.text?.trim() || '';
        if (text) {
          logger.info('[CompetitorIntelligence] Direct Claude call succeeded.');
          return { text, model: 'Claude 3.5 Sonnet' };
        }
      } catch (err) {
        logger.warn(`[CompetitorIntelligence] Direct Claude call failed: ${err.message}`);
        directClaudeError = err;
      }
    }

    // 2. Try OpenRouter Claude Sonnet if key is configured
    if (this.openrouterApiKey) {
      try {
        logger.info('[CompetitorIntelligence] Attempting OpenRouter Claude Sonnet call...');
        const model = '~anthropic/claude-sonnet-latest';
        const url = 'https://openrouter.ai/api/v1/chat/completions';

        const payload = {
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.4,
          max_tokens: 1800
        };

        if (responseMimeType === 'application/json') {
          payload.response_format = { type: 'json_object' };
        }

        let response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.openrouterApiKey}`
          },
          body: JSON.stringify(payload)
        });

        if (response.status === 402) {
          const errJson = await response.json();
          const msg = errJson.error?.message || '';
          const match = msg.match(/can only afford (\d+)/i);
          if (match && match[1]) {
            const affordTokens = parseInt(match[1], 10);
            if (affordTokens < 120) {
              throw new Error(`Insufficient OpenRouter credit balance on your key (can only afford ${affordTokens} tokens). Please add credits to your account at https://openrouter.ai/settings/credits.`);
            }
            const retryTokens = affordTokens - 10;
            logger.warn(`[CompetitorIntelligence] OpenRouter 402 error. Retrying with reduced max_tokens: ${retryTokens}`);
            
            payload.max_tokens = retryTokens;
            response = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.openrouterApiKey}`
              },
              body: JSON.stringify(payload)
            });
          } else {
            throw new Error(`OpenRouter API error 402: ${JSON.stringify(errJson)}`);
          }
        }

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`OpenRouter API error ${response.status}: ${errText}`);
        }

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content?.trim() || '';
        if (text) {
          logger.info('[CompetitorIntelligence] OpenRouter Claude Sonnet call succeeded.');
          return { text, model: 'Claude 3.5 Sonnet' };
        }
      } catch (err) {
        logger.warn(`[CompetitorIntelligence] OpenRouter Claude Sonnet call failed: ${err.message}`);
        openRouterClaudeError = err;
      }
    }

    // 3. Try OpenRouter Free Models if OpenRouter key is configured
    if (this.openrouterApiKey) {
      // Use free models as a fallback
      const freeModels = [
        'google/gemma-4-31b-it:free',
        'meta-llama/llama-3.3-70b-instruct:free',
        'liquid/lfm-2.5-1.2b-instruct:free',
        'meta-llama/llama-3.2-3b-instruct:free',
        'openrouter/free'
      ];

      for (const freeModel of freeModels) {
        try {
          logger.info(`[CompetitorIntelligence] Attempting OpenRouter free fallback model: ${freeModel}`);
          const url = 'https://openrouter.ai/api/v1/chat/completions';
          const payload = {
            model: freeModel,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            temperature: 0.4,
            max_tokens: 1800
          };

          if (responseMimeType === 'application/json') {
            payload.response_format = { type: 'json_object' };
          }

          let response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.openrouterApiKey}`
            },
            body: JSON.stringify(payload)
          });

          // Check if failed due to unsupported JSON mode
          if (!response.ok && payload.response_format) {
            const errText = await response.text();
            if (errText.toLowerCase().includes('json') || errText.toLowerCase().includes('format') || errText.toLowerCase().includes('structured')) {
              logger.warn(`[CompetitorIntelligence] Model ${freeModel} does not support JSON mode. Retrying without JSON format restriction.`);
              delete payload.response_format;
              response = await fetch(url, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${this.openrouterApiKey}`
                },
                body: JSON.stringify(payload)
              });
            } else {
              throw new Error(`OpenRouter free model ${freeModel} failed: ${errText}`);
            }
          }

          if (!response.ok) {
            const errText = await response.text();
            throw new Error(`OpenRouter free model ${freeModel} failed: ${errText}`);
          }

          const data = await response.json();
          const text = data.choices?.[0]?.message?.content?.trim() || '';
          if (text) {
            logger.info(`[CompetitorIntelligence] OpenRouter free fallback model ${freeModel} succeeded.`);
            const niceName = freeModel.includes('llama-3.3') ? 'Llama 3.3 70B' :
                             freeModel.includes('gemma-4') ? 'Gemma 4 31B' :
                             freeModel.includes('lfm-2.5') ? 'Liquid LFM 2.5' :
                             freeModel.includes('llama-3.2') ? 'Llama 3.2 3B' :
                             freeModel;
            return { text, model: niceName };
          }
        } catch (err) {
          logger.warn(`[CompetitorIntelligence] OpenRouter free fallback model ${freeModel} failed: ${err.message}`);
          openRouterFreeError = err;
        }
      }
    }

    // 4. Try Gemini fallback if key is configured
    if (process.env.GEMINI_API_KEY) {
      logger.info('[CompetitorIntelligence] Direct/OpenRouter Claude and free models failed or skipped. Falling back to resilient Gemini.');
      try {
        const geminiRes = await this.callGemini(systemPrompt, userPrompt, responseMimeType);
        return { text: geminiRes.text, model: geminiRes.model };
      } catch (geminiErr) {
        logger.error('[CompetitorIntelligence] Gemini fallback failed as well:', geminiErr.message || geminiErr);
      }
    }

    // Throw the most descriptive/relevant error we got
    const finalError = openRouterFreeError || openRouterClaudeError || directClaudeError || new Error('Neither Claude, OpenRouter free models, nor Gemini fallback succeeded.');
    logger.error('[CompetitorIntelligence] All generation options failed:', finalError.message);
    throw finalError;
  }

  /**
   * Detects competitors based on user's Brand Profile
   */
  async detectCompetitors(userId) {
    try {
      let brand = await BrandProfile.findOne({ user: userId });
      if (!brand) {
        const user = await User.findById(userId);
        brand = {
          companyName: user ? `${user.firstName || 'My'} Business` : 'Local Business',
          industry: 'Marketing and Services',
          products: 'Retail, general consulting, local services',
          services: 'Consulting and direct marketing',
          targetAudience: 'Local consumers and business owners',
          keywords: 'marketing, business optimization, consulting'
        };
        logger.info(`[CompetitorIntelligence] No Brand Profile found for user ${userId}. Using default fallback profile: "${brand.companyName}" (${brand.industry})`);
      }

      const systemPrompt = `You are a professional business intelligence bot.
Based on the user's business details, suggest 3-5 real or highly realistic competitors with their names, websites (or mock websites based on company names), and social media handles.
You must output a JSON array of objects. Each object should have:
- name (string)
- website (string)
- socialHandles (object with keys: facebook, instagram, threads, linkedin, values are strings of handles/usernames)

CRITICAL: Every string value in the JSON MUST be properly escaped. Double quotes inside string values must be escaped as \\" (e.g. \\"name\\"). Do NOT use unescaped double quotes or literal newlines inside string values.
Do NOT include any markdown code blocks, just return clean JSON.`;

      const userPrompt = `User Business Details:
CompanyName: ${brand.companyName || 'SaaS Brand'}
Industry: ${brand.industry || 'Tech SaaS'}
Products: ${brand.products || ''}
Services: ${brand.services || ''}
Target Audience: ${brand.targetAudience || ''}
Keywords: ${brand.keywords || ''}
Tone of Voice: ${brand.toneOfVoice || ''}`;

      const { text: responseText } = await this.callClaude(systemPrompt, userPrompt, 'application/json');
      let cleanJsonText = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
      const firstBracket = cleanJsonText.indexOf('[');
      const lastBracket = cleanJsonText.lastIndexOf(']');
      if (firstBracket !== -1 && lastBracket !== -1) {
        cleanJsonText = cleanJsonText.substring(firstBracket, lastBracket + 1);
      }
      const repairedJson = repairJsonQuotes(cleanJsonText);
      const competitors = JSON.parse(repairedJson);

      return {
        success: true,
        competitors: Array.isArray(competitors) ? competitors.slice(0, 3) : []
      };
    } catch (err) {
      logger.error('[CompetitorIntelligence] Failed to auto-detect competitors:', err);
      return {
        success: false,
        message: 'Could not automatically detect competitors due to an AI generation error.',
        competitors: []
      };
    }
  }

  /**
   * Scrapes competitor website metadata and load times
   */
  async scrapeWebsiteMetadata(websiteUrl) {
    if (!websiteUrl) {
      return {
        status: 'offline',
        loadTimeMs: 0,
        title: '',
        description: '',
        keywords: '',
        pageSizeBytes: 0
      };
    }

    // Ensure protocol
    let formattedUrl = websiteUrl.trim();
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = 'https://' + formattedUrl;
    }

    const startTime = Date.now();
    try {
      const response = await axios.get(formattedUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        timeout: 6000,
        validateStatus: () => true
      });

      const loadTimeMs = Date.now() - startTime;
      const html = typeof response.data === 'string' ? response.data : '';
      const pageSizeBytes = Buffer.byteLength(html, 'utf8');

      let title = '';
      let description = '';
      let keywords = '';

      if (html) {
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch) title = titleMatch[1].trim();

        const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) || 
                          html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
        if (descMatch) description = descMatch[1].trim();

        const keyMatch = html.match(/<meta[^>]*name=["']keywords["'][^>]*content=["']([^"']+)["']/i) ||
                         html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']keywords["']/i);
        if (keyMatch) keywords = keyMatch[1].trim();
      }

      return {
        status: response.status >= 400 ? 'error' : 'online',
        loadTimeMs,
        title: title.substring(0, 100),
        description: description.substring(0, 200),
        keywords: keywords.substring(0, 100),
        pageSizeBytes
      };
    } catch (err) {
      const loadTimeMs = Date.now() - startTime;
      logger.warn(`[CompetitorIntelligence] Website scrape failed for ${formattedUrl}: ${err.message}`);
      return {
        status: 'offline',
        loadTimeMs,
        title: '',
        description: '',
        keywords: '',
        pageSizeBytes: 0
      };
    }
  }

  /**
   * Run full AI analysis, gather website data, and generate PDF/DOCX
   */
  async runFullAnalysis(analysisId) {
    try {
      const analysisObj = await CompetitorAnalysis.findById(analysisId);
      if (!analysisObj) {
        throw new Error(`Analysis record ${analysisId} not found`);
      }

      // 1. Update status to processing
      analysisObj.status = 'processing';
      await analysisObj.save();

      // 2. Fetch User Brand Profile and User Stats
      const userId = analysisObj.user;
      const userBrand = await BrandProfile.findOne({ user: userId });
      const brandName = userBrand?.companyName || 'My Business';

      // Pull latest user social stats from database
      const userConnectedAccounts = await SocialAccount.find({ user: userId });
      const userPosts = await Post.find({ createdBy: userId, status: 'PUBLISHED' });
      const userAnalyticsSnapshots = await Analytics.find({ userId }).sort({ date: -1 }).limit(10);

      // Aggregate User Metrics
      let totalUserFollowers = 0;
      let userPlatforms = [];
      const platformStats = {};

      userConnectedAccounts.forEach(acc => {
        userPlatforms.push(acc.platform);
        platformStats[acc.platform] = { followers: 0, postCount: 0, likes: 0, comments: 0 };
      });

      // Find latest followers per platform
      for (const platform of userPlatforms) {
        const latestAnalytics = await Analytics.findOne({ userId, platform }).sort({ date: -1 });
        if (latestAnalytics) {
          totalUserFollowers += latestAnalytics.followers || 0;
          platformStats[platform].followers = latestAnalytics.followers || 0;
        }
      }

      // Aggregate User Posts metrics
      userPosts.forEach(post => {
        const p = post.platform;
        if (platformStats[p]) {
          platformStats[p].postCount++;
          platformStats[p].likes += post.likes || 0;
          platformStats[p].comments += post.comments || 0;
        }
      });

      // Calculate user averages
      const postsCount = userPosts.length;
      let totalUserLikes = 0;
      let totalUserComments = 0;
      userPosts.forEach(p => {
        totalUserLikes += p.likes || 0;
        totalUserComments += p.comments || 0;
      });

      const avgLikes = postsCount > 0 ? (totalUserLikes / postsCount) : 0;
      const avgComments = postsCount > 0 ? (totalUserComments / postsCount) : 0;
      const postsPerWeek = postsCount > 0 ? parseFloat((postsCount / 4).toFixed(1)) : 1; // proxy: posts in last month / 4
      
      const userStats = {
        followers: totalUserFollowers || 450, // default if no accounts connected yet
        postsPerWeek: postsPerWeek || 1.5,
        avgEngagement: postsCount > 0 ? parseFloat((((totalUserLikes + totalUserComments) / (totalUserFollowers || 100)) * 100).toFixed(2)) : 1.2,
        brandCompleteness: userBrand ? 75 : 30,
        postCount: postsCount,
        rating: 4.2, // mock rating proxy
        reviewsCount: 15, // mock reviews proxy
        webSpeedSeconds: 3.2
      };

      analysisObj.userStats = userStats;
      await analysisObj.save();

      // 3. Scrape websites of competitors
      const targetCompetitors = (analysisObj.targetCompetitors || []).slice(0, 3);
      const competitorsData = {};
      for (const comp of targetCompetitors) {
        logger.info(`[CompetitorIntelligence] Gathering website metadata for ${comp.name} (${comp.website})`);
        const webMeta = await this.scrapeWebsiteMetadata(comp.website);
        competitorsData[comp.name] = {
          website: webMeta,
          socialHandles: comp.socialHandles
        };
      }
      analysisObj.competitorsData = competitorsData;
      await analysisObj.save();

      // 4. Generate AI Analysis using Gemini
      const systemPrompt = `You are a Senior Business Consultant from McKinsey/Deloitte.
Analyze the user's business brand vs competitors.
Your response MUST be a complete JSON object matching the exact structure requested. Do NOT wrap the JSON in markdown blocks (no \`\`\`json). Just output raw JSON.

CRITICAL: Every string value in the JSON MUST be properly escaped. Double quotes inside string values must be escaped as \\" (e.g. \\"consulting\\" or \\"best practices\\"). Do NOT use unescaped double quotes or literal newlines inside string values.

JSON Structure:
{
  "scores": {
    "overall": { "user": 65, "competitors": [80, 75, 82], "improve": "..." },
    "brand": { "user": 70, "competitors": [85, 78, 80], "improve": "..." },
    "content": { "user": 60, "competitors": [75, 70, 85], "improve": "..." },
    "seo": { "user": 55, "competitors": [80, 72, 78], "improve": "..." },
    "engagement": { "user": 58, "competitors": [78, 65, 80], "improve": "..." },
    "profile": { "user": 72, "competitors": [85, 80, 82], "improve": "..." },
    "consistency": { "user": 62, "competitors": [80, 75, 85], "improve": "..." },
    "visualIdentity": { "user": 68, "competitors": [82, 76, 80], "improve": "..." },
    "authority": { "user": 50, "competitors": [75, 68, 72], "improve": "..." },
    "review": { "user": 45, "competitors": [85, 70, 80], "improve": "..." },
    "trust": { "user": 65, "competitors": [80, 75, 82], "improve": "..." },
    "growthPotential": { "user": 70, "competitors": [80, 75, 80], "improve": "..." }
  },
  "metrics": {
    "followers": { "user": 1200, "competitors": [45000, 12000, 85000] },
    "engagementRate": { "user": 1.8, "competitors": [3.4, 2.1, 4.2] },
    "postsPerWeek": { "user": 2, "competitors": [5, 3, 7] },
    "rating": { "user": 4.1, "competitors": [4.7, 4.3, 4.8] },
    "reviewsCount": { "user": 12, "competitors": [250, 85, 412] },
    "webSpeedSeconds": { "user": 4.5, "competitors": [2.1, 3.8, 1.8] }
  },
  "swot": {
    "user": { "strengths": ["..."], "weaknesses": ["..."], "opportunities": ["..."], "threats": ["..."] }
  },
  "gapAnalysis": [
    { "area": "...", "competitorStatus": "...", "userStatus": "...", "impact": "..." }
  ],
  "roadmap": [
    { "timeframe": "Immediate (1 week)", "task": "...", "priority": "High|Medium|Low", "difficulty": "Low|Medium|High", "impact": "...", "growth": "..." },
    { "timeframe": "Short-term (30 days)", "task": "...", "priority": "High|Medium|Low", "difficulty": "Low|Medium|High", "impact": "...", "growth": "..." },
    { "timeframe": "Medium-term (90 days)", "task": "...", "priority": "High|Medium|Low", "difficulty": "Low|Medium|High", "impact": "...", "growth": "..." },
    { "timeframe": "Long-term (6 months)", "task": "...", "priority": "High|Medium|Low", "difficulty": "Low|Medium|High", "impact": "...", "growth": "..." }
  ],
  "contentStrategy": {
    "pillars": ["..."],
    "schedule": "...",
    "hashtags": ["..."],
    "captions": ["..."],
    "ctas": ["..."],
    "hooks": ["..."],
    "ideas": {
      "video": ["..."],
      "carousel": ["..."],
      "linkedin": ["..."],
      "gmb": ["..."]
    }
  },
  "growthPredictions": {
    "followers": "...",
    "engagement": "...",
    "reviews": "...",
    "reach": "...",
    "authority": "...",
    "leads": "..."
  },
  "explanation": "..."
}

Note: For competitor arrays (e.g., scores, metrics), order them identically to the target competitors list provided. Ensure competitor names match.
CRITICAL MANDATE: If the user provided "Real Followers", "Real Rating", or "Real Reviews Count" for a competitor, you MUST use those exact user-provided numbers in the corresponding arrays in the JSON "metrics" object. Do NOT generate simulated or placeholder numbers for those metrics when user-provided values are present. Otherwise, if not provided, make highly professional, consistent industry evaluations.
CRITICAL CONSTRAINTS: Keep all text explanations, roadmap tasks, and improvement details extremely short (under 5-8 words each). For SWOT, limit to exactly 1-2 items per category, and keep each item under 4 words. Write a maximum of 1 short sentence for the 'explanation' field. This is strictly required to prevent token budget truncation on OpenRouter. Ensure the JSON is fully closed.`;

      const compListString = targetCompetitors.map((c, i) => {
        let details = `Competitor ${i+1}: Name: ${c.name}, Website: ${c.website}, Handles: ${JSON.stringify(c.socialHandles)}`;
        if (c.followers !== null && c.followers !== undefined) {
          details += `, Real Followers: ${c.followers}`;
        }
        if (c.rating !== null && c.rating !== undefined) {
          details += `, Real Rating: ${c.rating} stars`;
        }
        if (c.reviewsCount !== null && c.reviewsCount !== undefined) {
          details += `, Real Reviews Count: ${c.reviewsCount}`;
        }
        return details;
      }).join('\n');
      
      const compScrapedString = Object.entries(competitorsData).map(([name, data]) => `Scraped website data for ${name}: Status: ${data.website.status}, LoadTime: ${data.website.loadTimeMs}ms, Title: "${data.website.title}", Desc: "${data.website.description}"`).join('\n');

      const userPrompt = `User Business: "${brandName}"
Industry: "${userBrand?.industry || 'Services'}"
User Connected Accounts Stats: ${JSON.stringify(userStats)}
Target Competitors:
${compListString}

Scraped Competitor Website Details:
${compScrapedString}`;

      let parsedAnalysis;
      let modelUsed = '';
      let attempts = 0;
      const maxAttempts = 3;
      while (attempts < maxAttempts) {
        try {
          logger.info(`[CompetitorIntelligence] Requesting Claude competitor intelligence analysis (attempt ${attempts + 1}/${maxAttempts})...`);
          const result = await this.callClaude(systemPrompt, userPrompt, 'application/json');
          const analysisText = result.text;
          modelUsed = result.model;
          let cleanAnalysisText = analysisText.replace(/```json/gi, '').replace(/```/g, '').trim();
          const firstBrace = cleanAnalysisText.indexOf('{');
          const lastBrace = cleanAnalysisText.lastIndexOf('}');
          if (firstBrace !== -1 && lastBrace !== -1) {
            cleanAnalysisText = cleanAnalysisText.substring(firstBrace, lastBrace + 1);
          }
          const repairedJson = repairJsonQuotes(cleanAnalysisText);
          parsedAnalysis = JSON.parse(repairedJson);
          break; // Successful parse!
        } catch (jsonErr) {
          attempts++;
          logger.warn(`[CompetitorIntelligence] Analysis attempt ${attempts} failed to generate valid JSON: ${jsonErr.message}`);
          if (attempts >= maxAttempts) {
            throw jsonErr;
          }
          logger.info('[CompetitorIntelligence] Retrying generation...');
        }
      }

      // Fail-safe post-processing override: Ensure manually supplied metrics strictly overwrite LLM estimations.
      if (parsedAnalysis && parsedAnalysis.metrics) {
        if (!parsedAnalysis.metrics.followers) parsedAnalysis.metrics.followers = { user: userStats.followers, competitors: [] };
        if (!parsedAnalysis.metrics.rating) parsedAnalysis.metrics.rating = { user: userStats.rating, competitors: [] };
        if (!parsedAnalysis.metrics.reviewsCount) parsedAnalysis.metrics.reviewsCount = { user: userStats.reviewsCount, competitors: [] };
        
        targetCompetitors.forEach((comp, idx) => {
          if (comp.followers !== null && comp.followers !== undefined) {
            if (!Array.isArray(parsedAnalysis.metrics.followers.competitors)) {
              parsedAnalysis.metrics.followers.competitors = [];
            }
            parsedAnalysis.metrics.followers.competitors[idx] = comp.followers;
          }
          if (comp.rating !== null && comp.rating !== undefined) {
            if (!Array.isArray(parsedAnalysis.metrics.rating.competitors)) {
              parsedAnalysis.metrics.rating.competitors = [];
            }
            parsedAnalysis.metrics.rating.competitors[idx] = comp.rating;
          }
          if (comp.reviewsCount !== null && comp.reviewsCount !== undefined) {
            if (!Array.isArray(parsedAnalysis.metrics.reviewsCount.competitors)) {
              parsedAnalysis.metrics.reviewsCount.competitors = [];
            }
            parsedAnalysis.metrics.reviewsCount.competitors[idx] = comp.reviewsCount;
          }
        });
      }

      analysisObj.analysis = parsedAnalysis;
      analysisObj.modelUsed = modelUsed;
      await analysisObj.save();

      // 5. Generate Reports Directories
      const reportsDir = path.resolve('reports');
      if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
      }

      const pdfPath = path.join(reportsDir, `competitor_analysis_${analysisId}.pdf`);
      const docxPath = path.join(reportsDir, `competitor_analysis_${analysisId}.docx`);

      // Generate reports
      logger.info(`[CompetitorIntelligence] Generating PDF report at: ${pdfPath}`);
      await this.generatePdfReport(brandName, analysisObj, pdfPath);

      logger.info(`[CompetitorIntelligence] Generating DOCX report at: ${docxPath}`);
      await this.generateDocxReport(brandName, analysisObj, docxPath);

      // Save report URLs
      analysisObj.pdfReportUrl = `/api/v1/competitor/download/${analysisId}/pdf`;
      analysisObj.docxReportUrl = `/api/v1/competitor/download/${analysisId}/docx`;
      analysisObj.status = 'completed';
      await analysisObj.save();

      // Send email notification to user
      try {
        const user = await User.findById(userId);
        if (user && user.email) {
          logger.info(`[CompetitorIntelligence] Sending completion email to user ${user.email}`);
          await emailServiceInstance.sendEmail({
            to: user.email,
            subject: `Your Taraflow AI Competitor Intelligence Report is Ready!`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                <h2 style="color: #4F46E5; text-align: center;">Competitor Analysis Completed!</h2>
                <p>Hello ${user.firstName || 'User'},</p>
                <p>We are excited to let you know that your AI Competitor Intelligence Report for <strong>${brandName}</strong> has been successfully generated by our background systems.</p>
                <p>You can now download your professional consulting PDF and Word document directly from your dashboard, along with an interactive breakdown of SWOT, Gaps, and Roadmaps.</p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/competitor-intelligence" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">View Analysis Dashboard</a>
                </div>
                <hr style="border: 0; border-top: 1px solid #eeeeee; margin-top: 30px;">
                <p style="font-size: 12px; color: #777777; text-align: center;">Taraflow Enterprise AI Service</p>
              </div>
            `
          });
        }
      } catch (emailErr) {
        logger.error('[CompetitorIntelligence] Failed to send report ready email:', emailErr);
      }

      logger.info(`[CompetitorIntelligence] Job completed successfully for analysis ID: ${analysisId}`);
    } catch (err) {
      logger.error(`[CompetitorIntelligence] Job failed for analysis ID: ${analysisId}:`, err);
      await this.markAsFailed(analysisId, err.message);
      throw err;
    }
  }

  /**
   * Mark report as failed
   */
  async markAsFailed(analysisId, errorMsg) {
    try {
      const obj = await CompetitorAnalysis.findById(analysisId);
      if (obj) {
        obj.status = 'failed';
        obj.error = errorMsg;
        await obj.save();
      }
    } catch (err) {
      logger.error(`[CompetitorIntelligence] Failed to update fail status for ${analysisId}:`, err);
    }
  }

  /**
   * Generate PDF using pdfkit
   */
  async generatePdfReport(brandName, analysisObj, outputPath) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
        const writeStream = fs.createWriteStream(outputPath);
        doc.pipe(writeStream);

        const primaryColor = '#4F46E5'; // Indigo
        const secondaryColor = '#06B6D4'; // Cyan
        const textDark = '#1F2937'; // Charcoal
        const textMuted = '#4B5563'; // Slate grey
        const bgDark = '#0F172A'; // Dark navy
        const borderCol = '#E5E7EB'; // Border grey
        const lightBg = '#F9FAFB'; // Card grey

        // ────────── 1. COVER PAGE ──────────
        doc.rect(0, 0, doc.page.width, doc.page.height).fill(bgDark);
        
        // Large decorative colored visual box
        doc.rect(0, 0, 15, doc.page.height).fill(primaryColor);
        doc.rect(15, 0, 10, doc.page.height).fill(secondaryColor);

        doc.fillColor('#FFFFFF');
        doc.font('Helvetica-Bold').fontSize(36).text('AI COMPETITOR\nINTELLIGENCE\nREPORT', 60, 200, { lineGap: 10 });
        
        doc.rect(60, 360, 120, 4).fill(secondaryColor);

        doc.fillColor('#94A3B8');
        doc.font('Helvetica').fontSize(14).text('STRATEGIC BRAND & SOCIAL MEDIA ANALYSIS', 60, 390);

        doc.fillColor('#FFFFFF');
        doc.font('Helvetica-Bold').fontSize(16).text(`PREPARED FOR: ${brandName.toUpperCase()}`, 60, 520);
        
        doc.fillColor('#64748B').fontSize(11).font('Helvetica');
        doc.text(`GENERATED: ${new Date(analysisObj.createdAt).toLocaleDateString()}`, 60, 550);
        doc.text('REPORT ID: ' + analysisObj._id.toString().toUpperCase(), 60, 570);
        
        doc.fillColor('#94A3B8').fontSize(12).font('Helvetica-Bold');
        doc.text('TARAFLOW.AI BUSINESS CONSULTING', 60, 720);

        doc.addPage();

        // ────────── FOOTER HELPER ──────────
        const addHeaderFooter = () => {
          let pages = doc.bufferedPageRange();
          for (let i = 1; i < pages.count; i++) {
            doc.switchToPage(i);
            
            // Header
            doc.fontSize(8).fillColor(textMuted).text('TARAFLOW AI COMPETITOR INTELLIGENCE REPORT', 50, 25);
            doc.moveTo(50, 38).lineTo(doc.page.width - 50, 38).strokeColor(borderCol).lineWidth(0.5).stroke();

            // Footer
            doc.moveTo(50, doc.page.height - 40).lineTo(doc.page.width - 50, doc.page.height - 40).strokeColor(borderCol).lineWidth(0.5).stroke();
            doc.fontSize(8).fillColor(textMuted).text(`© ${new Date().getFullYear()} Taraflow.ai. All rights reserved.`, 50, doc.page.height - 30);
            doc.text(`Page ${i + 1} of ${pages.count}`, doc.page.width - 100, doc.page.height - 30, { align: 'right' });
          }
        };

        const analysis = analysisObj.analysis;

        // ────────── 2. EXECUTIVE SUMMARY ──────────
        doc.fillColor(textDark);
        doc.font('Helvetica-Bold').fontSize(22).text('1. Executive Summary', 50, 60);
        doc.rect(50, 90, 50, 3).fill(primaryColor);
        doc.y = 110;

        doc.font('Helvetica').fontSize(11).fillColor(textDark).text(analysis.explanation || 'An automated overview comparing metrics, SWOT quadrants, roadmaps, and scores.', { lineGap: 4, width: 495 });

        // Score Highlight Cards
        doc.y = doc.y + 30;
        doc.font('Helvetica-Bold').fontSize(14).text('Global Competitor Scoring Highlights', 50);
        doc.y = doc.y + 10;

        const summaryScores = [
          { name: 'Overall Score', key: 'overall' },
          { name: 'Content Score', key: 'content' },
          { name: 'SEO Score', key: 'seo' },
          { name: 'Engagement Score', key: 'engagement' }
        ];

        let startX = 50;
        summaryScores.forEach(s => {
          const scoreData = analysis.scores?.[s.key] || { user: 60, competitors: [70, 75] };
          
          doc.rect(startX, doc.y, 110, 80).fillColor(lightBg).strokeColor(borderCol).lineWidth(1).fillAndStroke();
          doc.fillColor(textDark).font('Helvetica-Bold').fontSize(10).text(s.name, startX + 10, doc.y + 10, { width: 90 });
          doc.fillColor(primaryColor).fontSize(20).text(`${scoreData.user}%`, startX + 10, doc.y + 30);
          
          const maxComp = Math.max(...(scoreData.competitors || [0]));
          doc.fillColor(textMuted).fontSize(8).font('Helvetica').text(`Top Competitor: ${maxComp}%`, startX + 10, doc.y + 55, { width: 90 });
          startX += 128;
        });

        doc.addPage();

        // ────────── 3. DETAILED SCORES COMPARISON ──────────
        doc.fillColor(textDark);
        doc.font('Helvetica-Bold').fontSize(22).text('2. Comparative Scoring Analysis', 50, 60);
        doc.rect(50, 90, 50, 3).fill(primaryColor);
        doc.y = 110;

        doc.font('Helvetica').fontSize(10).text('The graph below displays your business scores compared to target competitors. Target scores represent recommended growth markers to compete effectively.', 50, doc.y, { width: 495, lineGap: 3 });
        
        doc.y = doc.y + 30;
        // Drawing custom vectors for score comparison chart
        const chartKeys = ['overall', 'brand', 'content', 'seo', 'engagement', 'consistency', 'visualIdentity'];
        let chartY = doc.y;
        chartKeys.forEach(k => {
          const score = analysis.scores?.[k] || { user: 50, competitors: [70] };
          const userVal = score.user;
          const compVal = score.competitors?.[0] || 60;
          const label = k.charAt(0).toUpperCase() + k.slice(1).replace(/([A-Z])/g, ' $1');

          doc.fillColor(textDark).font('Helvetica-Bold').fontSize(9).text(label, 50, chartY);
          
          // Gray base track
          doc.rect(170, chartY - 2, 250, 10).fillColor('#E5E7EB').fill();
          // User Fill (Indigo)
          doc.rect(170, chartY - 2, (userVal / 100) * 250, 10).fillColor(primaryColor).fill();
          // Competitor marker (Cyan dot/line)
          doc.rect(170 + (compVal / 100) * 250 - 2, chartY - 4, 4, 14).fillColor(secondaryColor).fill();

          doc.fillColor(textDark).fontSize(9).text(`${userVal}% / ${compVal}%`, 430, chartY);
          chartY += 28;
        });

        // Legend
        doc.y = chartY + 15;
        doc.rect(50, doc.y, 10, 10).fillColor(primaryColor).fill();
        doc.fillColor(textDark).fontSize(8).text('Your Score', 65, doc.y + 1);
        doc.rect(150, doc.y, 4, 10).fillColor(secondaryColor).fill();
        doc.fillColor(textDark).fontSize(8).text('Competitor Max Target', 160, doc.y + 1);

        doc.addPage();

        // ────────── 4. SWOT ANALYSIS ──────────
        doc.fillColor(textDark);
        doc.font('Helvetica-Bold').fontSize(22).text('3. SWOT Analysis', 50, 60);
        doc.rect(50, 90, 50, 3).fill(primaryColor);
        doc.y = 110;

        // Draw SWOT grid
        const swot = analysis.swot?.user || { strengths: [], weaknesses: [], opportunities: [], threats: [] };
        
        let gridY = 130;
        // S - Strengths
        doc.rect(50, gridY, 240, 250).fillColor('#EEF2F6').fill();
        doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(12).text('STRENGTHS (Internal)', 60, gridY + 10);
        doc.fillColor(textDark).font('Helvetica').fontSize(9);
        let bulletY = gridY + 30;
        (swot.strengths || ['Strong local presence', 'Authentic owner stories']).forEach(bullet => {
          doc.text(`• ${bullet}`, 60, bulletY, { width: 220, lineGap: 2 });
          bulletY += doc.heightOfString(`• ${bullet}`, { width: 220, lineGap: 2 }) + 4;
        });

        // W - Weaknesses
        doc.rect(305, gridY, 240, 250).fillColor('#FFF5F5').fill();
        doc.fillColor('#DC2626').font('Helvetica-Bold').fontSize(12).text('WEAKNESSES (Internal)', 315, gridY + 10);
        doc.fillColor(textDark).font('Helvetica').fontSize(9);
        bulletY = gridY + 30;
        (swot.weaknesses || ['Inconsistent posting times', 'Lack of video hooks']).forEach(bullet => {
          doc.text(`• ${bullet}`, 315, bulletY, { width: 220, lineGap: 2 });
          bulletY += doc.heightOfString(`• ${bullet}`, { width: 220, lineGap: 2 }) + 4;
        });

        gridY = 400;
        // O - Opportunities
        doc.rect(50, gridY, 240, 250).fillColor('#ECFDF5').fill();
        doc.fillColor('#059669').font('Helvetica-Bold').fontSize(12).text('OPPORTUNITIES (External)', 60, gridY + 10);
        doc.fillColor(textDark).font('Helvetica').fontSize(9);
        bulletY = gridY + 30;
        (swot.opportunities || ['Launch video reels strategy', 'Post weekly updates to GMB']).forEach(bullet => {
          doc.text(`• ${bullet}`, 60, bulletY, { width: 220, lineGap: 2 });
          bulletY += doc.heightOfString(`• ${bullet}`, { width: 220, lineGap: 2 }) + 4;
        });

        // T - Threats
        doc.rect(305, gridY, 240, 250).fillColor('#FFFBEB').fill();
        doc.fillColor('#D97706').font('Helvetica-Bold').fontSize(12).text('THREATS (External)', 315, gridY + 10);
        doc.fillColor(textDark).font('Helvetica').fontSize(9);
        bulletY = gridY + 30;
        (swot.threats || ['Competitors running targeted ads', 'Shifts in platform algorithms']).forEach(bullet => {
          doc.text(`• ${bullet}`, 315, bulletY, { width: 220, lineGap: 2 });
          bulletY += doc.heightOfString(`• ${bullet}`, { width: 220, lineGap: 2 }) + 4;
        });

        doc.addPage();

        // ────────── 5. GAP ANALYSIS ──────────
        doc.fillColor(textDark);
        doc.font('Helvetica-Bold').fontSize(22).text('4. Core Gaps & Impacts', 50, 60);
        doc.rect(50, 90, 50, 3).fill(primaryColor);
        doc.y = 110;

        let tableY = 120;
        // Draw Header
        doc.rect(50, tableY, 495, 25).fillColor(primaryColor).fill();
        doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(10);
        doc.text('Marketing Area', 55, tableY + 7, { width: 120 });
        doc.text('Competitor Status', 180, tableY + 7, { width: 140 });
        doc.text('Your Status', 325, tableY + 7, { width: 100 });
        doc.text('Impact', 430, tableY + 7, { width: 110 });

        tableY += 25;
        const gaps = analysis.gapAnalysis || [
          { area: 'Posting frequency', competitorStatus: 'Daily reels & carousels', userStatus: 'Once a fortnight', impact: 'Loss of visual branding' }
        ];

        gaps.forEach((g, idx) => {
          const rowHeight = 45;
          doc.rect(50, tableY, 495, rowHeight).fillColor(idx % 2 === 0 ? '#FFFFFF' : lightBg).strokeColor(borderCol).lineWidth(0.5).fillAndStroke();
          doc.fillColor(textDark).font('Helvetica-Bold').fontSize(9).text(g.area || '', 55, tableY + 10, { width: 120 });
          doc.font('Helvetica').text(g.competitorStatus || '', 180, tableY + 10, { width: 140 });
          doc.text(g.userStatus || '', 325, tableY + 10, { width: 100 });
          doc.fillColor('#E11D48').text(g.impact || '', 430, tableY + 10, { width: 115 });
          tableY += rowHeight;
        });

        doc.addPage();

        // ────────── 6. IMPROVEMENT ROADMAP ──────────
        doc.fillColor(textDark);
        doc.font('Helvetica-Bold').fontSize(22).text('5. Implementation Roadmap', 50, 60);
        doc.rect(50, 90, 50, 3).fill(primaryColor);
        doc.y = 110;

        let roadmapY = 120;
        const roadmapTasks = analysis.roadmap || [
          { timeframe: 'Immediate (1 week)', task: 'Claim and optimize social handles', priority: 'High', difficulty: 'Low', impact: 'Uniformity' }
        ];

        roadmapTasks.forEach(task => {
          doc.rect(50, roadmapY, 495, 60).fillColor(lightBg).strokeColor(borderCol).lineWidth(0.8).fillAndStroke();
          
          doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(11).text(task.timeframe || '', 60, roadmapY + 10);
          doc.fillColor(textDark).font('Helvetica').fontSize(9).text(`Task: ${task.task || ''}`, 60, roadmapY + 26, { width: 300 });
          doc.text(`Expected Growth: ${task.growth || 'N/A'}`, 60, roadmapY + 40, { width: 300 });

          // Pill indicators
          doc.rect(380, roadmapY + 10, 65, 16).fillColor('#EEF2F6').fill();
          doc.fillColor(textDark).font('Helvetica-Bold').fontSize(8).text(`Priority: ${task.priority || 'Medium'}`, 385, roadmapY + 14);

          doc.rect(455, roadmapY + 10, 80, 16).fillColor('#ECFDF5').fill();
          doc.fillColor('#059669').text(`Diff: ${task.difficulty || 'Easy'}`, 460, roadmapY + 14);

          roadmapY += 75;
        });

        doc.addPage();

        // ────────── 7. CONTENT STRATEGY ──────────
        doc.fillColor(textDark);
        doc.font('Helvetica-Bold').fontSize(22).text('6. AI-Recommended Content Strategy', 50, 60);
        doc.rect(50, 90, 50, 3).fill(primaryColor);
        doc.y = 110;

        const content = analysis.contentStrategy || { pillars: [], schedule: '', hashtags: [], ctas: [], hooks: [] };
        
        doc.font('Helvetica-Bold').fontSize(12).text('Core Content Pillars', 50);
        doc.font('Helvetica').fontSize(9).text((content.pillars || []).join(' | '), 50, doc.y + 5, { lineGap: 3 });

        doc.y = doc.y + 20;
        doc.font('Helvetica-Bold').fontSize(12).text('Recommended Posting Schedule', 50);
        doc.font('Helvetica').fontSize(9).text(content.schedule || '3-4 times a week', 50, doc.y + 5);

        doc.y = doc.y + 20;
        doc.font('Helvetica-Bold').fontSize(12).text('Content Ideas & Formats', 50);
        
        let ideasY = doc.y + 10;
        // Instagram/Video ideas
        doc.rect(50, ideasY, 240, 130).fillColor(lightBg).fill();
        doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(10).text('Reels / Video Concept', 60, ideasY + 10);
        doc.fillColor(textDark).font('Helvetica').fontSize(8.5);
        let ideaBulletY = ideasY + 28;
        const videoIdeas = Array.isArray(content.ideas?.video) ? content.ideas.video : ['Show behind-the-scenes content', 'Explain 3 common client pain points'];
        videoIdeas.slice(0, 3).forEach(v => {
          doc.text(`• ${v}`, 60, ideaBulletY, { width: 220, lineGap: 2 });
          ideaBulletY += doc.heightOfString(`• ${v}`, { width: 220 }) + 3;
        });

        // LinkedIn/GMB
        doc.rect(305, ideasY, 240, 130).fillColor(lightBg).fill();
        doc.fillColor(secondaryColor).font('Helvetica-Bold').fontSize(10).text('LinkedIn / GMB Post Ideas', 315, ideasY + 10);
        doc.fillColor(textDark).font('Helvetica').fontSize(8.5);
        ideaBulletY = ideasY + 28;
        const linkedinIdeas = Array.isArray(content.ideas?.linkedin) ? content.ideas.linkedin : ['Share industry trends data', 'Case study of client transformation'];
        linkedinIdeas.slice(0, 3).forEach(l => {
          doc.text(`• ${l}`, 315, ideaBulletY, { width: 220, lineGap: 2 });
          ideaBulletY += doc.heightOfString(`• ${l}`, { width: 220 }) + 3;
        });

        doc.y = ideasY + 150;
        doc.font('Helvetica-Bold').fontSize(12).fillColor(textDark).text('Strategic Hooks & Calls to Action', 50);
        
        doc.font('Helvetica-Oblique').fontSize(9).fillColor(textMuted).text('Recommended Hooks:', 50, doc.y + 5);
        doc.font('Helvetica').fontSize(9).fillColor(textDark).text((content.hooks || []).slice(0, 3).map(h => `"${h}"`).join(', '), 50, doc.y + 5, { width: 495 });

        doc.y = doc.y + 10;
        doc.font('Helvetica-Oblique').fontSize(9).fillColor(textMuted).text('Calls to Action:', 50);
        doc.font('Helvetica').fontSize(9).fillColor(textDark).text((content.ctas || []).slice(0, 3).map(c => `"${c}"`).join(', '), 50, doc.y + 5, { width: 495 });

        // Add headers, footers and close
        doc.font('Helvetica'); // Reset
        addHeaderFooter();
        doc.end();

        writeStream.on('finish', () => {
          resolve();
        });

        writeStream.on('error', (err) => {
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Generate DOCX report using docx
   */
  async generateDocxReport(brandName, analysisObj, outputPath) {
    const analysis = analysisObj.analysis;
    const scores = analysis.scores || {};
    const gaps = analysis.gapAnalysis || [];
    const roadmap = analysis.roadmap || [];
    const content = analysis.contentStrategy || {};

    const docChildren = [
      new Paragraph({
        text: "AI COMPETITOR INTELLIGENCE REPORT",
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
      }),
      new Paragraph({
        text: `PREPARED FOR: ${brandName.toUpperCase()}`,
        alignment: AlignmentType.CENTER,
      }),
      new Paragraph({
        text: `Report Date: ${new Date(analysisObj.createdAt).toLocaleDateString()}`,
        alignment: AlignmentType.CENTER,
      }),
      new Paragraph({
        text: "Powered by Taraflow.ai",
        alignment: AlignmentType.CENTER,
      }),
      new Paragraph({ text: "" }), // Space
      new Paragraph({ text: "" }), // Space

      new Paragraph({
        text: "1. Executive Summary",
        heading: HeadingLevel.HEADING_1,
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: analysis.explanation || "This report summarizes the competitive landscape analysis.",
          }),
        ],
      }),
      new Paragraph({ text: "" }),

      new Paragraph({
        text: "2. Strategic Scores Comparison",
        heading: HeadingLevel.HEADING_1,
      }),
      new Paragraph({
        text: "Below are the calculated brand performance scores (out of 100) compared against top industry competitors:",
      }),
    ];

    // Add scores list
    Object.entries(scores).forEach(([key, val]) => {
      const label = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({ text: `• ${label}: `, bold: true }),
            new TextRun({ text: `Your Score: ${val.user}% | Competitor Max: ${Math.max(...(val.competitors || [0]))}%` }),
          ],
        })
      );
    });

    docChildren.push(new Paragraph({ text: "" }));
    docChildren.push(
      new Paragraph({
        text: "3. SWOT Analysis",
        heading: HeadingLevel.HEADING_1,
      })
    );

    const swot = analysis.swot?.user || { strengths: [], weaknesses: [], opportunities: [], threats: [] };
    docChildren.push(new Paragraph({ text: "Strengths:", heading: HeadingLevel.HEADING_2 }));
    swot.strengths?.forEach(s => docChildren.push(new Paragraph({ text: `- ${s}` })));

    docChildren.push(new Paragraph({ text: "Weaknesses:", heading: HeadingLevel.HEADING_2 }));
    swot.weaknesses?.forEach(w => docChildren.push(new Paragraph({ text: `- ${w}` })));

    docChildren.push(new Paragraph({ text: "Opportunities:", heading: HeadingLevel.HEADING_2 }));
    swot.opportunities?.forEach(o => docChildren.push(new Paragraph({ text: `- ${o}` })));

    docChildren.push(new Paragraph({ text: "Threats:", heading: HeadingLevel.HEADING_2 }));
    swot.threats?.forEach(t => docChildren.push(new Paragraph({ text: `- ${t}` })));

    docChildren.push(new Paragraph({ text: "" }));
    docChildren.push(
      new Paragraph({
        text: "4. Marketing Gaps & Impact",
        heading: HeadingLevel.HEADING_1,
      })
    );

    // Create table for Gaps
    const tableRows = [
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ text: "Marketing Area", bold: true })] }),
          new TableCell({ children: [new Paragraph({ text: "Competitor Status", bold: true })] }),
          new TableCell({ children: [new Paragraph({ text: "Your Status", bold: true })] }),
          new TableCell({ children: [new Paragraph({ text: "Impact", bold: true })] }),
        ],
      }),
    ];

    gaps.forEach(g => {
      tableRows.push(
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ text: g.area || "" })] }),
            new TableCell({ children: [new Paragraph({ text: g.competitorStatus || "" })] }),
            new TableCell({ children: [new Paragraph({ text: g.userStatus || "" })] }),
            new TableCell({ children: [new Paragraph({ text: g.impact || "" })] }),
          ],
        })
      );
    });

    docChildren.push(new Table({ rows: tableRows }));

    docChildren.push(new Paragraph({ text: "" }));
    docChildren.push(
      new Paragraph({
        text: "5. Tactical Roadmap",
        heading: HeadingLevel.HEADING_1,
      })
    );

    roadmap.forEach(r => {
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({ text: `[${r.timeframe}] `, bold: true, color: "4F46E5" }),
            new TextRun({ text: `${r.task} `, bold: true }),
            new TextRun({ text: `(Priority: ${r.priority} | Impact: ${r.impact} | Growth Projection: ${r.growth})` }),
          ],
        })
      );
    });

    docChildren.push(new Paragraph({ text: "" }));
    docChildren.push(
      new Paragraph({
        text: "6. Content pillars & Pillars Recommendations",
        heading: HeadingLevel.HEADING_1,
      })
    );

    docChildren.push(new Paragraph({ text: `Content Pillars: ${(content.pillars || []).join(', ')}`, bold: true }));
    docChildren.push(new Paragraph({ text: `Schedule: ${content.schedule || 'N/A'}` }));
    docChildren.push(new Paragraph({ text: `Best Hashtags: ${(content.hashtags || []).join(', ')}` }));
    docChildren.push(new Paragraph({ text: `Hooks: ${(content.hooks || []).slice(0, 3).join(' | ')}` }));

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: docChildren,
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(outputPath, buffer);
  }

  /**
   * Accepts recommendations and schedules posts/campaigns automatically
   */
  async acceptRecommendations(userId, analysisId) {
    try {
      const analysisObj = await CompetitorAnalysis.findById(analysisId);
      if (!analysisObj || !analysisObj.analysis) {
        throw new Error('Analysis data not found or not completed.');
      }

      const contentStrategy = analysisObj.analysis.contentStrategy || {};
      const ideas = contentStrategy.ideas || {};

      const postsCreated = [];

      // 1. Create a draft LinkedIn Post
      if (Array.isArray(ideas.linkedin) && ideas.linkedin.length > 0) {
        const title = ideas.linkedin[0];
        const newPost = await Post.create({
          content: `${title}\n\nRead more about how we optimize systems and grow client engagement.\n\n#businessGrowth #taraflow #strategy`,
          platform: 'linkedin',
          status: 'DRAFT',
          publishedAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // scheduled in 2 days
          createdBy: userId
        });
        postsCreated.push(newPost);
      }

      // 2. Create a GMB draft Post / article
      if (Array.isArray(ideas.gmb) && ideas.gmb.length > 0) {
        const title = ideas.gmb[0];
        const newPost = await Post.create({
          content: `${title}\n\nCheck out our local office updates and client reviews. Find out why we are the top-rated consultant in the region.\n\n#GMBupdate #businessgrowth`,
          platform: 'facebook', // default platform map since GMB routes into similar posting channels
          status: 'DRAFT',
          publishedAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000), // scheduled in 4 days
          createdBy: userId
        });
        postsCreated.push(newPost);
      }

      // 3. Create draft Instagram / carousel post
      if (Array.isArray(ideas.carousel) && ideas.carousel.length > 0) {
        const title = ideas.carousel[0];
        const newPost = await Post.create({
          content: `${title}\n\nSwipe left to see our step-by-step roadmap.\n\n#instagram #marketingtips #taraflow`,
          platform: 'instagram',
          status: 'DRAFT',
          publishedAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000), // scheduled in 6 days
          createdBy: userId
        });
        postsCreated.push(newPost);
      }

      return {
        success: true,
        message: 'Successfully generated draft social campaigns and posts in your Content Studio based on the roadmap recommendations.',
        postsCreatedCount: postsCreated.length
      };
    } catch (err) {
      logger.error('[CompetitorIntelligence] Failed to accept recommendations:', err);
      throw err;
    }
  }
}

/**
 * Repairs unescaped double quotes and literal newlines in JSON strings returned by LLMs.
 */
function repairJsonQuotes(str) {
  let result = '';
  let inString = false;
  
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    
    if (char === '"') {
      // Check if it's escaped
      let backslashes = 0;
      let j = i - 1;
      while (j >= 0 && str[j] === '\\') {
        backslashes++;
        j--;
      }
      const isEscaped = backslashes % 2 !== 0;
      
      if (isEscaped) {
        result += char;
        continue;
      }
      
      if (!inString) {
        // Start of string
        inString = true;
        result += char;
      } else {
        // We are in a string. Check if this quote is a structural quote.
        let isStructural = false;
        let nextIdx = i + 1;
        while (nextIdx < str.length && /\s/.test(str[nextIdx])) {
          nextIdx++;
        }
        if (nextIdx >= str.length) {
          isStructural = true;
        } else {
          const nextChar = str[nextIdx];
          if (nextChar === ',' || nextChar === '}' || nextChar === ']' || nextChar === ':') {
            isStructural = true;
          }
        }
        
        if (isStructural) {
          inString = false;
          result += char;
        } else {
          // Internal unescaped quote! Escape it.
          result += '\\"';
        }
      }
    } else if (char === '\n' && inString) {
      result += '\\n';
    } else if (char === '\r' && inString) {
      result += '\\r';
    } else {
      result += char;
    }
  }
  return result;
}

const competitorIntelligenceServiceInstance = new CompetitorIntelligenceService();
export default competitorIntelligenceServiceInstance;
export { competitorIntelligenceServiceInstance };
