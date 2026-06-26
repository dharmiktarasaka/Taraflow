import competitorIntelligenceServiceInstance from '../services/competitorIntelligence.service.js';
import CompetitorAnalysis from '../models/competitorAnalysis.model.js';
import { competitorQueue } from '../queues/competitor.queue.js';
import { getRedisClient } from '../config/redis.config.js';
import { NotFoundError, BadRequestError, UnauthorizedError } from '../utils/errors.util.js';
import path from 'path';
import fs from 'fs';
import logger from '../utils/logger.util.js';

class CompetitorController {
  /**
   * Auto-detect competitors based on user's Brand Profile
   */
  async detectCompetitors(req, res, next) {
    try {
      const userId = req.user.id || req.user._id;
      const result = await competitorIntelligenceServiceInstance.detectCompetitors(userId);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Start a competitor analysis (triggers background BullMQ task)
   */
  async startAnalysis(req, res, next) {
    try {
      logger.info(`[CompetitorController] startAnalysis called. req.user: ${JSON.stringify(req.user)}, req.body: ${JSON.stringify(req.body)}`);
      const userId = req.user.id || req.user._id;
      const { targetCompetitors } = req.body;

      if (!targetCompetitors || !Array.isArray(targetCompetitors)) {
        throw new BadRequestError('targetCompetitors must be an array of competitor objects.');
      }

      if (targetCompetitors.length === 0) {
        throw new BadRequestError('Please provide at least one competitor to analyze.');
      }

      if (targetCompetitors.length > 5) {
        throw new BadRequestError('You can analyze a maximum of 5 competitors at a time.');
      }

      // Validate each competitor has a name and valid metrics if supplied
      for (const comp of targetCompetitors) {
        if (!comp.name || typeof comp.name !== 'string') {
          throw new BadRequestError('Each competitor must have a valid name.');
        }
        if (comp.followers !== undefined && comp.followers !== null && comp.followers !== '') {
          const val = Number(comp.followers);
          if (isNaN(val) || val < 0) {
            throw new BadRequestError(`Followers count for "${comp.name}" must be a non-negative number.`);
          }
        }
        if (comp.rating !== undefined && comp.rating !== null && comp.rating !== '') {
          const val = Number(comp.rating);
          if (isNaN(val) || val < 0 || val > 5) {
            throw new BadRequestError(`Rating for "${comp.name}" must be a number between 0 and 5.`);
          }
        }
        if (comp.reviewsCount !== undefined && comp.reviewsCount !== null && comp.reviewsCount !== '') {
          const val = Number(comp.reviewsCount);
          if (isNaN(val) || val < 0) {
            throw new BadRequestError(`Reviews count for "${comp.name}" must be a non-negative number.`);
          }
        }
      }

      // Create pending competitor analysis record
      const analysisObj = await CompetitorAnalysis.create({
        user: userId,
        status: 'pending',
        targetCompetitors: targetCompetitors.map(c => ({
          name: c.name,
          website: c.website || '',
          socialHandles: {
            facebook: c.socialHandles?.facebook || '',
            instagram: c.socialHandles?.instagram || '',
            threads: c.socialHandles?.threads || '',
            linkedin: c.socialHandles?.linkedin || '',
          },
          followers: c.followers !== undefined && c.followers !== null && c.followers !== '' ? Number(c.followers) : null,
          rating: c.rating !== undefined && c.rating !== null && c.rating !== '' ? Number(c.rating) : null,
          reviewsCount: c.reviewsCount !== undefined && c.reviewsCount !== null && c.reviewsCount !== '' ? Number(c.reviewsCount) : null,
        }))
      });

      // Enqueue background job (with in-process fallback if Redis is down)
      const redisClient = getRedisClient();
      if (!redisClient) {
        logger.warn(`[CompetitorController] Redis is not running. Running analysis in-process asynchronously for ID: ${analysisObj._id}`);
        competitorIntelligenceServiceInstance.runFullAnalysis(analysisObj._id.toString()).catch(err => {
          logger.error(`[CompetitorController] In-process analysis fallback failed for ID ${analysisObj._id}:`, err);
        });
      } else {
        try {
          await competitorQueue.add(`analyze-competitors-${analysisObj._id}`, {
            analysisId: analysisObj._id.toString()
          });
          logger.info(`[CompetitorController] Analysis job enqueued in BullMQ for user ${userId}. Analysis ID: ${analysisObj._id}`);
        } catch (queueErr) {
          logger.error(`[CompetitorController] Failed to add job to BullMQ queue, falling back to in-process execution:`, queueErr);
          competitorIntelligenceServiceInstance.runFullAnalysis(analysisObj._id.toString()).catch(err => {
            logger.error(`[CompetitorController] In-process analysis fallback failed for ID ${analysisObj._id}:`, err);
          });
        }
      }

      return res.status(202).json({
        success: true,
        message: 'Competitor analysis job started in background.',
        analysisId: analysisObj._id.toString(),
        analysis: analysisObj
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get the current status/results of a specific analysis
   */
  async getAnalysisStatus(req, res, next) {
    try {
      const userId = req.user.id || req.user._id;
      const { id } = req.params;

      const analysisObj = await CompetitorAnalysis.findById(id);
      if (!analysisObj) {
        throw new NotFoundError('Competitor analysis record not found.');
      }

      // Security check: ensure only the owner can access this record
      if (analysisObj.user.toString() !== userId.toString()) {
        throw new UnauthorizedError('Unauthorized access to this competitor report.');
      }

      return res.status(200).json({
        success: true,
        analysis: analysisObj
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Download generated report file (PDF/DOCX)
   */
  async downloadReport(req, res, next) {
    try {
      const userId = req.user.id || req.user._id;
      const { id, format } = req.params;

      if (format !== 'pdf' && format !== 'docx') {
        throw new BadRequestError('Invalid file format requested. Must be "pdf" or "docx".');
      }

      const analysisObj = await CompetitorAnalysis.findById(id);
      if (!analysisObj) {
        throw new NotFoundError('Competitor analysis record not found.');
      }

      // Security check: ensure only the owner can download
      if (analysisObj.user.toString() !== userId.toString()) {
        throw new UnauthorizedError('Unauthorized download request.');
      }

      if (analysisObj.status !== 'completed') {
        throw new BadRequestError(`Report cannot be downloaded yet. Current status: ${analysisObj.status}`);
      }

      const fileName = `competitor_analysis_${id}.${format}`;
      const filePath = path.resolve('reports', fileName);

      if (!fs.existsSync(filePath)) {
        throw new NotFoundError(`The requested ${format.toUpperCase()} file does not exist on the server filesystem.`);
      }

      // Set download headers
      res.setHeader('Content-Type', format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);

      const fileStream = fs.createReadStream(filePath);
      fileStream.on('error', (err) => {
        logger.error(`Error streaming file ${filePath}:`, err);
        if (!res.headersSent) {
          res.status(500).json({ success: false, message: 'Error downloading report file' });
        }
      });

      fileStream.pipe(res);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Automatically schedule drafts and review posts in social post publishers
   */
  async acceptRecommendations(req, res, next) {
    try {
      const userId = req.user.id || req.user._id;
      const { analysisId } = req.body;

      if (!analysisId) {
        throw new BadRequestError('analysisId is required.');
      }

      const analysisObj = await CompetitorAnalysis.findById(analysisId);
      if (!analysisObj) {
        throw new NotFoundError('Competitor analysis record not found.');
      }

      // Security check
      if (analysisObj.user.toString() !== userId.toString()) {
        throw new UnauthorizedError('Unauthorized action.');
      }

      const result = await competitorIntelligenceServiceInstance.acceptRecommendations(userId, analysisId);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Fetch all analyses run by this user
   */
  async getUserAnalyses(req, res, next) {
    try {
      const userId = req.user.id || req.user._id;
      const analyses = await CompetitorAnalysis.find({ user: userId }).sort({ createdAt: -1 });
      return res.status(200).json({
        success: true,
        analyses
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Delete a competitor analysis run by this user
   */
  async deleteAnalysis(req, res, next) {
    try {
      const userId = req.user.id || req.user._id;
      const { id } = req.params;

      if (!id) {
        throw new BadRequestError('Analysis ID is required.');
      }

      const analysisObj = await CompetitorAnalysis.findById(id);
      if (!analysisObj) {
        throw new NotFoundError('Competitor analysis record not found.');
      }

      // Security check
      if (analysisObj.user.toString() !== userId.toString()) {
        throw new UnauthorizedError('Unauthorized action.');
      }

      await CompetitorAnalysis.findByIdAndDelete(id);

      return res.status(200).json({
        success: true,
        message: 'Competitor analysis record deleted successfully.'
      });
    } catch (err) {
      next(err);
    }
  }
}

export const competitorControllerInstance = new CompetitorController();
export default competitorControllerInstance;
