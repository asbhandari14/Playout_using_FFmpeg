const fs = require('fs');
const path = require('path');

const outputPath = path.resolve('d:\\Office_Work\\10.   Playlist_Playout_using_Ffmpeg\\uml.tldr');

let shapeIndex = 1;
let bindingIndex = 1;

function padIndex(num) {
  return 'a' + String(num).padStart(4, '0');
}

function createGeoShape({
  id,
  x,
  y,
  w,
  h,
  text,
  color = 'black',
  fill = 'semi',
  dash = 'solid',
  size = 's',
  font = 'sans',
  align = 'start',
  verticalAlign = 'start'
}) {
  return {
    id: `shape:${id}`,
    typeName: 'shape',
    type: 'geo',
    parentId: 'page:page',
    index: padIndex(shapeIndex++),
    x,
    y,
    rotation: 0,
    isLocked: false,
    opacity: 1,
    meta: {},
    props: {
      w,
      h,
      geo: 'rectangle',
      color,
      labelColor: 'black',
      fill,
      dash,
      size,
      font,
      text,
      align,
      verticalAlign,
      growY: 0,
      url: '',
      scale: 1
    }
  };
}

function createArrowShape({
  id,
  start,
  end,
  text = '',
  color = 'black',
  size = 's',
  dash = 'solid',
  bend = 0
}) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  return {
    id: `shape:${id}`,
    typeName: 'shape',
    type: 'arrow',
    parentId: 'page:page',
    index: padIndex(shapeIndex++),
    x: start.x,
    y: start.y,
    rotation: 0,
    isLocked: false,
    opacity: 1,
    meta: {},
    props: {
      dash,
      size,
      fill: 'none',
      color,
      labelColor: 'black',
      bend,
      start: { x: 0, y: 0 },
      end: { x: dx, y: dy },
      arrowheadStart: 'none',
      arrowheadEnd: 'arrow',
      text,
      labelPosition: 0.5,
      font: 'sans',
      scale: 1
    }
  };
}

function createBinding({ arrowId, toId, terminal, normalizedAnchor }) {
  return {
    id: `binding:${bindingIndex++}`,
    typeName: 'binding',
    type: 'arrow',
    fromId: `shape:${arrowId}`,
    toId: `shape:${toId}`,
    meta: {},
    props: {
      terminal,
      normalizedAnchor: normalizedAnchor || { x: 0.5, y: 0.5 },
      isExact: false,
      isPrecise: false
    }
  };
}

const records = [
  {
    id: 'document:document',
    typeName: 'document',
    gridSize: 10,
    name: '',
    meta: {}
  },
  {
    id: 'page:page',
    typeName: 'page',
    name: 'UML Architecture Diagram',
    index: 'a0000',
    meta: {}
  },
  {
    id: 'camera:page:page',
    typeName: 'camera',
    x: 100,
    y: 50,
    z: 0.35,
    meta: {}
  }
];

// -------------------------------------------------------------
// TOP HEADER BANNER
// -------------------------------------------------------------
records.push(
  createGeoShape({
    id: 'header_banner',
    x: 100,
    y: 40,
    w: 3840,
    h: 120,
    color: 'blue',
    fill: 'solid',
    font: 'sans',
    size: 'm',
    align: 'middle',
    verticalAlign: 'middle',
    text: 'DISTRIBUTED 24/7 PLAYLIST PLAYOUT & BROADCAST STREAMING SYSTEM\nFull-Stack UML Architecture, Multi-Process FFmpeg Engine, ZeroMQ IPC & Real-time Broadcast Pipeline'
  })
);

// -------------------------------------------------------------
// TIER 1: FRONTEND SINGLE-PAGE APPLICATION
// -------------------------------------------------------------
records.push(
  createGeoShape({
    id: 'tier1_container',
    x: 100,
    y: 190,
    w: 3840,
    h: 500,
    color: 'blue',
    fill: 'none',
    dash: 'dashed',
    font: 'sans',
    size: 'm',
    align: 'start',
    verticalAlign: 'start',
    text: 'TIER 1: FRONTEND SINGLE-PAGE APPLICATION (React 19 / Redux Toolkit / Vite / Hls.js / TailwindCSS)'
  })
);

records.push(
  createGeoShape({
    id: 'fe_pages',
    x: 140,
    y: 250,
    w: 680,
    h: 410,
    color: 'blue',
    fill: 'semi',
    size: 's',
    align: 'start',
    text: `[Pages & Routing View]
- LoginPage.jsx: JWT credentials form, token storage, auth guard
- ChannelsPage.jsx: Grid of broadcast channels, online badges
- ControlRoomPage.jsx: Playout master dashboard & controls
- ServersPage.jsx: Flussonic media server configs & testing
- UsersPage.jsx: RBAC administration (roles & assigned channels)
Responsibilities & Capabilities:
* Protected route authorization with Redux auth state
* Real-time channel telemetry monitoring
* Responsive TV broadcast control room layout`
  })
);

records.push(
  createGeoShape({
    id: 'fe_components',
    x: 860,
    y: 250,
    w: 740,
    h: 410,
    color: 'blue',
    fill: 'semi',
    size: 's',
    align: 'start',
    text: `[Control Room Core UI Components]
- BroadcastHeader.jsx:
  * Master ON-AIR badge, Start/Stop Broadcast triggers
  * Quick Fire L-Band (15s/30s/60s) & Ashton Band buttons
- VideoSection.jsx (Dual Player Architecture):
  * Local Preview: HTML5 native <video> for library media inspection
  * Live PGM Player: Hls.js low-latency live broadcast feed player
  * check-online polling loop (POST /channels/check-online, 3x retry tolerance)
- PlaylistTable.jsx:
  * Drag-and-drop broadcast schedule ordering & item status
    (QUEUED, PLAYING, PLAYED)
- AssetLibrary.jsx: Media catalog grid & chunked upload modal`
  })
);

