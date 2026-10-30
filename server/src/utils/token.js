import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export const generateAccessToken = (user) => {
  return jwt.sign(
    {
      userId: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdBy: user.createdBy
    },
    process.env.JWT_ACCESS_SECRET || 'playout_super_secret_access_jwt_key_2026_!@#',
    { expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m' }
  );
};

export const generateRefreshToken = (user) => {
  return jwt.sign(
    {
      userId: user._id,
      jti: crypto.randomUUID()
    },
    process.env.JWT_REFRESH_SECRET || 'playout_super_secret_refresh_jwt_key_2026_$%^',
    { expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d' }
  );
};

export const verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET || 'playout_super_secret_access_jwt_key_2026_!@#');
};

export const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET || 'playout_super_secret_refresh_jwt_key_2026_$%^');
};
