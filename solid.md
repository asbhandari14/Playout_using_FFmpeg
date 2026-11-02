# SOLID Architecture & CAP Theorem Blueprint
## Continuous 24/7 Linear Playout Engine & Cloud Streaming Architecture

---

## 1. Architectural Overview & System Context

The **Playlist Playout using FFmpeg** project is an enterprise broadcast automation platform designed to deliver uninterrupted, 24/7 linear television channels over RTMP and HLS. It marries a real-time media pipeline (FFmpeg, ZeroMQ, Sharp) with a modern web control room (React 19, Redux Toolkit, Socket.IO, Express 5, and MongoDB).

### 1.1 The Operational Lifecycle
The system operates across three distinct operational planes:
1. **Control Plane (Management & Orchestration)**: Multi-tenant RBAC, channel provisioning, playlist curation, drag-and-drop sequencing, asset ingest with chunked uploads, and automated time-window scheduling.
2. **Playout Data Plane (Continuous Video Processing)**: A two-tier FFmpeg pipeline consisting of:
   - A real-time **Feeder process** (`feederService`) that decodes local media assets, normalizes audio/video to uniform broadcast specifications (720p @ 25fps, stereo AAC), and pipes MPEG-TS frames into the encoder's standard input.
   - A long-running **Master Encoder process** (`encoderService`) that accepts the MPEG-TS pipe, runs an 8-layer filtergraph for real-time channel branding (station bug, animated GIF, crawling text ticker, L-Band DVE squeeze, Ashton Band lower thirds), and streams dual output: local HLS chunks for studio monitoring and remote RTMP ingest to Flussonic Media Server.
   - An IPC **ZeroMQ Control Bus** enabling sub-50ms live overlay modifications without interrupting the video stream.
3. **Distribution Plane (Edge Delivery)**: Flussonic Media Server ingesting RTMP (`publish://`) and publishing low-latency HLS manifests (`index.m3u8`) to global viewers.

```
                      +------------------------------------------------+
                      |             Web UI (React 19 / Redux)          |
                      +------------------------------------------------+
                               | (REST API)               ^ (Socket.IO)
                               v                          |
                      +------------------------------------------------+
                      |         Express 5 API & Socket.IO Gateway      |
                      +------------------------------------------------+
                               |                          |
             +-----------------+                          +-----------------+
             v                                                              v
+--------------------------+                                      +--------------------------+
|  MongoDB (Metadata/State)|                                      | Local File Storage       |
|  - Users, Servers        |                                      | - uploads/videos         |
|  - Channels, Playlists   |                                      | - uploads/thumbnails     |
|  - Assets, Schedules     |                                      | - uploads/branding       |
+--------------------------+                                      +--------------------------+
             ^                                                              |
             |                                                              v
+--------------------------------------------------------------------------------------------+
| Playout Engine Super-Cluster                                                               |
|                                                                                            |
|  +-----------------------+     stdin pipe (MPEG-TS)      +-------------------------------+ |
|  |     FeederService     | ============================> |        EncoderService         | |
|  |  (Dynamic Decoders,   |                               |   (Master Transcoder,         | |
|  |   Standby Slate,      |                               |    8-layer Filtergraph)       | |
|  |   Commercial Sched)   |                               +-------------------------------+ |
|  +-----------------------+                                          |           ^          |
|              ^                                            Dual Tee  |           | ZMQ REQ  |
|              | Clock ticks                                Output    |           | (port)   |
|  +-----------------------+                                          v           v          |
|  |   SchedulerService    |                           +------------------+  +-------------+ |
|  | (Time & Window Inter) |                           | /streams/{id}/hls|  | ZMQ Runtime | |
|  +-----------------------+                           +------------------+  +-------------+ |
+---------------------------------------------------------------|----------------------------+
                                                                | RTMP Stream
                                                                v
                                              +-----------------------------------+
                                              |       Flussonic Media Server      |
                                              |        (HLS Edge Packaging)       |
                                              +-----------------------------------+
```

---

## 2. Deconstruction Under SOLID Principles

While functional, the legacy codebase exhibits classic architectural smells common to fast-evolving streaming systems: **monolithic God classes**, **direct coupling to child processes and databases**, and **synchronous operations blocking the event loop**.

Below is a systematic refactoring blueprint grounded in each of the five SOLID principles.

---

### S: Single Responsibility Principle (SRP)
> *"A class or module should have one, and only one, reason to change."*

