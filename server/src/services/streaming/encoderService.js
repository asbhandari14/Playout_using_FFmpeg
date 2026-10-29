import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import * as zmq from 'zeromq';
import sharp from 'sharp';
import { ensureBrandingFiles, renderTickerImage } from './brandingAssets.js';
import { STREAMS_DIR, SERVER_ROOT } from '../../config/paths.js';
import { sanitizeStreamKey } from '../flussonicService.js';

export class EncoderService {
  constructor(channel, zmqPort) {
    this.channel = channel;
    this.zmqPort = zmqPort;
    this.process = null;
    this.zmqSocket = null;
    this.isRunning = false;
    this.lbandAnimId = 0;
    this.ashtonAnimId = 0;

    // Stream working directory
    this.channelDir = path.join(STREAMS_DIR, String(channel._id));
    this.hlsDir = path.join(this.channelDir, 'hls');

    if (!fs.existsSync(this.hlsDir)) {
      fs.mkdirSync(this.hlsDir, { recursive: true });
    }

    // Ensure initial logo.png, ticker_bg.png, ticker.png, lband.png, and ashton.png
    const logoSource = channel.branding?.logo?.assetPath
      ? path.resolve(SERVER_ROOT, channel.branding.logo.assetPath)
      : null;
    const lbandSource = channel.branding?.lband?.assetPath
      ? path.resolve(SERVER_ROOT, channel.branding.lband.assetPath)
      : null;
    const ashtonSource = channel.branding?.ashton?.assetPath
      ? path.resolve(SERVER_ROOT, channel.branding.ashton.assetPath)
      : null;

    const { logoFile, tickerBgFile, tickerFile, lbandFile, ashtonFile } = ensureBrandingFiles(this.channelDir, {
      logoSourcePath: logoSource,
      lbandSourcePath: lbandSource,
      ashtonSourcePath: ashtonSource
    });
    this.logoFile = logoFile;
    this.tickerBgFile = tickerBgFile;
    this.tickerFile = tickerFile;
    this.lbandFile = lbandFile;
    this.ashtonFile = ashtonFile;
  }

  // Calculate logo overlay expressions based on position and margins
  getLogoPositionExpressions(pos = 'top-right', mxPercent = 2, myPercent = 2) {
    const mx = Math.max(0, Math.round((1280 * Number(mxPercent !== undefined ? mxPercent : 2)) / 100));
    const my = Math.max(0, Math.round((720 * Number(myPercent !== undefined ? myPercent : 2)) / 100));

    const cleanPos = String(pos || 'top-right').toLowerCase().trim();

    switch (cleanPos) {
      case 'top-left':
        return { x: `${mx}`, y: `${my}` };
      case 'center':
        return { x: `(W-w)/2`, y: `(H-h)/2` };
      case 'bottom-left':
        return { x: `${mx}`, y: `H-h-${my}` };
      case 'bottom-right':
        return { x: `W-w-${mx}`, y: `H-h-${my}` };
      case 'top-right':
      default:
        return { x: `W-w-${mx}`, y: `${my}` };
    }
  }

