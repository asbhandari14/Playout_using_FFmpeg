import { Server } from '../models/server.model.js';
import {
  isValidId,
  isAdmin,
  canAccessServer,
  buildServerFilter,
  validateAndPrepareServerData,
  validateAndApplyServerUpdates
} from '../services/server.service.js';

// --------------------------------------------------
// GET ALL SERVERS
// --------------------------------------------------
export const getAllServers = async (req, res) => {
  try {
    const filter = buildServerFilter(req.user, req.query);

    const servers = await Server.find(filter)
      .populate('createdBy', 'name email role')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: servers.length,
      servers
    });
  } catch (error) {
    console.error('[Server] Get servers error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch servers'
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
        message: 'Invalid server ID'
      });
    }

    const server = await Server.findById(id)
      .populate('createdBy', 'name email role');

    if (!server) {
      return res.status(404).json({
        success: false,
        message: 'Server not found'
      });
    }

    if (!canAccessServer(server, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to access this server'
      });
    }

    return res.status(200).json({
      success: true,
      server
    });
  } catch (error) {
    console.error('[Server] Get server error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch server'
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
        message: 'Only Admin and Super Admin can create servers'
      });
    }

    const { serverPassword, ...serverFields } = validateAndPrepareServerData(
      req.body,
      req.user._id
    );

    const server = new Server(serverFields);

    if (serverPassword) {
      server.setPassword(serverPassword);
    }

    await server.save();

    await server.populate('createdBy', 'name email role');

    return res.status(201).json({
      success: true,
      message: 'Server created successfully',
      server
    });
  } catch (error) {
    console.error('[Server] Create server error:', error);

    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || 'Failed to create server'
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
        message: 'Invalid server ID'
      });
    }

    if (!isAdmin(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to update servers'
      });
    }

    const server = await Server.findById(id);

    if (!server) {
      return res.status(404).json({
        success: false,
        message: 'Server not found'
      });
    }

    if (!canAccessServer(server, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'You cannot update a server that you do not own'
      });
    }

    validateAndApplyServerUpdates(server, req.body);

    await server.save();

    await server.populate('createdBy', 'name email role');

    return res.status(200).json({
      success: true,
      message: 'Server updated successfully',
      server
    });
  } catch (error) {
    console.error('[Server] Update server error:', error);

    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || 'Failed to update server'
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
        message: 'Invalid server ID'
      });
    }

    if (!isAdmin(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to delete servers'
      });
    }

    const server = await Server.findById(id);

    if (!server) {
      return res.status(404).json({
        success: false,
        message: 'Server not found'
      });
    }

    if (!canAccessServer(server, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'You cannot delete a server that you do not own'
      });
    }

    await server.deleteOne();

    return res.status(200).json({
      success: true,
      message: 'Server deleted successfully'
    });
  } catch (error) {
    console.error('[Server] Delete server error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to delete server'
    });
  }
};
