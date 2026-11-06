import { User } from '../models/user.model.js';
import { RefreshToken } from '../models/refreshToken.model.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/token.js';

const isProduction = process.env.NODE_ENV === 'production';
const getCookieOptions = () => ({
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'none' : 'lax',
  path: '/'
});

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

    // Set secure HTTP-only cookies for seamless authentication
    res.cookie('accessToken', accessToken, {
      ...getCookieOptions(),
      maxAge: 15 * 60 * 1000 // 15 mins
    });
    res.cookie('refreshToken', refreshToken, {
      ...getCookieOptions(),
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    return res.status(200).json({
      success: true,
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
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token is required' });
    }

    // Verify token cryptographic signature
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (err) {
      await RefreshToken.deleteOne({ token: refreshToken });
      res.clearCookie('accessToken', { path: '/' });
      res.clearCookie('refreshToken', { path: '/' });
      return res.status(401).json({ message: 'Expired or invalid refresh token' });
    }

    // Check if token exists in DB
    const existingToken = await RefreshToken.findOne({ token: refreshToken }).populate('user');
    if (!existingToken) {
      res.clearCookie('accessToken', { path: '/' });
      res.clearCookie('refreshToken', { path: '/' });
      return res.status(401).json({ message: 'Invalid or revoked refresh token' });
    }

    const user = existingToken.user || (await User.findById(decoded.userId));
    if (!user || !user.isActive) {
      await RefreshToken.deleteOne({ _id: existingToken._id });
      res.clearCookie('accessToken', { path: '/' });
      res.clearCookie('refreshToken', { path: '/' });
      return res.status(401).json({ message: 'User account is no longer active' });
    }

    // Grace period for concurrent requests (30 seconds)
    if (existingToken.rotatedAt) {
      const gracePeriodMs = 30 * 1000;
      const isWithinGracePeriod = Date.now() - new Date(existingToken.rotatedAt).getTime() < gracePeriodMs;
      if (isWithinGracePeriod) {
        const newAccessToken = generateAccessToken(user);
        res.cookie('accessToken', newAccessToken, {
          ...getCookieOptions(),
          maxAge: 15 * 60 * 1000
        });
        return res.status(200).json({
          accessToken: newAccessToken,
          refreshToken: existingToken.replacedByToken || refreshToken,
          user: user.toJSON()
        });
      }
      res.clearCookie('accessToken', { path: '/' });
      res.clearCookie('refreshToken', { path: '/' });
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

    res.cookie('accessToken', newAccessToken, {
      ...getCookieOptions(),
      maxAge: 15 * 60 * 1000
    });
    res.cookie('refreshToken', newRefreshToken, {
      ...getCookieOptions(),
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

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
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    if (refreshToken) {
      await RefreshToken.deleteOne({ token: refreshToken });
    }
    res.clearCookie('accessToken', { path: '/' });
    res.clearCookie('refreshToken', { path: '/' });
    return res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req, res) => {
  return res.status(200).json({
    user: req.user.toJSON()
  });
};