  // Calculate ticker overlay expressions: supports Center, Left, Right background alignment and crawling text.
  // Dynamically adapts position when L-Band or Ashton Band are active:
  // - If L-Band is active: ticker appears strictly in the cutout region where video appears (windowX..windowX+windowWidth, windowY+windowHeight-h).
  // - If Ashton Band is active: ticker appears directly above the lower third banner (H - ashtonH - h).
  getTickerPositionExpressions(mbPercent = 0, speed = 3, alignment = 'center', tickerMeta = null) {
    const meta = tickerMeta || this.tickerMeta || {};
    const bTick = this.channel?.branding?.ticker || {};
    const bLband = this.channel?.branding?.lband || {};
    const bAshton = this.channel?.branding?.ashton || {};

    const align = (alignment || bTick.alignment || 'center').toLowerCase();
    const wp = Math.max(30, Math.min(100, Number(bTick.width) || 100));

    // Crawl scrolling speed in pixels per second (speed 1..10 maps to 70..295 px/s)
    const s = Math.max(1, Math.min(10, Number(speed) || 3));
    const scrollSpeed = Math.round(45 + s * 25);

    // Text crawling expression:
    // If small text (< 15 chars): crawl across with empty section W - mod(t * scrollSpeed, W + w)
    // If reasonable length: continuous infinite seamless crawl with NO empty section at any time: 0 - mod(t * scrollSpeed, unitWidth)
    let xTextExpr;
    if (meta.isSmallText) {
      xTextExpr = `W-mod(t*${scrollSpeed},W+w)`;
    } else {
      const u = meta.unitWidth || 350;
      xTextExpr = `0-mod(t*${scrollSpeed},${u})`;
    }

    const isLbandActive = !!bLband.enabled;
    const isAshtonActive = !!bAshton.enabled;

    let xBarExpr = '0';
    let yBarExpr = 'H-h';
    let targetWidth = 1280;

    if (isLbandActive) {
      // CASE 1: L-Band is active on air
      // Video is squeezed into cutout window [windowX, windowY, windowWidth, windowHeight]
      // Ticker appears strictly IN THE REGION TILL WHICH THE VIDEO APPEARS:
      // - Left edge starts at windowX
      // - Width constrained to windowWidth
      // - Bottom edge aligned to the bottom of the video region (windowY + windowHeight)
      const winX = Number(bLband.windowX !== undefined ? bLband.windowX : 300);
      const winY = Number(bLband.windowY !== undefined ? bLband.windowY : 20);
      const winW = Number(bLband.windowWidth || 960);
      const winH = Number(bLband.windowHeight || 540);

      targetWidth = Math.round((winW * wp) / 100);
      if (targetWidth % 2 !== 0) targetWidth += 1;
      targetWidth = Math.min(winW, targetWidth);

      const mb = Math.max(0, Math.round((winH * Number(mbPercent || 0)) / 100));
      const videoBottom = winY + winH;

      if (isAshtonActive) {
        const ashtonH = Number(bAshton.height) || 160;
        const bottomOffset = ashtonH + mb;
        yBarExpr = `${videoBottom}-h-${bottomOffset}`;
      } else {
        yBarExpr = mb > 0 ? `${videoBottom}-h-${mb}` : `${videoBottom}-h`;
      }

      if (align === 'center') {
        const offset = Math.max(0, Math.round((winW - targetWidth) / 2));
        xBarExpr = `${winX + offset}`;
      } else if (align === 'left') {
        xBarExpr = `${winX}`;
      } else if (align === 'right') {
        xBarExpr = `${winX + winW - targetWidth}`;
      }
    } else if (isAshtonActive) {
      // CASE 2: Ashton Band is active on air
      // Lower third banner graphic is at the bottom of the screen (height = ashtonH)
      // Ticker must appear directly ABOVE THE ASHTON BAND:
      // y = H - ashtonH - h - mb
      const ashtonH = Number(bAshton.height) || 160;
      const mb = Math.max(0, Math.round((720 * Number(mbPercent || 0)) / 100));

      targetWidth = Math.round((1280 * wp) / 100);
      if (targetWidth % 2 !== 0) targetWidth += 1;
      const bottomOffset = ashtonH + mb;
      yBarExpr = `H-h-${bottomOffset}`;

      if (align === 'center') {
        xBarExpr = '(W-w)/2';
      } else if (align === 'left') {
        xBarExpr = '0';
      } else if (align === 'right') {
        xBarExpr = 'W-w';
      }
    } else {
      // CASE 3: Normal mode (full screen video, no L-Band, no Ashton Band)
      const mb = Math.max(0, Math.round((720 * Number(mbPercent || 0)) / 100));
      yBarExpr = mb > 0 ? `H-h-${mb}` : 'H-h';
      targetWidth = Math.round((1280 * wp) / 100);
      if (targetWidth % 2 !== 0) targetWidth += 1;

      if (align === 'center') {
        xBarExpr = '(W-w)/2';
      } else if (align === 'left') {
        xBarExpr = '0';
      } else if (align === 'right') {
        xBarExpr = 'W-w';
      }
    }

    return {
      bar: { x: xBarExpr, y: yBarExpr, width: targetWidth },
      text: { x: xTextExpr, y: '0' },
      bg: { x: xBarExpr, y: yBarExpr, width: targetWidth },
      width: targetWidth,
      // Backward compatibility aliases
      x: xBarExpr,
      y: yBarExpr
    };
  }

