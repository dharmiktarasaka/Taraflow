import BrandProfile from '../models/brandProfile.model.js';

class BrandProfileService {
  async getProfile(userId) {
    let profile = await BrandProfile.findOne({ user: userId });
    if (!profile) {
      // Create a default empty profile for the user if none exists
      profile = await BrandProfile.create({ user: userId });
    }
    return profile;
  }

  async saveProfile(userId, profileData) {
    const {
      companyName,
      industry,
      products,
      services,
      targetAudience,
      toneOfVoice,
      keywords,
      competitors,
    } = profileData;

    const profile = await BrandProfile.findOneAndUpdate(
      { user: userId },
      {
        $set: {
          companyName: companyName || '',
          industry: industry || '',
          products: products || '',
          services: services || '',
          targetAudience: targetAudience || '',
          toneOfVoice: toneOfVoice || '',
          keywords: keywords || '',
          competitors: competitors || '',
        },
      },
      { new: true, upsert: true, runValidators: true }
    );
    return profile;
  }
}

export const brandProfileServiceInstance = new BrandProfileService();