records.push(
  createGeoShape({
    id: 'fe_live_controls',
    x: 1640,
    y: 250,
    w: 720,
    h: 410,
    color: 'blue',
    fill: 'semi',
    size: 's',
    align: 'start',
    text: `[Live Branding & Modal Controllers]
- LiveControls.jsx:
  * Station Logo: toggle on/off, corner/custom X/Y %, scale
  * Animated Station Bug: toggle, GIF / PNG support, position
  * Crawling Ticker: live breaking text, speed, colors, font
- MoreSettingsModal.jsx:
  * L-Band DVE Squeeze: window width/height, position X/Y
  * Ashton Band: lower-third banner toggle, squeeze vs overlay
- ScheduleModal.jsx:
  * Calendar & time-based automated commercial interruption programming
  * Day-of-week recurrence & priority rules`
  })
);

records.push(
  createGeoShape({
    id: 'fe_redux',
    x: 2400,
    y: 250,
    w: 720,
    h: 410,
    color: 'blue',
    fill: 'semi',
    size: 's',
    align: 'start',
    text: `[Client State Management (Redux Toolkit)]
- authSlice: user profile, JWT access token, roles
- channelSlice: active channel metadata, branding state, stream status
- playlistSlice: playlist items, currently playing item index
- assetSlice: media asset catalog, upload progress tracking
- serverSlice: media server configs, Flussonic credentials
- userSlice: user accounts & assigned channel mapping
Store Architecture:
* useSelector() for reactive UI subscriptions
* createAsyncThunk for API actions (fetch, update, delete)`
  })
);

records.push(
  createGeoShape({
    id: 'fe_networking',
    x: 3160,
    y: 250,
    w: 740,
    h: 410,
    color: 'blue',
    fill: 'semi',
    size: 's',
    align: 'start',
    text: `[Client Networking & WebSocket Client]
- api/axios.js (HTTP Client):
  * Bearer JWT token injection on outgoing requests
  * Response Interceptor Queue: on 401 Unauthorized, queues requests,
    transparently calls /auth/refresh, replays queue on new token
- Socket.IO Client (Real-time Gateway):
  * Joins isolated channel rooms: channel:<channelId>
  * Inbound Event Handlers:
    - stream_started / stream_stopped
    - stream_item_playing / stream_item_played
    - branding_updated (logo, bug, ticker, lband, ashton)
    - schedule_triggered / schedule_completed`
  })
);

// -------------------------------------------------------------
// TIER 2: BACKEND API GATEWAY & CONTROLLERS
// -------------------------------------------------------------
records.push(
  createGeoShape({
    id: 'tier2_container',
    x: 100,
    y: 720,
    w: 3840,
    h: 510,
    color: 'violet',
    fill: 'none',
    dash: 'dashed',
    font: 'sans',
    size: 'm',
    align: 'start',
    verticalAlign: 'start',
    text: 'TIER 2: BACKEND API GATEWAY & CONTROLLER TIER (Node.js / Express 5 / Socket.IO / Multer)'
  })
);

records.push(
  createGeoShape({
    id: 'be_server',
    x: 140,
    y: 780,
    w: 700,
    h: 420,
    color: 'violet',
    fill: 'semi',
    size: 's',
    align: 'start',
    text: `[Server & Gateway Runtime]
- server.js:
  * HTTP & Socket.IO server creation on PORT 5000
  * Socket rooms: io.to("channel:<id>") for isolated broadcast
  * Crash Protection: unhandledRejection & uncaughtException handlers
  * Graceful Shutdown: PM2 / nodemon SIGUSR2 & SIGINT hooks
  * MongoDB connection bootstrap & Playout Scheduler startup
- app.js:
  * Express 5 framework, Helmet security, CORS origin whitelist
  * Static media serving: /streams/*, /uploads/*
  * Route mounting: /api/{auth, channels, streams, playlists, ...}`
  })
);

records.push(
  createGeoShape({
    id: 'be_middleware',
    x: 880,
    y: 780,
    w: 700,
    h: 420,
    color: 'violet',
    fill: 'semi',
    size: 's',
    align: 'start',
    text: `[Security & Validation Middleware]
- auth.js: JWT Bearer token decoding & user hydration on req.user
- rbac.js: Role-based authorization (super_admin, admin, user)
- upload.js: Multer disk storage for chunked multipart video files
- logoUpload.js: Multer image filter for PNG/JPG/GIF branding assets
- validate.js: Zod request validation against schemas
- errorHandler.js: Centralized operational error catching & JSON replies
Security Policies:
* Password hashing with bcrypt (salt rounds = 10)
* AES-256-CBC server credential encryption`
  })
);

records.push(
  createGeoShape({
    id: 'be_controllers',
    x: 1620,
    y: 780,
    w: 1140,
    h: 420,
    color: 'violet',
    fill: 'semi',
    size: 's',
    align: 'start',
    text: `[REST API Controllers & Route Handlers]
- authController: login(), register(), refresh(), logout(), getMe()
- channelController: getChannels(), createChannel(), updateBranding(), checkOnline()
- streamController: startBroadcast(), stopBroadcast(), getStreamStatus(), reloadStream()
- playlistController: getPlaylist(), addItem(), removeItem(), reorderItems(), toggleLoop()
- brandingController: updateLogo(), updateTicker(), updateBug(), fireLBand(), fireAshton()
- scheduleController: getSchedules(), createSchedule(), updateSchedule(), deleteSchedule()
- assetController: initChunk(), uploadChunk(), finalizeUpload(), getAssets(), deleteAsset()
- serverController: getServers(), createServer(), testFlussonicConnection(), syncStreams()
- userController: getUsers(), createUser(), updateUserRole(), deleteUser()`
  })
);