#### 1. Current Violations in the Codebase
- **`streamManager.js` (501 lines)**:
  - *Reasons to change*: Channel lifecycle orchestration, monotonic TCP port allocation for ZeroMQ, REST calls to Flussonic API for provisioning, restoring pre-schedule branding snapshots from Mongo, managing `setTimeout` handles for temporary quick-fire overlays, handling PM2 crash recovery loops, and dispatching Socket.IO broadcast messages.
- **`encoderService.js` (1203 lines)**:
  - *Reasons to change*: FFmpeg CLI string generation, operating system process management, ZeroMQ socket reconnection and message framing, Sharp image geometry/aspect-ratio calculation, static PNG and animated GIF loop handling, and HLS directory creation on disk.
- **`feederService.js` (628 lines)**:
  - *Reasons to change*: Playlist iteration, spawning decoder FFmpeg processes, Unix/Windows stdin/stdout piping, pausing and resuming playback on schedule triggers, drawing Back-In countdown overlays, generating synthetic black standby slates, updating Mongoose playlist item statuses, and broadcasting Socket.IO player ticks.
- **`brandingController.js` (1274 lines)**:
  - *Reasons to change*: Express HTTP routing, Mongoose database validation, Sharp image conversion on disk, dynamic ZeroMQ socket transmission into live encoders, scheduled branding suppression logic, and Socket.IO event emission.
- **`ControlRoomPage.jsx` & `LiveControls.jsx` (1541 lines)**:
  - *Reasons to change*: React DOM layout, Redux action dispatching, raw WebSocket event listeners, HTML5 audio/video tag lifecycle, canvas drag-coordinate math for station bugs, and form input management.

#### 2. Target Architecture Under SRP
The system is divided into specialized, single-purpose classes:

| Class / Module | Single Responsibility |
|---|---|
| `PlayoutCoordinator` | High-level broadcast state machine (Idle $\to$ Pre-roll $\to$ On-Air $\to$ Post-roll). |
| `ZmqCommandClient` | Manages ZeroMQ socket lifecycle, binary message framing, retry logic, and timeouts. |
| `PortAllocator` | Thread-safe, leak-free allocation and recycling of OS network ports. |
| `FlussonicProvisioner` | Interacting exclusively with Flussonic Media Server REST API endpoints. |
| `FiltergraphBuilder` | Compiling mathematical FFmpeg filter expressions without spawning processes. |
| `ProcessSupervisor` | Platform-specific OS process lifecycle, cross-platform tree kill (`taskkill` vs `kill -9`), and pipe backpressure management. |
| `BrandingAssetRenderer` | Off-screen image resizing, SVG-to-PNG ticker rendering, and GIF parsing via Sharp. |
| `ScheduleEvaluator` | Pure clock and calendar arithmetic determining which event triggers when. |
| `PlaylistCursor` | Pure state container tracking active index, playback offset, and loop traversal. |

#### 3. Code Example: Refactoring `encoderService.js`
##### Legacy Anti-Pattern (SRP Violation):
```javascript
// encoderService.js mixes process control, ZMQ communication, Sharp parsing, and filter logic
export class EncoderService {
  async start() {
    // 1. Image metadata reading
    const meta = await sharp(this.logoFile).metadata();
    // 2. Filter string concatenation
    const filtergraph = `[0:v]zmq=...;[1:v]scale=...[vout]`;
    // 3. Child process spawning
    this.process = spawn('ffmpeg', [...]);
    // 4. Socket connecting
    this.zmqSocket = new zmq.Request();
    this.zmqSocket.connect(`tcp://127.0.0.1:${this.zmqPort}`);
  }
}
```

##### Clean Refactoring (Strict SRP):
```javascript
// 1. Pure Filter Builder
export class FiltergraphBuilder {
  constructor(canvasWidth = 1280, canvasHeight = 720) {
    this.canvasW = canvasWidth;
    this.canvasH = canvasHeight;
    this.layers = [];
  }
  addLayer(filterLayer) {
    this.layers.push(filterLayer);
    return this;
  }
  build() {
    return this.layers.map(layer => layer.toFilterString()).join('; ');
  }
}

