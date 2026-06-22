import logger from '../utils/logger.util.js';
import dotenv from 'dotenv';
import { brandProfileServiceInstance } from './brandProfile.service.js';
import AiLearningProfile from '../models/aiLearningProfile.model.js';
import { decrypt } from '../utils/encryption.js';

class QwenService {
  constructor() {
    this.apiKey = process.env.QWEN_API_KEY;
    this.apiBase = this.resolveApiBase();
    this.model = process.env.QWEN_MODEL || 'qwen-plus';

    // Separate image generation config (defaults to text config if not set)
    this.imageApiKey = process.env.QWEN_IMAGE_API_KEY || this.apiKey;
    this.imageApiBase = process.env.QWEN_IMAGE_API_BASE || this.apiBase;
    this.imageModel = process.env.QWEN_IMAGE_MODEL || null;

    // Hugging Face config for image generation
    this.hfToken = process.env.HF_TOKEN || null;
    this.hfModel = process.env.HF_IMAGE_MODEL || 'black-forest-labs/FLUX.1-schnell';
  }

  resolveApiBase() {
    const apiKey = process.env.QWEN_API_KEY || this.apiKey;
    const defaultBase = (apiKey && apiKey.startsWith('nvapi-'))
      ? 'https://integrate.api.nvidia.com/v1'
      : 'https://dashscope.aliyuncs.com/compatible-mode/v1';
    return process.env.QWEN_API_BASE || defaultBase;
  }