records.push(
  createGeoShape({
    id: 'be_services_utils',
    x: 2800,
    y: 780,
    w: 1100,
    h: 420,
    color: 'violet',
    fill: 'semi',
    size: 's',
    align: 'start',
    text: `[Backend Core Services & Utilities]
- flussonicService.js:
  * Flussonic REST API integration (http://<host>:81)
  * sanitizeStreamKey(): alphanumeric URL-safe key sanitizer
  * createFlussonicStream(): provisions publish:// stream with Basic Auth
  * checkFlussonicStreamOnline(): polls stream online/bitrate telemetry
  * deleteFlussonicStream(): cleans up stream on channel removal
- assetService.js: Chunked file reassembly, ffprobe media validation, thumbnail creation
- utils/crypto.js: AES-256-CBC encrypt() / decrypt() for server passwords
- utils/token.js: generateAccessToken() (15m) & generateRefreshToken() (7d)
- utils/media.js: ffprobe duration, resolution, codecs, and audio sample rate inspection`
  })
);

// -------------------------------------------------------------
// TIER 3: PLAYOUT ENGINE CORE TIER
// -------------------------------------------------------------
records.push(
  createGeoShape({
    id: 'tier3_container',
    x: 100,
    y: 1260,
    w: 3840,
    h: 750,
    color: 'green',
    fill: 'none',
    dash: 'dashed',
    font: 'sans',
    size: 'm',
    align: 'start',
    verticalAlign: 'start',
    text: 'TIER 3: PLAYOUT ENGINE CORE TIER (FFmpeg Dual-Process / ZeroMQ IPC / Real-Time Feeder / Scheduler)'
  })
);

records.push(
  createGeoShape({
    id: 'pe_stream_manager',
    x: 140,
    y: 1320,
    w: 720,
    h: 660,
    color: 'green',
    fill: 'semi',
    size: 's',
    align: 'start',
    text: `[StreamManager (streamManager.js)]
- Properties & Registries:
  * activeStreams: Map<channelId, { channel, encoder, feeder }>
  * nextZmqPort: 5600+ (auto-increment allocation per channel)
  * fireTimers: Map<channelId, { lbandTimer, ashtonTimer }>
- Broadcast Lifecycle Operations:
  * startStream(channelId, startIndex, options):
    1. Pre-provisions RTMP stream on Flussonic Media Server
    2. Restores leftover preScheduleBranding if interrupted
    3. Spawns long-running EncoderService on unique ZMQ port
    4. Spawns FeederService connected to encoder.process.stdin
    5. Emits stream_started via Socket.IO
  * stopStream(channelId):
    Gracefully shuts down feeder and encoder, cleans timers & sockets
  * fireLBand(channelId, durationSec):
    Triggers DVE squeeze, sets auto-revert timer to restore full screen
  * fireAshton(channelId, durationSec, squeeze):
    Triggers Ashton lower-third banner & squeeze, sets auto-revert timer`
  })
);

records.push(
  createGeoShape({
    id: 'pe_feeder_service',
    x: 900,
    y: 1320,
    w: 860,
    h: 660,
    color: 'green',
    fill: 'semi',
    size: 's',
    align: 'start',
    text: `[FeederService (feederService.js)]
- Real-Time Media Feeder Engine:
  * Spawns decoder FFmpeg process for each playlist item:
    ffmpeg -re -ss <offset> -i <path> -vf scale=1280:720,pad=...,fps=25 -f mpegts pipe:1
  * Pipes raw MPEG-TS stdout to encoder stdin:
    this.currentDecoder.stdout.pipe(this.encoderProcess.stdin, { end: false })
  * Playback State Tracking:
    getCurrentPlaybackPosition() -> { index, offsetSeconds }
  * Standby Slate Generator:
    streamStandbySlate(duration): outputs live test pattern when playlist queue is empty!
- Commercial Break Interruption Engine:
  * interruptWithSchedule(schedule):
    1. Snapshots active playback PTS & pre-schedule branding state
    2. Kills regular decoder gracefully without closing encoder stdin
    3. Spawns decoder for commercial ad assets with Back-In countdown timer
    4. Upon ad completion, calls restorePreScheduleBranding()
    5. Seamlessly resumes regular playlist item at exact frame offset!`
  })
);

records.push(
  createGeoShape({
    id: 'pe_encoder_service',
    x: 1800,
    y: 1320,
    w: 1060,
    h: 660,
    color: 'green',
    fill: 'semi',
    size: 's',
    align: 'start',
    text: `[EncoderService (encoderService.js)]
- Master Encoding FFmpeg Process:
  * Long-running process spawned with stdio: ['pipe', 'pipe', 'pipe']
  * Video encoding: libx264, veryfast preset, GOP=50, 25fps, yuv420p
  * Audio encoding: aac, 44100Hz stereo, 128kbps
  * Dual Output Tee Muxer:
    - Local low-latency HLS: streams/<channelId>/hls/index.m3u8 (1s chunks)
    - Remote RTMP: rtmp://<flussonic>/static/<streamKey> (+global_header)
- ZeroMQ IPC Filtergraph Controller:
  * ZeroMQ Request socket (zmq.Request()) connected to tcp://127.0.0.1:<zmqPort>
  * sendZmqCommand(commandString, timeoutMs = 700):
    Directly injects live runtime commands into FFmpeg filtergraph!
- Runtime Overlay Control APIs:
  * setLogoEnabled(enabled) / updateLogoPosition(pos, size, mx, my)
  * setTickerEnabled(enabled) / updateTickerPositions(mb, speed)
  * setBugEnabled(enabled) / updateBugPosition(pos, size, x, y)
  * setLBandEnabled(enabled) / setLBandSmootherstep(targetW, targetH, targetX, targetY)
  * setAshtonLive(enabled, squeeze)`
  })
);

