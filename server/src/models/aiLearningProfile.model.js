import mongoose from 'mongoose';

/**
 * AiLearningProfile
 *
 * Stores aggregated performance insights per user for AI personalization.
 * Privacy principles:
 *  - 1:1 isolation per userId (unique index).
 *  - Only aggregated stats are stored; no raw post content, no PII.
 *  - learningEnabled flag allows GDPR opt-out.
 *  - Document can be hard-deleted via API for GDPR erasure.
 */

const weeklyMetricSchema = new mongoose.Schema(
  {
    week: { type: String },           // Format: 'YYYY-WW'
    avgEngagementRate: { type: Number, default: 0 },
    avgReach: { type: Number, default: 0 },
    postsCount: { type: Number, default: 0 }
  },
  { _id: false }
);

const aiLearningProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },

    // GDPR opt-in/out: when false, profile is never read or updated
    learningEnabled: {
      type: Boolean,
      default: true
    },

    // Platform performance insights
    bestPlatforms: [{ type: String }],

    // Temporal posting patterns
    bestPostingHours: [{ type: Number }],   // e.g. [18, 19, 20]
    bestPostingDays: [{ type: String }],    // e.g. ['Tuesday', 'Thursday']

    // Content format performance
    topContentCategories: [{ type: String }],
    avgEngagementByFormat: {
      type: Map,
      of: Number,
      default: {}
    },

    // Caption style insights (aggregated, no raw captions stored)
    captionStyleInsights: {
      optimalLength: {
        type: String,
        enum: ['short', 'medium', 'long'],
        default: 'medium'
      },
      emojiUsage: {
        type: String,
        enum: ['high', 'low', 'none'],
        default: 'low'
      },
      hashtagCount: { type: Number, default: 5 },
      tonePattern: { type: String, default: 'conversational' }
    },

    // Hashtag performance insights
    hashtagInsights: {
      topPerformingHashtags: [{ type: String }],
      avgReachPerHashtag: { type: Number, default: 0 }
    },

    // Audience behavior patterns
    audienceBehavior: {
      peakEngagementHour: { type: Number, default: 18 },
      mostResponsivePlatform: { type: String },
      avgEngagementRate: { type: Number, default: 0 }
    },

    // Rolling 90-day weekly performance history
    contentPerformanceHistory: {
      type: [weeklyMetricSchema],
      default: []
    },

    // Snapshot of top-level metrics at last sync
    lastSnapshotSummary: {
      totalPosts: { type: Number, default: 0 },
      avgEngagementRate: { type: Number, default: 0 },
      avgReach: { type: Number, default: 0 },
      topPlatform: { type: String },
      analysisQuality: { type: String, enum: ['insufficient', 'fair', 'good', 'excellent'], default: 'insufficient' }
    },

    // Latest recommendations from AI Suggestions analysis
    latestSuggestions: {
      performanceSummary: { type: String },
      growthOpportunities: [{
        title: { type: String },
        description: { type: String },
        metric: { type: String }
      }],
      contentRecommendations: [{
        type: { type: String },
        suggestion: { type: String },
        reason: { type: String }
      }],
      captionRecommendations: {
        style: { type: String },
        length: { type: String },
        hooks: [{ type: String }],
        toneAdvice: { type: String }
      },
      hashtagRecommendations: {
        strategy: { type: String },
        suggestedHashtags: [{ type: String }],
        frequency: { type: String }
      },
      audienceInsights: [{
        insight: { type: String },
        actionable: { type: String }
      }],
      postingStrategy: {
        bestDays: [{ type: String }],
        bestHours: { type: String },
        frequency: { type: String },
        rationale: { type: String }
      },
      priorityActions: [{
        priority: { type: String },
        action: { type: String },
        impact: { type: String }
      }]
    },

    lastSyncedAt: { type: Date }
  },
  {
    timestamps: true
  }
);

const AiLearningProfile = mongoose.model('AiLearningProfile', aiLearningProfileSchema);
export default AiLearningProfile;
