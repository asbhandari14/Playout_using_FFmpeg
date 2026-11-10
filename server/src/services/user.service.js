import mongoose from 'mongoose';
import { User } from '../models/user.model.js';
import { ROLES } from '../config/constants.js';

// ============================================
// HELPER FUNCTIONS
// ============================================

//  Create a validation/authorization error with an HTTP status code.
export const createValidationError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

// Validate MongoDB ObjectId.
export const isValidId = (id) => {
  return mongoose.isValidObjectId(id);
}

//  Escape special regex characters.
export const escapeRegex = (value) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

//  Check whether logged-in user has Admin or Super Admin role.
export const canManageUsers = (loggedInUser) => {
  return [ROLES.SUPER_ADMIN, ROLES.ADMIN].includes(loggedInUser?.role);
}

//  Check if the target ID matches the logged-in user's ID.
export const isSelfAction = (loggedInUser, targetId) => {
  return String(loggedInUser?._id) === String(targetId);
}

//  Check whether logged-in user can access target user.
export const canAccessUser = (loggedInUser, targetUser) => {
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

//  Check whether logged-in user can delete targetUser.
export const canDeleteUser = (loggedInUser, targetUser) => {
  if (loggedInUser.role === ROLES.SUPER_ADMIN) {
    return true;
  }

  if (loggedInUser.role === ROLES.ADMIN) {
    const createdById = targetUser.createdBy?._id
      ? targetUser.createdBy._id
      : targetUser.createdBy;
    return String(createdById) === String(loggedInUser._id);
  }

  return false;
};


// ============================================
// VALIDATION FUNCTIONS
// ============================================

//  Validate query parameters for fetching all users and construct the MongoDB filter.
export const validateAndBuildUserFilter = (loggedInUser, query = {}) => {
  const {
    search = '',
    role,
    page = '1',
    limit = '50'
  } = query;

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
    throw createValidationError('Invalid pagination parameters', 400);
  }

  // Validate search
  if (typeof search !== 'string' || search.length > 100) {
    throw createValidationError('Invalid search query', 400);
  }

  const filter = {};

  // Admin can only see users created by them
  if (loggedInUser.role === ROLES.ADMIN) {
    filter.createdBy = loggedInUser._id;
  }

  // Validate role filter
  if (role !== undefined) {
    if (!Object.values(ROLES).includes(role)) {
      throw createValidationError('Invalid role', 400);
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

  return { filter, pageNumber, limitNumber };
};

//  Validate update payload fields and apply valid updates onto targetUser document.
export const validateAndApplyUserUpdates = async (targetUser, loggedInUser, updateBody = {}) => {
  const { name, email, password, role, isActive } = updateBody;

  // Validate & update name
  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim()) {
      throw createValidationError('Name cannot be empty', 400);
    }
    targetUser.name = name.trim();
  }

  // Validate & update email
  if (email !== undefined) {
    if (
      typeof email !== 'string' ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ) {
      throw createValidationError('Please provide a valid email address', 400);
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (normalizedEmail !== targetUser.email) {
      const existingUser = await User.findOne({ email: normalizedEmail });
      if (existingUser) {
        throw createValidationError('Email already in use', 409);
      }
      targetUser.email = normalizedEmail;
    }
  }

  // Validate & update password
  if (password !== undefined) {
    if (typeof password !== 'string' || password.length < 6) {
      throw createValidationError('Password must contain at least 6 characters', 400);
    }
    targetUser.passwordHash = await User.hashPassword(password);
  }

  // Validate & update role
  if (role !== undefined) {
    if (!Object.values(ROLES).includes(role)) {
      throw createValidationError('Invalid role', 400);
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
      throw createValidationError('You are not authorized to change this role', 403);
    }
  }

  // Validate & update isActive status (Super Admin only)
  if (isActive !== undefined) {
    if (loggedInUser.role !== ROLES.SUPER_ADMIN) {
      throw createValidationError('Only Super Admin can change account status', 403);
    }

    if (typeof isActive !== 'boolean') {
      throw createValidationError('isActive must be a boolean', 400);
    }

    targetUser.isActive = isActive;
  }

  return targetUser;
};