  async start() {
    const bLogo = this.channel.branding?.logo || {};
    const bTick = this.channel.branding?.ticker || {};

    // Pre-render both ticker_bg.png and ticker.png with current channel branding
    try {
      this.tickerMeta = await renderTickerImage({
        text: bTick.text || 'Welcome to Cloud Playout Live Broadcast',
        bgColor: bTick.bgColor || '#000000dd',
        textColor: bTick.textColor || '#ffffff',
        fontFamily: bTick.fontFamily || 'Sans Bold',
        fontSize: bTick.fontSize || 26,
        widthPercent: bTick.width || 100,
        paddingY: bTick.paddingY || 12,
        alignment: bTick.alignment || 'center',
        outputPath: this.tickerFile
      });
    } catch (tErr) {
      console.warn('[Encoder] Warning generating initial ticker:', tErr.message);
    }

    const logoPos = this.getLogoPositionExpressions(
      bLogo.position || 'top-right',
      bLogo.marginX || 2,
      bLogo.marginY || 2
    );
    const tickPos = this.getTickerPositionExpressions(
      bTick.marginBottom !== undefined ? bTick.marginBottom : 0,
      bTick.speed !== undefined ? bTick.speed : 3,
      bTick.alignment || 'center',
      this.tickerMeta
    );

    // Initial logo dimensions and aspect ratio
    const canvasHeight = this.channel.outputSettings?.height || 720;
    const is1080p = canvasHeight >= 1080;
    const baseHeight = is1080p ? 100 : 70;
    const sizePct = Math.max(5, Math.min(60, Number(bLogo.sizePercent) || 10));
    let logoH = Math.round(baseHeight * (sizePct / 10));
    logoH = Math.max(20, logoH - (logoH % 2));

    this.logoAspectRatio = 1.0;
    try {
      if (fs.existsSync(this.logoFile)) {
        const meta = await sharp(this.logoFile).metadata();
        if (meta && meta.width && meta.height) {
          this.logoAspectRatio = meta.width / meta.height;
        }
      }
    } catch {}

    let logoW = Math.round(logoH * this.logoAspectRatio);
    if (logoW % 2 !== 0) logoW += 1;
    logoW = Math.max(20, logoW);

    const bLband = this.channel.branding?.lband || {};
    const bAshton = this.channel.branding?.ashton || {};

    const logoEnabled = bLogo.enabled ? 1 : 0;
    const tickEnabled = bTick.enabled ? 1 : 0;
    const lbandEnabled = bLband.enabled ? 1 : 0;
    const lbandW = Number(bLband.windowWidth) || 960;
    const lbandH = Number(bLband.windowHeight) || 540;
    const lbandX = bLband.windowX !== undefined ? Number(bLband.windowX) : 300;
    const lbandY = bLband.windowY !== undefined ? Number(bLband.windowY) : 20;

    const ashtonEnabled = bAshton.enabled ? 1 : 0;
    const ashtonSqueeze = bAshton.squeeze !== false;
    const ashtonH = Number(bAshton.height) || 160;
    const ashtonVidH = Math.max(300, 720 - ashtonH);

    const lbandMasterX = lbandEnabled ? '0' : '-5000';
    const lbandMasterY = lbandEnabled ? '0' : '-5000';

    const ashtonSqX = (ashtonEnabled && ashtonSqueeze) ? '0' : '-5000';
    const ashtonSqY = (ashtonEnabled && ashtonSqueeze) ? '0' : '-5000';

    const ashtonOvX = (ashtonEnabled && !ashtonSqueeze) ? '0' : '-5000';
    const ashtonOvY = (ashtonEnabled && !ashtonSqueeze) ? 'H-h' : '-5000';

    const logoX = logoEnabled ? logoPos.x : '-5000';
    const logoY = logoEnabled ? logoPos.y : '-5000';

    const tickBarX = tickEnabled ? tickPos.bar.x : '-5000';
    const tickBarY = tickEnabled ? tickPos.bar.y : '-5000';

    // Complex filter with ZMQ broker and dynamic DVE squeeze + overlay filters:
    // 1. Moving ticker text over static background bar
    // 2. Incoming video with ZMQ broker & 3-way split: full, lband_in, ashton_in
    // 3. L-Band Squeeze: video scaled to window cutout (e.g. 960x540) & padded to 1280x720, then lband.png overlaid on top
    // 4. Ashton Squeeze: video scaled to fit above banner (e.g. 1280x560) & padded, then ashton.png (bottom banner) overlaid at (0, H-h)
    // 5. Compositing switches: lband_master, ashton_squeeze, ashton_overlay, logo, ticker toggled via (x, y) coordinates
    // 6. Dynamic logo scaling filter (scale@logo_scale) controllable via live ZMQ with zero stream restart
    const filtergraph = [
      `[2:v][3:v]overlay@ticktext=x='${tickPos.text.x}':y='${tickPos.text.y}':format=auto[tickbar_raw]`,
      `[tickbar_raw]crop@tick_crop=w=${tickPos.bar.width || 1280}:h=ih:x=0:y=0[tickbar]`,
      `[0:v]zmq=bind_address=tcp\\\\://127.0.0.1\\\\:${this.zmqPort},split=3[v_full][v_lband_in][v_ashton_in]`,
      `[v_lband_in]scale=w=${lbandW}:h=${lbandH},pad=1280:720:${lbandX}:${lbandY}:black[v_lband_padded]`,
      `[v_lband_padded][4:v]overlay@lband_gfx=x=0:y=0[lband_composite]`,
      `[v_ashton_in]scale=w=1280:h=${ashtonVidH},pad=1280:720:0:0:black[v_ashton_padded]`,
      `[v_ashton_padded][5:v]overlay@ashton_sq_gfx=x=0:y='H-h'[ashton_sq_composite]`,
      `[v_full][lband_composite]overlay@lband_master=x='${lbandMasterX}':y='${lbandMasterY}'[v_after_lband]`,
      `[v_after_lband][ashton_sq_composite]overlay@ashton_squeeze=x='${ashtonSqX}':y='${ashtonSqY}'[v_after_ashton_sq]`,
      `[v_after_ashton_sq][5:v]overlay@ashton_overlay=x='${ashtonOvX}':y='${ashtonOvY}'[v_after_ashton]`,
      `[1:v]scale@logo_scale=w=${logoW}:h=${logoH}:eval=frame[v_logo_scaled]`,
      `[v_after_ashton][v_logo_scaled]overlay@logo=x='${logoX}':y='${logoY}'[v_after_logo]`,
      `[v_after_logo][tickbar]overlay@tick=x='${tickBarX}':y='${tickBarY}'[vout]`
    ].join('; ');

        const hlsManifest = path.join(this.hlsDir, 'index.m3u8').replace(/\\/g, '/');
        let rtmpTarget = this.channel.rtmpUrl?.trim();
        let streamKey = sanitizeStreamKey(this.channel.streamKey || this.channel.name);

        if (rtmpTarget) {
          // Clean spaces from rtmpUrl while preserving exact casing (e.g. rtmp://94.136.185.222/static/newTestChannel)
          rtmpTarget = rtmpTarget.replace(/\s+/g, '_');
          const urlMatch = rtmpTarget.match(/\/([^/?#]+)(?:\?.*)?$/);
          if (urlMatch && urlMatch[1]) {
            streamKey = sanitizeStreamKey(urlMatch[1]);
          }
        } else {
          // Extract host from server
          const sUrl = this.channel.server?.streamUrl || this.channel.server?.hlsBaseUrl || 'http://127.0.0.1:81';
          let hostname = '127.0.0.1';
          try {
            const p = new URL(sUrl.startsWith('http') ? sUrl : `http://${sUrl}`);
            hostname = p.hostname;
          } catch {
            const m = sUrl.match(/^(?:https?:\/\/)?([^:/]+)/i);
            if (m) hostname = m[1];
          }

          // Build clean RTMP target
          let rtmpBase = this.channel.server?.rtmpBaseUrl?.trim();
          if (!rtmpBase) {
            rtmpBase = `rtmp://${hostname}/static`;
          }
          rtmpBase = rtmpBase.replace(/\/+$/, '');
          if (!rtmpBase.endsWith('/static') && !rtmpBase.endsWith('/live')) {
            rtmpBase = `${rtmpBase}/static`;
          }

          rtmpTarget = `${rtmpBase}/${streamKey}`;
        }

        // Low-latency local HLS for live monitoring + remote RTMP
        const teeOutput = `[f=hls:hls_time=1:hls_list_size=3:hls_flags=delete_segments+split_by_time]${hlsManifest}|[f=flv:flvflags=no_duration_filesize:onfail=ignore]${rtmpTarget}`;

        const ffmpegArgs = [
          '-y',
          // Input 0: MPEG-TS stdin from Feeder
          '-f', 'mpegts', '-i', 'pipe:0',
          // Input 1: Looping logo.png
          '-loop', '1', '-i', this.logoFile,
          // Input 2: Looping ticker_bg.png (STATIC BACKGROUND BAR)
          '-loop', '1', '-i', this.tickerBgFile,
          // Input 3: Looping ticker.png (MOVING TEXT OVERLAY)
          '-loop', '1', '-i', this.tickerFile,
          // Input 4: Looping lband.png (L-BAND GRAPHIC WITH TRANSPARENT CUTOUT)
          '-loop', '1', '-i', this.lbandFile,
          // Input 5: Looping ashton.png (ASHTON BAND LOWER THIRD)
          '-loop', '1', '-i', this.ashtonFile,
          // Filtergraph
          '-filter_complex', filtergraph,
          '-map', '[vout]',
          '-map', '0:a?',
          // Video encoding (libx264, CPU only, low CPU veryfast preset, 25fps GOP 50)
          '-c:v', 'libx264',
          '-preset', 'veryfast',
          '-g', '50',
          '-keyint_min', '25',
          '-sc_threshold', '0',
          '-b:v', this.channel.outputSettings?.videoBitrate || '2500k',
          '-maxrate', this.channel.outputSettings?.videoBitrate || '2500k',
          '-bufsize', '5000k',
          '-pix_fmt', 'yuv420p',
          '-flags', '+global_header', // Required for FLV/RTMP to include SPS/PPS headers for Flussonic!
          // Audio encoding
          '-c:a', 'aac',
          '-b:a', this.channel.outputSettings?.audioBitrate || '128k',
          '-ar', '44100',
          '-ac', '2',
          // Dual output via tee
          '-f', 'tee',
          teeOutput
        ];

        console.log(`[Encoder] Launching FFmpeg encoder for channel '${this.channel.name}' -> RTMP: ${rtmpTarget} (ZMQ: ${this.zmqPort})`);
        this.process = spawn('ffmpeg', ffmpegArgs, {
          stdio: ['pipe', 'pipe', 'pipe']
        });

        this.isRunning = true;

        // Catch broken pipe (EPIPE) when feeder or encoder restarts/stops
        this.process.stdin?.on('error', (err) => {
          if (err.code === 'EPIPE' || err.code === 'EOF') return;
          console.error('[Encoder stdin error]', err.message);
        });

        this.process.on('error', (err) => {
          console.error('[Encoder process error]', err.message);
        });

        this.process.stderr.on('data', (d) => {
          const msg = d.toString();
          // Log notable encoder events, RTMP connection messages, and errors
          if (
            msg.includes('Error') ||
            msg.includes('failed') ||
            msg.includes('rtmp') ||
            msg.includes('Connection') ||
            msg.includes('Slave')
          ) {
            console.log(`[Encoder:${streamKey}] ${msg.trim()}`);
          }
        });

        this.process.on('close', (code) => {
          console.log(`[Encoder] FFmpeg encoder exited with code ${code}`);
          this.isRunning = false;
          if (this.zmqSocket) {
            try {
              this.zmqSocket.close();
            } catch {}
            this.zmqSocket = null;
          }
        });

        // Initialize ZMQ Request client after brief warmup
        return new Promise((resolve) => {
          setTimeout(async () => {
            try {
              this.zmqSocket = new zmq.Request();
              this.zmqSocket.connect(`tcp://127.0.0.1:${this.zmqPort}`);
              console.log(`[Encoder] ZMQ socket connected for live overlay commands on port ${this.zmqPort}`);
            } catch (err) {
              console.error('[Encoder] ZMQ connect error:', err);
            }
            resolve(this);
          }, 1200);
        });
  }

  /**
   * Send live runtime ZMQ command directly into FFmpeg filtergraph with strict timeout
   */
  async sendZmqCommand(commandString, timeoutMs = 700) {
    if (!this.zmqSocket || !this.isRunning) {
      console.warn('[Encoder ZMQ] Cannot send command, socket or encoder not running');
      return null;
    }
    try {
      const sendPromise = this.zmqSocket.send(commandString);
      const receivePromise = this.zmqSocket.receive();

      let timeoutHandle;
      const timeoutPromise = new Promise((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error(`Timeout (${timeoutMs}ms)`));
        }, timeoutMs);
      });

      await sendPromise;
      const [reply] = await Promise.race([receivePromise, timeoutPromise]);
      clearTimeout(timeoutHandle);
      const res = reply ? reply.toString().trim() : '';
      return res;
    } catch (err) {
      console.warn(`[Encoder ZMQ] Command '${commandString}' failed/timed out: ${err.message}`);
      try {
        if (this.zmqSocket) {
          this.zmqSocket.close();
          this.zmqSocket = new zmq.Request();
          this.zmqSocket.connect(`tcp://127.0.0.1:${this.zmqPort}`);
        }
      } catch {}
      return null;
    }
  }

