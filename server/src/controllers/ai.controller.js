import { qwenServiceInstance } from '../services/qwen.service.js';
import { BadRequestError } from '../utils/errors.util.js';
import AIUsage from '../models/aiUsage.model.js';
import logger from '../utils/logger.util.js';

class AIController {
  async generateContent(req, res, next) {
    try {
      const { type, options } = req.body;

      if (!type) {
        throw new BadRequestError('Generation type is required');
      }

      const validTypes = ['caption', 'post', 'hashtags', 'rewrite', 'translate', 'keypoints', 'cta', 'carousel_outline', 'carousel_slides', 'brand_brain_suggestions', 'optimize_prompt'];
      if (!validTypes.includes(type)) {
        throw new BadRequestError(`Invalid generation type. Must be one of: ${validTypes.join(', ')}`);
      }

      if (!options || typeof options !== 'object') {
        throw new BadRequestError('Generation options object is required');
      }

      // Specific quick validations depending on type
      if (type === 'keypoints' && !options.topic) {
        throw new BadRequestError('Topic is required for keypoints generation');
      }
      if (type === 'cta' && !options.topic) {
        throw new BadRequestError('Topic is required for CTA generation');
      }
      if (type === 'caption' && !options.topic) {
        throw new BadRequestError('Topic is required for caption generation');
      }
      if (type === 'post' && !options.topic) {
        throw new BadRequestError('Topic is required for post generation');
      }
      if (type === 'carousel_outline' && !options.topic) {
        throw new BadRequestError('Topic is required for carousel outline generation');
      }
      if (type === 'carousel_slides' && (!options.topic || !options.outline)) {
        throw new BadRequestError('Topic and Outline are required for carousel slides generation');
      }
      if (type === 'hashtags' && !options.content && !options.caption && !options.image) {
        throw new BadRequestError('Content/topic, caption, or image is required for hashtag generation');
      }
      if (type === 'rewrite' && !options.originalText) {
        throw new BadRequestError('Original text is required for rewriting');
      }
      if (type === 'translate' && (!options.originalText || !options.language)) {
        throw new BadRequestError('Original text and target language are required for translation');
      }
      if (type === 'brand_brain_suggestions' && !options.companyName) {
        throw new BadRequestError('Company Name is required for brand brain suggestions generation');
      }

      const response = await qwenServiceInstance.generate(type, options, req.user?.id);

      // Log AI Usage asynchronously in database
      if (req.user?.id) {
        try {
          const promptTokens = response.usage?.prompt_tokens || 20;
          const completionTokens = response.usage?.completion_tokens || 80;
          const totalTokens = response.usage?.total_tokens || (promptTokens + completionTokens);

          await AIUsage.create({
            userId: req.user.id,
            type,
            promptTokens,
            completionTokens,
            totalTokens
          });
        } catch (dbErr) {
          logger.error(`[AIController] Failed to log AI usage to database: ${dbErr.message}`);
        }
      }

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}

// Force nodemon reload to load Qwen .env variables (attempt 2)

export const aiControllerInstance = new AIController();
