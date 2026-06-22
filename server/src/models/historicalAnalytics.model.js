import mongoose from 'mongoose';

const historicalAnalyticsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SocialAccount',
      required: true,
      index: true,
    },
    platform: {
      type: String,
      required: true,
      index: true,
    },
    metricName: {
      type: String,
      required: true,
      index: true,
    },
    metricValue: {
      type: Number,
      required: true,
    },
    metricDate: {
      type: Date,
      required: true,
      index: true,
    },
    source: {
      type: String,
      required: true,
    },
    fetchedAt: {
      type: Date,
      default: Date.now,
    },
    isHistorical: {
      type: Boolean,
      default: false,
    },
    isAfterConnection: {
      type: Boolean,
      default: false,
    },
    rawApiResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate records per account, metric name, and date
historicalAnalyticsSchema.index({ accountId: 1, metricName: 1, metricDate: 1 }, { unique: true });

const HistoricalAnalytics = mongoose.model('HistoricalAnalytics', historicalAnalyticsSchema);
export default HistoricalAnalytics;