  // Live logo control via ZMQ
  async setLogoEnabled(enabled) {
    if (!this.channel) this.channel = {};
    if (!this.channel.branding) this.channel.branding = {};
    if (!this.channel.branding.logo) this.channel.branding.logo = {};
    this.channel.branding.logo.enabled = !!enabled;

    if (enabled) {
      const bLogo = this.channel.branding.logo;
      const expr = this.getLogoPositionExpressions(
        bLogo.position || 'top-right',
        bLogo.marginX !== undefined ? bLogo.marginX : 2,
        bLogo.marginY !== undefined ? bLogo.marginY : 2
      );
      await this.sendZmqCommand(`overlay@logo x ${expr.x}`);
      return this.sendZmqCommand(`overlay@logo y ${expr.y}`);
    } else {
      await this.sendZmqCommand('overlay@logo x -5000');
      return this.sendZmqCommand('overlay@logo y -5000');
    }
  }

  async setLogoPosition(pos, marginX, marginY) {
    if (!this.channel) this.channel = {};
    if (!this.channel.branding) this.channel.branding = {};
    if (!this.channel.branding.logo) this.channel.branding.logo = {};
    if (pos) this.channel.branding.logo.position = pos;
    if (marginX !== undefined) this.channel.branding.logo.marginX = Number(marginX);
    if (marginY !== undefined) this.channel.branding.logo.marginY = Number(marginY);

    const targetPos = pos || this.channel.branding.logo.position || 'top-right';
    const targetMx = marginX !== undefined ? Number(marginX) : (this.channel.branding.logo.marginX ?? 2);
    const targetMy = marginY !== undefined ? Number(marginY) : (this.channel.branding.logo.marginY ?? 2);

    const expr = this.getLogoPositionExpressions(targetPos, targetMx, targetMy);
    await this.sendZmqCommand(`overlay@logo x ${expr.x}`);
    return this.sendZmqCommand(`overlay@logo y ${expr.y}`);
  }