// 2. Pure ZMQ Client
export class ZmqOverlayClient {
  constructor(port, timeoutMs = 800) {
    this.port = port;
    this.timeoutMs = timeoutMs;
    this.socket = null;
  }
  async connect() {
    this.socket = new zmq.Request();
    this.socket.connect(`tcp://127.0.0.1:${this.port}`);
  }
  async send(targetFilter, parameter, value) {
    if (!this.socket) throw new Error('ZMQ client disconnected');
    return this.executeWithTimeout(`${targetFilter} ${parameter} ${value}`);
  }
  async close() {
    if (this.socket) {
      await this.socket.close();
      this.socket = null;
    }
  }
}

// 3. Pure Process Supervisor
export class MediaProcessSupervisor {
  constructor(binary = 'ffmpeg') {
    this.binary = binary;
    this.child = null;
  }
  spawn(args, stdioConfig) {
    this.child = spawn(this.binary, args, { stdio: stdioConfig });
    return this.child;
  }
  async terminateGracefully() {
    if (!this.child) return;
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(this.child.pid), '/f', '/t']);
    } else {
      this.child.kill('SIGTERM');
    }
  }
}
```

---

### O: Open/Closed Principle (OCP)
> *"Software entities should be open for extension, but closed for modification."*

#### 1. Current Violations in the Codebase
- **Monolithic Filtergraph Construction**: Adding a new visual layer (e.g., Breaking News banner, Emergency Alert System (EAS), Picture-in-Picture, or SCTE-35 ad splice indicator) requires directly editing the massive 30-line string template inside `EncoderService.prototype.start()`.
- **Output Destination Hardcoding**: `encoderService.js` creates a dual-muxer tee strictly for `[f=hls]...|[f=flv]...` (local HLS and Flussonic RTMP). If a channel needs to push to YouTube Live, Facebook Live, SRT (Secure Reliable Transport), or AWS MediaLive, `encoderService.js` must be directly edited and retested.
- **Hardcoded Schedule Types**: In `schedulerService.js`, event types are checked via a hardcoded `if-else` ladder:
  ```javascript
  if (schedule.type === 'lband') { ... }
  else if (schedule.type === 'ashton') { ... }
  else { /* video */ }
  ```
  Adding a new schedule type (e.g., SCTE-35 marker, live audio ducking, external live studio feed) requires modifying `schedulerService.js`, `feederService.js`, and `Schedule.js`.

#### 2. Target Architecture Under OCP
We employ the **Strategy Pattern** and a **Composable Pipeline**:

```
             +------------------------------+
             |      <<interface>>           |
             |       IFilterLayer           |
             +------------------------------+
             | +compileInputs(): string[]   |
             | +compileFilter(ctx): string  |
             | +getRuntimeCommands(): map   |
             +------------------------------+
                            ^
       +--------------------+--------------------+
       |                    |                    |
+--------------+     +--------------+     +--------------+
|  LogoLayer   |     |  TickerLayer |     |  LBandLayer  | ... (Easily add EASLayer,
+--------------+     +--------------+     +--------------+      PipLayer without modifying
                                                                Filtergraph engine)
```

```javascript
// Open/Closed Filter Layer Interface
export class IFilterLayer {
  getInputs() { throw new Error('Not implemented'); }
  buildFilterString(inputLabel, outputLabel) { throw new Error('Not implemented'); }
  getZmqTarget() { throw new Error('Not implemented'); }
}

export class StationBugLayer extends IFilterLayer {
  constructor(config) {
    super();
    this.config = config;
  }
  getInputs() {
    return this.config.isGif 
      ? ['-ignore_loop', '0', '-i', this.config.filePath] 
      : ['-loop', '1', '-i', this.config.filePath];
  }
  buildFilterString(inputLabel, outputLabel) {
    return `[${this.config.inputIndex}:v]scale=${this.config.w}:${this.config.h}[scaled_bug]; ` +
           `[${inputLabel}][scaled_bug]overlay@bug=x='${this.config.x}':y='${this.config.y}'[${outputLabel}]`;
  }
  getZmqTarget() { return 'overlay@bug'; }
}

// Destination Strategy for Output Ingest
export class IStreamDestination {
  compileTeeClause() { throw new Error('Not implemented'); }
}

export class FlussonicRtmpDestination extends IStreamDestination {
  constructor(rtmpUrl) {
    super();
    this.rtmpUrl = rtmpUrl;
  }
  compileTeeClause() {
    return `[f=flv:flvflags=no_duration_filesize:onfail=ignore]${this.rtmpUrl}`;
  }
}

