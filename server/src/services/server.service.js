import mongoose from 'mongoose';
import { ROLES } from '../config/constants.js';

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Create a validation error with an attached HTTP status code.
 */
export const createValidationError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

/**
 * Escape special regex characters in search input.
 */
export const escapeRegex = (value = '') =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Safely compare createdBy whether populated or not.
 */
export const isOwner = (server, userId) => {
  const createdBy = server.createdBy?._id || server.createdBy;
  return createdBy?.toString() === userId?.toString();
};

/**
 * Validate MongoDB ObjectId.
 */
export const isValidId = (id) => mongoose.isValidObjectId(id);

/**
 * Check if user has Admin or Super Admin role.
 */
export const isAdmin = (user) =>
  user?.role === ROLES.ADMIN || user?.role === ROLES.SUPER_ADMIN;

/**
 * Check if user has Super Admin role.
 */
export const isSuperAdmin = (user) =>
  user?.role === ROLES.SUPER_ADMIN;

/**
 * Validate and normalize server URLs.
 */
export const normalizeServerUrls = ({ streamUrl }) => {
  if (!streamUrl || typeof streamUrl !== 'string') {
    throw createValidationError('Stream URL is required', 400);
  }

  const cleanStreamUrl = streamUrl.trim().replace(/\/+$/, '');

  return {
    streamUrl: cleanStreamUrl
  };
};

/**
 * Check whether the current user can access a server.
 */
export const canAccessServer = (server, user) => {
  if (isSuperAdmin(user)) return true;

  if (user.role === ROLES.ADMIN || user.role === ROLES.USER) {
    return isOwner(server, user._id);
  }

  return false;
};

// ============================================
// VALIDATION & FILTER FUNCTIONS
// ============================================

/**
 * Build MongoDB query filter for listing servers based on user role and query params.
 */
export const buildServerFilter = (loggedInUser, query = {}) => {
  const { category, search } = query;
  const filter = {};

  // Non-super-admin users see only their own servers
  if (!isSuperAdmin(loggedInUser)) {
    filter.createdBy = loggedInUser._id;
  }

  if (category?.trim()) {
    filter.category = category.trim();
  }

  if (search?.trim()) {
    const searchRegex = new RegExp(escapeRegex(search.trim()), 'i');
    filter.$or = [
      { name: searchRegex },
      { streamUrl: searchRegex },
      { category: searchRegex }
    ];
  }

  return filter;
};

/**
 * Validate and prepare payload for creating a new server.
 */
export const validateAndPrepareServerData = (body = {}, userId) => {
  const {
    name,
    category,
    serverUsername,
    serverPassword,
    streamUrl
  } = body;

  if (
    !name?.trim() ||
    !streamUrl?.trim() ||
    category?.trim() === '' ||
    serverUsername?.trim() === '' ||
    serverPassword?.trim() === ''
  ) {
    throw createValidationError(
      'Missing required fields: name, streamUrl, category, serverUsername, or serverPassword',
      400
    );
  }

  const normalizedUrls = normalizeServerUrls({ streamUrl });

  return {
    name: name.trim(),
    category: category?.trim() || 'General',
    serverUsername: serverUsername?.trim() || '',
    serverPassword,
    streamUrl: normalizedUrls.streamUrl,
    createdBy: userId
  };
};

/**
 * Validate update payload fields and apply valid updates onto server document.
 */
export const validateAndApplyServerUpdates = (server, body = {}) => {
  const {
    name,
    category,
    serverUsername,
    serverPassword,
    streamUrl
  } = body;

  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim()) {
      throw createValidationError('Server name cannot be empty', 400);
    }
    server.name = name.trim();
  }

  if (category !== undefined) {
    server.category = category?.trim() || 'General';
  }

  if (serverUsername !== undefined) {
    server.serverUsername = serverUsername?.trim() || '';
  }

  if (streamUrl !== undefined) {
    if (typeof streamUrl !== 'string' || !streamUrl.trim()) {
      throw createValidationError('Stream URL cannot be empty', 400);
    }

    const normalizedUrls = normalizeServerUrls({ streamUrl });
    server.streamUrl = normalizedUrls.streamUrl;
  }

  // Only replace the password when a new one is supplied
  if (serverPassword !== undefined && serverPassword !== '') {
    server.setPassword(serverPassword);
  }

  return server;
};

