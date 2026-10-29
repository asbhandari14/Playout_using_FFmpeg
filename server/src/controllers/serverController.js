import { Server } from '../models/Server.js';
import { ROLES } from '../config/constants.js';
import { z } from 'zod';

export const createServerSchema = z
  .object({
    name: z.string().min(2, 'Stream name must be at least 2 characters'),
    category: z.string().optional().default('General'),
    streamUrl: z.string().min(5, 'Stream URL required (e.g. http://94.136.185.222:81)').optional(),
    serverUsername: z.string().optional().default(''),
    serverPassword: z.string().optional().default(''),
    rtmpBaseUrl: z.string().optional(),
    hlsBaseUrl: z.string().optional()
  })
  .refine((data) => data.streamUrl || (data.rtmpBaseUrl && data.hlsBaseUrl), {
    message: 'Stream URL is required (e.g. http://94.136.185.222:81)'
  });

export const updateServerSchema = z.object({
  name: z.string().min(2).optional(),
  category: z.string().optional(),
  streamUrl: z.string().min(5).optional(),
  serverUsername: z.string().optional(),
  serverPassword: z.string().optional(),
  rtmpBaseUrl: z.string().optional(),
  hlsBaseUrl: z.string().optional()
});

// GET /api/servers
export const getServers = async (req, res, next) => {
  try {
    const { search, category } = req.query;
    const filter = {};

    // RBAC: Admin only sees servers created by them
    if (req.user.role === ROLES.ADMIN) {
      filter.createdBy = req.user._id;
    }

    if (category) {
      filter.category = category;
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { streamUrl: { $regex: search, $options: 'i' } },
        { rtmpBaseUrl: { $regex: search, $options: 'i' } },
        { hlsBaseUrl: { $regex: search, $options: 'i' } }
      ];
    }

    const servers = await Server.find(filter)
      .populate('createdBy', 'name email role')
      .sort({ createdAt: -1 });

    return res.status(200).json({ servers, total: servers.length });
  } catch (error) {
    next(error);
  }
};

// GET /api/servers/:id
export const getServerById = async (req, res, next) => {
  try {
    const server = await Server.findById(req.params.id).populate('createdBy', 'name email role');
    if (!server) {
      return res.status(404).json({ message: 'Server not found' });
    }

    if (req.user.role === ROLES.ADMIN && String(server.createdBy?._id || server.createdBy) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Forbidden: You do not manage this server' });
    }

    return res.status(200).json({ server });
  } catch (error) {
    next(error);
  }
};

// POST /api/servers
export const createServer = async (req, res, next) => {
  try {
    const { name, category, serverUsername, serverPassword, streamUrl, rtmpBaseUrl, hlsBaseUrl } = req.body || {};

    const effectiveStreamUrl = streamUrl || hlsBaseUrl || 'http://127.0.0.1:81';
    let cleanUrl = effectiveStreamUrl.trim().replace(/\/+$/, '');
    let hostname = '127.0.0.1';
    try {
      const parsed = new URL(cleanUrl.startsWith('http') ? cleanUrl : `http://${cleanUrl}`);
      hostname = parsed.hostname;
      cleanUrl = `${parsed.protocol}//${parsed.host}`;
    } catch (e) {
      const match = cleanUrl.match(/^(?:https?:\/\/)?([^:/]+)/i);
      if (match) hostname = match[1];
    }

    const effectiveHlsBase = hlsBaseUrl || cleanUrl;
    const effectiveRtmpBase = rtmpBaseUrl || `rtmp://${hostname}/static`;

    const server = new Server({
      name,
      category: category || 'General',
      streamUrl: cleanUrl,
      serverUsername: serverUsername || '',
      rtmpBaseUrl: effectiveRtmpBase,
      hlsBaseUrl: effectiveHlsBase,
      createdBy: req.user._id
    });

    if (serverPassword) {
      server.setPassword(serverPassword);
    }

    await server.save();
    const populated = await Server.findById(server._id).populate('createdBy', 'name email role');

    return res.status(201).json({
      message: 'Server created successfully',
      server: populated
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/servers/:id
export const updateServer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const server = await Server.findById(id);
    if (!server) {
      return res.status(404).json({ message: 'Server not found' });
    }

    if (req.user.role === ROLES.ADMIN && String(server.createdBy) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Forbidden: You cannot modify this server' });
    }

    const { name, category, serverUsername, serverPassword, streamUrl, rtmpBaseUrl, hlsBaseUrl } = req.body || {};
    if (name) server.name = name;
    if (category) server.category = category;
    if (serverUsername !== undefined) server.serverUsername = serverUsername;
    if (serverPassword) server.setPassword(serverPassword);

    if (streamUrl) {
      let cleanUrl = streamUrl.trim().replace(/\/+$/, '');
      let hostname = '127.0.0.1';
      try {
        const parsed = new URL(cleanUrl.startsWith('http') ? cleanUrl : `http://${cleanUrl}`);
        hostname = parsed.hostname;
        cleanUrl = `${parsed.protocol}//${parsed.host}`;
      } catch (e) {
        const match = cleanUrl.match(/^(?:https?:\/\/)?([^:/]+)/i);
        if (match) hostname = match[1];
      }
      server.streamUrl = cleanUrl;
      server.hlsBaseUrl = hlsBaseUrl || cleanUrl;
      server.rtmpBaseUrl = rtmpBaseUrl || `rtmp://${hostname}/static`;
    } else {
      if (rtmpBaseUrl) server.rtmpBaseUrl = rtmpBaseUrl;
      if (hlsBaseUrl) server.hlsBaseUrl = hlsBaseUrl;
    }

    await server.save();
    const updated = await Server.findById(id).populate('createdBy', 'name email role');

    return res.status(200).json({
      message: 'Server updated successfully',
      server: updated
    });
  } catch (error) {
    next(error);
  }
};


// DELETE /api/servers/:id
export const deleteServer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const server = await Server.findById(id);
    if (!server) {
      return res.status(404).json({ message: 'Server not found' });
    }

    if (req.user.role === ROLES.ADMIN && String(server.createdBy) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Forbidden: You cannot delete this server' });
    }

    await Server.findByIdAndDelete(id);
    return res.status(200).json({ message: 'Server deleted successfully' });
  } catch (error) {
    next(error);
  }
};
