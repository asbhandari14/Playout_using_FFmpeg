import { User } from '../models/user.model.js';
import {
  isValidId,
  canManageUsers,
  isSelfAction,
  canAccessUser,
  canDeleteUser,
  validateAndBuildUserFilter,
  validateAndApplyUserUpdates
} from '../services/user.service.js';

// ============================================
// GET ALL USERS
// Super Admin and Admin
// ============================================
export const getAllUsers = async (req, res, next) => {
  try {
    if (!canManageUsers(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Insufficient permissions'
      });
    }

    const { filter, pageNumber, limitNumber } = validateAndBuildUserFilter(
      req.user,
      req.query
    );

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
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    }
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

    if (!canAccessUser(req.user, targetUser)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You cannot update this user'
      });
    }

    await validateAndApplyUserUpdates(targetUser, req.user, req.body);

    await targetUser.save();

    const updatedUser = await User.findById(id)
      .populate('createdBy', 'name email role');

    return res.status(200).json({
      success: true,
      message: 'User updated successfully',
      user: updatedUser
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    }

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
    if (!canManageUsers(req.user)) {
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

    if (isSelfAction(req.user, id)) {
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

    if (!canDeleteUser(req.user, targetUser)) {
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
