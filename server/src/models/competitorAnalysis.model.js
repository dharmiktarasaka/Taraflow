import mongoose from 'mongoose';

const competitorAnalysisSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    targetCompetitors: [
      {
        name: { type: String, required: true },
        website: { type: String, default: '' },
        socialHandles: {
          facebook: { type: String, default: '' },
          instagram: { type: String, default: '' },
          threads: { type: String, default: '' },
          linkedin: { type: String, default: '' },
        },
        followers: { type: Number, default: null },
        rating: { type: Number, default: null },
        reviewsCount: { type: Number, default: null },
      },
    ],
    userStats: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    competitorsData: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    analysis: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    pdfReportUrl: {
      type: String,
      default: '',
    },
    docxReportUrl: {
      type: String,
      default: '',
    },
    error: {
      type: String,
      default: '',
    },
    modelUsed: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

const CompetitorAnalysis = mongoose.model('CompetitorAnalysis', competitorAnalysisSchema);
export default CompetitorAnalysis;