  getFallbackUrl(p, width = 1080, height = 1080) {
    const stopWords = ['a', 'an', 'the', 'and', 'but', 'for', 'with', 'from', 'glowing', 'neon', 'dark', 'light', 'themed', 'mockup', 'accent', 'sleek', 'modern', 'minimalist', 'minimalistic', 'workspace', 'background', 'abstract', 'technological', 'design'];
    const keywords = p
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.includes(w))
      .slice(0, 3)
      .join(',');
    const query = keywords || 'abstract,tech';
    const randomSeed = Math.floor(Math.random() * 1000000);
    return `https://loremflickr.com/${width}/${height}/${encodeURIComponent(query)}?random=${randomSeed}`;
  }

  async enhancePrompt(prompt, opts = {}) {
    const apiKey = process.env.QWEN_API_KEY || this.apiKey;
    const apiBase = this.resolveApiBase();
    const model = process.env.QWEN_MODEL || this.model;

    if (!apiKey) return prompt;

    try {
      const endpoint = `${apiBase.replace(/\/$/, '')}/chat/completions`;
      
      const industry = opts.industry || 'auto-detect';
      const contentType = opts.contentType || 'auto-detect';
      const visualStyle = opts.visualStyle || 'auto-detect';
      const platform = opts.platform || 'auto-detect';
      const keyPoints = opts.keyPoints || '';

      const systemPrompt = `You are an expert AI image prompt engineer and creative director.
Your goal is to transform a raw user topic/concept into a highly detailed, professional visual prompt for an image generator (like Flux or Stable Diffusion).

Analyze the input text and options:
- Target Industry: ${industry}
- Content Type: ${contentType}
- Visual Style: ${visualStyle}
- Platform Optimization: ${platform}
- Specific Details: ${keyPoints}

GUIDELINES FOR PROMPT ENHANCEMENT:
1. Intent & Context: Determine what the user wants to communicate. Detect if it is a business/corporate topic.
2. Scene Composition & Storytelling: Design a clean, visually balanced scene with a clear focal point. Avoid cluttered layouts.
3. Industry Visuals: Add specific high-value professional elements relevant to the industry (e.g. for Finance: clean chart lines, elegant modern graphs; for Marketing: workspace, devices with analytics, content calendars).
4. Lighting & Colors: Specify precise lighting (e.g. volumetric lighting, warm soft office glow, cinematic backlight) and color palette (e.g. sleek dark mode, vibrant branding colors, professional blue tones).
5. Quality & Style: Use descriptors like "realistic photography", "commercial design visual", "clean composition", "highly detailed", "premium look". Avoid generic stock-photo style words (e.g. "stock image", "smiling business people").
6. Multi-step Process (Internal): 
   - Extract keywords.
   - Generate 3 to 5 internal visual concepts.
   - Select the single best visual story representing the topic.
   - Expand it into a detailed prompt of 45 to 80 words.

Return ONLY the final selected visual prompt. Do not include preamble, explanations, numbering, quotes, or formatting tags.`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: `Optimize this prompt for image generation: "${prompt}"`
            }
          ],
          temperature: 0.6,
          max_tokens: 150
        })
      });

      if (response.ok) {
        const data = await response.json();
        const enhanced = data.choices[0]?.message?.content?.trim();
        if (enhanced) {
          const cleanEnhanced = enhanced.replace(/^["']|["']$/g, '');
          logger.info(`[QwenService] Enhanced prompt from "${prompt}" to "${cleanEnhanced}"`);
          return cleanEnhanced;
        }
      }
    } catch (err) {
      logger.warn('[QwenService] Failed to enhance prompt:', err.message || err);
    }
    return prompt;
  }

  async generateImage(prompt, opts = {}) {
    dotenv.config({ override: true });
    
    // Auto-enhance prompt to generate highly detailed images
    if (!opts.skipEnhance) {
      prompt = await this.enhancePrompt(prompt, opts);
    }
    
    const geminiApiKey = process.env.GEMINI_API_KEY || null;
    const geminiModel = process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image';

    if (geminiApiKey) {
      logger.info(`[QwenService] Attempting Gemini image generation for prompt: "${prompt}" using model: "${geminiModel}"`);
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: prompt
                  }
                ]
              }
            ],
            generationConfig: {
              responseModalities: ['IMAGE']
            }
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Gemini API responded with status ${response.status}: ${errText}`);
        }

        const data = await response.json();
        const candidate = data.candidates?.[0];
        const part = candidate?.content?.parts?.find(p => p.inlineData);
        if (part && part.inlineData && part.inlineData.data) {
          const mimeType = part.inlineData.mimeType || 'image/jpeg';
          logger.info(`[QwenService] Gemini image generation succeeded using model "${geminiModel}"`);
          return `data:${mimeType};base64,${part.inlineData.data}`;
        } else {
          throw new Error('Gemini API response did not contain inline image data.');
        }
      } catch (geminiErr) {
        logger.error('[QwenService] Gemini image generation failed. Falling back to next methods:', geminiErr.message || geminiErr);
      }
    }

    const hfToken = process.env.HF_TOKEN || null;
    const hfModel = process.env.HF_IMAGE_MODEL || 'black-forest-labs/FLUX.1-schnell';

    const width = opts.width || 1080;
    const height = opts.height || 1080;

    const tryPollinationsAI = (p) => {
      logger.info(`[QwenService] Returning Pollinations AI direct URL for prompt: "${p}"`);
      const seed = Math.floor(Math.random() * 1000000);
      const url = `https://image.pollinations.ai/p/${encodeURIComponent(p)}?width=${width}&height=${height}&nologo=true&seed=${seed}`;
      return url;
    };

    if (!hfToken) {
      logger.info('[QwenService] HF_TOKEN is not configured. Returning Pollinations AI URL.');
      return tryPollinationsAI(prompt);
    }

    try {
      const endpoint = `https://router.huggingface.co/hf-inference/models/${hfModel}`;
      logger.info(`[QwenService] Calling Hugging Face image generation at: ${endpoint}`);

      let response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${hfToken}`,
          'x-use-cache': 'false'
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            width: width,
            height: height,
            seed: Math.floor(Math.random() * 1000000)
          },
          options: {
            use_cache: false,
            wait_for_model: true
          }
        })
      });

      // If HF returns 400 Bad Request, retry with a simplified payload containing only the inputs prompt
      if (response.status === 400) {
        logger.warn('[QwenService] HF API returned 400. Retrying with basic inputs payload...');
        response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${hfToken}`,
            'x-use-cache': 'false'
          },
          body: JSON.stringify({
            inputs: prompt,
            options: {
              use_cache: false,
              wait_for_model: true
            }
          })
        });
      }

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`HF API responded with status ${response.status}: ${errText}`);
      }

      const buffer = await response.arrayBuffer();
      const base64Data = Buffer.from(buffer).toString('base64');
      return `data:image/jpeg;base64,${base64Data}`;
    } catch (error) {
      logger.error('[QwenService] Hugging Face image generation failed. Returning Pollinations AI direct URL instead of server-side fetch to avoid rate limits:', error);
      return tryPollinationsAI(prompt);
    }
  }

  async analyzeImage(imageContent, prompt) {
    const geminiApiKey = process.env.GEMINI_API_KEY || null;
    if (!geminiApiKey) {
      logger.warn('[QwenService] GEMINI_API_KEY is not defined. Falling back to default text description.');
      return 'Image description fallback: A professional SaaS interface with modern dark mode theme and clean UI assets.';
    }

    try {
      let mimeType = 'image/jpeg';
      let base64Data = '';

      if (imageContent.startsWith('data:')) {
        const parts = imageContent.split(';base64,');
        mimeType = parts[0].replace('data:', '');
        base64Data = parts[1];
      } else {
        logger.info(`[QwenService] Fetching image from URL: "${imageContent}" for multimodal analysis.`);
        const response = await fetch(imageContent);
        if (!response.ok) {
          throw new Error(`Failed to fetch image URL: ${response.status}`);
        }
        const buffer = await response.arrayBuffer();
        base64Data = Buffer.from(buffer).toString('base64');
        const contentType = response.headers.get('content-type');
        if (contentType) mimeType = contentType;
      }

      let responseText = '';
      const modelsToTry = ['gemini-2.5-flash', 'gemini-3.1-flash-lite', 'gemini-2.0-flash', 'gemini-flash-latest'];
      let lastError = null;

      for (const model of modelsToTry) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;
          logger.info(`[QwenService] Sending image to Gemini model ${model} for analysis...`);
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    { text: prompt },
                    {
                      inlineData: {
                        mimeType: mimeType,
                        data: base64Data
                      }
                    }
                  ]
                }
              ]
            })
          });

          if (response.ok) {
            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (text) {
              responseText = text.trim();
              logger.info(`[QwenService] Gemini image analysis succeeded using model ${model}`);
              break;
            }
          } else {
            const errText = await response.text();
            logger.warn(`[QwenService] Gemini model ${model} failed: ${response.status} ${errText}`);
            lastError = new Error(`Gemini Multimodal API status ${response.status}: ${errText}`);
          }
        } catch (err) {
          logger.warn(`[QwenService] Request failed for model ${model}: ${err.message}`);
          lastError = err;
        }
      }

      if (!responseText) {
        throw lastError || new Error('All Gemini models failed for multimodal image analysis');
      }

      const resultText = responseText;
      logger.info(`[QwenService] Gemini image analysis completed. Output length: ${resultText.length} chars.`);
      return resultText;
    } catch (err) {
      logger.error('[QwenService] Gemini image analysis failed:', err.message || err);
      return 'Image description fallback: Modern UI dashboard mockup with minimalist graphs and custom colors.';
    }
  }

  async generate(type, options, userId = null) {
    dotenv.config({ override: true });
    
    // Check if Brand Brain is active and load profile
    let brandProfile = null;
    if (options.useBrandBrain && userId) {
      try {
        brandProfile = await brandProfileServiceInstance.getProfile(userId);
      } catch (err) {
        logger.error(`[QwenService] Failed to load brand profile: ${err.message}`);
      }
    }

    // Load AI learning profile for personalized content generation
    let learningProfile = null;
    if (userId && ['caption', 'post', 'hashtags', 'rewrite'].includes(type)) {
      try {
        const profile = await AiLearningProfile.findOne({ userId, learningEnabled: true });
        if (profile && profile.lastSnapshotSummary?.analysisQuality !== 'insufficient') {
          learningProfile = profile;
          logger.info(`[QwenService] Learning profile loaded for user ${userId} (quality: ${profile.lastSnapshotSummary?.analysisQuality})`);
        }
      } catch (err) {
        logger.warn(`[QwenService] Failed to load learning profile: ${err.message}`);
      }
    }
    
    if (type === 'optimize_prompt') {
      const topic = options.topic || '';
      let promptText = topic;
      if (options.keyPoints) {
        const points = options.keyPoints
          .split('\n')
          .map(p => p.replace(/^[-*•\s\d.]+|[-*•\s\d.]+$/g, '').trim())
          .filter(Boolean)
          .join(', ');
        if (points) {
          promptText += `, representing these details: ${points}`;
        }
      }
      logger.info(`[QwenService] Optimizing prompt for: "${promptText}"`);
      const enhanced = await this.enhancePrompt(promptText, options);
      return {
        success: true,
        result: enhanced,
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
      };
    }

    if (type === 'post') {
      const topic = options.topic || '';
      let enhancedPrompt = topic;

      if (!options.skipEnhance) {
        let promptText = topic;
        if (options.keyPoints) {
          const points = options.keyPoints
            .split('\n')
            .map(p => p.replace(/^[-*•\s\d.]+|[-*•\s\d.]+$/g, '').trim())
            .filter(Boolean)
            .join(', ');
          if (points) {
            promptText += `, representing these details: ${points}`;
          }
        }
        logger.info(`[QwenService] Post Creator enhancing prompt for topic: "${topic}"`);
        enhancedPrompt = await this.enhancePrompt(promptText, options);
      }

      logger.info(`[QwenService] Post Creator generating ONLY image for enhanced prompt: "${enhancedPrompt}"`);
      const mediaUrl = await this.generateImage(enhancedPrompt, {
        width: options.imageWidth ?? 1080,
        height: options.imageHeight ?? 1080,
        skipEnhance: true
      });

      return {
        success: true,
        result: "Image generated successfully based on your topic.",
        mediaUrl,
        enhancedPrompt,
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
      };
    }

    if ((type === 'caption' || type === 'hashtags') && options.image) {
      try {
        const visualDescription = await this.analyzeImage(options.image, 
          type === 'caption' 
            ? "Describe the visual details of this image in a single descriptive sentence for a social media copywriter. Focus on the main subject, setting, colors, and mood."
            : "List 10 descriptive keywords for this image, separated by commas."
        );
        options.imageDescription = visualDescription;
      } catch (err) {
        logger.error(`[QwenService] Failed to pre-analyze image: ${err.message}`);
      }
    }

    const apiKey = process.env.QWEN_API_KEY;
    const apiBase = this.resolveApiBase();
    const model = process.env.QWEN_MODEL || 'qwen-plus';
    const hfToken = process.env.HF_TOKEN || null;

    if (!apiKey) {
      logger.warn('QWEN_API_KEY is not defined. Falling back to mock response.');
      const resp = this.getMockResponse(type, options, brandProfile);
      resp.mockReason = 'missing_api_key';
      return resp;
    }

    if (!hfToken && (type === 'post' || type === 'caption') && options.mediaType === 'image') {
      logger.warn('HF_TOKEN is not configured. Image generation will fall back to Pollinations AI.');
    }
    if (!hfToken && type === 'post' && options.mediaType === 'carousel') {
      logger.warn('HF_TOKEN is not configured. Carousel images will fall back to Pollinations AI.');
    }

    const { systemPrompt: rawSystemPrompt, userPrompt } = this.buildPrompts(type, options, brandProfile);

    // Inject personalization context if a learning profile is available
    let systemPrompt = rawSystemPrompt;
    if (learningProfile) {
      const personalizationContext = this.buildPersonalizationContext(learningProfile);
      if (personalizationContext) {
        systemPrompt = `${personalizationContext}\n\n${rawSystemPrompt}`;
        logger.info(`[QwenService] Personalization context injected for type: ${type}`);
      }
    }

    const timeoutMs = parseInt(process.env.QWEN_TIMEOUT_MS, 10) || 180000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      logger.warn(`Qwen API request timed out after ${timeoutMs / 1000}s for type: ${type}. Aborting request.`);
      controller.abort();
    }, timeoutMs);

    try {
      const endpoint = `${apiBase.replace(/\/$/, '')}/chat/completions`;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: options.temperature ?? 0.5,
          max_tokens: options.maxTokens ?? (type.includes('carousel') || type === 'post' ? 1200 : 500)
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Qwen API responded with status ${response.status}`);
      }

      const data = await response.json();
      let text = data.choices[0]?.message?.content?.trim() || '';

      if (type === 'carousel_outline' || type === 'carousel_slides' || type === 'brand_brain_suggestions') {
        try {
          let jsonText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(jsonText);
          return {
            success: true,
            result: parsed,
            usage: data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
          };
        } catch (err) {
          logger.error(`Failed to parse ${type} JSON response:`, err);
          return {
            success: true,
            result: text,
            usage: data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
            parseError: true
          };
        }
      }

      if (type === 'keypoints' || type === 'cta') {
        const points = text.split('\n')
          .map(p => p.replace(/^[-*•\s\d.]+|[-*•\s\d.]+$/g, '').trim())
          .filter(Boolean)
          .slice(0, 5);
        return {
          success: true,
          result: points,
          usage: data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
        };
      }
      
      let mediaUrl = null;
      let carousel = null;

      if ((type === 'post' || type === 'caption') && options.mediaType && options.mediaType !== 'none') {
        if (options.mediaType === 'image') {
          let imgPrompt = '';
          if (options.mediaDescription && options.mediaDescription.trim()) {
            imgPrompt = options.mediaDescription.trim();
          }
          
          // Clean the LLM-generated prompt suffix if present in the text
          if (text.includes('---MEDIA-PROMPT---')) {
            text = text.split('---MEDIA-PROMPT---')[0].trim();
          }

          if (imgPrompt) {
            try {
              mediaUrl = await this.generateImage(imgPrompt, {
                width: options.imageWidth ?? 1080,
                height: options.imageHeight ?? 1080
              });
            } catch (imgError) {
              logger.warn('Image generation failed, falling back to LoremFlickr:', imgError);
              mediaUrl = this.getFallbackUrl(imgPrompt, options.imageWidth ?? 1080, options.imageHeight ?? 1080);
            }
          } else {
            logger.info('[QwenService] Media description prompt is empty. Skipping image generation.');
          }
        } else if (options.mediaType === 'video') {
          mediaUrl = this.getVideoUrl(options.topic, options.mediaDescription);
        } else if (options.mediaType === 'carousel') {
          try {
            let jsonText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(jsonText);
            if (Array.isArray(parsed)) {
              const slidesWithImages = [];
              for (const [idx, slide] of parsed.entries()) {
                let slideImageUrl = null;
                try {
                  slideImageUrl = await this.generateImage(slide.imagePrompt || options.topic || 'minimalist slide bg', {
                    width: 800,
                    height: 800
                  });
                } catch (imgError) {
                  logger.warn(`Hugging Face image generation failed for slide ${idx + 1}, falling back to LoremFlickr:`, imgError);
                  slideImageUrl = this.getFallbackUrl(slide.imagePrompt || options.topic || 'minimalist slide bg', 800, 800);
                }
                slidesWithImages.push({
                  slideNumber: idx + 1,
                  title: slide.title || `Slide ${idx + 1}`,
                  text: slide.text || '',
                  image: slideImageUrl
                });
              }
              carousel = slidesWithImages;
              text = `Generated a professional carousel deck containing ${carousel.length} slides.`;
            }
          } catch (err) {
            logger.error('Failed to parse carousel JSON:', err);
            // Return parsed fallback
            carousel = [
              {
                slideNumber: 1,
                title: options.topic || 'Introduction',
                text: text.substring(0, 150),
                image: await this.generateImage(options.topic || 'abstract tech background', {
                  width: 800,
                  height: 800
                }).catch(err => {
                  logger.warn('Hugging Face image generation failed for fallback, using LoremFlickr:', err);
                  return this.getFallbackUrl(options.topic || 'abstract tech background', 800, 800);
                })
              }
            ];
          }
        }
      }

      return {
        success: true,
        result: text,
        mediaUrl,
        carousel,
        usage: data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
      };
    } catch (error) {
      clearTimeout(timeoutId);
      
      logger.error('Error generating Qwen AI content, returning mock fallback response:', error);
      const mockResp = this.getMockResponse(type, options, brandProfile);
      mockResp.isMock = true;
      mockResp.isTimeoutFallback = error.name === 'AbortError';
      mockResp.mockReason = error.name === 'AbortError' ? 'api_timeout' : 'api_error';
      mockResp.errorMessage = error.message;
      return mockResp;
    }
  }

  /**
   * Build a concise personalization context block from the user's learning profile.
   * Injected at the TOP of the system prompt for content generation.
   */
  buildPersonalizationContext(profile) {
    if (!profile) return null;

    const parts = ['[PERSONALIZATION CONTEXT — Based on this user\'s historical performance data]'];

    if (profile.bestPlatforms?.length > 0) {
      parts.push(`- Best performing platforms: ${profile.bestPlatforms.join(', ')}`);
    }
    if (profile.audienceBehavior?.mostResponsivePlatform) {
      parts.push(`- Audience most responsive on: ${profile.audienceBehavior.mostResponsivePlatform}`);
    }
    if (profile.bestPostingDays?.length > 0) {
      parts.push(`- Best posting days: ${profile.bestPostingDays.slice(0, 2).join(' and ')}`);
    }
    if (profile.bestPostingHours?.length > 0) {
      const hourLabels = profile.bestPostingHours.slice(0, 2).map(h => {
        const ampm = h < 12 ? 'AM' : 'PM';
        const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
        return `${hour12}${ampm}`;
      });
      parts.push(`- Optimal posting time: ${hourLabels.join('–')}`);
    }
    if (profile.captionStyleInsights?.optimalLength) {
      parts.push(`- Optimal caption length: ${profile.captionStyleInsights.optimalLength} (based on past engagement)`);
    }
    if (profile.captionStyleInsights?.emojiUsage) {
      parts.push(`- Emoji usage pattern that works: ${profile.captionStyleInsights.emojiUsage}`);
    }
    if (profile.hashtagInsights?.topPerformingHashtags?.length > 0) {
      parts.push(`- Top performing hashtags: ${profile.hashtagInsights.topPerformingHashtags.slice(0, 5).join(' ')}`);
    }
    if (profile.lastSnapshotSummary?.avgEngagementRate > 0) {
      parts.push(`- Current average engagement rate: ${profile.lastSnapshotSummary.avgEngagementRate}%`);
    }

    if (profile.encryptedPostLearnings) {
      const decrypted = decrypt(profile.encryptedPostLearnings);
      if (decrypted) {
        try {
          const postLearnings = JSON.parse(decrypted);
          if (postLearnings.successfulContentTraits?.length > 0) {
            parts.push(`- Successful content traits from historical posts: ${postLearnings.successfulContentTraits.join(', ')}`);
          }
          if (postLearnings.successfulHashtagPatterns?.length > 0) {
            parts.push(`- Successful hashtag patterns from historical posts: ${postLearnings.successfulHashtagPatterns.join(', ')}`);
          }
          if (postLearnings.successfulPostingPatterns?.length > 0) {
            parts.push(`- Successful posting patterns from historical posts: ${postLearnings.successfulPostingPatterns.join(', ')}`);
          }
          if (postLearnings.successfulEngagementPatterns?.length > 0) {
            parts.push(`- Successful engagement patterns from historical posts: ${postLearnings.successfulEngagementPatterns.join(', ')}`);
          }
        } catch (err) {
          logger.warn(`[QwenService] Failed to parse decrypted postLearnings: ${err.message}`);
        }
      }
    }

    if (profile.latestSuggestions) {
      parts.push('\n[AI STRATEGY DIRECTIVES — Optimize copy using these analytics-backed recommendations]');
      const sug = profile.latestSuggestions;
      if (sug.performanceSummary) {
        parts.push(`- Performance summary context: ${sug.performanceSummary}`);
      }
      if (sug.captionRecommendations?.style) {
        parts.push(`- Formatting / Structure recommendation: ${sug.captionRecommendations.style}`);
      }
      if (sug.captionRecommendations?.toneAdvice) {
        parts.push(`- Tone of Voice guideline: ${sug.captionRecommendations.toneAdvice}`);
      }
      if (sug.hashtagRecommendations?.strategy) {
        parts.push(`- Hashtag placement strategy: ${sug.hashtagRecommendations.strategy}`);
      }
      if (sug.postingStrategy?.rationale) {
        parts.push(`- Campaign scheduling strategy context: ${sug.postingStrategy.rationale}`);
      }
    }

    parts.push('\nApply these patterns, tone guidelines, and growth insights naturally when generating the copy to maximize social growth.');

    return parts.length > 2 ? parts.join('\n') : null;
  }

  getVideoUrl(topic, description) {
    const text = `${topic} ${description || ''}`.toLowerCase();
    const videos = {
      tech: 'https://assets.mixkit.co/videos/preview/mixkit-code-running-on-a-computer-screen-files-40984-large.mp4',
      creative: 'https://assets.mixkit.co/videos/preview/mixkit-abstract-laser-lights-background-40924-large.mp4',
      business: 'https://assets.mixkit.co/videos/preview/mixkit-keyboard-typing-close-up-40974-large.mp4',
      coffee: 'https://assets.mixkit.co/videos/preview/mixkit-coffee-pouring-into-a-cup-392-large.mp4',
      social: 'https://assets.mixkit.co/videos/preview/mixkit-hand-holding-smartphone-with-a-social-media-app-42861-large.mp4'
    };

    if (text.includes('code') || text.includes('tech') || text.includes('program') || text.includes('developer') || text.includes('quantum') || text.includes('ai') || text.includes('server')) {
      return videos.tech;
    }
    if (text.includes('business') || text.includes('office') || text.includes('work') || text.includes('keyboard') || text.includes('typing') || text.includes('marketing')) {
      return videos.business;
    }
    if (text.includes('coffee') || text.includes('morning') || text.includes('cafe') || text.includes('food')) {
      return videos.coffee;
    }
    if (text.includes('phone') || text.includes('social') || text.includes('mobile') || text.includes('app')) {
      return videos.social;
    }
    return videos.creative;
  }

  buildPrompts(type, options, brandProfile = null) {
    let systemPrompt = '';
    let userPrompt = '';

    if (brandProfile && brandProfile.toneOfVoice) {
      options.tone = brandProfile.toneOfVoice;
    }

    switch (type) {
      case 'keypoints': {
        const { topic = '', platform = 'linkedin', isImage = false } = options;
        if (isImage) {
          systemPrompt = `You are an expert creative director and AI image prompt engineer. Analyze the following image topic or concept, and suggest 5 visual details, objects, style elements, or key details (e.g., lighting, camera angle, textures, aesthetics) that can be included in this image to make it look stunning and highly detailed.
Ensure that each of the 5 visual details is directly related to the specific image topic/concept: "${topic}". Do NOT generate generic visual details or details unrelated to "${topic}".
Keep each visual detail concise, punchy, and structured as a single phrase (max 12 words) with NO bullet characters, NO numbering, and NO quotes. 
Return ONLY the 5 visual details, each on a new line. Do not add any preamble, titles, or numbering.`;
          userPrompt = `Suggest 5 visual details specifically related to and describing: "${topic}"`;
        } else {
          systemPrompt = `You are an expert social media strategist and trend analyst. Analyze the following topic and suggest 5 trending, highly engaging, and personalized key points that the user can cover in their post for ${platform}.
Ensure that each of the 5 key points is directly related to the specific topic: "${topic}". Do NOT generate generic points or points unrelated to "${topic}".
Keep each key point concise, punchy, and structured as a single sentence or phrase (max 15 words) with NO bullet characters, NO numbering, and NO quotes. 
Return ONLY the 5 key points, each on a new line. Do not add any preamble, titles, or numbering.`;
          userPrompt = `Suggest 5 trending key points specifically related to and addressing the topic: "${topic}"`;
        }
        break;
      }

      case 'cta': {
        const { topic = '', platform = 'linkedin' } = options;
        systemPrompt = `You are an expert social media copywriter and growth marketer. Analyze the following topic/concept and suggest 5 highly engaging, platform-specific, and personalized Call to Actions (CTAs) for ${platform}.
Each CTA should encourage interaction (e.g., commenting, saving, sharing, subscribing, or asking direct questions).
Keep each CTA extremely concise and punchy (max 12 words) with NO bullet characters, NO numbering, and NO quotes.
Return ONLY the 5 CTAs, each on a new line. Do not add any preamble, titles, or numbering.`;
        userPrompt = `Suggest 5 personalized CTAs for the topic: "${topic}"`;
        break;
      }

      case 'caption': {
        const { platform = 'instagram', tone = 'engaging', length = 'medium', emojis = true, hashtags = true, topic = '', keyPoints = '', cta = '', imageDescription = '' } = options;
        systemPrompt = `You are a world-class social media viral copywriter. Your goal is to write a highly attractive, scroll-stopping, and extremely concise caption for ${platform} about: "${topic || 'the attached visual content'}".
It must sound like it was written by a real, intelligent human, NOT an AI generator.

CRITICAL TONE, CONCISENESS & CONTENT RULES:
1. NO AI CLICHÉS OR BUZZWORDS: Absolutely ban these phrases: "in today's fast-paced digital world", "unlock your potential", "elevate your workflow", "game-changer", "look no further", "delighted to share", "furthermore", "moreover", "in conclusion", "testament to", "revolutionize", "shaping the future".
2. BOLD SCROLL-STOPPING HOOK: Start directly with a hook (e.g., a contrarian take, a personal lesson, or an interesting observation). Do NOT start with greeting fluff or generic questions.
3. HUMAN-LIKE FLOW & SPACING: Use varied sentence lengths. Use short, 1-2 sentence paragraphs. Do not output blocks of text.
4. SUMMARIZE KEY POINTS NATURALLY:
${keyPoints ? `Weave the following key points naturally into the copy:
${keyPoints}` : `Seamlessly elaborate on the topic using key insights.`}
5. CALL TO ACTION:
${cta ? `End the caption with this specific Call to Action: "${cta}"` : `Include a natural call to action relevant to the topic.`}
6. TREND FRAMING: Connect the topic to current, real-world industry discussions or trending themes.
7. STRICT LENGTH CONTROL: Ensure the length matches the request: ${
  length === 'short' ? 'max 20-30 words (ultra-short, single punchy sentence or hook)' : length === 'long' ? 'max 70-85 words (concise, no filler)' : 'max 40-50 words (short and snappy)'
}. Keep it highly meaningful, concise, and punchy. Avoid long-winded paragraphs.
8. EMOJIS: ${emojis ? 'Use only 1-2 highly relevant emojis strategically. Do NOT spam emojis.' : 'Do NOT use any emojis.'}
9. HASHTAGS: ${hashtags ? 'Include 2-3 trending, highly specific hashtags at the very end.' : 'Do NOT use hashtags.'}

${imageDescription ? `Visual Content Details: The caption is for an image showing: "${imageDescription}". Reference this visual naturally in the copy to make the post highly cohesive.` : ''}

Format for the specific feed styling of ${platform}. Do NOT wrap the response in markdown blocks or quotes. Return ONLY the final caption text.`;
        userPrompt = `Generate a short, human-written, attractive caption for "${topic || 'this image'}".${keyPoints ? ` Ensure you cover these key points: ${keyPoints}` : ''}${cta ? ` End with CTA: ${cta}` : ''}`;
        break;
      }

      case 'post': {
        const { platform = 'linkedin', tone = 'engaging', topic = '', keyPoints = '', cta = '', mediaType = 'none', mediaDescription = '', imageDescription = '' } = options;
        
        if (mediaType === 'carousel') {
          systemPrompt = `You are a social media copywriting expert.
Generate a premium carousel slide deck on ${platform} for the topic: "${topic}".
- Tone: ${tone}
- Key Points to cover: ${keyPoints || 'Expand creatively'}
- Call to Action: ${cta || 'None'}
- Strict Rule: Do not use AI clichés like "in today's fast-paced digital world", "game-changer", "look no further". Keep titles and texts ultra short and punchy.

Format your entire response as a valid, parsable JSON array of objects. Do not wrap in markdown tags or \`\`\`json.
Each slide object must contain exactly:
1. "title": A short, punchy slide title (max 5 words).
2. "text": 1-2 highly engaging sentences of slide content.
3. "imagePrompt": A highly descriptive 5-word prompt for an image representing this slide.

Example:
[{"title": "Slide Title", "text": "Slide text here.", "imagePrompt": "Futuristic laptop glowing blue"}]`;
          userPrompt = `Generate a ${platform} carousel JSON array for: "${topic}"`;
        } else {
          systemPrompt = `You are an expert social media content creator. Generate a premium, highly engaging post for ${platform} about: "${topic}".
It must sound authentic, human-written, and attractive, avoiding corporate/AI fluff.

CRITICAL GUIDELINES:
1. BAN AI CLICHÉS: Absolutely do not use "in today's fast-paced digital world", "elevate your", "unlock your", "game-changer", "look no further", "delighted to share", "furthermore", "moreover", "in conclusion", "testament to", "revolutionize".
2. HOOK: Open with a powerful, conversational hook. No generic greetings or intros.
3. KEY POINTS: Incorporate the following key points naturally into the narrative flow of the post:
${keyPoints || 'No specific points, expand creatively.'}
4. STRUCTURE: Use varied sentence lengths. Break text into 1-2 sentence paragraphs with clean line breaks to optimize readability.
5. TONE & CTA: Use an authentic, ${tone} tone. End with this Call to Action: "${cta || 'None'}".
6. FORMATTING:
- If the platform is 'twitter' and the content exceeds 280 characters, format it as a cohesive Twitter thread. Separate each tweet in the thread with a line containing exactly three dashes '---'. Number each tweet.
- ${mediaType === 'image' ? `Since the user requested an image, you MUST append "---MEDIA-PROMPT---" at the very end of your response, followed by a highly descriptive 12-word prompt for an image generator representing the visual topic (e.g. "Minimalistic Workspace with Glowing Laptop, neon accents").` : ''}

Return ONLY the post content. Do not include markdown code block fences (like \`\`\`), labels, or meta-comments.`;
          userPrompt = `Create a human-written post about: "${topic}"`;
        }
        break;
      }

      case 'comment': {
        const { platform = 'linkedin', tone = 'engaging', originalText = '', stance = 'value-added' } = options;
        systemPrompt = `You are a professional social media networker. Generate a thoughtful comment/reply to a post on ${platform}.
- Original Post Content: "${originalText}"
- Goal/Stance of your reply: ${stance}
- Tone of comment: ${tone}

Make the comment sound natural, human-written, and directly engaged. Avoid generic praise.
Return ONLY the comment text. No intros, no explanations.`;
        userPrompt = `Generate a comment for this post.`;
        break;
      }

      case 'hashtags': {
        const { platform = 'instagram', count = 10, content = '', caption = '', imageDescription = '', focus = 'mixed' } = options;
        systemPrompt = `You are a search engine optimization and social media hashtags specialist. 
Generate exactly ${count} highly targeted, trending, and SEO-friendly hashtags for ${platform}.
${imageDescription ? `- Visual context of the post image: "${imageDescription}"` : ''}
${caption ? `- Post caption text: "${caption}"` : ''}
${content ? `- Post topic/concept: "${content}"` : ''}
- Hashtag focus: ${focus}

Return ONLY the hashtags, separated by spaces (e.g., #tag1 #tag2 #tag3). Do not include any other text.`;
        userPrompt = `Generate the hashtags.`;
        break;
      }

      case 'rewrite': {
        const { originalText = '', objective = 'more engaging', tone = 'professional' } = options;
        systemPrompt = `You are a master editor. Rewrite the following text:
"${originalText}"

- Objective: ${objective}
- Target Tone: ${tone}

Retain the core message but completely upgrade the writing quality and format.
Return ONLY the rewritten text, without explanations.`;
        userPrompt = `Rewrite the text.`;
        break;
      }

      case 'translate': {
        const { originalText = '', language = 'Spanish', tonePreservation = true } = options;
        systemPrompt = `You are a professional translator and localizer.
Translate the following text into ${language}:
"${originalText}"

${tonePreservation ? 'Preserve the exact tone, styling, emojis, line breaks, and hashtags.' : 'Optimize the tone for a native speaker.'}
Return ONLY the translated text. Do not add comments, translator notes, or quotes.`;
        userPrompt = `Translate the text.`;
        break;
      }

      case 'carousel_outline': {
        const { topic = '', platform = 'linkedin', slideCount = 5 } = options;
        systemPrompt = `You are an expert social media content designer and copywriter.
Analyze the user's topic and create a slide-by-slide outline for a high-converting carousel presentation on ${platform} (${slideCount} slides).
Format your entire response as a valid, parsable JSON array of objects. Do not wrap in markdown tags or \`\`\`json. Do not include any explanation or extra text.

Each slide object must contain exactly:
1. "slideNumber": The order of the slide (starting from 1).
2. "title": A short, hooky headline for this slide (max 5 words).
3. "concept": A brief visual description or focus of what this slide will display (max 10 words).

Example response format:
[
  {"slideNumber": 1, "title": "The Node.js Scaling Bottleneck", "concept": "Minimalist graphic showing slow server response"},
  {"slideNumber": 2, "title": "1. Blocked Event Loop", "concept": "Diagram of code running synchronously"}
]`;
        userPrompt = `Create a carousel outline for the topic: "${topic}" targeting ${platform} with ${slideCount} slides.`;
        break;
      }

      case 'carousel_slides': {
        const { topic = '', platform = 'linkedin', outline = [] } = options;
        systemPrompt = `You are a world-class social media viral copywriter and visual designer.
Take the following carousel outline and generate complete detailed slide content for each slide.
For each slide, you must write a highly compelling headline (title), 1-2 sentences of body copy (body) that are extremely concise and punchy, and a descriptive 5-word image prompt (imagePrompt) for generating the visual.

Format your entire response as a valid, parsable JSON array of objects. Do not wrap in markdown tags or \`\`\`json. Do not include any explanation or extra text.

Each slide object must contain exactly:
1. "slideNumber": The order of the slide (matching the outline).
2. "title": The slide headline (max 5 words).
3. "body": 1-2 highly engaging sentences of content.
4. "imagePrompt": A 5-word image prompt representing the slide's visual concept.

Example response format:
[
  {
    "slideNumber": 1,
    "title": "Scaling Node.js Backends",
    "body": "Cron jobs leak memory at scale under peak traffic. Decouple background workers to stay fast.",
    "imagePrompt": "Futuristic laptop glowing blue"
  }
]`;
        userPrompt = `Generate full slide contents for this outline: ${JSON.stringify(outline)} based on the topic: "${topic}".`;
        break;
      }

      case 'brand_brain_suggestions': {
        const { companyName = '', industry = '', products = '' } = options;
        systemPrompt = `You are an expert brand strategist and business consultant.
Your goal is to suggest a complete, detailed brand identity profile for a company based on its name and any partial details provided.
Format your entire response as a single valid, parsable JSON object. Do NOT wrap in markdown tags or \`\`\`json. Do NOT include any explanations or extra text.

The JSON object must contain exactly these fields:
1. "industry": A brief industry categorization (max 4 words).
2. "products": 2-3 prominent products they might sell (comma-separated, max 10 words).
3. "services": 2-3 prominent services they might offer (comma-separated, max 10 words).
4. "targetAudience": A short description of their target demographic/audience (max 12 words).
5. "toneOfVoice": A description of their brand's tone of voice (max 8 words).
6. "keywords": 4-5 core keywords relevant to their business (comma-separated, max 8 words).
7. "competitors": 2-3 main competitors they would have in this market (comma-separated, max 8 words).

Example response format:
{
  "industry": "Marketing Technology",
  "products": "AI Content Writer, Social Scheduler",
  "services": "Social media automation, branding strategy",
  "targetAudience": "SaaS founders, content creators, digital marketers",
  "toneOfVoice": "Professional, authoritative, yet innovative",
  "keywords": "automation, scheduler, copywriting, marketing",
  "competitors": "Buffer, Hootsuite, Jasper AI"
}`;
        userPrompt = `Suggest brand profile details for the company: "${companyName}"${industry ? `, in the industry: "${industry}"` : ''}${products ? `, selling: "${products}"` : ''}`;
        break;
      }

      default:
        systemPrompt = 'You are a helpful AI assistant.';
        userPrompt = `Process this request: ${JSON.stringify(options)}`;
      }

    if (brandProfile) {
      const parts = [];
      if (brandProfile.companyName) parts.push(`- Company Name: ${brandProfile.companyName}`);
      if (brandProfile.industry) parts.push(`- Industry: ${brandProfile.industry}`);
      if (brandProfile.products) parts.push(`- Products: ${brandProfile.products}`);
      if (brandProfile.services) parts.push(`- Services: ${brandProfile.services}`);
      if (brandProfile.targetAudience) parts.push(`- Target Audience: ${brandProfile.targetAudience}`);
      if (brandProfile.toneOfVoice) parts.push(`- Tone of Voice: ${brandProfile.toneOfVoice}`);
      if (brandProfile.keywords) parts.push(`- Core Keywords to weave in: ${brandProfile.keywords}`);
      if (brandProfile.competitors) parts.push(`- Competitors (to differentiate from): ${brandProfile.competitors}`);

      if (parts.length > 0) {
        systemPrompt = `${systemPrompt}\n\n[Brand Brain Directives]\nAdhere strictly to this brand profile while writing the content:\n${parts.join('\n')}\n`;
      }
    }

    return { systemPrompt, userPrompt };
  }

  getMockResponse(type, options, brandProfile = null) {
    let result = '';
    const topic = options.topic || options.content || '';
    const platform = options.platform || 'linkedin';
    const tone = options.tone || 'engaging';
    let mediaUrl = null;
    let carousel = null;

    if ((type === 'post' || type === 'caption') && options.mediaType && options.mediaType !== 'none') {
      if (options.mediaType === 'image') {
        const queryText = options.mediaDescription || options.topic || 'workspace,tech,modern';
        const keywords = queryText
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .split(/\s+/)
          .filter(w => w.length > 3 && !['with', 'glowing', 'neon', 'dark', 'light', 'themed', 'mockup', 'accent', 'sleek', 'modern', 'minimalist', 'minimalistic', 'workspace', 'background', 'abstract', 'technological', 'design'].includes(w))
          .slice(0, 3)
          .join(',');
        mediaUrl = `https://loremflickr.com/1080/1080/${encodeURIComponent(keywords || 'workspace,tech,modern')}`;
      } else if (options.mediaType === 'video') {
        mediaUrl = this.getVideoUrl(options.topic, options.mediaDescription);
      } else if (options.mediaType === 'carousel') {
        carousel = [
          {
            slideNumber: 1,
            title: 'Unlocking Node.js Scaling',
            text: 'Standard cron jobs cause memory leaks as traffic grows. Discover the modern way to decouple background workers.',
            image: `https://loremflickr.com/800/800/${encodeURIComponent('workspace,dark')}`
          },
          {
            slideNumber: 2,
            title: 'Leverage Redis & BullMQ',
            text: 'By processing messages on background threads, your API events stay lightning fast and highly responsive.',
            image: `https://loremflickr.com/800/800/${encodeURIComponent('database,network')}`
          },
          {
            slideNumber: 3,
            title: 'Start Scaling Today',
            text: 'Build seamless, fail-safe retries right out of the box with the Taraflow background task scheduler.',
            image: `https://loremflickr.com/800/800/${encodeURIComponent('analytics,dashboard')}`
          }
        ];
        result = 'Generated a professional carousel deck containing 3 slides.';
      }
    }

    if (!result) {
      switch (type) {
        case 'keypoints': {
          const cleanTopic = topic ? topic.trim() : 'the concept';
          if (options.isImage) {
            result = [
              `Cinematic high-resolution graphic showcasing ${cleanTopic}`,
              `Dramatic professional lighting designed for ${cleanTopic}`,
              `Focus on key visual elements of ${cleanTopic} with clean styling`,
              `Vibrant color palette and rich textures reflecting ${cleanTopic}`,
              `Modern, aesthetically balanced composition featuring ${cleanTopic}`
            ].join('\n');
          } else {
            result = [
              `Key insights and core values behind ${cleanTopic}.`,
              `How to optimize and implement best practices for ${cleanTopic}.`,
              `Common pitfalls and challenges when dealing with ${cleanTopic}.`,
              `Future trends and what to expect next in ${cleanTopic}.`,
              `Practical steps and tips to master ${cleanTopic} today.`
            ].join('\n');
          }
          break;
        }

        case 'carousel_outline':
          result = [
            { slideNumber: 1, title: 'The Node.js Scaling Bottleneck', concept: 'Minimalist graphic showing slow server response' },
            { slideNumber: 2, title: 'Why Cron Jobs Leak Memory', concept: 'Diagram showing event loop blockages' },
            { slideNumber: 3, title: 'Decoupling with Redis & BullMQ', concept: 'Illustration of background worker threads' },
            { slideNumber: 4, title: 'Optimizing API Performance', concept: 'Graph showing under 100ms response times' },
            { slideNumber: 5, title: 'Scale Your Backends Today', concept: 'Call to Action screen with brand logo' }
          ];
          break;

        case 'carousel_slides':
          result = [
            {
              slideNumber: 1,
              title: 'Scaling Node.js Backends',
              body: 'Cron jobs leak memory at scale under peak traffic. Discover the modern way to decouple background workers.',
              imagePrompt: 'Futuristic laptop glowing blue'
            },
            {
              slideNumber: 2,
              title: 'Why Cron Jobs Fail',
              body: 'Traditional cron jobs run inside your main API thread, blocking the event loop and hurting response times.',
              imagePrompt: 'Server rack overheating red warning'
            },
            {
              slideNumber: 3,
              title: 'Decouple with Redis',
              body: 'By processing messages on background threads, your API events stay lightning fast and highly responsive.',
              imagePrompt: 'Database network nodes interconnected white'
            },
            {
              slideNumber: 4,
              title: 'Keep Response < 100ms',
              body: 'Push long-running processes to queue workers. Keep your client experience seamless and lag-free.',
              imagePrompt: 'Sleek dark analytical line chart'
            },
            {
              slideNumber: 5,
              title: 'Get Started with Taraflow',
              body: 'Build seamless, fail-safe retries right out of the box with the Taraflow background task scheduler.',
              imagePrompt: 'Clean minimalist workspace dark theme'
            }
          ];
          break;

        case 'cta':
          result = [
            `Have you hit queue scaling bottlenecks? Let's discuss in the comments!`,
            `What is your go-to message broker for Node.js? Share below!`,
            `Save this post if you plan to scale your background workers soon.`,
            `Hit follow for more deep-dives into modern backend architecture.`,
            `How do you handle memory leaks in production? Drop your tips below!`
          ].join('\n');
          break;

        case 'caption':
          result = `🚀 Ready to elevate your workflow? Here is a simple guide to scaling background tasks.\n\nKey takeaways:\n- Decouple queues with Redis & BullMQ\n- Optimize database index performance\n- Keep controllers super thin\n\nWhat are you working on today? Let me know! 👇\n\n#productivity #tech #development #saas`;
          break;
        case 'post':
          if (platform === 'twitter') {
            result = `1/ Stop using basic cron jobs for background worker systems in Node.js. It's a recipe for memory leaks and blocked event loops as you scale. 🧵\n\n---\n2/ Instead, decouple your architecture using Redis and BullMQ. This lets you distribute tasks across worker instances without slowing down your API endpoints.\n\n---\n3/ We integrated this pattern in Taraflow.ai, and it reduced server response times by 40% under peak load. Give it a try! #nodejs #systemdesign`;
          } else {
            result = `💡 Let's talk about building high-fidelity products in 2026.\n\nMany developers think a Minimum Viable Product (MVP) means sacrificing design quality. But in a crowded market, aesthetics ARE a feature.\n\nBy prioritizing dynamic dark modes, customized HSL colors, and micro-animations, you build immediate trust. It shows you care about the details.\n\nWhat's your take? Do you prioritize design or ship pure logic first? Let's discuss! 👇\n\n#saas #design #webdevelopment #uidesign`;
          }
          break;
        case 'hashtags':
          result = `#socialmedia #contentstrategy #marketingtips #aiwriting #digitalmarketing #productivity #growthhacking #saasgrowth`;
          break;
        case 'rewrite':
          result = `Stop relying on default browser styles. If your web app looks basic, you've already lost the user's attention. Implement sleek dark modes, custom typography (like Inter or Outfit), and fluid hover effects. A premium interface isn't a luxury—it's a requirement.`;
          break;
        case 'brand_brain_suggestions':
          result = {
            industry: "Technology & Software",
            products: "BullMQ Scheduler, AI Writer Studio",
            services: "SaaS automation, brand consulting",
            targetAudience: "Developers, content creators, marketers",
            toneOfVoice: "Professional, clean, and futuristic",
            keywords: "scheduler, task queue, copywriter, dark mode",
            competitors: "Hootsuite, Jasper AI, Buffer"
          };
          break;
        default:
          result = 'This is a mock response from the AI Content Studio service.';
      }
    }

    if (brandProfile && result && typeof result === 'string') {
      const brandSuffix = `\n\n[Brand Brain Active]\nCrafted for ${brandProfile.companyName || 'Brand'} in the ${brandProfile.industry || 'specified'} industry. Target Audience: ${brandProfile.targetAudience || 'General'}. Tone: ${brandProfile.toneOfVoice || 'Engaging'}. Keywords: ${brandProfile.keywords || 'None'}.`;
      result += brandSuffix;
    }

    return {
      success: true,
      result,
      mediaUrl,
      carousel,
      isMock: true,
      usage: { prompt_tokens: 15, completion_tokens: 85, total_tokens: 100 }
    };
  }
}

export const qwenServiceInstance = new QwenService();
export default qwenServiceInstance;