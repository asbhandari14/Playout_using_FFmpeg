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
    this.canvasWidth = Number(channel.outputSettings?.width) || 1280;
    this.canvasHeight = Number(channel.outputSettings?.height) || 720;
    this.lastReportedPts = 0;
    this.lastReportedAt = Date.now();
    this.streamStartTime = Date.now();

    // Stream working directory
    this.channelDir = path.join(STREAMS_DIR, String(channel._id));
    this.hlsDir = path.join(this.channelDir, 'hls');

    if (!fs.existsSync(this.hlsDir)) {
      fs.mkdirSync(this.hlsDir, { recursive: true });
    }

    // Ensure initial logo.png, ticker_bg.png, ticker.png, lband.png, ashton.png, and bug file
    const logoSource = channel.branding?.logo?.assetPath
      ? path.resolve(SERVER_ROOT, channel.branding.logo.assetPath)
      : null;
    const lbandSource = channel.branding?.lband?.assetPath
      ? path.resolve(SERVER_ROOT, channel.branding.lband.assetPath)
      : null;
    const ashtonSource = channel.branding?.ashton?.assetPath
      ? path.resolve(SERVER_ROOT, channel.branding.ashton.assetPath)
      : null;
    const bugSource = channel.branding?.bug?.assetPath
      ? path.resolve(SERVER_ROOT, channel.branding.bug.assetPath)
      : null;
    const isBugGif = !!channel.branding?.bug?.isGif || (bugSource && bugSource.toLowerCase().endsWith('.gif'));

    const { logoFile, tickerBgFile, tickerFile, lbandFile, ashtonFile, bugFile, isBugGif: resolvedIsBugGif } = ensureBrandingFiles(this.channelDir, {
      logoSourcePath: logoSource,
      lbandSourcePath: lbandSource,
      ashtonSourcePath: ashtonSource,
      bugSourcePath: bugSource,
      isBugGif
    });
    this.logoFile = logoFile;
    this.tickerBgFile = tickerBgFile;
    this.tickerFile = tickerFile;
    this.lbandFile = lbandFile;
    this.ashtonFile = ashtonFile;
    this.bugFile = bugFile;
    this.isBugGif = resolvedIsBugGif;
    this.bugAspectRatio = 1.0;
  }

  // Get current presentation timestamp (PTS) in seconds
  getCurrentStreamTime() {
    if (this.lastReportedPts !== undefined && this.lastReportedAt) {
      const elapsed = (Date.now() - this.lastReportedAt) / 1000;
      return Math.max(0, this.lastReportedPts + elapsed);
    }
    if (this.streamStartTime) {
      return Math.max(0, (Date.now() - this.streamStartTime) / 1000);
    }
    return 0;
  }

  // Calculate bug overlay expressions based on flexible position (custom X/Y percentages) or preset corners
  getBugPositionExpressions(posOrOptions = 'custom', mxPercent = 2, myPercent = 2, posX = null, posY = null) {
    let pos = 'custom';
    let mxVal = 2;
    let myVal = 2;
    let customX = null;
    let customY = null;

    if (typeof posOrOptions === 'object' && posOrOptions !== null) {
      pos = posOrOptions.position || 'custom';
      mxVal = posOrOptions.marginX !== undefined ? posOrOptions.marginX : 2;
      myVal = posOrOptions.marginY !== undefined ? posOrOptions.marginY : 2;
      customX = posOrOptions.positionX !== undefined ? posOrOptions.positionX : null;
      customY = posOrOptions.positionY !== undefined ? posOrOptions.positionY : null;
    } else {
      pos = posOrOptions || 'custom';
      mxVal = mxPercent !== undefined ? mxPercent : 2;
      myVal = myPercent !== undefined ? myPercent : 2;
      customX = posX !== undefined ? posX : null;
      customY = posY !== undefined ? posY : null;
    }

    const cleanPos = String(pos || 'custom').toLowerCase().trim();

    // If explicit positionX and positionY (0-100%) are provided, position ANYWHERE freely on screen!
    if (customX !== null && customY !== null && !isNaN(customX) && !isNaN(customY)) {
      const clampedX = Math.max(0, Math.min(100, Number(customX)));
      const clampedY = Math.max(0, Math.min(100, Number(customY)));
      return {
        x: `(W-w)*${(clampedX / 100).toFixed(4)}`,
        y: `(H-h)*${(clampedY / 100).toFixed(4)}`
      };
    }

    // Preset positions for backward compatibility
    const mx = Math.max(0, Math.round((1280 * Number(mxVal)) / 100));
    const my = Math.max(0, Math.round((720 * Number(myVal)) / 100));

    switch (cleanPos) {
      case 'top-left':
        return { x: `${mx}`, y: `${my}` };
      case 'center':
        return { x: `(W-w)/2`, y: `(H-h)/2` };
      case 'bottom-left':
        return { x: `${mx}`, y: `H-h-${my}` };
      case 'top-right':
        return { x: `W-w-${mx}`, y: `${my}` };
      case 'bottom-right':
        return { x: `W-w-${mx}`, y: `H-h-${my}` };
      case 'custom':
      default:
        // Default flexible position (bottom-right 95%, 95%)
        return { x: '(W-w)*0.9500', y: '(H-h)*0.9500' };
    }
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
  getTickerPositionExpressions(mbPercent = 0, speed = 3, alignment = 'center', tickerMeta = null, lbandOverride = null) {
    const meta = tickerMeta || this.tickerMeta || {};
    const bTick = this.channel?.branding?.ticker || {};
    const bLband = this.channel?.branding?.lband || {};
    const bAshton = this.channel?.branding?.ashton || {};

    const align = (alignment || bTick.alignment || 'center').toLowerCase();
    const wp = Math.max(30, Math.min(100, Number(bTick.width) || 100));

    // Crawl scrolling speed in pixels per second (speed 1..10 maps to 70..295 px/s)
    const s = Math.max(1, Math.min(10, Number(speed) || 3));
    const scrollSpeed = Math.round(10 + s * 25);

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

    const isLbandActive = lbandOverride !== null ? !!lbandOverride : !!bLband.enabled;
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
        fontFamily: bTick.fontFamily || 'Arial',
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
    } catch { }

    let logoW = Math.round(logoH * this.logoAspectRatio);
    if (logoW % 2 !== 0) logoW += 1;
    logoW = Math.max(20, logoW);

    const bLband = this.channel.branding?.lband || {};
    const bAshton = this.channel.branding?.ashton || {};
    const bBug = this.channel.branding?.bug || {};

    const logoEnabled = bLogo.enabled ? 1 : 0;
    const tickEnabled = bTick.enabled ? 1 : 0;
    const lbandEnabled = bLband.enabled ? 1 : 0;
    const canvasW = this.canvasWidth;
    const canvasH = this.canvasHeight;

    let targetW = Number(bLband.windowWidth) || 960;
    let targetH = Number(bLband.windowHeight) || 540;
    let targetX = bLband.windowX !== undefined ? Number(bLband.windowX) : 300;
    let targetY = bLband.windowY !== undefined ? Number(bLband.windowY) : 20;

    // Ensure even dimensions
    if (targetW % 2 !== 0) targetW -= 1;
    if (targetH % 2 !== 0) targetH -= 1;
    if (targetX % 2 !== 0) targetX -= 1;
    if (targetY % 2 !== 0) targetY -= 1;

    const isLeftPillar = targetX > 50;
    const deltaW = canvasW - targetW;
    const deltaH = canvasH - targetH;

    // Initial parameters based on whether L-Band is enabled at stream boot
    const initW = lbandEnabled ? targetW : canvasW;
    const initH = lbandEnabled ? targetH : canvasH;
    const initX = lbandEnabled ? targetX : 0;
    const initY = lbandEnabled ? targetY : 0;

    const ashtonEnabled = bAshton.enabled ? 1 : 0;
    const ashtonSqueeze = bAshton.squeeze !== false;
    let ashtonH = Number(bAshton.height) || 160;
    if (ashtonH % 2 !== 0) ashtonH -= 1;
    const ashtonVidH = Math.max(20, canvasH - ashtonH);
    const ashtonGfxY = canvasH - ashtonH;

    const initAshtonVidH = (ashtonEnabled && ashtonSqueeze) ? ashtonVidH : canvasH;

    const lbandMasterX = lbandEnabled ? '0' : '-5000';
    const lbandMasterY = lbandEnabled ? '0' : '-5000';

    const ashtonSqX = (ashtonEnabled && ashtonSqueeze) ? '0' : '-5000';
    const ashtonSqY = (ashtonEnabled && ashtonSqueeze) ? '0' : '-5000';

    const ashtonOvX = (ashtonEnabled && !ashtonSqueeze) ? '0' : '-5000';
    const ashtonOvY = (ashtonEnabled && !ashtonSqueeze) ? `${ashtonGfxY}` : '-5000';

    // Bug setup & sizing (input 6)
    const bugPos = this.getBugPositionExpressions(bBug);
    const bugSizePct = Math.max(2, Math.min(60, Number(bBug.sizePercent) || 8));
    let bugH = Math.round(baseHeight * (bugSizePct / 10));
    bugH = Math.max(20, bugH - (bugH % 2));

    this.bugAspectRatio = 1.0;
    try {
      if (fs.existsSync(this.bugFile)) {
        const meta = await sharp(this.bugFile, { animated: this.isBugGif }).metadata();
        // For animated GIFs, meta.pageHeight holds single-frame height (meta.height is total of all frames concatenated!)
        const effectiveHeight = (this.isBugGif && meta.pageHeight) ? meta.pageHeight : meta.height;
        if (meta && meta.width && effectiveHeight) {
          this.bugAspectRatio = meta.width / effectiveHeight;
        }
      }
    } catch { }

    // Both static images and animated GIFs scale width and height proportionally based on aspect ratio
    let bugW = Math.round(bugH * (this.bugAspectRatio || 1.0));
    if (bugW % 2 !== 0) bugW += 1;
    bugW = Math.max(20, bugW);

    const bugEnabled = bBug.enabled ? 1 : 0;
    const bugX = bugEnabled ? bugPos.x : '-5000';
    const bugY = bugEnabled ? bugPos.y : '-5000';

    const logoX = logoEnabled ? logoPos.x : '-5000';
    const logoY = logoEnabled ? logoPos.y : '-5000';

    const tickBarX = tickEnabled ? tickPos.bar.x : '-5000';
    const tickBarY = tickEnabled ? tickPos.bar.y : '-5000';

    // Complex filter with ZMQ broker and dynamic DVE squeeze + overlay filters:
    // 1. Moving ticker text over static background bar
    // 2. Incoming video with ZMQ broker & 3-way split: full, lband_in, ashton_in
    // 3. Dynamic Smootherstep Broadcast DVE Squeeze for Uncut L-Band:
    //    - [0:v] scaled dynamically with eval=frame
    //    - [lband_bg] black canvas
    //    - [4:v] whole uncut lband.png with transparent video cutout overlaid dynamically in lockstep
    // 4. Ashton Squeeze: video scaled to fit above banner (e.g. 1280x560) & padded, then ashton.png (bottom banner) overlaid at (0, H-h)
    // 5. Compositing switches: lband_master, ashton_squeeze, ashton_overlay
    // 6. Bug Overlay: [6:v] scaled and overlaid onto [v_after_ashton] -> [v_after_bug]
    // 7. Logo Overlay: [1:v] scaled and overlaid onto [v_after_bug] -> [v_after_logo] (LOGO ON TOP OF BUG IF SAME POSITION!)
    // 8. Ticker Overlay: [v_after_logo] + [tickbar] -> [vout]
    const filtergraph = [
      `color=c=black:s=${canvasW}x${canvasH}:r=25[lband_bg]`,
      `color=c=black:s=${canvasW}x${canvasH}:r=25[ashton_bg]`,
      `[2:v][3:v]overlay@ticktext=x='${tickPos.text.x}':y='${tickPos.text.y}':format=auto[tickbar_raw]`,
      `[tickbar_raw]crop@tick_crop=w=${tickPos.bar.width || canvasW}:h=ih:x=0:y=0[tickbar]`,
      `[0:v]zmq=bind_address=tcp\\\\://127.0.0.1\\\\:${this.zmqPort},split=3[v_full][v_lband_in][v_ashton_in]`,
      `[v_lband_in]scale@lband_sq=w='${initW}':h='${initH}':eval=frame[v_lband_scaled]`,
      `[4:v]format=rgba[lband_g]`,
      `[lband_bg][lband_g]overlay@lband_gfx=x=0:y=0[lband_base]`,
      `[lband_base][v_lband_scaled]overlay@lband_vid_pos=x='${initX}':y='${initY}'[lband_composite]`,
      `[5:v]format=rgba,split[ashton_sq_g][ashton_ov_g]`,
      `[ashton_bg][ashton_sq_g]overlay@ashton_sq_gfx=x=0:y='${ashtonGfxY}'[ashton_base]`,
      `[v_ashton_in]scale@ashton_sq=w=${canvasW}:h='${initAshtonVidH}':eval=frame[v_ashton_scaled]`,
      `[ashton_base][v_ashton_scaled]overlay@ashton_sq_vid=x=0:y=0[ashton_sq_composite]`,
      `[v_full][lband_composite]overlay@lband_master=x='${lbandMasterX}':y='${lbandMasterY}'[v_after_lband]`,
      `[v_after_lband][ashton_sq_composite]overlay@ashton_squeeze=x='${ashtonSqX}':y='${ashtonSqY}'[v_after_ashton_sq]`,
      `[v_after_ashton_sq][ashton_ov_g]overlay@ashton_overlay=x='${ashtonOvX}':y='${ashtonOvY}'[v_after_ashton]`,
      `[6:v]scale@bug_scale=w=${bugW}:h=${bugH}:eval=frame[v_bug_scaled]`,
      `[v_after_ashton][v_bug_scaled]overlay@bug=x='${bugX}':y='${bugY}'[v_after_bug]`,
      `[1:v]scale@logo_scale=w=${logoW}:h=${logoH}:eval=frame[v_logo_scaled]`,
      `[v_after_bug][v_logo_scaled]overlay@logo=x='${logoX}':y='${logoY}'[v_after_logo]`,
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

    // Low-latency local HLS for live monitoring + remote RTMP (onfail=ignore preserves local HLS if remote RTMP drops)
    const teeOutput = `[f=hls:hls_time=1:hls_list_size=3:hls_flags=delete_segments+split_by_time]${hlsManifest}|[onfail=ignore:f=flv:flvflags=no_duration_filesize]${rtmpTarget}`;

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
      // Input 6: Station Bug (animated GIF via -ignore_loop 0 or static image via -loop 1)
      ...(this.isBugGif ? ['-ignore_loop', '0', '-i', this.bugFile] : ['-loop', '1', '-i', this.bugFile]),
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
    this.streamStartTime = Date.now();
    this.lastReportedPts = 0;
    this.lastReportedAt = Date.now();

    // Catch broken pipe (EPIPE / ECONNRESET) when feeder or encoder restarts/stops
    this.process.stdin?.on('error', (err) => {
      if (err.code === 'EPIPE' || err.code === 'EOF' || err.code === 'ECONNRESET') return;
      console.warn('[Encoder stdin error]', err.message);
    });

    this.process.stdout?.on('error', (err) => {
      if (err.code === 'EPIPE' || err.code === 'EOF' || err.code === 'ECONNRESET') return;
    });

    this.process.stderr?.on('error', (err) => {
      if (err.code === 'EPIPE' || err.code === 'EOF' || err.code === 'ECONNRESET') return;
    });

    this.process.on('error', (err) => {
      if (err.code === 'EPIPE' || err.code === 'ECONNRESET') return;
      console.error('[Encoder process error]', err.message);
    });

    this.process.stderr.on('data', (d) => {
      const msg = d.toString();
      const timeMatch = msg.match(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/);
      if (timeMatch) {
        this.lastReportedPts = Number(timeMatch[1]) * 3600 + Number(timeMatch[2]) * 60 + Number(timeMatch[3]);
        this.lastReportedAt = Date.now();
      }

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
      const wasRunning = this.isRunning;
      this.isRunning = false;
      if (this.zmqSocket) {
        try {
          this.zmqSocket.close();
        } catch { }
        this.zmqSocket = null;
      }
      if (wasRunning && !this.isStopping && typeof this.onUnexpectedExit === 'function') {
        this.onUnexpectedExit(code);
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
      } catch { }
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
      } catch { }
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

  // Live station bug control via ZMQ
  async setBugEnabled(enabled) {
    if (!this.channel) this.channel = {};
    if (!this.channel.branding) this.channel.branding = {};
    if (!this.channel.branding.bug) this.channel.branding.bug = {};
    this.channel.branding.bug.enabled = !!enabled;

    if (enabled) {
      const bBug = this.channel.branding.bug;
      const expr = this.getBugPositionExpressions(bBug);
      await this.sendZmqCommand(`overlay@bug x ${expr.x}`);
      return this.sendZmqCommand(`overlay@bug y ${expr.y}`);
    } else {
      await this.sendZmqCommand('overlay@bug x -5000');
      return this.sendZmqCommand('overlay@bug y -5000');
    }
  }

  // Live dynamic bug repositioning via ZMQ: accepts free X/Y percentages (0-100%) or preset positions
  async setBugPosition(posOrOptions, marginX, marginY, positionX, positionY) {
    if (!this.channel) this.channel = {};
    if (!this.channel.branding) this.channel.branding = {};
    if (!this.channel.branding.bug) this.channel.branding.bug = {};

    if (typeof posOrOptions === 'object' && posOrOptions !== null) {
      const opts = posOrOptions;
      if (opts.position !== undefined) this.channel.branding.bug.position = opts.position;
      if (opts.positionX !== undefined) this.channel.branding.bug.positionX = Number(opts.positionX);
      if (opts.positionY !== undefined) this.channel.branding.bug.positionY = Number(opts.positionY);
      if (opts.marginX !== undefined) this.channel.branding.bug.marginX = Number(opts.marginX);
      if (opts.marginY !== undefined) this.channel.branding.bug.marginY = Number(opts.marginY);
    } else {
      if (posOrOptions !== undefined) this.channel.branding.bug.position = posOrOptions;
      if (marginX !== undefined) this.channel.branding.bug.marginX = Number(marginX);
      if (marginY !== undefined) this.channel.branding.bug.marginY = Number(marginY);
      if (positionX !== undefined) this.channel.branding.bug.positionX = Number(positionX);
      if (positionY !== undefined) this.channel.branding.bug.positionY = Number(positionY);
    }

    const expr = this.getBugPositionExpressions(this.channel.branding.bug);
    console.log(`[Encoder] Live dynamic bug reposition via ZMQ -> x: ${expr.x}, y: ${expr.y}`);
    await this.sendZmqCommand(`overlay@bug x ${expr.x}`);
    return this.sendZmqCommand(`overlay@bug y ${expr.y}`);
  }

  // Live dynamic bug size scaling via ZMQ with zero stream restart:
  // - For animated GIF: increasing size increases HEIGHT ONLY, NOT width
  // - For static image: increasing size increases BOTH height and width proportionally
  async setBugSize(sizePercent) {
    if (!this.channel) this.channel = {};
    if (!this.channel.branding) this.channel.branding = {};
    if (!this.channel.branding.bug) this.channel.branding.bug = {};
    if (sizePercent !== undefined) this.channel.branding.bug.sizePercent = Number(sizePercent);

    const canvasHeight = this.channel.outputSettings?.height || 720;
    const is1080p = canvasHeight >= 1080;
    const baseHeight = is1080p ? 100 : 70;
    const pct = Math.max(2, Math.min(60, Number(this.channel.branding.bug.sizePercent) || 8));
    let targetHeight = Math.round(baseHeight * (pct / 10));
    if (targetHeight % 2 !== 0) targetHeight += 1;
    targetHeight = Math.max(20, targetHeight);

    if (!this.bugAspectRatio || this.bugAspectRatio < 0.1) {
      this.bugAspectRatio = 1.0;
      try {
        if (fs.existsSync(this.bugFile)) {
          const meta = await sharp(this.bugFile, { animated: this.isBugGif }).metadata();
          const effectiveHeight = (this.isBugGif && meta.pageHeight) ? meta.pageHeight : meta.height;
          if (meta && meta.width && effectiveHeight) {
            this.bugAspectRatio = meta.width / effectiveHeight;
          }
        }
      } catch { }
    }

    // Both static images and animated GIFs scale width and height proportionally, maintaining original aspect ratio
    let targetWidth = Math.round(targetHeight * (this.bugAspectRatio || 1.0));
    if (targetWidth % 2 !== 0) targetWidth += 1;
    targetWidth = Math.max(20, targetWidth);

    console.log(`[Encoder] Live dynamic bug resize via ZMQ -> ${targetWidth}x${targetHeight}px (${pct}%, ratio: ${this.bugAspectRatio?.toFixed(3)})`);

    await this.sendZmqCommand(`scale@bug_scale w ${targetWidth}`);
    await this.sendZmqCommand(`scale@bug_scale h ${targetHeight}`);

    const bBug = this.channel.branding.bug;
    if (bBug.enabled !== false) {
      const expr = this.getBugPositionExpressions(bBug);
      await this.sendZmqCommand(`overlay@bug x ${expr.x}`);
      await this.sendZmqCommand(`overlay@bug y ${expr.y}`);
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

  // Ticker x/y that blend between the normal (no L-band) and L-band positions using the same eased E
  getTickerMoveExpressions(E) {
    const bTick = this.channel?.branding?.ticker;
    if (!bTick || !bTick.enabled) return null;

    const mb = bTick.marginBottom !== undefined ? bTick.marginBottom : 0;
    const spd = bTick.speed ?? 3;
    const al = bTick.alignment ?? 'center';

    const off = this.getTickerPositionExpressions(mb, spd, al, this.tickerMeta, false);
    const on = this.getTickerPositionExpressions(mb, spd, al, this.tickerMeta, true);

    return {
      x: `(1-${E})*(${off.bar.x})+${E}*(${on.bar.x})`,
      y: `(1-${E})*(${off.bar.y})+${E}*(${on.bar.y})`,
      offWidth: off.bar.width
    };
  }

  // Live Broadcast-Grade Smootherstep DVE Squeeze & L-Band control via ZMQ
  async setLBandEnabled(enabled) {
    if (!this.channel) this.channel = {};
    if (!this.channel.branding) this.channel.branding = {};
    if (!this.channel.branding.lband) this.channel.branding.lband = {};
    this.channel.branding.lband.enabled = !!enabled;

    const animId = ++this.lbandAnimId;
    const bLband = this.channel.branding.lband;
    const canvasW = this.canvasWidth || 1280;
    const canvasH = this.canvasHeight || 720;

    let targetW = Number(bLband.windowWidth) || 960;
    let targetH = Number(bLband.windowHeight) || 540;
    let targetX = bLband.windowX !== undefined ? Number(bLband.windowX) : 300;
    let targetY = bLband.windowY !== undefined ? Number(bLband.windowY) : 20;

    if (targetW % 2 !== 0) targetW -= 1;
    if (targetH % 2 !== 0) targetH -= 1;
    if (targetX % 2 !== 0) targetX -= 1;
    if (targetY % 2 !== 0) targetY -= 1;

    const isLeftPillar = targetX > 50;
    const deltaW = canvasW - targetW;
    const deltaH = canvasH - targetH;

    // const currentPts = this.getCurrentStreamTime();
    // const T = Math.max(0, currentPts);
    // const D = 1.8; // 1.8s smootherstep duration as requested

    const LEAD = 0.8;   // start in the future so all ZMQ commands land before motion begins
    const T = Math.max(0, this.getCurrentStreamTime()) + LEAD;
    const D = 1.8;

    console.log(`[Encoder] L-Band smootherstep transition starting: enabled=${enabled}, T=${T.toFixed(3)}s, D=${D}s`);

    try {
      if (enabled) {
        // Smootherstep progress for the VIDEO squeeze:
        // Video starts full screen ABOVE the L-band, and then squeezes into the cutout window revealing the L-band
        const P = `clip((t-${T.toFixed(3)})/${D},0,1)`;
        const E = `(${P}*${P}*${P}*(${P}*(${P}*6-15)+10))`;

        const W_expr = `trunc((${canvasW}-${deltaW}*${E})/2)*2`;
        const H_expr = `trunc((${canvasH}-${deltaH}*${E})/2)*2`;
        const X_expr = isLeftPillar ? `trunc((${targetX}*${E})/2)*2` : '0';
        const Y_expr = `trunc((${targetY}*${E})/2)*2`;

        // 1. Video squeeze expressions (E = 0 until T, so the video stays full-size above the L-band at first)
        await this.sendZmqCommand(`scale@lband_sq w ${W_expr}`);
        await this.sendZmqCommand(`scale@lband_sq h ${H_expr}`);
        await this.sendZmqCommand(`overlay@lband_vid_pos x ${X_expr}`);
        await this.sendZmqCommand(`overlay@lband_vid_pos y ${Y_expr}`);

        // 2. Ticker follows the squeeze
        const tk = this.getTickerMoveExpressions(E);
        if (tk) {
          await this.sendZmqCommand(`overlay@tick x ${tk.x}`);
          await this.sendZmqCommand(`overlay@tick y ${tk.y}`);
        }

        // 3. Switch the master composite on (video is currently full-screen above the L-band, zero pop)
        await this.sendZmqCommand('overlay@lband_master y 0');
        await this.sendZmqCommand('overlay@lband_master x 0');

        // 4. When the squeeze finishes, pin final window position and update ticker
        setTimeout(async () => {
          if (this.lbandAnimId !== animId) return;
          await this.sendZmqCommand(`scale@lband_sq w ${targetW}`);
          await this.sendZmqCommand(`scale@lband_sq h ${targetH}`);
          await this.sendZmqCommand(`overlay@lband_vid_pos x ${targetX}`);
          await this.sendZmqCommand(`overlay@lband_vid_pos y ${targetY}`);
          this.updateLiveTickerPosition().catch(() => { });
        }, Math.round((LEAD + D + 0.2) * 1000));

        return { success: true, enabled: true };
      } else {
        // Reverse smootherstep: smoothly expand video back from squeezed size to full screen ABOVE the L-band
        const P = `clip((t-${T.toFixed(3)})/${D},0,1)`;
        const E = `(1-(${P}*${P}*${P}*(${P}*(${P}*6-15)+10)))`;

        const W_expr = `trunc((${canvasW}-${deltaW}*${E})/2)*2`;
        const H_expr = `trunc((${canvasH}-${deltaH}*${E})/2)*2`;
        const X_expr = isLeftPillar ? `trunc((${targetX}*${E})/2)*2` : '0';
        const Y_expr = `trunc((${targetY}*${E})/2)*2`;

        // NO layer swapping! Video is already above the L-band graphic, expands smoothly over it:
        await this.sendZmqCommand(`scale@lband_sq w ${W_expr}`);
        await this.sendZmqCommand(`scale@lband_sq h ${H_expr}`);
        await this.sendZmqCommand(`overlay@lband_vid_pos x ${X_expr}`);
        await this.sendZmqCommand(`overlay@lband_vid_pos y ${Y_expr}`);

        const tk = this.getTickerMoveExpressions(E);
        if (tk) {
          await this.sendZmqCommand(`crop@tick_crop w ${tk.offWidth}`);
          await this.sendZmqCommand(`overlay@tick x ${tk.x}`);
          await this.sendZmqCommand(`overlay@tick y ${tk.y}`);
        }

        // After transition duration (1.8s + lead + buffer), video is completely full-screen covering graphic.
        // Park master overlay off-screen seamlessly with zero blink:
        setTimeout(async () => {
          if (this.lbandAnimId !== animId) return;
          await this.sendZmqCommand(`scale@lband_sq w ${canvasW}`);
          await this.sendZmqCommand(`scale@lband_sq h ${canvasH}`);
          await this.sendZmqCommand('overlay@lband_vid_pos x 0');
          await this.sendZmqCommand('overlay@lband_vid_pos y 0');
          await this.sendZmqCommand('overlay@lband_master x -5000');
          await this.sendZmqCommand('overlay@lband_master y -5000');
          await this.updateLiveTickerPosition();
        }, Math.round((LEAD + D + 0.2) * 1000));

        return { success: true, enabled: false };
      }
    } catch (e) {
      console.warn('[Encoder ZMQ] L-Band smootherstep animation fallback:', e.message);
      const offGfxX = isLeftPillar ? -targetX : deltaW;
      if (enabled) {
        await this.sendZmqCommand('overlay@lband_master x 0', 250);
        await this.sendZmqCommand('overlay@lband_master y 0', 250);
        await this.sendZmqCommand(`scale@lband_sq w ${targetW}`, 250);
        await this.sendZmqCommand(`scale@lband_sq h ${targetH}`, 250);
        await this.sendZmqCommand(`overlay@lband_vid_pos x ${targetX}`, 250);
        await this.sendZmqCommand(`overlay@lband_vid_pos y ${targetY}`, 250);
      } else {
        await this.sendZmqCommand('overlay@lband_master x -5000', 250);
        await this.sendZmqCommand('overlay@lband_master y -5000', 250);
        await this.sendZmqCommand(`scale@lband_sq w ${canvasW}`, 250);
        await this.sendZmqCommand(`scale@lband_sq h ${canvasH}`, 250);
        await this.sendZmqCommand('overlay@lband_vid_pos x 0', 250);
        await this.sendZmqCommand('overlay@lband_vid_pos y 0', 250);
      }
      await this.updateLiveTickerPosition();
      return { success: true, fallback: true, enabled };
    }
  }

  // Live Ashton Band control via ZMQ (Squeeze vs Overlay vs Off)
  // - Squeeze Mode:
  //     Appear: Ashton band appears on top at bottom, video squeezes in height underneath it
  //     Disappear: Video expands in height above the Ashton band, then Ashton band disappears
  // - Overlay Mode:
  //     Appear: Ashton band slides from the bottom to the top (canvasH -> canvasH - ashtonH)
  //     Disappear: Ashton band slides back down from top to bottom (canvasH - ashtonH -> canvasH)
  async setAshtonLive(enabled, squeeze = true) {
    if (!this.channel) this.channel = {};
    if (!this.channel.branding) this.channel.branding = {};
    if (!this.channel.branding.ashton) this.channel.branding.ashton = {};
    this.channel.branding.ashton.enabled = !!enabled;
    this.channel.branding.ashton.squeeze = !!squeeze;

    const animId = ++this.ashtonAnimId;
    const canvasW = this.canvasWidth || 1280;
    const canvasH = this.canvasHeight || 720;
    let ashtonH = Number(this.channel.branding?.ashton?.height) || 160;
    if (ashtonH % 2 !== 0) ashtonH -= 1;
    const ashtonVidH = Math.max(20, canvasH - ashtonH);
    const targetY = canvasH - ashtonH;

    const LEAD = 0.8;
    const currentPts = this.getCurrentStreamTime();
    const T = Math.max(0, currentPts) + LEAD;
    const D = 1.8; // 1.8s smootherstep duration

    console.log(`[Encoder] Ashton transition starting: enabled=${enabled}, squeeze=${squeeze}, T=${T.toFixed(3)}s, D=${D}s`);

    try {
      if (enabled) {
        // Move ticker above Ashton Band
        this.updateLiveTickerPosition().catch(() => { });

        if (squeeze) {
          // --- SQUEEZE MODE APPEAR ---
          // 1. Turn off overlay mode
          await this.sendZmqCommand('overlay@ashton_overlay x -5000', 180);
          await this.sendZmqCommand('overlay@ashton_overlay y -5000', 180);

          // 2. Squeeze video in height ABOVE the Ashton band: canvasH -> (canvasH - ashtonH)
          // Video starts full screen (E = 0 until T) completely covering graphic, then shrinks upward revealing the Ashton band
          const P = `clip((t-${T.toFixed(3)})/${D},0,1)`;
          const E = `(${P}*${P}*${P}*(${P}*(${P}*6-15)+10))`;
          const H_expr = `trunc((${canvasH}-${ashtonH}*${E})/2)*2`;

          await this.sendZmqCommand(`scale@ashton_sq h ${H_expr}`);

          // 3. Bring squeeze composite on air (video is currently full height, zero pop)
          await this.sendZmqCommand('overlay@ashton_squeeze x 0', 250);
          await this.sendZmqCommand('overlay@ashton_squeeze y 0', 250);

          // 4. When motion completes, pin final height and update ticker
          setTimeout(async () => {
            if (this.ashtonAnimId !== animId) return;
            await this.sendZmqCommand(`scale@ashton_sq h ${ashtonVidH}`);
            this.updateLiveTickerPosition().catch(() => { });
          }, Math.round((LEAD + D + 0.2) * 1000));

          return { success: true, enabled: true, squeeze: true };
        } else {
          // --- OVERLAY MODE APPEAR ---
          // 1. Turn off squeeze mode
          await this.sendZmqCommand('overlay@ashton_squeeze x -5000', 180);
          await this.sendZmqCommand('overlay@ashton_squeeze y -5000', 180);

          // 2. Ashton graphic slides UP from bottom to top: canvasH -> targetY
          const P = `clip((t-${T.toFixed(3)})/${D},0,1)`;
          const E = `(${P}*${P}*${P}*(${P}*(${P}*6-15)+10))`;
          const Y_expr = `trunc((${canvasH}-${ashtonH}*${E})/2)*2`;

          await this.sendZmqCommand('overlay@ashton_overlay x 0', 250);
          await this.sendZmqCommand(`overlay@ashton_overlay y ${Y_expr}`);

          setTimeout(() => {
            if (this.ashtonAnimId !== animId) return;
            this.updateLiveTickerPosition().catch(() => { });
          }, Math.round((LEAD + D + 0.2) * 1000));

          return { success: true, enabled: true, squeeze: false };
        }
      } else {
        // --- DISAPPEARING ---
        if (squeeze) {
          // --- SQUEEZE MODE DISAPPEAR ---
          // NO layer swapping! Video is ALREADY above the Ashton band graphic!
          // 1. Video smoothly expands downward in height from (canvasH - ashtonH) back to canvasH:
          const P = `clip((t-${T.toFixed(3)})/${D},0,1)`;
          const E = `(1-(${P}*${P}*${P}*(${P}*(${P}*6-15)+10)))`;
          const H_expr = `trunc((${canvasH}-${ashtonH}*${E})/2)*2`;

          await this.sendZmqCommand(`scale@ashton_sq h ${H_expr}`);

          // 2. When expansion completes (video covers entire canvas), park squeeze composite off-screen:
          setTimeout(async () => {
            if (this.ashtonAnimId !== animId) return;
            await this.sendZmqCommand(`scale@ashton_sq h ${canvasH}`);
            await this.sendZmqCommand('overlay@ashton_squeeze x -5000');
            await this.sendZmqCommand('overlay@ashton_squeeze y -5000');
            await this.updateLiveTickerPosition();
          }, Math.round((LEAD + D + 0.2) * 1000));

          return { success: true, enabled: false, squeeze: true };
        } else {
          // --- OVERLAY MODE DISAPPEAR ---
          // 1. Ashton graphic slides DOWN from targetY to bottom off-screen (canvasH)
          const P = `clip((t-${T.toFixed(3)})/${D},0,1)`;
          const E = `(1-(${P}*${P}*${P}*(${P}*(${P}*6-15)+10)))`;
          const Y_expr = `trunc((${canvasH}-${ashtonH}*${E})/2)*2`;

          await this.sendZmqCommand(`overlay@ashton_overlay y ${Y_expr}`);

          // 2. When slide-down completes, park overlay off-screen
          setTimeout(async () => {
            if (this.ashtonAnimId !== animId) return;
            await this.sendZmqCommand('overlay@ashton_overlay x -5000');
            await this.sendZmqCommand('overlay@ashton_overlay y -5000');
            await this.updateLiveTickerPosition();
          }, Math.round((LEAD + D + 0.2) * 1000));

          return { success: true, enabled: false, squeeze: false };
        }
      }
    } catch (e) {
      console.warn('[Encoder ZMQ] Ashton animation fallback:', e.message);
      if (enabled) {
        if (squeeze) {
          await this.sendZmqCommand('overlay@ashton_overlay x -5000', 200);
          await this.sendZmqCommand('overlay@ashton_overlay y -5000', 200);
          await this.sendZmqCommand(`scale@ashton_sq h ${ashtonVidH}`, 200);
          await this.sendZmqCommand('overlay@ashton_squeeze x 0', 200);
          await this.sendZmqCommand('overlay@ashton_squeeze y 0', 200);
        } else {
          await this.sendZmqCommand('overlay@ashton_squeeze x -5000', 200);
          await this.sendZmqCommand('overlay@ashton_squeeze y -5000', 200);
          await this.sendZmqCommand('overlay@ashton_overlay x 0', 200);
          await this.sendZmqCommand(`overlay@ashton_overlay y ${targetY}`, 200);
        }
      } else {
        await this.sendZmqCommand(`scale@ashton_sq h ${canvasH}`, 200);
        await this.sendZmqCommand('overlay@ashton_squeeze x -5000', 200);
        await this.sendZmqCommand('overlay@ashton_squeeze y -5000', 200);
        await this.sendZmqCommand('overlay@ashton_overlay x -5000', 200);
        await this.sendZmqCommand('overlay@ashton_overlay y -5000', 200);
      }
      await this.updateLiveTickerPosition();
      return { success: false, error: e.message };
    }
  }

  stop() {
    this.isRunning = false;
    if (this.zmqSocket) {
      try {
        this.zmqSocket.close();
      } catch { }
      this.zmqSocket = null;
    }
    if (this.process) {
      try {
        this.process.stdin.end();
        this.process.kill('SIGINT');
      } catch { }
    }
  }
}
