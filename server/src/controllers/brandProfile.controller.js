import { brandProfileServiceInstance } from '../services/brandProfile.service.js';

class BrandProfileController {
  async getProfile(req, res, next) {
    try {
      const userId = req.user.id;
      const profile = await brandProfileServiceInstance.getProfile(userId);
      res.status(200).json({ success: true, result: profile });
    } catch (error) {
      next(error);
    }
  }

  async saveProfile(req, res, next) {
    try {
      const userId = req.user.id;
      const profile = await brandProfileServiceInstance.saveProfile(userId, req.body);
      res.status(200).json({ success: true, result: profile });
    } catch (error) {
      next(error);
    }
  }
}

export const brandProfileControllerInstance = new BrandProfileController();
