/**
 * Service for communicating with Flussonic Media Server REST API.
 * Handles automatic provisioning of live streams / channels in Flussonic.
 */
import { decrypt } from '../utils/crypto.js';

/**
 * Sanitizes any channel name or stream key into a URL-safe, alphanumeric stream identifier
 * (no spaces, special characters, etc.) e.g. "SAI LEELA" -> "saileela" or "sai_leela"
 * @param {string} val
 * @returns {string}
 */
export const sanitizeStreamKey = (val) => {
  if (!val) return 'live';
  return val
    .toString()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_-]/g, '')
    .replace(/^_+|_+$/g, '') || 'live';
};

/**
 * Normalizes the base HTTP URL of the Flussonic server (e.g. "http://94.136.185.222:81")
 * @param {Object} server - Mongoose Server document or object
 * @returns {string} Normalized base URL
 */
export const getFlussonicBaseUrl = (server) => {
  const rawUrl = server?.streamUrl || server?.hlsBaseUrl || 'http://127.0.0.1:81';
  let cleanUrl = rawUrl.trim().replace(/\/+$/, '');
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    cleanUrl = `http://${cleanUrl}`;
  }
  return cleanUrl;
};

/**
 * Builds HTTP headers including Basic Auth for Flussonic API requests
 * @param {Object} server - Server model with serverUsername and getDecryptedPassword()
 * @returns {Object} Headers object
 */
export const getFlussonicHeaders = (server) => {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  const username = server?.serverUsername?.trim();
  let password = '';

  if (typeof server?.getDecryptedPassword === 'function') {
    password = server.getDecryptedPassword() || '';
  } else if (server?.serverPasswordEncrypted) {
    try {
      password = decrypt(server.serverPasswordEncrypted) || '';
    } catch (e) {}
  } else if (server?.serverPassword) {
    password = server.serverPassword;
  }

  if (username && password) {
    const credentials = Buffer.from(`${username}:${password}`).toString('base64');
    headers['Authorization'] = `Basic ${credentials}`;
  }

  return headers;
};

/**
 * Creates or updates a channel stream in Flussonic Media Server
 * Configures the stream as a published ingest point (inputs: [{ url: "publish://" }])
 *
 * @param {Object} server - The Server document where channel is assigned
 * @param {string} channelOrKey - The channel stream key or name (e.g. "saileela")
 * @param {Object} [options] - Additional optional settings
 * @returns {Promise<{ success: boolean, message: string, streamKey: string, details?: any }>}
 */
export const createFlussonicStream = async (server, channelOrKey, options = {}) => {
  if (!server) {
    return { success: false, message: 'Server configuration is missing' };
  }

  const streamKey = sanitizeStreamKey(channelOrKey);
  const baseUrl = getFlussonicBaseUrl(server);
  const headers = getFlussonicHeaders(server);

  const payload = {
    title: options.title || streamKey,
    inputs: [
      {
        url: 'publish://'
      }
    ],
    ...options.flussonicConfig
  };

  const v3Url = `${baseUrl}/streamer/api/v3/streams/${encodeURIComponent(streamKey)}`;

  // 6-second timeout controller
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    console.log(`[Flussonic API] Provisioning stream '${streamKey}' on ${baseUrl}...`);
    const res = await fetch(v3Url, {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const status = res.status;
    let data = null;
    try { data = await res.json(); } catch (e) {}

    if (res.ok || status === 200 || status === 201) {
      console.log(`[Flussonic API] Stream '${streamKey}' provisioned successfully (HTTP ${status})`);
      return {
        success: true,
        streamKey,
        message: `Stream '${streamKey}' provisioned in Flussonic Media Server`,
        data
      };
    }

    if (status === 404) {
      // Legacy Flussonic API fallback
      console.warn(`[Flussonic API] v3 endpoint returned 404 for '${streamKey}', attempting legacy API...`);
      const legacyRes = await tryLegacyFlussonicCreate(baseUrl, streamKey, headers, payload);
      return { ...legacyRes, streamKey };
    }

    const errMsg = data?.message || data?.error || `HTTP ${status}`;
    console.warn(`[Flussonic API] Stream '${streamKey}' error (HTTP ${status}):`, errMsg);
    return {
      success: false,
      streamKey,
      status,
      message: `Flussonic returned HTTP ${status}: ${errMsg}`
    };
  } catch (err) {
    clearTimeout(timeoutId);
    const isTimeout = err.name === 'AbortError';
    const errMsg = isTimeout
      ? `Connection timed out connecting to Flussonic at ${baseUrl}`
      : err.message;
    console.warn(`[Flussonic API] Stream '${streamKey}' creation failed:`, errMsg);
    return {
      success: false,
      streamKey,
      message: errMsg
    };
  }
};

/**
 * Fallback for older Flussonic versions (e.g. Flussonic v20.x and earlier)
 */
const tryLegacyFlussonicCreate = async (baseUrl, streamKey, headers, payload) => {
  const legacyUrl = `${baseUrl}/flussonic/api/media/${encodeURIComponent(streamKey)}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(legacyUrl, {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const status = res.status;
    let data = null;
    try { data = await res.json(); } catch (e) {}

    if (res.ok || status === 200 || status === 201) {
      return { success: true, legacy: true, status, data };
    }
    return { success: false, legacy: true, status, message: `Legacy API status: ${status}` };
  } catch (err) {
    clearTimeout(timeoutId);
    return { success: false, legacy: true, message: err.message };
  }
};

/**
 * Removes a channel stream from Flussonic Media Server
 *
 * @param {Object} server - Server document
 * @param {string} channelOrKey - Name of channel or stream key to delete
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export const deleteFlussonicStream = async (server, channelOrKey) => {
  if (!server) {
    return { success: false, message: 'Server configuration is missing' };
  }

  const streamKey = sanitizeStreamKey(channelOrKey);
  const baseUrl = getFlussonicBaseUrl(server);
  const headers = getFlussonicHeaders(server);

  const v3Url = `${baseUrl}/streamer/api/v3/streams/${encodeURIComponent(streamKey)}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    console.log(`[Flussonic API] Deleting stream '${streamKey}' from ${baseUrl}...`);
    const res = await fetch(v3Url, {
      method: 'DELETE',
      headers,
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    return {
      success: res.ok || res.status === 200 || res.status === 204 || res.status === 404,
      message: `Stream '${streamKey}' deletion completed on Flussonic Media Server`
    };
  } catch (err) {
    clearTimeout(timeoutId);
    return { success: false, message: err.message };
  }
};

/**
 * Checks if a stream is active and receiving live input on Flussonic Media Server
 *
 * @param {Object} server - Server document
 * @param {string} channelOrKey - Name of channel or stream key
 * @returns {Promise<{ online: boolean, stats?: any }>}
 */
export const getFlussonicStreamStatus = async (server, channelOrKey) => {
  if (!server) return { online: false };

  const streamKey = sanitizeStreamKey(channelOrKey);
  const baseUrl = getFlussonicBaseUrl(server);
  const headers = getFlussonicHeaders(server);

  const v3Url = `${baseUrl}/streamer/api/v3/streams/${encodeURIComponent(streamKey)}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const res = await fetch(v3Url, {
      method: 'GET',
      headers,
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) return { online: false };
    const data = await res.json();
    const isAlive = data?.stats?.alive === true || data?.stats?.running === true || (data?.stats?.bitrate > 0);
    return { online: isAlive, stats: data?.stats };
  } catch (err) {
    clearTimeout(timeoutId);
    return { online: false, error: err.message };
  }
};