export class SrtCallerDestination extends IStreamDestination {
  constructor(srtUrl, passphrase) {
    super();
    this.srtUrl = srtUrl;
    this.passphrase = passphrase;
  }
  compileTeeClause() {
    return `[f=mpegts:onfail=ignore]srt://${this.srtUrl}?passphrase=${this.passphrase}`;
  }
}
```

---

### L: Liskov Substitution Principle (LSP)
> *"Subtypes must be substitutable for their base types without altering the correctness of the program."*

#### 1. Current Violations in the Codebase
- **Standby Slate vs Asset Feeder**: In `feederService.js`, streaming real assets (`streamAsset()`) and generating standby slates (`streamStandbySlate()`) duplicate child process spawn logic. However, standby slates do not respect presentation timestamps (PTS), cannot be interrupted by schedules cleanly, and fail to report cumulative playback offsets. They cannot be substituted for each other in the playback loop.
- **Media Assets Divergence**: Static images and animated GIFs diverge significantly in both Sharp metadata probing and FFmpeg input flags:
  ```javascript
  // Sharp metadata behaves differently for GIFs:
  const effectiveHeight = (isBugGif && meta.pageHeight) ? meta.pageHeight : meta.height;
  ```
  If a GIF asset is passed to a routine expecting a standard `ImageAsset`, it corrupts aspect-ratio calculations, resulting in `NaN` width parameters that crash FFmpeg.
- **Storage Subsystem**: Local filesystem paths (`uploads/videos/...`) are hardcoded across `assetService.js` and `feederService.js`. If an `S3MediaSource` or `NfsMediaSource` were substituted, `fs.existsSync` and synchronous `path.resolve` fail immediately.

#### 2. Target Architecture Under LSP
We establish an **`IMediaSource`** contract that guarantees uniform playback behavior across live feeds, local MP4 files, remote HTTP assets, and standby slates:

```javascript
export class IMediaSource {
  async getDuration() { throw new Error('Not implemented'); }
  async getDecoderArguments(startOffsetSeconds = 0, maxDuration = 0) { throw new Error('Not implemented'); }
  isSeekable() { throw new Error('Not implemented'); }
}

export class LocalVideoMediaSource extends IMediaSource {
  constructor(filePath, probeDuration) {
    super();
    this.filePath = filePath;
    this.probeDuration = probeDuration;
  }
  async getDuration() { return this.probeDuration; }
  isSeekable() { return true; }
  async getDecoderArguments(startOffset = 0, maxDuration = 0) {
    return [
      '-re',
      ...(startOffset > 0 ? ['-ss', String(startOffset)] : []),
      '-i', this.filePath,
      ...(maxDuration > 0 ? ['-t', String(maxDuration)] : []),
      '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-ar', '44100', '-ac', '2', '-f', 'mpegts', 'pipe:1'
    ];
  }
}

export class StandbySlateMediaSource extends IMediaSource {
  constructor(durationSeconds = 3, colorHex = '0x0c0e12') {
    super();
    this.duration = durationSeconds;
    this.colorHex = colorHex;
  }
  async getDuration() { return this.duration; }
  isSeekable() { return false; }
  async getDecoderArguments() {
    return [
      '-re',
      '-f', 'lavfi', '-i', `color=c=${this.colorHex}:s=1280x720:r=25:d=${this.duration}`,
      '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
      '-t', String(this.duration),
      '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-ar', '44100', '-ac', '2', '-f', 'mpegts', 'pipe:1'
    ];
  }
}
```

Now, `feederService` can play any `IMediaSource` polymorphically without knowing whether it is a user video, an emergency announcement, or a live slate.

---

### I: Interface Segregation Principle (ISP)
> *"Clients should not be forced to depend upon interfaces that they do not use."*

#### 1. Current Violations in the Codebase
- **Monolithic `EncoderService` Interface**: Currently, `EncoderService` exposes a sprawling surface area:
  - Process lifecycle (`start`, `stop`)
  - Low-level telemetry (`getCurrentStreamTime`, `lastReportedPts`)
  - Station branding (`setLogoEnabled`, `setLogoPosition`, `setLogoSize`, `setBugEnabled`, `setBugPosition`)
  - Text banner (`setTickerEnabled`, `setTickerSpeed`, `setTickerColors`)
  - DVE squeeze (`setLBandEnabled`, `setAshtonLive`)
  
  `feederService` only needs to know the encoder's `process.stdin` pipe and its active state, yet it receives the entire `EncoderService` instance with full mutating capabilities over overlays and ZMQ sockets.
- **Frontend DTO Bloat**: When `ControlRoomPage.jsx` fetches channel data, the backend serializes the entire MongoDB document including encrypted server passwords, RTMP push credentials, resolution matrices, and historical schedule arrays. The live overlay buttons in `LiveControls.jsx` only require `{ enabled, position }`.

#### 2. Target Architecture Under ISP
We segregate these capabilities into focused, narrow interfaces:

```
                       +-------------------------------+
                       |         EncoderService        |
                       +-------------------------------+
                         /            |              \
                        /             |               \
                       v              v                v
      +---------------------+ +--------------------+ +--------------------+
      |   IPlayoutSink      | | IOverlayController | | IStreamTelemetry   |
      +---------------------+ +--------------------+ +--------------------+
      | +getWritablePipe()  | | +setLogo(...)      | | +getPts(): number  |
      | +isSinkAvailable()  | | +setTicker(...)    | | +getFps(): number  |
      +---------------------+ | +setLBand(...)     | | +getBitrate(): num |
                              +--------------------+ +--------------------+
