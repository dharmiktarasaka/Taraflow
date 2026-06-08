import User from '../models/user.model.js';

export class UserRepository {
  async findByEmail(email, selectFields = '') {
    return User.findOne({ email }).select(selectFields);
  }

  async findById(id) {
    return User.findById(id);
  }

  async findByGoogleId(googleId) {
    return User.findOne({ googleId });
  }

  async findByVerificationToken(token) {
    return User.findOne({
      verificationToken: token,
      verificationTokenExpiresAt: { $gt: new Date() },
    }).select('+verificationToken +verificationTokenExpiresAt');
  }

  async findByResetPasswordToken(token) {
    return User.findOne({
      resetPasswordToken: token,
      resetPasswordExpiresAt: { $gt: new Date() },
    }).select('+resetPasswordToken +resetPasswordExpiresAt');
  }

  async create(userData) {
    return User.create(userData);
  }

  async update(id, updateData) {
    return User.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
  }

  async save(userDocument) {
    return userDocument.save();
  }

  async incrementLoginAttempts(user) {
    const lockTime = 30 * 60 * 1000; // 30 minutes lockout
    const update = { $inc: { loginAttempts: 1 } };
    
    // Lock account if attempts exceed 5
    if (user.loginAttempts + 1 >= 5 && !user.isLocked()) {
      update.$set = { lockUntil: new Date(Date.now() + lockTime) };
    }
    
    return User.findByIdAndUpdate(user._id, update, { new: true });
  }

  async resetLoginAttempts(user) {
    return User.findByIdAndUpdate(
      user._id,
      { $set: { loginAttempts: 0 }, $unset: { lockUntil: 1 } },
      { new: true }
    );
  }
}
export const userRepositoryInstance = new UserRepository();
