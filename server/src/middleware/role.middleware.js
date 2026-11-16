import { ROLES } from '../config/constants.js';
import { Channel } from '../models/channel.model.js';
import { User } from '../models/user.model.js';

// RBAC
export const role = (allowedRoles = [], resourceCheck = null) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      // super_admin has absolute full access to everything
      if (req.user.role === ROLES.SUPER_ADMIN) {
        return next();
      }

      // Check role permission
      if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          message: `Access denied. Role '${req.user.role}' is not authorized for this action.`
        });
      }

      // If a resource check is provided, verify ownership/assignment
      if (resourceCheck) {
        const isAllowed = await resourceCheck(req);
        if (!isAllowed) {
          return res.status(403).json({
            message: 'Access denied. You do not have permission to access or modify this specific resource.'
          });
        }
      }

      next();
    } catch (error) {
      console.error('RBAC authorization error:', error);
      return res.status(500).json({ message: 'Authorization verification failed', error: error.message });
    }
  };
};

/**
 * Middleware to verify that the authenticated user has access to the channel specified in req.params or req.body.
 * - super_admin: full access
 * - admin: access to channels they created, are assigned to, or assigned to users they created
 * - user: ONLY channels assigned to them (or created by them)
 */
export const channelAccess = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (req.user.role === ROLES.SUPER_ADMIN) {
      return next();
    }

    const channelId = req.params.channelId || req.params.id || req.body?.channelId || req.body?.channel;
    if (!channelId) {
      return next();
    }

    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }

    req.channel = channel;

    if (req.user.role === ROLES.USER) {
      const isAssigned = String(channel.assignedUser?._id || channel.assignedUser) === String(req.user._id);
      const isCreator = String(channel.createdBy?._id || channel.createdBy) === String(req.user._id);
      if (!isAssigned && !isCreator) {
        return res.status(403).json({ message: 'Forbidden: You do not have access to this channel' });
      }
    } else if (req.user.role === ROLES.ADMIN) {
      const isOwner = String(channel.createdBy?._id || channel.createdBy) === String(req.user._id);
      const isAssigned = String(channel.assignedUser?._id || channel.assignedUser) === String(req.user._id);
      const userManaged = await User.exists({
        _id: channel.assignedUser?._id || channel.assignedUser,
        createdBy: req.user._id
      });
      if (!isOwner && !isAssigned && !userManaged) {
        return res.status(403).json({ message: 'Forbidden: You do not manage this channel' });
      }
    }

    next();
  } catch (err) {
    console.error('Channel access check error:', err);
    return res.status(500).json({ message: 'Channel authorization check failed', error: err.message });
  }
};