```

```javascript
// ISP Interface Contracts
export const IPlayoutSink = {
  getWritablePipe: (instance) => instance.process?.stdin,
  isSinkAvailable: (instance) => Boolean(instance.isRunning && instance.process?.stdin?.writable)
};

export const IStreamTelemetry = {
  getPts: (instance) => instance.getCurrentStreamTime(),
  getZmqPort: (instance) => instance.zmqPort
};

export const IOverlayController = {
  setLogoVisibility: (instance, visible) => instance.setLogoEnabled(visible),
  setTickerVisibility: (instance, visible) => instance.setTickerEnabled(visible),
  triggerLBandSqueeze: (instance, active, coords) => instance.setLBandEnabled(active, coords)
};
```

---

### D: Dependency Inversion Principle (DIP)
> *"High-level modules should not depend upon low-level modules. Both should depend upon abstractions."*
> *"Abstractions should not depend upon details. Details should depend upon abstractions."*

#### 1. Current Violations in the Codebase
- **Direct Mongoose Model Imports**: `streamManager.js`, `feederService.js`, and `schedulerService.js` directly import `Channel`, `Playlist`, `Schedule`, and `Server` Mongoose models. The core playout engine cannot be tested without a live MongoDB replica set running.
- **Direct Child Process Spawning**: Streaming services directly invoke Node.js `child_process.spawn()`. They are completely coupled to the host OS runtime and cannot run in simulated environments or unit-test harnesses.
- **Global Socket.IO Singleton**: Services import `import { io } from '../../server.js'`. This creates circular dependency hazards (e.g. `server.js` $\to$ `streamManager.js` $\to$ `server.js`) and tightly couples streaming logic to the Web transport layer.

#### 2. Target Architecture Under DIP
We apply **Hexagonal (Ports and Adapters) Architecture**. The Core Playout Domain depends solely on abstract Port interfaces:

```
       [ Core Playout Domain ]
                 |
                 +---> (Port) IChannelRepository
                 +---> (Port) IPlaylistRepository
                 +---> (Port) IEventBroadcaster
                 +---> (Port) IMediaServerGateway
                 +---> (Port) IProcessFactory
```

```javascript
// Domain Port: Event Notification
export class IEventBroadcaster {
  emitToChannel(channelId, eventName, payload) {
    throw new Error('Not implemented');
  }
}

// Infrastructure Adapter: Socket.IO
export class SocketIoBroadcaster extends IEventBroadcaster {
  constructor(socketIoServer) {
    super();
    this.io = socketIoServer;
  }
  emitToChannel(channelId, eventName, payload) {
    if (this.io) {
      this.io.to(`channel:${channelId}`).emit(eventName, payload);
    }
  }
}

// Domain Port: Channel Data Access
export class IChannelRepository {
  async findById(id) { throw new Error('Not implemented'); }
  async updateStatus(id, status) { throw new Error('Not implemented'); }
  async saveBrandingSnapshot(id, snapshot) { throw new Error('Not implemented'); }
}

// Infrastructure Adapter: Mongoose
export class MongooseChannelRepository extends IChannelRepository {
  async findById(id) {
    return Channel.findById(id).lean();
  }
  async updateStatus(id, status) {
    return Channel.findByIdAndUpdate(id, { status }, { new: true });
  }
  async saveBrandingSnapshot(id, snapshot) {
    return Channel.findByIdAndUpdate(id, { 'branding.preScheduleBranding': snapshot });
  }
}
```

#### 3. Inversion of Control (IoC) Composition Root
At application startup (`server.js`), concrete adapters are injected into the domain services:

```javascript
// server.js - IoC Bootstrapper
const eventBroadcaster = new SocketIoBroadcaster(io);
const channelRepo = new MongooseChannelRepository();
const playlistRepo = new MongoosePlaylistRepository();
const flussonicClient = new FlussonicMediaServerClient(process.env.FLUSSONIC_API_KEY);
const processFactory = new OsProcessFactory();

