import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export const generateAccessToken = (userId, role) => {
  const secret = process.env.JWT_ACCESS_SECRET || 'fallback_access_secret';
  const expires = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
  return jwt.sign({ sub: userId, role }, secret, { expiresIn: expires });
};

export const generateRefreshToken = (userId, role) => {
  const secret = process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret';
  const expires = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
  return jwt.sign({ sub: userId, role }, secret, { expiresIn: expires });
};

export const verifyAccessToken = (token) => {
  const secret = process.env.JWT_ACCESS_SECRET || 'fallback_access_secret';
  return jwt.verify(token, secret);
};

export const verifyRefreshToken = (token) => {
  const secret = process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret';
  return jwt.verify(token, secret);
};

export const generateRandomToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

export const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};
