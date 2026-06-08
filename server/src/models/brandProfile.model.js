import mongoose from 'mongoose';

const brandProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    companyName: {
      type: String,
      trim: true,
      default: '',
    },
    industry: {
      type: String,
      trim: true,
      default: '',
    },
    products: {
      type: String,
      trim: true,
      default: '',
    },
    services: {
      type: String,
      trim: true,
      default: '',
    },
    targetAudience: {
      type: String,
      trim: true,
      default: '',
    },
    toneOfVoice: {
      type: String,
      trim: true,
      default: '',
    },
    keywords: {
      type: String,
      trim: true,
      default: '',
    },
    competitors: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

const BrandProfile = mongoose.model('BrandProfile', brandProfileSchema);
export default BrandProfile;