  // Live dynamic logo size scaling via ZMQ with zero stream restart
  async setLogoSize(sizePercent) {
    if (!this.channel) this.channel = {};
    if (!this.channel.branding) this.channel.branding = {};
    if (!this.channel.branding.logo) this.channel.branding.logo = {};
    if (sizePercent !== undefined) this.channel.branding.logo.sizePercent = Number(sizePercent);

    const canvasHeight = this.channel.outputSettings?.height || 720;
    const is1080p = canvasHeight >= 1080;
    const baseHeight = is1080p ? 100 : 70;
    const pct = Math.max(5, Math.min(60, Number(this.channel.branding.logo.sizePercent) || 10));
    let targetHeight = Math.round(baseHeight * (pct / 10));
    if (targetHeight % 2 !== 0) targetHeight += 1;
    targetHeight = Math.max(20, targetHeight);

    if (!this.logoAspectRatio) {
      this.logoAspectRatio = 1.0;
      try {
        if (fs.existsSync(this.logoFile)) {
          const meta = await sharp(this.logoFile).metadata();
          if (meta && meta.width && meta.height) {
            this.logoAspectRatio = meta.width / meta.height;
          }
        }
      } catch {}
    }

    let targetWidth = Math.round(targetHeight * (this.logoAspectRatio || 1.0));
    if (targetWidth % 2 !== 0) targetWidth += 1;
    targetWidth = Math.max(20, targetWidth);

    console.log(`[Encoder] Live dynamic logo resize via ZMQ -> ${targetWidth}x${targetHeight}px (${pct}%)`);

    await this.sendZmqCommand(`scale@logo_scale w ${targetWidth}`);
    await this.sendZmqCommand(`scale@logo_scale h ${targetHeight}`);

    const bLogo = this.channel.branding.logo;
    if (bLogo.enabled !== false) {
      const expr = this.getLogoPositionExpressions(
        bLogo.position || 'top-right',
        bLogo.marginX !== undefined ? bLogo.marginX : 2,
        bLogo.marginY !== undefined ? bLogo.marginY : 2
      );
      await this.sendZmqCommand(`overlay@logo x ${expr.x}`);
      await this.sendZmqCommand(`overlay@logo y ${expr.y}`);
    }

    return { width: targetWidth, height: targetHeight };
  }