const streamManager = new StreamManager({
  channelRepo,
  playlistRepo,
  eventBroadcaster,
  flussonicClient,
  processFactory
});
```

---

## 3. Distributed Playout Systems & The CAP Theorem

Playout automation is inherently a **distributed system**. It spans web clients, central coordination databases, localized media decoders/encoders, and edge packaging servers (Flussonic/HLS).

```
[Web Studio Clients] <--- WAN ---> [API / DB Cluster] <--- LAN ---> [Playout Workers] <--- WAN ---> [Flussonic Edge CDN] <---> [Viewers]
```

### 3.1 Defining the Dimensions in Broadcast Playout

1. **Consistency ($C$)**:
   - Every node and client sees the exact same channel status, current playing item, and branding overlay configuration at the exact same instant.
   - Strict linear sequence: Video $N$ finishes $\implies$ Video $N+1$ begins without double-feeding or skipping.
2. **Availability ($A$)**:
   - The on-air stream **never stops transmitting frames**. In linear television, a black screen or green digital artifact on air is considered a catastrophic outage leading to FCC/regulatory fines and contractual advertising breach.
   - Playout output commands receive immediate response without blocking.
3. **Partition Tolerance ($P$)**:
   - The system continues operating despite lost packets, network disconnects, or communication latency spikes between:
     - The Central DB and the Playout Node.
     - The Playout Node and the Flussonic Ingest Server.
     - The Browser Control Room and the Backend API.

---

### 3.2 CAP Classification Matrix Across Subsystems

Broadcast playout cannot be classified as purely CP or purely AP; it is a **heterogeneous system** where different planes make different architectural trade-offs:

| Subsystem | CAP Class | Primary Goal | Behavior Under Network Partition ($P$) |
|---|---|---|---|
| **Live Stream Video Pipeline (Feeder $\to$ Encoder)** | **AP** | **Availability** | If database or network partitions, playout **continues playing queued media** from local cache or falls back to an emergency looping slate. It **must never drop frames** to wait for DB consistency. |
| **Channel Ingest Ownership & Lock** | **CP** | **Consistency** | **Single-Leader Consistency** is mandatory. If two encoders push to the same Flussonic RTMP key (`rtmp://cdn/static/ch1`) simultaneously (split-brain), packets collide, producing catastrophic video tearing. The system must reject the secondary writer. |
| **Playlist Curation & Reordering** | **AP** (Eventual Consistency) | **Availability** | Operators can edit and reorder items in the browser during transient network hiccups; edits are merged to the playout worker using version vectors / optimistic locking. |
| **Commercial Break Scheduling** | **AP with Bounded Staleness** | **Availability** | Feeder uses local clock time. If partitioned from Mongo, it executes the last known schedule cache rather than abandoning the commercial break window. |
| **User Authentication & Quota Enforcement** | **CP** | **Consistency** | Cannot allow unauthenticated operators or disk quota overruns; operations abort if authentication/identity authority cannot be validated. |

---

### 3.3 Deep Dive: Why Playout Video Pipelines Must Be AP (Availability-First)

In a traditional transactional system (e.g., banking), Consistency is prioritized over Availability (**CP**): if the network splits, bank transfers freeze to prevent double-spending.

In **Broadcast Automation**, the cost model is inverted:
$$\text{Cost}(\text{Black Screen}) \gg \text{Cost}(\text{Metadata Lag})$$

If the MongoDB cluster becomes unavailable or the control network splits:
1. **Under a CP Model (Incorrect for Playout)**:
   The Feeder would block waiting for a database write confirmation before beginning Item #4. The decoder stops pushing MPEG-TS packets to the encoder stdin. The encoder runs out of buffer and closes the RTMP socket to Flussonic. Millions of viewers experience buffering and a dead broadcast.
2. **Under an AP Model (Correct Broadcast Standard)**:
   The Feeder detects DB disconnection, logs a telemetry warning, transitions to autonomous mode, and continues decoding Item #4 from its local NVMe cache. The MPEG-TS pipeline remains saturated at 25 fps. When the partition heals, the Feeder pushes state reconciliation events back to MongoDB via eventual consistency.