records.push(
  createGeoShape({
    id: 'pe_scheduler_branding',
    x: 2900,
    y: 1320,
    w: 1000,
    h: 660,
    color: 'green',
    fill: 'semi',
    size: 's',
    align: 'start',
    text: `[Scheduler & Branding Engine]
- SchedulerService (schedulerService.js):
  * 24/7 Playout Clock Service checking schedules every 5 seconds
  * Checks active channels, enabled schedules, date ranges & day-of-week
  * Evaluates dailyStartTime & dailyEndTime (supports midnight crossing!)
  * Priority ordering & duplicate prevention (lastAiredDate = YYYY-MM-DD)
  * Dispatches scheduled events:
    - video: triggers feeder.interruptWithSchedule(schedule)
    - lband: triggers streamManager.fireLBand(channelId, duration)
    - ashton: triggers streamManager.fireAshton(channelId, duration, squeeze)
- BrandingAssets (brandingAssets.js):
  * ensureBrandingFiles(): initializes transparent PNGs / GIFs in channel dir
  * renderTickerImage(): uses Sharp + SVG to generate:
    - ticker_bg.png: static 1280px background bar
    - ticker.png: smooth scrolling text strip with full Unicode / Hindi support
  * buildBackInTimerFilter(): builds drawtext countdown filter for commercials`
  })
);

// -------------------------------------------------------------
// TIER 4: PERSISTENCE, STORAGE & EXTERNAL STREAMING
// -------------------------------------------------------------
records.push(
  createGeoShape({
    id: 'tier4_container',
    x: 100,
    y: 2040,
    w: 3840,
    h: 550,
    color: 'yellow',
    fill: 'none',
    dash: 'dashed',
    font: 'sans',
    size: 'm',
    align: 'start',
    verticalAlign: 'start',
    text: 'TIER 4: PERSISTENCE, STORAGE & EXTERNAL STREAMING DISTRIBUTION TIER'
  })
);

records.push(
  createGeoShape({
    id: 'db_models',
    x: 140,
    y: 2100,
    w: 1220,
    h: 465,
    color: 'yellow',
    fill: 'semi',
    size: 's',
    align: 'start',
    text: `[MongoDB Database Models (Mongoose ORM)]
- User: username, password (bcrypt), role (super_admin | admin | user), assignedChannels [ObjectId]
- Server: name, streamUrl, hlsBaseUrl, rtmpBaseUrl, serverUsername, serverPasswordEncrypted (AES-256)
- Channel: name, server (ref), assignedUser (ref), streamKey, hlsUrl, rtmpUrl, status (IDLE | RUNNING | ERROR),
  currentPlayingIndex, currentAssetId, outputSettings { resolution, width, height, fps, videoBitrate, audioBitrate },
  branding { logo, bug, ticker, lband, ashton, preScheduleBranding }
- Playlist: channel (ref), name, loop (boolean), items: [{ asset: ref, order: Number, status: enum }]
- Asset: originalName, fileName, filePath, thumbnailPath, fileSize, duration, durationFormatted, mimeType, status
- Schedule: channel (ref), title, type (video | lband | ashton), daysOfWeek, startDate, endDate,
  dailyStartTime, dailyEndTime, duration, ashtonSqueeze, assets [ref], priority, lastAiredDate
- RefreshToken: user (ref), tokenHash, expiresAt, revoked (boolean)`
  })
);

records.push(
  createGeoShape({
    id: 'storage_fs',
    x: 1400,
    y: 2100,
    w: 1160,
    h: 465,
    color: 'yellow',
    fill: 'semi',
    size: 's',
    align: 'start',
    text: `[Local File Storage & Working Directories]
- uploads/videos/<channelId>/:
  * Normalized high-definition MP4 playout video files
- uploads/thumbnails/:
  * Auto-extracted video frame thumbnails (thumb_<assetId>.jpg)
- uploads/branding/:
  * Persistent storage for uploaded logos, animated bug GIFs, and L-Band graphics
- uploads/temp/general/:
  * Multi-part video chunk staging directory during active uploads
- streams/<channelId>/:
  * Channel broadcast runtime sandbox:
    logo.png, bug.png / bug.gif, ticker_bg.png, ticker.png, lband.png, ashton.png
- streams/<channelId>/hls/:
  * Live monitoring HLS stream: index.m3u8 manifest + rotating index*.ts media segments`
  })
);

records.push(
  createGeoShape({
    id: 'ext_flussonic',
    x: 2600,
    y: 2100,
    w: 1300,
    h: 465,
    color: 'orange',
    fill: 'semi',
    size: 's',
    align: 'start',
    text: `[Flussonic Media Server (External Broadcast Cloud)]
- Architecture & Role:
  * High-performance 24/7 Carrier-grade Media Streaming Server
  * Remote RTMP stream receiver: rtmp://<flussonic-host>/static/<streamKey>
- REST API Provisioning Interface:
  * PUT /flussonic/api/v3/streams/:streamKey
  * Payload: { title: channel.name, inputs: [{ url: "publish://" }] }
  * Flussonic registers dynamic RTMP publishing listener socket
- Adaptive Bitrate Transcoding & CDN Edge Packaging:
  * Dual multi-protocol delivery: HLS (m3u8), MPEG-DASH (mpd), WebRTC, RTMP re-publish
  * Global viewer delivery with low latency and SSL/TLS edge termination
- Stream Health Monitoring:
  * GET /flussonic/api/v3/streams/:streamKey -> verifies active bitrate, frame drops, and client count`
  })
);