  // Live ticker control via ZMQ
  async setTickerEnabled(enabled) {
    if (!this.channel) this.channel = {};
    if (!this.channel.branding) this.channel.branding = {};
    if (!this.channel.branding.ticker) this.channel.branding.ticker = {};
    this.channel.branding.ticker.enabled = !!enabled;

    if (enabled) {
      const bTick = this.channel.branding.ticker;
      const expr = this.getTickerPositionExpressions(
        bTick.marginBottom !== undefined ? bTick.marginBottom : 0,
        bTick.speed || 3,
        bTick.alignment || 'center'
      );
      if (expr.bar.width) {
        await this.sendZmqCommand(`crop@tick_crop w ${expr.bar.width}`);
      }
      await this.sendZmqCommand(`overlay@tick x ${expr.bar.x}`);
      return this.sendZmqCommand(`overlay@tick y ${expr.bar.y}`);
    } else {
      await this.sendZmqCommand('overlay@tick x -5000');
      return this.sendZmqCommand('overlay@tick y -5000');
    }
  }

  async setTickerPosition(marginBottom, speed, alignment, tickerMeta = null) {
    if (tickerMeta) {
      this.tickerMeta = tickerMeta;
    }
    if (!this.channel) this.channel = {};
    if (!this.channel.branding) this.channel.branding = {};
    if (!this.channel.branding.ticker) this.channel.branding.ticker = {};
    if (marginBottom !== undefined) this.channel.branding.ticker.marginBottom = Number(marginBottom);
    if (speed !== undefined) this.channel.branding.ticker.speed = Number(speed);
    if (alignment !== undefined) this.channel.branding.ticker.alignment = alignment;

    const expr = this.getTickerPositionExpressions(
      this.channel.branding.ticker.marginBottom !== undefined ? this.channel.branding.ticker.marginBottom : 0,
      this.channel.branding.ticker.speed ?? 3,
      this.channel.branding.ticker.alignment ?? 'center',
      this.tickerMeta
    );
    if (expr.bar.width) {
      await this.sendZmqCommand(`crop@tick_crop w ${expr.bar.width}`);
    }
    await this.sendZmqCommand(`overlay@tick x ${expr.bar.x}`);
    await this.sendZmqCommand(`overlay@tick y ${expr.bar.y}`);
    return this.sendZmqCommand(`overlay@ticktext x ${expr.text.x}`);
  }

