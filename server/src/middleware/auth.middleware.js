import { verifyToken } from '../utils/token.js';
import { User } from '../models/user.model.js';

export const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    let token = null;

    if (req.cookies && (req.cookies.accessToken || req.cookies.token)) {
      token = req.cookies.accessToken || req.cookies.token;
    } else if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ message: 'Authentication required. No token provided.' });
    }

    const decoded = verifyToken(token);

    // Verify user is still active in database
    const user = await User.findById(decoded._id);
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'User account is inactive or no longer exists.' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ message: 'Invalid or malformed token' });
  }
};