// -------------------------------------------------------------
// DEEP DIVE PANEL A: FFMPEG ENGINE & FILTERGRAPH
// -------------------------------------------------------------
records.push(
  createGeoShape({
    id: 'deepdive_a_container',
    x: 100,
    y: 2630,
    w: 2380,
    h: 1290,
    color: 'red',
    fill: 'none',
    dash: 'dashed',
    font: 'sans',
    size: 'm',
    align: 'start',
    verticalAlign: 'start',
    text: 'DEEP-DIVE ARCHITECTURE: FFMPEG DUAL-PROCESS ENGINE & 8-LAYER FILTERGRAPH PIPELINE'
  })
);

records.push(
  createGeoShape({
    id: 'dd_feeder',
    x: 140,
    y: 2700,
    w: 600,
    h: 360,
    color: 'red',
    fill: 'semi',
    size: 's',
    align: 'start',
    text: `[Feeder Decoder Process (ffmpeg -re)]
- Command & Execution:
  ffmpeg -re -ss <startOffset> -i <asset.mp4>
  -vf scale=1280:720:force_original_aspect_ratio=decrease,
      pad=1280:720:(ow-iw)/2:(oh-ih)/2,fps=25
  -c:v rawvideo -c:a pcm_s16le -f mpegts pipe:1
- Pacing & Normalization:
  Forces all media files to 1280x720 25fps MPEG-TS.
- Non-stop Pipe Feed:
  currentDecoder.stdout.pipe(encoderProcess.stdin, { end: false })
  Encoder stdin stays permanently open across track changes!`
  })
);

records.push(
  createGeoShape({
    id: 'dd_ipc_pipe',
    x: 780,
    y: 2700,
    w: 460,
    h: 360,
    color: 'red',
    fill: 'semi',
    size: 's',
    align: 'start',
    text: `[Anonymous Stdin IPC Pipe]
- Continuous byte stream (MPEG-TS)
- Seamless Loop:
  feeder loops playlist items; when item N ends,
  item N+1 spawns immediately and pipes to same stdin.
- Commercial Break Interruption:
  feeder pauses main pipe, saves exact PTS,
  streams commercial ad MPEG-TS with Back-In timer,
  then seamlessly resumes main video at saved offset!
- Standby Slate Generator:
  outputs synthetic color bars to prevent encoder starvation.`
  })
);

records.push(
  createGeoShape({
    id: 'dd_encoder',
    x: 1280,
    y: 2700,
    w: 1160,
    h: 360,
    color: 'red',
    fill: 'semi',
    size: 's',
    align: 'start',
    text: `[Master Encoder Process (ffmpeg)]
- Command:
  ffmpeg -y -f mpegts -i pipe:0 \\
    -loop 1 -i logo.png \\
    -loop 1 -i ticker_bg.png \\
    -loop 1 -i ticker.png \\
    -loop 1 -i lband.png \\
    -loop 1 -i ashton.png \\
    -ignore_loop 0 -i bug.gif \\
    -filter_complex "<8_LAYER_FILTERGRAPH>" \\
    -map "[vout]" -map "0:a?" \\
    -c:v libx264 -preset veryfast -g 50 -keyint_min 25 -sc_threshold 0 \\
    -b:v 2500k -pix_fmt yuv420p -flags +global_header \\
    -c:a aac -b:a 128k -ar 44100 -ac 2 \\
    -f tee "[f=hls:hls_time=1:hls_list_size=3]streams/.../index.m3u8|[f=flv]rtmp://.../static/..."`
  })
);

records.push(
  createGeoShape({
    id: 'dd_filtergraph',
    x: 140,
    y: 3090,
    w: 2300,
    h: 470,
    color: 'red',
    fill: 'semi',
    size: 's',
    align: 'start',
    text: `[The Complex 8-Layer Filtergraph Architecture Inside FFmpeg]
Stage 1: Background Canvases:
  color=c=black:s=1280x720:r=25[lband_bg]; color=c=black:s=1280x720:r=25[ashton_bg]
Stage 2: Crawling Ticker Pre-Compositing:
  [2:v][3:v] overlay@ticktext=x='...':y='0':format=auto [tickbar_raw]; [tickbar_raw] crop@tick_crop=w=...:h=ih:x=0:y=0 [tickbar]
Stage 3: ZeroMQ Broker & 3-Way Video Split:
  [0:v] zmq=bind_address=tcp\\\\://127.0.0.1\\\\:<port>,split=3 [v_full][v_lband_in][v_ashton_in]
Stage 4: Broadcast DVE Squeeze for Uncut L-Band Graphic:
  [v_lband_in] scale@lband_sq=w='...':h='...':eval=frame [v_lband_scaled]; [4:v] format=rgba [lband_g]
  [lband_bg][lband_g] overlay@lband_gfx=x=0:y=0 [lband_base]; [lband_base][v_lband_scaled] overlay@lband_vid_pos=x='...':y='...' [lband_composite]
Stage 5: Ashton Band Lower-Third Squeeze & Direct Overlay:
  [5:v] format=rgba,split [ashton_sq_g][ashton_ov_g]; [ashton_bg][ashton_sq_g] overlay@ashton_sq_gfx=x=0:y='...' [ashton_base]
  [v_ashton_in] scale@ashton_sq=w=1280:h='...':eval=frame [v_ashton_scaled]; [ashton_base][v_ashton_scaled] overlay@ashton_sq_vid=x=0:y=0 [ashton_sq_composite]
Stage 6: Master Compositing Switches:
  [v_full][lband_composite] overlay@lband_master=x='...':y='...' [v_after_lband]
  [v_after_lband][ashton_sq_composite] overlay@ashton_squeeze=x='...':y='...' [v_after_ashton_sq]
  [v_after_ashton_sq][ashton_ov_g] overlay@ashton_overlay=x='...':y='...' [v_after_ashton]
Stage 7: Animated Station Bug Overlay:
  [6:v] scale@bug_scale=w=...:h=...:eval=frame [v_bug_scaled]; [v_after_ashton][v_bug_scaled] overlay@bug=x='...':y='...' [v_after_bug]
Stage 8: Station Logo & Crawling Ticker (Top of Z-Order):
  [1:v] scale@logo_scale=w=...:h=...:eval=frame [v_logo_scaled]; [v_after_bug][v_logo_scaled] overlay@logo=x='...':y='...' [v_after_logo]
  [v_after_logo][tickbar] overlay@tick=x='...':y='...' [vout]`
  })
);