---

### 3.4 Ingest Locking: Why Channel Control Must Be CP (Consistency-First)

While frame delivery is AP, **Channel Publishing Rights** must be **CP**.

```
[Playout Worker A] -- (Pushing RTMP) ---> +------------------------+
                                          | Flussonic Ingest Point | <--- STREAM COLLISION (JITTER / TEAR)
[Playout Worker B] -- (Pushing RTMP) ---> +------------------------+
```

To prevent split-brain dual-feed collision, the system requires a **Distributed Lease with Fencing Tokens**:

```
                       +-------------------------------+
                       |   Distributed Lock Manager    |
                       |  (Redis / etcd / Mongo Lease) |
                       +-------------------------------+
                                      |
         +----------------------------+----------------------------+
         | Lease Granted (Token: 104)                              | Lease Denied / Expired
         v                                                         v
+------------------+                                      +------------------+
| Playout Worker A |                                      | Playout Worker B |
| (ON AIR - RTMP)  |                                      | (HOT STANDBY)    |
+------------------+                                      +------------------+
```

```javascript
// CP Distributed Channel Ingest Fencing
export class ChannelLeaseManager {
  constructor(lockStore, ttlSeconds = 10) {
    this.lockStore = lockStore;
    this.ttl = ttlSeconds;
  }

  async acquireIngestLease(channelId, workerId) {
    const key = `channel_lock:${channelId}`;
    const token = Date.now();
    
    // Atomic SET if Not Exists with TTL
    const acquired = await this.lockStore.set(key, { workerId, token }, 'NX', 'EX', this.ttl);
    if (!acquired) {
      throw new ChannelCollisionError(`Channel ${channelId} is locked by another active playout worker.`);
    }

    return token;
  }

  async renewLease(channelId, workerId, token) {
    // Atomic renewal with fencing verification
    const current = await this.lockStore.get(`channel_lock:${channelId}`);
    if (!current || current.token !== token || current.workerId !== workerId) {
      throw new FencingTokenExpiredError('Lost channel leadership lease! Immediately severing RTMP push.');
    }
    await this.lockStore.expire(`channel_lock:${channelId}`, this.ttl);
  }
}
```

---

### 3.5 PACELC Theorem Applied to Live Broadcast Playout

The **PACELC Theorem** extends CAP by describing system behavior under normal (non-partitioned) conditions:
> *If there is a Partition ($P$), trade off Availability ($A$) vs Consistency ($C$);  
> **Else** ($E$), trade off Latency ($L$) vs Consistency ($C$).*

In this platform:
$$\text{PACELC} \implies \text{PA / EL}$$
- **Under Partition ($P$)**: Favor **Availability ($A$)** over Consistency ($C$) for audio/video continuity.
- **Else (Normal Operations $E$)**: Favor **Latency ($L$)** over Consistency ($C$) for studio controls.

#### Real-World Justification:
When an operator in the control room clicks **"Take Ticker Off Air"** or triggers **"L-Band Ad Squeeze"**, the studio expectation is real-time response ($\le 50\text{ms}$).
- **If we chose Consistency ($C$)**: The server would wait for MongoDB write commit, wait for multiple replica nodes to acknowledge, and then send the ZMQ socket command. Latency: $150\text{--}400\text{ms}$ (unacceptable on-air lag).
- **Because we choose Latency ($L$)**: The server sends the ZeroMQ command **immediately into the running FFmpeg filtergraph**, updating the video frame in memory within $20\text{ms}$. It updates MongoDB asynchronously in the background.

---

## 4. Proposed Clean Architecture Directory Structure

Applying SOLID and Clean Architecture principles yields the following modular layout:

