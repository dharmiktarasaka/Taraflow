import SocialAccount from '../models/socialAccount.model.js';
import { getAuthUrl, exchangeCodeAndFetchProfile } from '../services/socialOAuth.service.js';
import { getRedisClient } from '../config/redis.config.js';
import logger from '../utils/logger.util.js';

class SocialController {
  async getAccounts(req, res, next) {
    try {
      const accounts = await SocialAccount.find({ user: req.user.id })
        .select('-accessToken -refreshToken')
        .sort({ createdAt: -1 });

      const enriched = accounts.map(acc => {
        const isExpired = acc.expiresAt && new Date(acc.expiresAt) < new Date();
        const canRefresh = ['linkedin'].includes(acc.platform);
        return {
          _id: acc._id,
          platform: acc.platform,
          platformAccountId: acc.platformAccountId,
          platformUsername: acc.platformUsername,
          profilePicture: acc.profilePicture,
          expiresAt: acc.expiresAt,
          status: isExpired ? 'expired' : 'connected',
          needsReconnect: isExpired && !canRefresh,
          createdAt: acc.createdAt,
          updatedAt: acc.updatedAt,
        };
      });

      res.status(200).json({
        success: true,
        data: enriched,
      });
    } catch (error) {
      next(error);
    }
  }

  async getConnectUrl(req, res, next) {
    try {
      const { platform } = req.params;
      const state = req.query.state || 'default_state';

      const authUrl = getAuthUrl(platform, state);

      res.status(200).json({
        success: true,
        data: { authUrl },
      });
    } catch (error) {
      next(error);
    }
  }

  async callback(req, res, next) {
    try {
      const { platform } = req.params;
      const { code } = req.body;

      if (!code) {
        return res.status(400).json({
          success: false,
          message: 'OAuth authorization code is required',
        });
      }

      const profileData = await exchangeCodeAndFetchProfile(platform, code);

      const account = await SocialAccount.findOneAndUpdate(
        {
          user: req.user.id,
          platform,
          platformAccountId: profileData.platformAccountId,
        },
        {
          ...profileData,
          user: req.user.id,
          platform,
        },
        {
          new: true,
          upsert: true,
        }
      );

      // Invalidate user analytics Redis cache on connection
      const redisClient = getRedisClient();
      if (redisClient) {
        try {
          const userId = req.user.id;
          const keys = await redisClient.keys(`user:analytics:${userId}:*`);
          const topPostKeys = await redisClient.keys(`user:topposts:${userId}:*`);
          const allKeys = [...keys, ...topPostKeys];
          if (allKeys.length > 0) {
            await redisClient.del(allKeys);
            logger.info(`[Social Connect Cache Invalidate] Deleted ${allKeys.length} cache keys for user ${userId}`);
          }
        } catch (cacheErr) {
          logger.warn(`[Social Connect Cache Invalidate] Failed to invalidate cache: ${cacheErr.message}`);
        }
      }

      res.status(200).json({
        success: true,
        message: `${platform.charAt(0).toUpperCase() + platform.slice(1)} account connected successfully!`,
        data: {
          _id: account._id,
          platform: account.platform,
          platformAccountId: account.platformAccountId,
          platformUsername: account.platformUsername,
          profilePicture: account.profilePicture,
          expiresAt: account.expiresAt,
          status: 'connected',
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async reconnectAccount(req, res, next) {
    try {
      const { platform } = req.params;
      const state = req.query.state || `reconnect_${Date.now()}`;

      const existing = await SocialAccount.findOne({
        user: req.user.id,
        platform,
      });

      if (!existing) {
        return res.status(404).json({
          success: false,
          message: `No existing ${platform} account found to reconnect. Connect a new one instead.`,
        });
      }

      const authUrl = getAuthUrl(platform, state);

      res.status(200).json({
        success: true,
        data: { authUrl, reconnectId: existing._id },
      });
    } catch (error) {
      next(error);
    }
  }

  async disconnectAccount(req, res, next) {
    try {
      const { id } = req.params;

      const deleted = await SocialAccount.findOneAndDelete({
        _id: id,
        user: req.user.id,
      });

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Social account connection not found',
        });
      }

      // Invalidate user analytics Redis cache on disconnection
      const redisClient = getRedisClient();
      if (redisClient) {
        try {
          const userId = req.user.id;
          const keys = await redisClient.keys(`user:analytics:${userId}:*`);
          const topPostKeys = await redisClient.keys(`user:topposts:${userId}:*`);
          const allKeys = [...keys, ...topPostKeys];
          if (allKeys.length > 0) {
            await redisClient.del(allKeys);
            logger.info(`[Social Disconnect Cache Invalidate] Deleted ${allKeys.length} cache keys for user ${userId}`);
          }
        } catch (cacheErr) {
          logger.warn(`[Social Disconnect Cache Invalidate] Failed to invalidate cache: ${cacheErr.message}`);
        }
      }

      res.status(200).json({
        success: true,
        message: 'Social account disconnected successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const socialControllerInstance = new SocialController();