records.push(
  createGeoShape({
    id: 'dd_out_hls',
    x: 140,
    y: 3590,
    w: 1120,
    h: 290,
    color: 'red',
    fill: 'semi',
    size: 's',
    align: 'start',
    text: `[Tee Destination 1: Local HLS Streaming]
- Output Target: streams/<channelId>/hls/index.m3u8
- FFmpeg Tee Options:
  [f=hls:hls_time=1:hls_list_size=3:hls_flags=delete_segments+split_by_time]
- Architecture & Performance:
  * Generates short 1.0-second HLS media chunks
  * Immediate availability for low-latency live monitoring in ControlRoom
  * Consumed directly by React 19 Frontend via Hls.js in VideoSection.jsx`
  })
);

records.push(
  createGeoShape({
    id: 'dd_out_rtmp',
    x: 1320,
    y: 3590,
    w: 1120,
    h: 290,
    color: 'red',
    fill: 'semi',
    size: 's',
    align: 'start',
    text: `[Tee Destination 2: Remote RTMP Ingestion]
- Output Target: rtmp://<flussonic_host>/static/<streamKey>
- FFmpeg Tee Options:
  [f=flv:flvflags=no_duration_filesize:onfail=ignore]
- Architecture & Performance:
  * Continuous high-bitrate broadcast video delivery (2500kbps, 25fps)
  * onfail=ignore prevents local encoder failure if remote network drops!
  * Directly ingested by Flussonic Media Server for global Edge distribution`
  })
);

// -------------------------------------------------------------
// DEEP DIVE PANEL B: ZEROMQ CONTROL LOOP & SOCKET.IO
// -------------------------------------------------------------
records.push(
  createGeoShape({
    id: 'deepdive_b_container',
    x: 2520,
    y: 2630,
    w: 1420,
    h: 1290,
    color: 'grey',
    fill: 'none',
    dash: 'dashed',
    font: 'sans',
    size: 'm',
    align: 'start',
    verticalAlign: 'start',
    text: 'DEEP-DIVE ARCHITECTURE: ZEROMQ DYNAMIC RUNTIME CONTROL LOOP & SOCKET.IO STATE SYNC'
  })
);

records.push(
  createGeoShape({
    id: 'dd_operator',
    x: 2550,
    y: 2700,
    w: 420,
    h: 360,
    color: 'grey',
    fill: 'semi',
    size: 's',
    align: 'start',
    text: `[Operator UI Action]
- Operator in ControlRoom toggles branding:
  * Enable / Disable Station Logo
  * Adjust Logo Size or Position
  * Toggle Station Bug (GIF / PNG)
  * Update Crawling Ticker Headline
  * Fire Quick L-Band DVE (30s)
  * Fire Ashton Band Lower-Third
- Redux dispatches async action:
  POST /api/channels/:id/branding/...`
  })
);

records.push(
  createGeoShape({
    id: 'dd_gateway_zmq',
    x: 3010,
    y: 2700,
    w: 440,
    h: 360,
    color: 'grey',
    fill: 'semi',
    size: 's',
    align: 'start',
    text: `[Backend Gateway & StreamManager]
- Express route handles request
- StreamManager retrieves active instance:
  stream = activeStreams.get(channelId)
- Formats ZeroMQ command string:
  Target filter name + parameter value:
  * overlay@logo: x 1120 y 30
  * scale@lband_sq: w 960 h 540
  * overlay@lband_master: x 0 y 0
- Calls encoder.sendZmqCommand(cmd)`
  })
);

records.push(
  createGeoShape({
    id: 'dd_zmq_socket',
    x: 3490,
    y: 2700,
    w: 420,
    h: 360,
    color: 'grey',
    fill: 'semi',
    size: 's',
    align: 'start',
    text: `[ZeroMQ IPC REQ/REP Client]
- Socket: zmq.Request()
- Connects: tcp://127.0.0.1:<port>
  (e.g., port 5600 for channel 1, 5601...)
- Strict Timeout Race:
  Promise.race([
    receivePromise,
    timeoutPromise (700ms)
  ])
- Auto-reconnect:
  Recovers cleanly if FFmpeg restarts.`
  })
);

records.push(
  createGeoShape({
    id: 'dd_ffmpeg_zmq_filter',
    x: 2550,
    y: 3090,
    w: 670,
    h: 790,
    color: 'grey',
    fill: 'semi',
    size: 's',
    align: 'start',
    text: `[In-Process FFmpeg ZeroMQ Filter]
- Filter Node in filtergraph:
  [0:v] zmq=bind_address=tcp\\\\://127.0.0.1\\\\:<port>,split=3
- Real-Time Command Execution:
  * Intercepts incoming REQ message on loopback socket
  * Routes command to downstream filter node by label
    (e.g., Parsed_overlay_19 for logo, Parsed_scale_5 for DVE)
  * Dynamic Evaluation (eval=frame):
    Applies updated values on the very next video frame!
  * Zero Interruption:
    Video & audio playback NEVER stop, skip, or buffer.
  * Sends REP response: "0 Success"`
  })
);

