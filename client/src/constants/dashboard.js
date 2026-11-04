// Available permission modules matching the UI
export const DEFAULT_PERMISSIONS = [
  'HLS',
  'RESTREAM',
  'Playlist Management',
  'Cg',
  'Youtube Playlist',
  'VOD Scheduling',
  'Show SRT Output',
  'Custom Import',
  'Public Iframe Page'
];

// Permissions pre-selected for a new user (everything except 'Public Iframe Page')
export const DEFAULT_USER_PERMISSIONS = DEFAULT_PERMISSIONS.slice(0, 8);

export const DEFAULT_SERVER_URL = 'http://94.136.185.222:81';
export const RTMP_BASE_URL = 'rtmp://94.136.185.222:1935/static/';

export const getEmptyUserForm = () => ({
  username: '',
  email: '',
  password: '',
  role: 'user', // 'user' | 'admin' | 'super_admin'
  bandwidthAmount: '',
  bandwidthUnit: 'GB',
  storageAmount: '',
  storageUnit: 'GB',
  gracePeriodDays: 3,
  permissions: [...DEFAULT_USER_PERMISSIONS]
});

export const getEmptyChannelForm = () => ({
  name: '',
  server: '',
  serverDomain: '',
  serverUsername: '',
  serverPassword: '',
  assignedUser: '',
  streamKey: '',
  allocatedStorageAmount: '',
  allocatedStorageUnit: 'GB',
  resolution: '1280x720',
  fps: 25,
  videoBitrate: '2500k',
  audioBitrate: '128k'
});

export const getEmptyServerForm = () => ({
  name: '',
  category: 'General',
  streamUrl: DEFAULT_SERVER_URL,
  serverUsername: 'admin',
  serverPassword: ''
});
