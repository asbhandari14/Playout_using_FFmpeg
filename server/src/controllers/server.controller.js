import mongoose from 'mongoose';
import { Server } from "../models/server.model.js";
import { ROLES } from '../config/constants.js';

// Escape special regex characters in search input
const escapeRegex = (value = '') =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Safely compare createdBy whether populated or not
const isOwner = (server, userId) => {
  const createdBy = server.createdBy?._id || server.createdBy;
  return createdBy?.toString() === userId?.toString();
};

const isValidId = (id) => mongoose.isValidObjectId(id);

const isAdmin = (user) =>
  user?.role === ROLES.ADMIN ||
  user?.role === ROLES.SUPER_ADMIN;

const isSuperAdmin = (user) =>
  user?.role === ROLES.SUPER_ADMIN;

// Validate and normalize server URLs
const normalizeServerUrls = ({ streamUrl }) => {
  if (!streamUrl || typeof streamUrl !== 'string') {
    throw new Error('Stream URL is required');
  }

  // Remove the space and trailing / from the streamUrl
  let cleanStreamUrl = streamUrl.trim().replace(/\/+$/, '');

  return {
    streamUrl: cleanStreamUrl,
  };
};

// Check whether the current user can access a server
const canAccessServer = (server, user) => {
  if (isSuperAdmin(user)) return true;

  if (user.role === ROLES.ADMIN || user.role === ROLES.USER) {
    return isOwner(server, user._id);
  }

  return false;
};

// --------------------------------------------------
// GET ALL SERVERS
// --------------------------------------------------
export const getAllServers = async (req, res) => {
  try {
    const { category, search } = req.query;

    const filter = {};

    // Non-super-admin users see only their own servers
    if (!isSuperAdmin(req.user)) {
      filter.createdBy = req.user._id;
    }

    if (category?.trim()) {
      filter.category = category.trim();
    }

    if (search?.trim()) {
      const searchRegex = new RegExp(
        escapeRegex(search.trim()),
        'i'
      );

      filter.$or = [
        { name: searchRegex },
        { streamUrl: searchRegex },
        { category: searchRegex },
      ];
    }

    const servers = await Server.find(filter)
      .populate('createdBy', 'name email role')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: servers.length,
      servers,
    });

  } catch (error) {
    console.error('[Server] Get servers error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch servers',
    });
  }
};

// --------------------------------------------------
// GET SERVER BY ID
// --------------------------------------------------
export const getServerById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid server ID',
      });
    }

    const server = await Server.findById(id)
      .populate('createdBy', 'name email role');

    if (!server) {
      return res.status(404).json({
        success: false,
        message: 'Server not found',
      });
    }

    if (!canAccessServer(server, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to access this server',
      });
    }

    return res.status(200).json({
      success: true,
      server,
    });

  } catch (error) {
    console.error('[Server] Get server error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch server',
    });
  }
};

// --------------------------------------------------
// CREATE SERVER
// --------------------------------------------------
export const createServer = async (req, res) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Only Admin and Super Admin can create servers',
      });
    }

    const {
      name,
      category,
      serverUsername,
      serverPassword,
      streamUrl,
    } = req.body;

    console.log("req.body", req.body);
    if (
      !name?.trim() ||
      !streamUrl?.trim() ||
      category?.trim() === '' ||
      serverUsername?.trim() === '' ||
      serverPassword?.trim() === ''
    ) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, streamUrl, category, serverUsername, or serverPassword',
      });
    }

    const normalizedUrls = normalizeServerUrls({ streamUrl });

    const server = new Server({
      name: name.trim(),
      category: category?.trim() || 'General',
      serverUsername: serverUsername?.trim() || '',
      streamUrl: normalizedUrls?.streamUrl,
      createdBy: req.user._id,
    });

    if (serverPassword) {
      server.setPassword(serverPassword);
    }

    await server.save();

    await server.populate('createdBy', 'name email role');

    return res.status(201).json({
      success: true,
      message: 'Server created successfully',
      server,
    });

  } catch (error) {
    console.error('[Server] Create server error:', error);

    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to create server',
    });
  }
};

// --------------------------------------------------
// UPDATE SERVER
// --------------------------------------------------
export const updateServer = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid server ID',
      });
    }

    if (!isAdmin(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to update servers',
      });
    }

    const server = await Server.findById(id);

    if (!server) {
      return res.status(404).json({
        success: false,
        message: 'Server not found',
      });
    }

    if (!canAccessServer(server, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'You cannot update a server that you do not own',
      });
    }

    const {
      name,
      category,
      serverUsername,
      serverPassword,
      streamUrl,
    } = req.body;

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Server name cannot be empty',
        });
      }

      server.name = name.trim();
    }

    if (category !== undefined) {
      server.category = category?.trim() || 'General';
    }

    if (serverUsername !== undefined) {
      server.serverUsername = serverUsername?.trim() || '';
    }

    // If the stream URL changes, recalculate the defaults
    if ( streamUrl !== undefined ) {
      if (typeof streamUrl !== 'string' || !streamUrl.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Stream URL cannot be empty',
        });
      }

      const normalizedUrls = normalizeServerUrls({ streamUrl });

      server.streamUrl = normalizedUrls.streamUrl;
    }

    // Only replace the password when a new one is supplied
    if (serverPassword !== undefined && serverPassword !== '') {
      server.setPassword(serverPassword);
    }

    await server.save();

    await server.populate('createdBy', 'name email role');

    return res.status(200).json({
      success: true,
      message: 'Server updated successfully',
      server,
    });

  } catch (error) {
    console.error('[Server] Update server error:', error);

    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to update server',
    });
  }
};

// --------------------------------------------------
// DELETE SERVER
// --------------------------------------------------
export const deleteServer = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid server ID',
      });
    }

    if (!isAdmin(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to delete servers',
      });
    }

    const server = await Server.findById(id);

    if (!server) {
      return res.status(404).json({
        success: false,
        message: 'Server not found',
      });
    }

    if (!canAccessServer(server, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'You cannot delete a server that you do not own',
      });
    }

    await server.deleteOne();

    return res.status(200).json({
      success: true,
      message: 'Server deleted successfully',
    });

  } catch (error) {
    console.error('[Server] Delete server error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to delete server',
    });
  }
};