import Analytics from '../models/analytics.model.js';
import Post from '../models/post.model.js';
import { BadRequestError } from '../utils/errors.util.js';

class AnalyticsController {
  /**
   * Get aggregated KPI performance stats and timeline charts data
   */
  async getOverview(req, res, next) {
    try {
      const userId = req.user.id;
      const { platform = 'all', days = 30 } = req.query;

      const numDays = parseInt(days, 10) || 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - numDays);

      // Find analytics snapshots within the time range
      const query = {
        userId,
        date: { $gte: startDate },
        platform
      };

      const metrics = await Analytics.find(query).sort({ date: 1 });

      if (metrics.length === 0) {
        return res.status(200).json({
          success: true,
          hasData: false,
          summary: {
            impressions: 0,
            reach: 0,
            followers: 0,
            engagementRate: 0,
            changeImpressions: '+0%',
            changeReach: '+0%',
            changeFollowers: '+0%',
            changeEngagement: '+0%'
          },
          timeline: []
        });
      }

      // Aggregate overview metric stats
      const totalImpressions = metrics.reduce((sum, m) => sum + m.impressions, 0);
      const totalReach = metrics.reduce((sum, m) => sum + m.reach, 0);
      const latestSnapshot = metrics[metrics.length - 1];
      const earliestSnapshot = metrics[0];

      const avgEngagementRate = metrics.reduce((sum, m) => sum + m.engagementRate, 0) / metrics.length;

      // Calculate growth percentages
      const followerGrowth = latestSnapshot.followers - earliestSnapshot.followers;
      const growthPct = earliestSnapshot.followers > 0 
        ? ((followerGrowth / earliestSnapshot.followers) * 100).toFixed(1) 
        : '0.0';

      const reachChange = earliestSnapshot.reach > 0
        ? (((latestSnapshot.reach - earliestSnapshot.reach) / earliestSnapshot.reach) * 100).toFixed(1)
        : '0.0';

      const impressionsChange = earliestSnapshot.impressions > 0
        ? (((latestSnapshot.impressions - earliestSnapshot.impressions) / earliestSnapshot.impressions) * 100).toFixed(1)
        : '0.0';

      const engagementChange = earliestSnapshot.engagementRate > 0
        ? (((latestSnapshot.engagementRate - earliestSnapshot.engagementRate) / earliestSnapshot.engagementRate) * 100).toFixed(1)
        : '0.0';

      res.status(200).json({
        success: true,
        hasData: true,
        summary: {
          impressions: latestSnapshot.impressions, // current total
          reach: latestSnapshot.reach,
          followers: latestSnapshot.followers,
          engagementRate: parseFloat(avgEngagementRate.toFixed(2)),
          changeImpressions: `${parseFloat(impressionsChange) >= 0 ? '+' : ''}${impressionsChange}%`,
          changeReach: `${parseFloat(reachChange) >= 0 ? '+' : ''}${reachChange}%`,
          changeFollowers: `${parseFloat(growthPct) >= 0 ? '+' : ''}${growthPct}%`,
          changeEngagement: `${parseFloat(engagementChange) >= 0 ? '+' : ''}${engagementChange}%`
        },
        timeline: metrics.map(m => ({
          date: m.date.toISOString().split('T')[0],
          impressions: m.impressions,
          reach: m.reach,
          followers: m.followers,
          engagementRate: parseFloat(m.engagementRate.toFixed(2))
        }))
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get top performing content lists
   */
  async getTopPosts(req, res, next) {
    try {
      const userId = req.user.id;
      const { limit = 5, sortBy = 'engagementRate' } = req.query;

      const validSorts = ['engagementRate', 'reach', 'likes', 'impressions'];
      const sortField = validSorts.includes(sortBy) ? sortBy : 'engagementRate';

      const posts = await Post.find({
        createdBy: userId,
        status: 'PUBLISHED'
      })
      .sort({ [sortField]: -1 })
      .limit(parseInt(limit, 10) || 5);

      res.status(200).json({
        success: true,
        posts
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Seed Mock Analytics Metrics for demonstration/testing
   */
  async seedMetrics(req, res, next) {
    try {
      const userId = req.user.id;

      // 1. Delete any existing Analytics records for this user
      await Analytics.deleteMany({ userId });

      // 2. Generate 30 days of metrics
      const records = [];
      let currentFollowers = Math.floor(Math.random() * 1500) + 1200; // start base
      
      const platforms = ['all', 'linkedin', 'instagram', 'facebook', 'threads'];
      
      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);

        // Daily growth modifiers
        const dailyNewFollowers = Math.floor(Math.random() * 25) + 3;
        currentFollowers += dailyNewFollowers;

        platforms.forEach(platform => {
          let platformMultiplier = 1;
          if (platform === 'linkedin') platformMultiplier = 0.4;
          if (platform === 'instagram') platformMultiplier = 0.3;
          if (platform === 'facebook') platformMultiplier = 0.2;
          if (platform === 'threads') platformMultiplier = 0.1;

          // Add randomized fluctuation peaks
          const peakFluctuation = (Math.sin(i / 1.5) + 1) * 1.5 + (Math.random() * 0.8);
          const reach = Math.floor((400 + Math.floor(Math.random() * 800)) * platformMultiplier * peakFluctuation);
          const impressions = Math.floor(reach * (1.2 + Math.random() * 0.5));
          
          const likes = Math.floor(reach * (0.05 + Math.random() * 0.08));
          const comments = Math.floor(likes * (0.1 + Math.random() * 0.15));
          const shares = Math.floor(likes * (0.08 + Math.random() * 0.1));

          const engagementRate = reach > 0 
            ? parseFloat((((likes + comments + shares) / reach) * 100).toFixed(2)) 
            : 0;

          records.push({
            userId,
            date,
            platform,
            followers: platform === 'all' ? currentFollowers : Math.floor(currentFollowers * platformMultiplier),
            impressions,
            reach,
            likes,
            comments,
            shares,
            engagementRate
          });
        });
      }

      await Analytics.insertMany(records);

      // 3. Update existing posts or seed mock top posts
      const userPostsCount = await Post.countDocuments({ createdBy: userId });
      
      if (userPostsCount === 0) {
        // Create 3 demo published posts if none exist
        const demoPosts = [
          {
            content: "We decouple background workers using Redis & BullMQ to keep API endpoints under 100ms. Decoupled tasks run safely without blocking Node's main thread.",
            platform: 'linkedin',
            status: 'PUBLISHED',
            scheduledAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            publishedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            createdBy: userId,
            likes: 142,
            comments: 24,
            shares: 18,
            impressions: 4850,
            reach: 3980,
            engagementRate: 4.62
          },
          {
            content: "Elevate your web app designs with rich aesthetics. Harmonies in CSS gradients, Inter fonts, and glassmorphic panels will wow your users at first glance! 🎨🚀",
            platform: 'instagram',
            status: 'PUBLISHED',
            scheduledAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
            publishedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
            createdBy: userId,
            likes: 198,
            comments: 32,
            shares: 41,
            impressions: 8900,
            reach: 6500,
            engagementRate: 4.17
          },
          {
            content: "Never rely on browser default styles. If your interface looks basic, you have already lost the user's focus. Sleek dark modes and subtle micro-animations are the standard. #uidesign",
            platform: 'threads',
            status: 'PUBLISHED',
            scheduledAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            publishedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            createdBy: userId,
            likes: 64,
            comments: 8,
            shares: 12,
            impressions: 2100,
            reach: 1850,
            engagementRate: 4.54
          }
        ];
        await Post.insertMany(demoPosts);
      } else {
        // Randomly populate metrics on existing user posts
        const userPosts = await Post.find({ createdBy: userId });
        for (const post of userPosts) {
          const reach = Math.floor(Math.random() * 4000) + 300;
          const impressions = Math.floor(reach * (1.2 + Math.random() * 0.4));
          const likes = Math.floor(reach * (0.04 + Math.random() * 0.08));
          const comments = Math.floor(likes * (0.1 + Math.random() * 0.15));
          const shares = Math.floor(likes * (0.05 + Math.random() * 0.1));
          const engagementRate = reach > 0 ? parseFloat((((likes + comments + shares) / reach) * 100).toFixed(2)) : 0;

          await Post.updateOne(
            { _id: post._id },
            {
              $set: {
                status: 'PUBLISHED',
                likes,
                comments,
                shares,
                impressions,
                reach,
                engagementRate
              }
            }
          );
        }
      }

      res.status(200).json({
        success: true,
        message: 'Metrics seeded successfully!'
      });
    } catch (error) {
      next(error);
    }
  }
}

export const analyticsControllerInstance = new AnalyticsController();
export default analyticsControllerInstance;
