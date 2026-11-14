import { generateChannelEpg, generateChannelXmltv, autoSyncChannelEpg } from '../services/epgService.js';

/**
 * GET /api/v1/channels/:channelId/epg
 * Returns JSON EPG schedule with all micro-events, program titles, descriptions,
 * durations, commercial breakdowns, and real-time status.
 */
export const getChannelEpgHandler = async (req, res) => {
  try {
    const { channelId } = req.params;
    const { date, refresh, force } = req.query;
    const forceSync = refresh === 'true' || force === 'true';

    const epg = await generateChannelEpg(channelId, date, forceSync);
    return res.status(200).json({
      success: true,
      data: epg
    });
  } catch (err) {
    console.error('[EPG Controller Error]', err);
    return res.status(err.message === 'Channel not found' ? 404 : 500).json({
      success: false,
      message: err.message || 'Failed to generate EPG schedule'
    });
  }
};

/**
 * POST /api/v1/channels/:channelId/epg/sync
 * Manually force re-syncs and persists the EPG for a specific date or today.
 */
export const syncChannelEpgHandler = async (req, res) => {
  try {
    const { channelId } = req.params;
    const { date } = req.body || {};

    await autoSyncChannelEpg(channelId, date ? [date] : null);
    const epg = await generateChannelEpg(channelId, date, true);

    return res.status(200).json({
      success: true,
      message: 'EPG synchronized successfully',
      data: epg
    });
  } catch (err) {
    console.error('[EPG Sync Controller Error]', err);
    return res.status(err.message === 'Channel not found' ? 404 : 500).json({
      success: false,
      message: err.message || 'Failed to sync EPG schedule'
    });
  }
};

/**
 * GET /api/v1/channels/:channelId/epg.xml
 * Returns XMLTV compliant XML feed for IPTV players, OTT clients, and smart TV apps.
 */
export const getChannelEpgXmlHandler = async (req, res) => {
  try {
    const { channelId } = req.params;
    const { date } = req.query;

    const epg = await generateChannelEpg(channelId, date);
    const xml = generateChannelXmltv(epg);

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="epg-${channelId}.xml"`);
    return res.status(200).send(xml);
  } catch (err) {
    console.error('[EPG XML Error]', err);
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    return res.status(err.message === 'Channel not found' ? 404 : 500).send(
      `<?xml version="1.0" encoding="UTF-8"?><error>${err.message}</error>`
    );
  }
};
