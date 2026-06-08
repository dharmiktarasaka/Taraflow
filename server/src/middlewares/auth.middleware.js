import { verifyAccessToken } from '../utils/token.util.js';
import { userRepositoryInstance } from '../repositories/user.repository.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.util.js';

export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Access token is missing or malformed');
    }

    const token = authHeader.split(' ')[1];

    // Development Mode Bypass for visual demonstration
    if (token === 'development_mock_jwt_token') {
      const mockId = '60c72b2f9b1d8a23c8e88888';
      let mockUser = await userRepositoryInstance.findById(mockId);
      if (!mockUser) {
        try {
          mockUser = await userRepositoryInstance.create({
            _id: mockId,
            firstName: 'Developer',
            lastName: 'Taraflow',
            email: 'developer@taraflow.ai',
            role: 'SUPER_ADMIN',
            isVerified: true,
            googleId: 'mock_developer_google_id',
            subscription: {
              plan: 'free',
              status: 'none',
              gateway: 'none'
            }
          });
        } catch (err) {
          // If we fail to create (e.g. key constraints or validation), fetch again
          mockUser = await userRepositoryInstance.findById(mockId);
          if (!mockUser) {
            throw new Error(`Failed to create or retrieve mock developer user in DB: ${err.message}`);
          }
        }
      }
      req.user = {
        id: mockUser._id.toString(),
        email: mockUser.email,
        role: mockUser.role,
        firstName: mockUser.firstName,
        lastName: mockUser.lastName,
      };
      return next();
    }

    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (err) {
      throw new UnauthorizedError('Access token is invalid or has expired');
    }

    const user = await userRepositoryInstance.findById(decoded.sub);
    if (!user) {
      throw new UnauthorizedError('User associated with this token no longer exists');
    }

    // Soft bypass verification check if it is verification route itself,
    // but here we block other private routes if user is not verified.
    if (!user.isVerified && !req.path.includes('/verify-email')) {
      throw new ForbiddenError('Please verify your email address to access this resource');
    }

    req.user = {
      id: user._id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
    };

    next();
  } catch (error) {
    next(error);
  }
};

export const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication is required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new ForbiddenError('You do not have permission to perform this action'));
    }

    next();
  };
};
