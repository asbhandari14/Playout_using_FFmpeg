import { User } from '../models/user.model.js';
import getCookieOptions from '../utils/cookieOption.js';
import { generateToken, verifyToken } from '../utils/token.js';
import { ROLES } from '../config/constants.js';

// Create New User Controller function ( Super Admins and Admins )
export const createUser = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    // User Input Validation
    if(!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required: name, email, password, role' 
      });
    }

    // Existing Account Validation
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Email is already registered' 
      });
    }

    const passwordHash = await User.hashPassword(password);

    // Create User
    const newUser = await User.create({
      name,
      email: email.toLowerCase(),
      passwordHash,
      role: role || ROLES.USER,
      createdBy: req.user._id,
      isActive: true
    });

    const populated = await User.findById(newUser._id).populate('createdBy', 'name email role');

    return res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: populated
    });
  } catch (error) {
    next(error);
  }
};

// Login Controller Function ( All Users )
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate user input
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Find user by email and include password hash for comparison and validate user
    const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Check user is active or not
    if (!user.isActive) {
      return res.status(403).json({ message: 'Account is deactivated. Contact an administrator.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = generateToken(user);

    const userObj = user.toJSON();

    // Set secure HTTP-only cookies for seamless authentication
    res.cookie('token', token, {
      ...getCookieOptions(),
      maxAge: 7 * 24 * 60 * 60 * 1000  // 7 days
    });

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      accessToken: token,
      user: userObj,
    });
  } catch (error) {
    next(error);
  }
};


// Logout Controller Function (All Users )
export const logout = async (req, res, next) => {
  try {
    res.clearCookie('token', getCookieOptions());
    return res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};

// Refresh Token Controller Function
export const refreshToken = async (req, res, next) => {
  try {
    const rawToken = req.body?.refreshToken || req.cookies?.token || req.headers.authorization?.split(' ')[1];
    if (!rawToken) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }
    const decoded = verifyToken(rawToken);
    if (!decoded || !decoded.id) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'User not found or deactivated' });
    }
    const newToken = generateToken(user);
    res.cookie('token', newToken, {
      ...getCookieOptions(),
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
    return res.status(200).json({
      success: true,
      token: newToken,
      accessToken: newToken,
      refreshToken: newToken,
      user: user.toJSON()
    });
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token refresh failed' });
  }
};

// Get Logged-in User Info Controller Function ( All Users )
export const getMe = async (req, res) => {
  return res.status(200).json({
    user: req.user.toJSON()
  });
};