  // Live ZMQ update to adapt ticker position & width when L-Band or Ashton Band toggles
  async updateLiveTickerPosition() {
    const bTick = this.channel?.branding?.ticker;
    if (!bTick || !bTick.enabled) return null;

    const expr = this.getTickerPositionExpressions(
      bTick.marginBottom !== undefined ? bTick.marginBottom : 0,
      bTick.speed ?? 3,
      bTick.alignment ?? 'center',
      this.tickerMeta
    );

    if (expr.bar.width) {
      await this.sendZmqCommand(`crop@tick_crop w ${expr.bar.width}`);
    }
    await this.sendZmqCommand(`overlay@tick x ${expr.bar.x}`);
    await this.sendZmqCommand(`overlay@tick y ${expr.bar.y}`);
    return this.sendZmqCommand(`overlay@ticktext x ${expr.text.x}`);
  }

  // Live L-Band control via ZMQ with smooth sliding animation
  async setLBandEnabled(enabled) {
    if (!this.channel) this.channel = {};
    if (!this.channel.branding) this.channel.branding = {};
    if (!this.channel.branding.lband) this.channel.branding.lband = {};
    this.channel.branding.lband.enabled = !!enabled;

    const animId = ++this.lbandAnimId;
    try {
      if (enabled) {
        // Adjust ticker position so it appears within the video region
        this.updateLiveTickerPosition().catch(() => {});

        // Smooth slide-in from left: x: -1280 -> 0
        await this.sendZmqCommand('overlay@lband_master y 0', 250);
        const steps = [-1280, -850, -480, -220, -70, 0];
        for (const x of steps) {
          if (this.lbandAnimId !== animId) return;
          await this.sendZmqCommand(`overlay@lband_master x ${x}`, 180);
          await new Promise((r) => setTimeout(r, 25));
        }
        await this.sendZmqCommand('overlay@lband_master x 0', 250);
        await this.sendZmqCommand('overlay@lband_master y 0', 250);
        return this.updateLiveTickerPosition();
      } else {
        // Smooth slide-out to left: x: 0 -> -1280
        const steps = [-70, -220, -480, -850, -1280];
        for (const x of steps) {
          if (this.lbandAnimId !== animId) return;
          await this.sendZmqCommand(`overlay@lband_master x ${x}`, 180);
          await new Promise((r) => setTimeout(r, 25));
        }
        await this.sendZmqCommand('overlay@lband_master x -5000', 250);
        await this.sendZmqCommand('overlay@lband_master y -5000', 250);

        // Restore ticker position to full video width / bottom
        return this.updateLiveTickerPosition();
      }
    } catch (e) {
      console.warn('[Encoder ZMQ] L-Band animation fallback:', e.message);
      if (enabled) {
        await this.sendZmqCommand('overlay@lband_master x 0', 250);
        await this.sendZmqCommand('overlay@lband_master y 0', 250);
      } else {
        await this.sendZmqCommand('overlay@lband_master x -5000', 250);
        await this.sendZmqCommand('overlay@lband_master y -5000', 250);
      }
      return this.updateLiveTickerPosition();
    }
  }

