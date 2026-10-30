import { User } from '../models/User.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/token.js';

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'Account is deactivated. Contact an administrator.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Save refresh token with 7 days expiry
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await RefreshToken.create({
      token: refreshToken,
      user: user._id,
      expiresAt
    });

    const userObj = user.toJSON();

    return res.status(200).json({
      message: 'Login successful',
      user: userObj,
      accessToken,
      refreshToken
    });
  } catch (error) {
    next(error);
  }
};

export const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token is required' });
    }

    // Verify token cryptographic signature
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (err) {
      await RefreshToken.deleteOne({ token: refreshToken });
      return res.status(401).json({ message: 'Expired or invalid refresh token' });
    }

    // Check if token exists in DB
    const existingToken = await RefreshToken.findOne({ token: refreshToken }).populate('user');
    if (!existingToken) {
      return res.status(401).json({ message: 'Invalid or revoked refresh token' });
    }

    const user = existingToken.user || (await User.findById(decoded.userId));
    if (!user || !user.isActive) {
      await RefreshToken.deleteOne({ _id: existingToken._id });
      return res.status(401).json({ message: 'User account is no longer active' });
    }

    // Grace period for concurrent requests (30 seconds)
    // If this token was already rotated a moment ago by another parallel request or tab
    if (existingToken.rotatedAt) {
      const gracePeriodMs = 30 * 1000;
      const isWithinGracePeriod = Date.now() - new Date(existingToken.rotatedAt).getTime() < gracePeriodMs;
      if (isWithinGracePeriod) {
        const newAccessToken = generateAccessToken(user);
        return res.status(200).json({
          accessToken: newAccessToken,
          refreshToken: existingToken.replacedByToken || refreshToken,
          user: user.toJSON()
        });
      }
      return res.status(401).json({ message: 'Invalid or revoked refresh token' });
    }

    // Generate fresh tokens
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    // Save new refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await RefreshToken.create({
      token: newRefreshToken,
      user: user._id,
      expiresAt
    });

    // Mark old token as rotated with grace period and short 60s TTL
    existingToken.rotatedAt = new Date();
    existingToken.replacedByToken = newRefreshToken;
    existingToken.expiresAt = new Date(Date.now() + 60 * 1000);
    await existingToken.save();

    return res.status(200).json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: user.toJSON()
    });
  } catch (error) {
    next(error);
  }
};

export const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await RefreshToken.deleteOne({ token: refreshToken });
    }
    return res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req, res) => {
  return res.status(200).json({
    user: req.user.toJSON()
  });
};