```
server/
├── src/
│   ├── domain/                               # PURE DOMAIN LAYER (Zero external dependencies)
│   │   ├── entities/
│   │   │   ├── Channel.js                    # Channel entity & business validation
│   │   │   ├── Playlist.js                   # PlaylistItem & sequence logic
│   │   │   ├── MediaAsset.js                 # Media metadata entity
│   │   │   └── ScheduleRule.js               # Time-window & recurrence entities
│   │   └── ports/                            # DOMAIN INTERFACES (Contracts)
│   │       ├── IChannelRepository.js
│   │       ├── IPlaylistRepository.js
│   │       ├── IMediaProcessSupervisor.js
│   │       ├── IZmqControlClient.js
│   │       ├── IMediaServerProvisioner.js
│   │       ├── IEventBroadcaster.js
│   │       └── IStorageService.js
│   │
│   ├── application/                          # APPLICATION USE CASES (Orchestration)
│   │   ├── useCases/
│   │   │   ├── channel/
│   │   │   │   ├── StartChannelBroadcast.js
│   │   │   │   ├── StopChannelBroadcast.js
│   │   │   │   └── RecoverActiveStreams.js
│   │   │   ├── branding/
│   │   │   │   ├── UpdateOverlayState.js
│   │   │   │   ├── QuickFireOverlay.js
│   │   │   │   └── RestorePreScheduleBranding.js
│   │   │   ├── playlist/
│   │   │   │   ├── ReorderPlaylistItems.js
│   │   │   │   └── AdvancePlaybackCursor.js
│   │   │   └── schedule/
│   │   │       ├── EvaluateScheduleClock.js
│   │   │       └── InterruptWithCommercial.js
│   │   └── services/
│   │       ├── PlayoutClockWorker.js
│   │       └── PortPoolManager.js
│   │
│   ├── infrastructure/                       # INFRASTRUCTURE ADAPTERS (External dependencies)
│   │   ├── database/
│   │   │   ├── mongoose/
│   │   │   │   ├── schemas/                  # Mongoose models
│   │   │   │   └── repositories/             # Mongoose repository implementations
│   │   │   └── MongoConnection.js
│   │   ├── streaming/
│   │   │   ├── ffmpeg/
│   │   │   │   ├── FFmpegEncoderProcess.js   # Master encoder runner
│   │   │   │   ├── FFmpegDecoderProcess.js   # Real-time feeder decoder
│   │   │   │   └── FiltergraphCompiler.js    # Open/Closed filtergraph generator
│   │   │   ├── zeromq/
│   │   │   │   └── ZmqRequestClient.js       # ZMQ IPC adapter
│   │   │   └── flussonic/
│   │   │       └── FlussonicRestAdapter.js   # Flussonic API v3 client
│   │   ├── storage/
│   │   │   ├── LocalDiskStorageService.js
│   │   │   └── S3StorageService.js           # Pluggable cloud storage
│   │   ├── image/
│   │   │   └── SharpImageProcessor.js        # Sharp resizing & ticker rendering
│   │   └── websocket/
│   │       └── SocketIoEventBroadcaster.js
│   │
│   ├── presentation/                         # PRESENTATION LAYER
│   │   ├── http/
│   │   │   ├── controllers/                  # Thin Express controllers
│   │   │   ├── middleware/                   # Auth, RBAC, Zod validation
│   │   │   └── routes/
│   │   └── socket/
│   │       └── ChannelRoomGateway.js
│   │
│   ├── container.js                          # Dependency Injection Composition Root
│   ├── app.js                                # Express application setup
│   └── server.js                             # HTTP & WebSocket bootstrap
```

---

## 5. Architectural Summary & Migration Path

| Dimension | Legacy System | SOLID / Clean Architecture Target |
|---|---|---|
| **Class Cohesion (SRP)** | God controllers (1200+ LOC) mixing HTTP, DB, disk, and ZMQ. | Single-responsibility units (Filter compiler, Process supervisor, Zmq client). |
| **Extensibility (OCP)** | Hardcoded string template filtergraphs and switch-cases. | Polymorphic `IFilterLayer`, `IStreamDestination`, and `IScheduleHandler`. |
| **Substitutability (LSP)** | Hardcoded local paths; branching logic for GIFs vs PNGs. | Uniform `IMediaSource` and `IStorageService` contracts. |
| **Interface Design (ISP)** | Leaking full DB models to UI and monolithic encoder methods. | Role-based interfaces (`IPlayoutSink`, `IOverlayMutator`, `ITelemetry`). |
| **Coupling (DIP)** | Direct dependencies on Mongoose, `child_process`, and Sharp. | Inversion of Control with constructor injection and domain ports. |
| **CAP Theorem Strategy** | Ad-hoc fallback; potential split-brain dual RTMP ingest. | **AP video pipeline** (zero black frames) + **CP ingest lease lock** (fencing tokens). |
| **PACELC Real-Time Behavior** | Synchronous DB blocking before overlay updates. | **PA/EL**: Sub-50ms instant ZMQ dispatch with asynchronous DB reconciliation. |