  // Live Ashton Band control via ZMQ (Squeeze vs Overlay vs Off) with smooth bottom slide animation
  async setAshtonLive(enabled, squeeze = true) {
    if (!this.channel) this.channel = {};
    if (!this.channel.branding) this.channel.branding = {};
    if (!this.channel.branding.ashton) this.channel.branding.ashton = {};
    this.channel.branding.ashton.enabled = !!enabled;
    this.channel.branding.ashton.squeeze = !!squeeze;

    const animId = ++this.ashtonAnimId;
    const ashtonH = Number(this.channel.branding?.ashton?.height) || 160;
    const targetY = 720 - ashtonH; // Bottom position (e.g. 560)

    try {
      if (enabled) {
        // Move ticker above Ashton Band
        this.updateLiveTickerPosition().catch(() => {});

        if (squeeze) {
          await this.sendZmqCommand('overlay@ashton_overlay x -5000', 180);
          await this.sendZmqCommand('overlay@ashton_overlay y -5000', 180);

          // Smooth slide-up from bottom for squeezed frame: y: 720 -> 0
          await this.sendZmqCommand('overlay@ashton_squeeze x 0', 250);
          const steps = [720, 500, 300, 150, 40, 0];
          for (const y of steps) {
            if (this.ashtonAnimId !== animId) return;
            await this.sendZmqCommand(`overlay@ashton_squeeze y ${y}`, 180);
            await new Promise((r) => setTimeout(r, 25));
          }
          await this.sendZmqCommand('overlay@ashton_squeeze x 0', 250);
          await this.sendZmqCommand('overlay@ashton_squeeze y 0', 250);
          return this.updateLiveTickerPosition();
        } else {
          await this.sendZmqCommand('overlay@ashton_squeeze x -5000', 180);
          await this.sendZmqCommand('overlay@ashton_squeeze y -5000', 180);

          // Smooth slide-up from bottom for lower-third banner: y: 720 -> targetY (e.g. 560)
          await this.sendZmqCommand('overlay@ashton_overlay x 0', 250);
          const diff = 720 - targetY;
          const steps = [
            720,
            Math.round(720 - diff * 0.35),
            Math.round(720 - diff * 0.65),
            Math.round(720 - diff * 0.88),
            targetY
          ];
          for (const y of steps) {
            if (this.ashtonAnimId !== animId) return;
            await this.sendZmqCommand(`overlay@ashton_overlay y ${y}`, 180);
            await new Promise((r) => setTimeout(r, 25));
          }
          await this.sendZmqCommand('overlay@ashton_overlay x 0', 250);
          await this.sendZmqCommand('overlay@ashton_overlay y H-h', 250);
          return this.updateLiveTickerPosition();
        }
      } else {
        // Disappearing: slide down off bottom edge
        if (squeeze) {
          const steps = [40, 150, 300, 500, 720];
          for (const y of steps) {
            if (this.ashtonAnimId !== animId) return;
            await this.sendZmqCommand(`overlay@ashton_squeeze y ${y}`, 180);
            await new Promise((r) => setTimeout(r, 25));
          }
          await this.sendZmqCommand('overlay@ashton_squeeze x -5000', 250);
          await this.sendZmqCommand('overlay@ashton_squeeze y -5000', 250);
        } else {
          const diff = 720 - targetY;
          const steps = [
            Math.round(targetY + diff * 0.25),
            Math.round(targetY + diff * 0.55),
            Math.round(targetY + diff * 0.85),
            720
          ];
          for (const y of steps) {
            if (this.ashtonAnimId !== animId) return;
            await this.sendZmqCommand(`overlay@ashton_overlay y ${y}`, 180);
            await new Promise((r) => setTimeout(r, 25));
          }
          await this.sendZmqCommand('overlay@ashton_overlay x -5000', 250);
          await this.sendZmqCommand('overlay@ashton_overlay y -5000', 250);
        }
        return this.updateLiveTickerPosition();
      }
    } catch (e) {
      console.warn('[Encoder ZMQ] Ashton animation fallback:', e.message);
      if (enabled) {
        if (squeeze) {
          await this.sendZmqCommand('overlay@ashton_overlay x -5000', 200);
          await this.sendZmqCommand('overlay@ashton_overlay y -5000', 200);
          await this.sendZmqCommand('overlay@ashton_squeeze x 0', 200);
          await this.sendZmqCommand('overlay@ashton_squeeze y 0', 200);
        } else {
          await this.sendZmqCommand('overlay@ashton_squeeze x -5000', 200);
          await this.sendZmqCommand('overlay@ashton_squeeze y -5000', 200);
          await this.sendZmqCommand('overlay@ashton_overlay x 0', 200);
          await this.sendZmqCommand('overlay@ashton_overlay y H-h', 200);
        }
      } else {
        await this.sendZmqCommand('overlay@ashton_squeeze x -5000', 200);
        await this.sendZmqCommand('overlay@ashton_squeeze y -5000', 200);
        await this.sendZmqCommand('overlay@ashton_overlay x -5000', 200);
        await this.sendZmqCommand('overlay@ashton_overlay y -5000', 200);
      }
      return this.updateLiveTickerPosition();
    }
  }

  stop() {
    this.isRunning = false;
    if (this.zmqSocket) {
      try {
        this.zmqSocket.close();
      } catch {}
      this.zmqSocket = null;
    }
    if (this.process) {
      try {
        this.process.stdin.end();
        this.process.kill('SIGINT');
      } catch {}
    }
  }
}