records.push(
  createGeoShape({
    id: 'dd_socket_io_sync',
    x: 3260,
    y: 3090,
    w: 650,
    h: 790,
    color: 'grey',
    fill: 'semi',
    size: 's',
    align: 'start',
    text: `[Socket.IO Multi-Client State Sync]
- Node.js receives "0 Success" from ZeroMQ
- Persists updated branding settings into MongoDB Channel document
- Broadcasts WebSocket event:
  io.to("channel:<id>").emit("branding_updated", {
    type: "logo",
    branding: channel.branding
  })
- Real-Time Client Synchronization:
  * All active control room operators receive event instantly
  * Redux store updates channelSlice
  * UI toggle switches & preview indicators sync seamlessly across all browsers!`
  })
);

// -------------------------------------------------------------
// ARROWS & BINDINGS SETUP
// -------------------------------------------------------------
const arrowsConfig = [
  // Tier 1 Internal Flow
  {
    id: 'arrow_fe1',
    fromId: 'fe_pages',
    toId: 'fe_components',
    start: { x: 820, y: 455 },
    end: { x: 860, y: 455 },
    text: 'Renders Page View',
    color: 'blue'
  },
  {
    id: 'arrow_fe2',
    fromId: 'fe_components',
    toId: 'fe_live_controls',
    start: { x: 1600, y: 455 },
    end: { x: 1640, y: 455 },
    text: 'UI Controls',
    color: 'blue'
  },
  {
    id: 'arrow_fe3',
    fromId: 'fe_live_controls',
    toId: 'fe_redux',
    start: { x: 2360, y: 455 },
    end: { x: 2400, y: 455 },
    text: 'Dispatches Actions',
    color: 'blue'
  },
  {
    id: 'arrow_fe4',
    fromId: 'fe_redux',
    toId: 'fe_networking',
    start: { x: 3120, y: 455 },
    end: { x: 3160, y: 455 },
    text: 'Async Thunk HTTP',
    color: 'blue'
  },

  // Tier 1 to Tier 2
  {
    id: 'arrow_fe_be_rest',
    fromId: 'fe_networking',
    toId: 'be_server',
    start: { x: 3530, y: 660 },
    end: { x: 490, y: 780 },
    text: 'HTTP REST API (JWT) & Socket.IO Rooms',
    color: 'violet'
  },
  {
    id: 'arrow_fe_hls_monitor',
    fromId: 'fe_components',
    toId: 'storage_fs',
    start: { x: 1230, y: 660 },
    end: { x: 1980, y: 2100 },
    text: 'Hls.js Live PGM Playback & check-online Polling',
    color: 'blue'
  },

  // Tier 2 Internal Flow
  {
    id: 'arrow_be1',
    fromId: 'be_server',
    toId: 'be_middleware',
    start: { x: 840, y: 990 },
    end: { x: 880, y: 990 },
    text: 'Middleware Pipeline',
    color: 'violet'
  },
  {
    id: 'arrow_be2',
    fromId: 'be_middleware',
    toId: 'be_controllers',
    start: { x: 1580, y: 990 },
    end: { x: 1620, y: 990 },
    text: 'Auth & Zod Verified',
    color: 'violet'
  },
  {
    id: 'arrow_be3',
    fromId: 'be_controllers',
    toId: 'be_services_utils',
    start: { x: 2760, y: 990 },
    end: { x: 2800, y: 990 },
    text: 'Service Invocations',
    color: 'violet'
  },

  // Tier 2 to Tier 3 & Tier 4
  {
    id: 'arrow_be_stream_mgr',
    fromId: 'be_controllers',
    toId: 'pe_stream_manager',
    start: { x: 1900, y: 1200 },
    end: { x: 500, y: 1320 },
    text: 'Broadcast Operations (start / stop / fire)',
    color: 'green'
  },
  {
    id: 'arrow_be_db',
    fromId: 'be_controllers',
    toId: 'db_models',
    start: { x: 2190, y: 1200 },
    end: { x: 750, y: 2100 },
    text: 'Mongoose Queries (Channel, Playlist, Schedule, Asset)',
    color: 'yellow'
  },
  {
    id: 'arrow_flussonic_api',
    fromId: 'be_services_utils',
    toId: 'ext_flussonic',
    start: { x: 3350, y: 1200 },
    end: { x: 3250, y: 2100 },
    text: 'REST API Provisioning (PUT /flussonic/api/v3/streams)',
    color: 'orange'
  },

  // Tier 3 Internal Flow
  {
    id: 'arrow_mgr_enc',
    fromId: 'pe_stream_manager',
    toId: 'pe_encoder_service',
    start: { x: 860, y: 1480 },
    end: { x: 1800, y: 1480 },
    text: '1. Spawns Master Encoder (ZMQ Port 5600+)',
    color: 'green'
  },
  {
    id: 'arrow_mgr_feed',
    fromId: 'pe_stream_manager',
    toId: 'pe_feeder_service',
    start: { x: 860, y: 1650 },
    end: { x: 900, y: 1650 },
    text: '2. Spawns FeederService',
    color: 'green'
  },
  {
    id: 'arrow_feed_enc',
    fromId: 'pe_feeder_service',
    toId: 'pe_encoder_service',
    start: { x: 1760, y: 1650 },
    end: { x: 1800, y: 1650 },
    text: 'MPEG-TS stdin IPC pipe (end: false)',
    color: 'green'
  },
  {
    id: 'arrow_sched_feed',
    fromId: 'pe_scheduler_branding',
    toId: 'pe_feeder_service',
    start: { x: 2900, y: 1800 },
    end: { x: 1760, y: 1800 },
    text: 'Commercial Break Interruption & Countdown Timer',
    color: 'green'
  },
  {
    id: 'arrow_sched_mgr',
    fromId: 'pe_scheduler_branding',
    toId: 'pe_stream_manager',
    start: { x: 2900, y: 1400 },
    end: { x: 860, y: 1400 },
    text: 'Scheduled L-Band / Ashton Fire Trigger',
    color: 'green'
  },

  // Tier 3 to Tier 4
  {
    id: 'arrow_feed_db',
    fromId: 'pe_feeder_service',
    toId: 'db_models',
    start: { x: 1330, y: 1980 },
    end: { x: 750, y: 2100 },
    text: 'Reads Playlist & Updates PLAYING/PLAYED Status',
    color: 'yellow'
  },
  {
    id: 'arrow_enc_hls',
    fromId: 'pe_encoder_service',
    toId: 'storage_fs',
    start: { x: 2000, y: 1980 },
    end: { x: 1980, y: 2100 },
    text: 'Tee Output: Local HLS index.m3u8 & .ts segments',
    color: 'yellow'
  },
  {
    id: 'arrow_enc_rtmp',
    fromId: 'pe_encoder_service',
    toId: 'ext_flussonic',
    start: { x: 2600, y: 1980 },
    end: { x: 3250, y: 2100 },
    text: 'Tee Output: Remote RTMP Broadcast Stream',
    color: 'orange'
  },

  // Deep Dive Panel A Flow
  {
    id: 'arrow_dd_feed_pipe',
    fromId: 'dd_feeder',
    toId: 'dd_ipc_pipe',
    start: { x: 740, y: 2880 },
    end: { x: 780, y: 2880 },
    text: 'stdout (MPEG-TS)',
    color: 'red'
  },
  {
    id: 'arrow_dd_pipe_enc',
    fromId: 'dd_ipc_pipe',
    toId: 'dd_encoder',
    start: { x: 1240, y: 2880 },
    end: { x: 1280, y: 2880 },
    text: 'pipe:0 stdin (end: false)',
    color: 'red'
  },
  {
    id: 'arrow_dd_enc_fg',
    fromId: 'dd_encoder',
    toId: 'dd_filtergraph',
    start: { x: 1860, y: 3060 },
    end: { x: 1860, y: 3090 },
    text: '-filter_complex (8 Graphic & DVE Layers)',
    color: 'red'
  },
  {
    id: 'arrow_dd_fg_hls',
    fromId: 'dd_filtergraph',
    toId: 'dd_out_hls',
    start: { x: 700, y: 3560 },
    end: { x: 700, y: 3590 },
    text: 'Tee Destination 1: Local HLS',
    color: 'red'
  },
  {
    id: 'arrow_dd_fg_rtmp',
    fromId: 'dd_filtergraph',
    toId: 'dd_out_rtmp',
    start: { x: 1880, y: 3560 },
    end: { x: 1880, y: 3590 },
    text: 'Tee Destination 2: Remote RTMP',
    color: 'red'
  },

  // Deep Dive Panel B Flow
  {
    id: 'arrow_dd_op_gw',
    fromId: 'dd_operator',
    toId: 'dd_gateway_zmq',
    start: { x: 2970, y: 2880 },
    end: { x: 3010, y: 2880 },
    text: 'HTTP POST /branding',
    color: 'grey'
  },
  {
    id: 'arrow_dd_gw_zmq',
    fromId: 'dd_gateway_zmq',
    toId: 'dd_zmq_socket',
    start: { x: 3450, y: 2880 },
    end: { x: 3490, y: 2880 },
    text: 'encoder.sendZmqCommand()',
    color: 'grey'
  },
  {
    id: 'arrow_dd_zmq_fg',
    fromId: 'dd_zmq_socket',
    toId: 'dd_ffmpeg_zmq_filter',
    start: { x: 3700, y: 3060 },
    end: { x: 3100, y: 3090 },
    text: 'ZMQ REQ tcp://127.0.0.1:<port>',
    color: 'grey'
  },
  {
    id: 'arrow_dd_fg_sync',
    fromId: 'dd_ffmpeg_zmq_filter',
    toId: 'dd_socket_io_sync',
    start: { x: 3220, y: 3485 },
    end: { x: 3260, y: 3485 },
    text: 'ZMQ Reply "0 Success"',
    color: 'grey'
  },
  {
    id: 'arrow_dd_sync_op',
    fromId: 'dd_socket_io_sync',
    toId: 'dd_operator',
    start: { x: 3585, y: 3090 },
    end: { x: 2760, y: 3060 },
    text: 'WebSocket branding_updated Event',
    color: 'grey'
  }
];

