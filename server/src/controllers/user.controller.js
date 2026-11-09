import mongoose from 'mongoose';
import { User } from '../models/user.model.js';
import { ROLES } from '../config/constants.js';

// ============================================
// HELPER FUNCTIONS
// ============================================

// Validate MongoDB ObjectId
const isValidId = (id) => mongoose.isValidObjectId(id);

// Escape special regex characters
const escapeRegex = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Check whether logged-in user can access target user
const canAccessUser = (loggedInUser, targetUser) => {
  if (loggedInUser.role === ROLES.SUPER_ADMIN) {
    return true;
  }

  const createdById = targetUser.createdBy?._id
    ? targetUser.createdBy._id
    : targetUser.createdBy;

  if (loggedInUser.role === ROLES.ADMIN) {
    return (
      String(targetUser._id) === String(loggedInUser._id) ||
      String(createdById) === String(loggedInUser._id)
    );
  }

  if (loggedInUser.role === ROLES.USER) {
    return String(targetUser._id) === String(loggedInUser._id);
  }

  return false;
};

// ============================================
// GET ALL USERS
// Super Admin and Admin
// ============================================
export const getAllUsers = async (req, res, next) => {
  try {
    if (![ROLES.SUPER_ADMIN, ROLES.ADMIN].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Insufficient permissions'
      });
    }

    const {
      search = '',
      role,
      page = '1',
      limit = '50'
    } = req.query;

    const pageNumber = Number(page);
    const limitNumber = Number(limit);

    // Validate pagination
    if (
      !Number.isInteger(pageNumber) ||
      !Number.isInteger(limitNumber) ||
      pageNumber < 1 ||
      limitNumber < 1 ||
      limitNumber > 100
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid pagination parameters'
      });
    }

    // Validate search
    if (typeof search !== 'string' || search.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Invalid search query'
      });
    }

    const filter = {};

    // Admin can only see users created by them
    if (req.user.role === ROLES.ADMIN) {
      filter.createdBy = req.user._id;
    }

    // Validate role filter
    if (role !== undefined) {
      if (!Object.values(ROLES).includes(role)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid role'
        });
      }

      filter.role = role;
    }

    // Search by name or email
    if (search.trim()) {
      const safeSearch = escapeRegex(search.trim());

      filter.$or = [
        { name: { $regex: safeSearch, $options: 'i' } },
        { email: { $regex: safeSearch, $options: 'i' } }
      ];
    }

    const total = await User.countDocuments(filter);

    const users = await User.find(filter)
      .populate('createdBy', 'name email role')
      .sort({ createdAt: -1 })
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber);

    return res.status(200).json({
      success: true,
      users,
      total,
      page: pageNumber,
      limit: limitNumber,
      pages: Math.ceil(total / limitNumber)
    });

  } catch (error) {
    next(error);
  }
};

// ============================================
// GET USER BY ID
// Super Admin, Admin and User
// ============================================

export const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    const user = await User.findById(id)
      .populate('createdBy', 'name email role');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // RBAC check
    if (!canAccessUser(req.user, user)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You cannot access this user'
      });
    }

    return res.status(200).json({
      success: true,
      user
    });

  } catch (error) {
    next(error);
  }
};

// ============================================
// UPDATE USER
// Super Admin, Admin and User
// ============================================

export const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    const targetUser = await User.findById(id);

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const loggedInUser = req.user;

    // RBAC check
    if (!canAccessUser(loggedInUser, targetUser)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You cannot update this user'
      });
    }

    const { name, email, password, role, isActive } = req.body;

    // Update name
    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Name cannot be empty'
        });
      }

      targetUser.name = name.trim();
    }

    // Update email
    if (email !== undefined) {
      if (
        typeof email !== 'string' ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
      ) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid email address'
        });
      }

      const normalizedEmail = email.trim().toLowerCase();

      if (normalizedEmail !== targetUser.email) {
        const existingUser = await User.findOne({
          email: normalizedEmail
        });

        if (existingUser) {
          return res.status(409).json({
            success: false,
            message: 'Email already in use'
          });
        }

        targetUser.email = normalizedEmail;
      }
    }

    // Update password
    if (password !== undefined) {
      if (
        typeof password !== 'string' ||
        password.length < 6
      ) {
        return res.status(400).json({
          success: false,
          message: 'Password must contain at least 6 characters'
        });
      }

      targetUser.passwordHash = await User.hashPassword(password);
    }

    // Update role
    if (role !== undefined) {
      if (!Object.values(ROLES).includes(role)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid role'
        });
      }

      if (loggedInUser.role === ROLES.SUPER_ADMIN) {
        targetUser.role = role;
      } else if (
        loggedInUser.role === ROLES.ADMIN &&
        String(targetUser._id) !== String(loggedInUser._id) &&
        String(targetUser.createdBy) === String(loggedInUser._id) &&
        role === ROLES.USER
      ) {
        targetUser.role = role;
      } else {
        return res.status(403).json({
          success: false,
          message: 'You are not authorized to change this role'
        });
      }
    }

    // Only Super Admin can activate/deactivate accounts
    if (isActive !== undefined) {
      if (loggedInUser.role !== ROLES.SUPER_ADMIN) {
        return res.status(403).json({
          success: false,
          message: 'Only Super Admin can change account status'
        });
      }

      if (typeof isActive !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: 'isActive must be a boolean'
        });
      }

      targetUser.isActive = isActive;
    }

    await targetUser.save();

    const updatedUser = await User.findById(id)
      .populate('createdBy', 'name email role');

    return res.status(200).json({
      success: true,
      message: 'User updated successfully',
      user: updatedUser
    });

  } catch (error) {
    // Handle MongoDB duplicate email error
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Email already in use'
      });
    }

    next(error);
  }
};

// ============================================
// DELETE USER
// Super Admin and Admin
// ============================================

export const deleteUser = async (req, res, next) => {
  try {
    // Only Super Admin and Admin can delete users
    if (![ROLES.SUPER_ADMIN, ROLES.ADMIN].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Insufficient permissions'
      });
    }

    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    // Prevent self-deletion
    if (String(req.user._id) === String(id)) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account'
      });
    }

    const targetUser = await User.findById(id);

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Admin can only delete users created by them
    if (
      req.user.role === ROLES.ADMIN &&
      String(targetUser.createdBy) !== String(req.user._id)
    ) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You cannot delete users you did not create'
      });
    }

    await targetUser.deleteOne();

    return res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    next(error);
  }
};
