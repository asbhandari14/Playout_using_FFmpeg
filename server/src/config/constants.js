export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  USER: 'user'
};

export const CHANNEL_STATUS = {
  IDLE: 'idle',
  LIVE: 'live',
  ERROR: 'error'
};

export const ASSET_STATUS = {
  UPLOADING: 'uploading',
  PROCESSING: 'processing',
  READY: 'ready',
  FAILED: 'failed'
};

export const PLAYLIST_ITEM_STATUS = {
  QUEUED: 'queued',
  PLAYING: 'playing',
  PLAYED: 'played'
};

export const PLAYLIST_TYPE = {
  DEFAULT: 'default',
  SCHEDULING: 'scheduling',
  LIVE_SCHEDULE: 'live_schedule',
  ADVERTISEMENT: 'advertisement',
  EMERGENCY: 'emergency'
};

export const PLAYLIST_PRIORITY = {
  [PLAYLIST_TYPE.EMERGENCY]: 5,        // Highest priority
  [PLAYLIST_TYPE.ADVERTISEMENT]: 4,    // 2nd highest priority
  [PLAYLIST_TYPE.LIVE_SCHEDULE]: 3,    // 3rd highest priority
  [PLAYLIST_TYPE.SCHEDULING]: 2,       // 4th highest priority
  [PLAYLIST_TYPE.DEFAULT]: 1           // Lowest priority
};

export const SCHEDULE_OPTION = {
  NONE: 'none',
  WEEKLY: 'weekly',
  DATE: 'date'
};

export const LOGO_POSITIONS = {
  TOP_LEFT: 'top-left',
  TOP_RIGHT: 'top-right',
  CENTER: 'center',
  BOTTOM_LEFT: 'bottom-left',
  BOTTOM_RIGHT: 'bottom-right'
};