arrowsConfig.forEach((a) => {
  records.push(
    createArrowShape({
      id: a.id,
      start: a.start,
      end: a.end,
      text: a.text,
      color: a.color
    })
  );

  records.push(
    createBinding({
      arrowId: a.id,
      toId: a.fromId,
      terminal: 'start',
      normalizedAnchor: { x: 0.5, y: 0.5 }
    })
  );

  records.push(
    createBinding({
      arrowId: a.id,
      toId: a.toId,
      terminal: 'end',
      normalizedAnchor: { x: 0.5, y: 0.5 }
    })
  );
});

const tldrDocument = {
  tldrawFileFormatVersion: 1,
  schema: {
    schemaVersion: 2,
    sequences: {
      'com.tldraw.store': 4,
      'com.tldraw.asset': 1,
      'com.tldraw.camera': 1,
      'com.tldraw.document': 2,
      'com.tldraw.instance': 25,
      'com.tldraw.instance_page_state': 5,
      'com.tldraw.page': 1,
      'com.tldraw.instance_presence': 5,
      'com.tldraw.pointer': 1,
      'com.tldraw.shape': 4,
      'com.tldraw.shape.arrow': 5,
      'com.tldraw.shape.geo': 9,
      'com.tldraw.shape.text': 2,
      'com.tldraw.binding.arrow': 0
    }
  },
  records
};

const jsonStr = JSON.stringify(tldrDocument, null, 2);
fs.writeFileSync(outputPath, jsonStr, 'utf8');

console.log(`Successfully generated UML tldraw document at: ${outputPath}`);
console.log(`Total records: ${records.length}`);
