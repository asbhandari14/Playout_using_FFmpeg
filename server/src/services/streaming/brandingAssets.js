import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

// 1x1 transparent PNG base64
const TRANSPARENT_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

/**
 * Ensure transparent/placeholder logo.png, ticker_bg.png, ticker.png, lband.png, ashton.png, and bug file exist in channel stream directory
 */
export const ensureBrandingFiles = (
  channelDir,
  { logoSourcePath = null, lbandSourcePath = null, ashtonSourcePath = null, bugSourcePath = null, isBugGif = false, isBugMov = false } = {}
) => {
  if (!fs.existsSync(channelDir)) {
    fs.mkdirSync(channelDir, { recursive: true });
  }

  const logoFile = path.join(channelDir, 'logo.png');
  const tickerBgFile = path.join(channelDir, 'ticker_bg.png');
  const tickerFile = path.join(channelDir, 'ticker.png');
  const lbandFile = path.join(channelDir, 'lband.png');
  const ashtonFile = path.join(channelDir, 'ashton.png');

  const bugIsActuallyMov = isBugMov || (bugSourcePath && bugSourcePath.toLowerCase().endsWith('.mov'));
  const bugIsActuallyGif = !bugIsActuallyMov && (isBugGif || (bugSourcePath && bugSourcePath.toLowerCase().endsWith('.gif')));
  
  let bugFileName = 'bug.png';
  if (bugIsActuallyMov) {
    bugFileName = 'bug.mov';
  } else if (bugIsActuallyGif) {
    bugFileName = 'bug.gif';
  }
  const bugFile = path.join(channelDir, bugFileName);

  // Logo file: preserve existing scaled logo.png, or initialize if missing
  if (!fs.existsSync(logoFile)) {
    if (logoSourcePath && fs.existsSync(logoSourcePath)) {
      fs.copyFileSync(logoSourcePath, logoFile);
    } else {
      fs.writeFileSync(logoFile, Buffer.from(TRANSPARENT_PNG_BASE64, 'base64'));
    }
  }

  // Bug file: supports transparent PNG, or QuickTime MOV
  if (bugSourcePath && fs.existsSync(bugSourcePath)) {
    fs.copyFileSync(bugSourcePath, bugFile);
  } else if (!fs.existsSync(bugFile)) {
    fs.writeFileSync(bugFile, Buffer.from(TRANSPARENT_PNG_BASE64, 'base64'));
  }

  // Ticker static background file
  if (!fs.existsSync(tickerBgFile)) {
    fs.writeFileSync(tickerBgFile, Buffer.from(TRANSPARENT_PNG_BASE64, 'base64'));
  }

  // Ticker text overlay file
  if (!fs.existsSync(tickerFile)) {
    fs.writeFileSync(tickerFile, Buffer.from(TRANSPARENT_PNG_BASE64, 'base64'));
  }

  // L-Band file (1280x720 frame with transparent video window)
  if (lbandSourcePath && fs.existsSync(lbandSourcePath)) {
    fs.copyFileSync(lbandSourcePath, lbandFile);
  } else if (!fs.existsSync(lbandFile)) {
    fs.writeFileSync(lbandFile, Buffer.from(TRANSPARENT_PNG_BASE64, 'base64'));
    generateDefaultLBandImageSync(lbandFile);
  }

  // Ashton Band file (1280x720 frame with transparent top & bottom banner)
  if (ashtonSourcePath && fs.existsSync(ashtonSourcePath)) {
    fs.copyFileSync(ashtonSourcePath, ashtonFile);
  } else if (!fs.existsSync(ashtonFile)) {
    fs.writeFileSync(ashtonFile, Buffer.from(TRANSPARENT_PNG_BASE64, 'base64'));
    generateDefaultAshtonImageSync(ashtonFile);
  }

  return {
    logoFile,
    tickerBgFile,
    tickerFile,
    lbandFile,
    ashtonFile,
    bugFile,
    isBugGif: !!bugIsActuallyGif,
    isBugMov: !!bugIsActuallyMov
  };
};

export const safeWriteFileSync = (filePath, buffer, retries = 5, delayMs = 50) => {
  const dir = path.dirname(filePath);
  const tempPath = path.join(dir, `.tmp_${Date.now()}_${path.basename(filePath)}`);
  try {
    fs.writeFileSync(tempPath, buffer);
  } catch {
    fs.writeFileSync(filePath, buffer);
    return;
  }

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      fs.copyFileSync(tempPath, filePath);
      try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch {}
      return;
    } catch (err) {
      if (attempt === retries - 1) {
        try { fs.writeFileSync(filePath, buffer); } catch {}
        try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch {}
        return;
      }
      const start = Date.now();
      while (Date.now() - start < delayMs) {
        // brief sync wait
      }
    }
  }
};

export const safeWriteFile = async (filePath, buffer, retries = 5, delayMs = 50) => {
  return safeWriteFileSync(filePath, buffer, retries, delayMs);
};

/**
 * Atomically replace a branding file in the active stream folder with a 1x1 transparent PNG.
 */
export const clearStreamBrandingFile = (filePath) => {
  if (!filePath || !fs.existsSync(filePath)) return false;
  safeWriteFileSync(filePath, Buffer.from(TRANSPARENT_PNG_BASE64, 'base64'));
  return true;
};


/**
 * Maps user-selected font families to system font stacks recognized by librsvg on Windows/Linux,
 * ensuring distinct, high-quality typography (Serif, Sans, Monospace, Headline, Devanagari Hindi).
 */
export const resolveTickerFont = (fontFamily = '') => {
  const norm = String(fontFamily || '').trim().toLowerCase();
  switch (norm) {
    case 'impact':
      return '"Impact", "Arial Black", sans-serif';
    case 'times new roman':
    case 'times':
      return '"Times New Roman", "Times", serif';
    case 'georgia':
      return '"Georgia", "Palatino", serif';
    case 'courier new':
    case 'courier':
    case 'monospace':
      return '"Courier New", "Courier", monospace';
    case 'verdana':
      return '"Verdana", "Geneva", sans-serif';
    case 'trebuchet ms':
    case 'trebuchet':
      return '"Trebuchet MS", "Lucida Grande", sans-serif';
    case 'comic sans ms':
    case 'comic sans':
      return '"Comic Sans MS", cursive, sans-serif';
    case 'segoe ui':
      return '"Segoe UI", "Tahoma", sans-serif';
    case 'noto sans devanagari':
    case 'hindi (devanagari)':
    case 'hindi':
    case 'mangal':
    case 'nirmala ui':
      return '"Nirmala UI", "Mangal", "Noto Sans Devanagari", "Segoe UI", sans-serif';
    case 'arial':
    case 'sans bold':
    case 'sans':
    default:
      return norm && norm !== 'sans' && norm !== 'sans bold'
        ? `"${fontFamily}", "Arial", "Segoe UI", sans-serif`
        : '"Arial", "Segoe UI", sans-serif';
  }
};

/**
 * Render ticker crawl text to transparent PNG using sharp + SVG with Unicode/Hindi support.
 * Renders two files:
 * 1. ticker_bg.png: STATIC full-width background bar (1280px wide) that remains motionless at the bottom.
 * 2. ticker.png: MOVING transparent text strip that scrolls smoothly over the static background.
 */
export const renderTickerImage = async ({
  text = '',
  bgColor = '#000000dd',
  textColor = '#ffffff',
  fontFamily = 'Arial',
  fontSize = 26,
  widthPercent = 100,
  paddingY = 12,
  alignment = 'center',
  outputPath
}) => {
  let cleanText = (text && typeof text === 'string') ? text.trim() : '';
  if (!cleanText) {
    cleanText = 'Welcome to Cloud Playout Live Broadcast';
  }

  // Robust textColor sanitization to guarantee white/colored text never defaults to black
  let cleanTextColor = (textColor && typeof textColor === 'string' && textColor.trim().length > 0)
    ? textColor.trim()
    : '#ffffff';
  if (cleanTextColor.toLowerCase() === 'white') cleanTextColor = '#ffffff';
  if (cleanTextColor.toLowerCase() === 'black') cleanTextColor = '#000000';
  if (/^#[0-9a-fA-F]{3}$/.test(cleanTextColor)) {
    cleanTextColor = '#' + cleanTextColor[1] + cleanTextColor[1] + cleanTextColor[2] + cleanTextColor[2] + cleanTextColor[3] + cleanTextColor[3];
  }
  if (/^#[0-9a-fA-F]{8}$/.test(cleanTextColor)) {
    cleanTextColor = cleanTextColor.substring(0, 7);
  }

  // Robust bgColor sanitization
  let cleanBgColor = (bgColor && typeof bgColor === 'string' && bgColor.trim().length > 0)
    ? bgColor.trim()
    : '#000000dd';

  // Small text threshold: short tags (e.g. < 15 chars like "LIVE", "BREAKING") crawl with an empty section.
  // Reasonable length text (>= 15 chars) renders in an infinite seamless loop with zero empty section at any time.
  const isSmallText = cleanText.length < 15;

  const canvasWidth = 1280;
  const wp = Math.max(30, Math.min(100, Number(widthPercent) || 100));
  const barWidth = Math.round((canvasWidth * wp) / 100);
  const tickerHeight = Math.round(fontSize + paddingY * 2);
  const yPos = Math.round(tickerHeight / 2 + fontSize * 0.35);

  const fontDef = resolveTickerFont(fontFamily);

  // XML-escape special characters for SVG
  const escapedText = cleanText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

  // Measure text pixel width using Sharp
  const textMeasureSvg = `<svg width="8000" height="${tickerHeight}" xmlns="http://www.w3.org/2000/svg">
    <text x="0" y="${yPos}" font-family='${fontDef}' font-size="${fontSize}px" font-weight="bold">${escapedText}</text>
  </svg>`;
  const textTrimmed = await sharp(Buffer.from(textMeasureSvg))
    .trim({ background: 'rgba(0,0,0,0)' })
    .png()
    .toBuffer({ resolveWithObject: true });
  const textWidth = Math.max(10, textTrimmed.info.width);

  // Ensure output directory exists
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // 1. Render STATIC Background Bar: ticker_bg.png (full canvasWidth wide, cropped dynamically by crop@tick_crop)
  const bgPath = path.join(dir, 'ticker_bg.png');
  const bgRadius = wp < 100 ? 8 : 0;
  const bgWidth = Math.max(canvasWidth, barWidth);
  const bgSvg = `
    <svg width="${bgWidth}" height="${tickerHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${cleanBgColor}" rx="${bgRadius}" />
      <line x1="0" y1="0" x2="${bgWidth}" y2="0" stroke="rgba(255,255,255,0.18)" stroke-width="1" />
    </svg>
  `;
  const bgBuffer = await sharp(Buffer.from(bgSvg)).png().toBuffer();
  await safeWriteFile(bgPath, bgBuffer);

  let tickerWidth = 0;
  let unitWidth = 0;
  let textSvg = '';

  if (isSmallText) {
    // Very small text: crawl across with empty section W - mod(t * scrollSpeed, W + w)
    const paddingX = Math.max(40, Math.round(fontSize * 1.5));
    tickerWidth = Math.max(300, textWidth + paddingX * 2);
    unitWidth = tickerWidth;

    textSvg = `
      <svg width="${tickerWidth}" height="${tickerHeight}" xmlns="http://www.w3.org/2000/svg">
        <style>
          text {
            fill: ${cleanTextColor} !important;
            fill-opacity: 1 !important;
            color: ${cleanTextColor} !important;
          }
        </style>
        <text
          x="${paddingX}"
          y="${yPos}"
          fill="${cleanTextColor}"
          style="fill: ${cleanTextColor} !important; color: ${cleanTextColor} !important;"
          font-family='${fontDef}'
          font-size="${fontSize}px"
          font-weight="bold"
          text-anchor="start"
        >${escapedText}</text>
      </svg>
    `;
  } else {
    // Reasonable length text: INFINITE seamless scrolling with NO empty section at any time
    // Measure star separator width
    const starMeasureSvg = `<svg width="200" height="${tickerHeight}" xmlns="http://www.w3.org/2000/svg">
      <text x="0" y="${yPos}" font-family='${fontDef}' font-size="${fontSize}px" font-weight="bold"> </text>
    </svg>`;
    const starTrimmed = await sharp(Buffer.from(starMeasureSvg))
      .trim({ background: 'rgba(0,0,0,0)' })
      .png()
      .toBuffer({ resolveWithObject: true });
    const starWidth = Math.max(8, starTrimmed.info.width);

    const gap = Math.max(30, Math.round(fontSize * 2.2));
    unitWidth = textWidth + gap + starWidth + gap;
    if (unitWidth % 2 !== 0) unitWidth += 1;

    // Number of repetitions required so that the visible bar is ALWAYS 100% covered across all time t
    const repeatCount = Math.max(3, Math.ceil((barWidth + unitWidth * 2) / unitWidth) + 1);
    tickerWidth = repeatCount * unitWidth;

    let itemsSvg = '';
    for (let k = 0; k < repeatCount; k++) {
      const xText = k * unitWidth;
      const xStar = xText + textWidth + gap;
      itemsSvg += `
        <text
          x="${xText}"
          y="${yPos}"
          fill="${cleanTextColor}"
          style="fill: ${cleanTextColor} !important; color: ${cleanTextColor} !important;"
          font-family='${fontDef}'
          font-size="${fontSize}px"
          font-weight="bold"
          text-anchor="start"
        >${escapedText}</text>
        <text
          x="${xStar}"
          y="${yPos}"
          fill="${cleanTextColor}"
          style="fill: ${cleanTextColor} !important; color: ${cleanTextColor} !important;"
          font-family='${fontDef}'
          font-size="${fontSize}px"
          font-weight="bold"
          text-anchor="start"
        > </text>
      `;
    }

    textSvg = `
      <svg width="${tickerWidth}" height="${tickerHeight}" xmlns="http://www.w3.org/2000/svg">
        <style>
          text {
            fill: ${cleanTextColor} !important;
            fill-opacity: 1 !important;
            color: ${cleanTextColor} !important;
          }
        </style>
        ${itemsSvg}
      </svg>
    `;
  }

  // 2. Render MOVING Text: ticker.png
  const textBuffer = await sharp(Buffer.from(textSvg)).png().toBuffer();
  await safeWriteFile(outputPath, textBuffer);

  return {
    outputPath,
    bgPath,
    width: tickerWidth,
    height: tickerHeight,
    unitWidth,
    isSmallText,
    barWidth
  };
};

/**
 * Copy custom logo over running stream logo.png
 */
export const atomicUpdateLogo = (sourcePath, destinationPath) => {
  if (!fs.existsSync(sourcePath)) return false;
  const buffer = fs.readFileSync(sourcePath);
  safeWriteFileSync(destinationPath, buffer);
  return true;
};

/**
 * Automatically inspects uploaded logo file, detects non-transparent pixel bounding box,
 * and crops away all transparent padding/margins (e.g. 360x360 with centered logo -> exact logo dimensions).
 * Operates on memory buffer to avoid any file descriptor lock issues on Windows.
 *
 * @param {string} inputPath - Path to the original uploaded logo image
 * @param {string|null} outputPath - Optional output path (defaults to inputPath)
 * @returns {Promise<{success: boolean, path: string, originalWidth: number, originalHeight: number, width: number, height: number, trimmed: boolean}>}
 */
export const normalizeAndTrimLogo = async (inputPath, outputPath = null) => {
  const destPath = outputPath || inputPath;
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input logo file not found at ${inputPath}`);
  }

  const inputBuffer = fs.readFileSync(inputPath);
  let origW = 0;
  let origH = 0;

  try {
    const metaBefore = await sharp(inputBuffer).metadata();
    origW = metaBefore.width || 0;
    origH = metaBefore.height || 0;

    // Use sharp.trim to automatically detect and crop all transparent outer padding.
    // background: 'rgba(0, 0, 0, 0)' explicitly targets transparent areas.
    // threshold: 10 handles subtle anti-aliased or nearly transparent outer pixels.
    const { data, info } = await sharp(inputBuffer)
      .trim({ background: 'rgba(0, 0, 0, 0)', threshold: 10 })
      .png()
      .toBuffer({ resolveWithObject: true });

    safeWriteFileSync(destPath, data);

    const isTrimmed = info.width !== origW || info.height !== origH;
    if (isTrimmed) {
      console.log(`[Branding] Auto-trimmed logo from ${origW}x${origH} to ${info.width}x${info.height} (transparent padding removed)`);
    }

    return {
      success: true,
      path: destPath,
      originalWidth: origW,
      originalHeight: origH,
      width: info.width,
      height: info.height,
      trimmed: isTrimmed
    };
  } catch (err) {
    console.warn('[Branding] Could not trim logo (keeping original image):', err.message);
    try {
      const fallbackData = await sharp(inputBuffer).png().toBuffer();
      safeWriteFileSync(destPath, fallbackData);
    } catch {
      if (destPath !== inputPath) {
        fs.copyFileSync(inputPath, destPath);
      }
    }

    return {
      success: false,
      path: destPath,
      originalWidth: origW,
      originalHeight: origH,
      width: origW,
      height: origH,
      trimmed: false
    };
  }
};

/**
 * Scales a master trimmed logo to the target height according to channel resolution and sizePercent,
 * maintaining exact aspect ratio with even dimensions (divisible by 2).
 *
 * Baseline heights (sizePercent = 10%):
 * - 1280x720: 70px height
 * - 1920x1080: 100px height
 * - Other resolutions: Math.round(canvasHeight * (70 / 720))
 *
 * As sizePercent increases (e.g. 15%, 20%, 30%), the logo size increases proportionally.
 *
 * @param {string} sourcePath - Path to master trimmed logo image
 * @param {string} destinationPath - Path where scaled logo.png will be written
 * @param {object} options
 * @param {string} [options.resolution='1280x720']
 * @param {number} [options.canvasHeight=720]
 * @param {number} [options.sizePercent=10]
 * @returns {Promise<{width: number, height: number, destinationPath: string}>}
 */
export const scaleAndSaveLogo = async (
  sourcePath,
  destinationPath,
  { resolution = '1280x720', canvasHeight = 720, sizePercent = 10 } = {}
) => {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Master logo file not found at ${sourcePath}`);
  }

  const resStr = String(resolution || '').toLowerCase();
  const is1080p = resStr.includes('1080') || Number(canvasHeight) >= 1080;
  const baseHeight = is1080p ? 100 : 70;

  const pct = Math.max(5, Math.min(60, Number(sizePercent) || 10));
  let targetHeight = Math.round(baseHeight * (pct / 10));
  targetHeight = Math.max(20, targetHeight - (targetHeight % 2));

  const inputBuffer = fs.readFileSync(sourcePath);
  const intermediate = await sharp(inputBuffer)
    .resize({ height: targetHeight, withoutEnlargement: false })
    .png()
    .toBuffer({ resolveWithObject: true });

  let targetWidth = intermediate.info.width;
  if (targetWidth % 2 !== 0) {
    targetWidth -= 1;
  }
  targetWidth = Math.max(20, targetWidth);

  const finalBuffer = await sharp(intermediate.data)
    .resize(targetWidth, targetHeight, { fit: 'fill' })
    .png()
    .toBuffer();

  safeWriteFileSync(destinationPath, finalBuffer);

  return {
    width: targetWidth,
    height: targetHeight,
    destinationPath
  };
};

/**
 * Generate default broadcast L-Band SVG template with transparent video cutout
 */
export const generateDefaultLBandSvg = ({
  windowX = 300,
  windowY = 20,
  windowWidth = 960,
  windowHeight = 540
} = {}) => {
  return `
    <svg width="1280" height="720" viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="lbandSideGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#090d16" />
          <stop offset="50%" stop-color="#111827" />
          <stop offset="100%" stop-color="#0f172a" />
        </linearGradient>
        <linearGradient id="lbandBottomGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#0f172a" />
          <stop offset="50%" stop-color="#1e293b" />
          <stop offset="100%" stop-color="#0f172a" />
        </linearGradient>
        <linearGradient id="accentBlue" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#3b82f6" />
          <stop offset="100%" stop-color="#06b6d4" />
        </linearGradient>
      </defs>

      <!-- Left Pillar -->
      <rect x="0" y="0" width="${windowX}" height="720" fill="url(#lbandSideGrad)" />
      <rect x="${Math.max(0, windowX - 3)}" y="0" width="3" height="720" fill="url(#accentBlue)" />

      <!-- Top Bar above cutout -->
      <rect x="${windowX}" y="0" width="${1280 - windowX}" height="${windowY}" fill="#090d16" />

      <!-- Right Margin beyond cutout -->
      <rect x="${windowX + windowWidth}" y="${windowY}" width="${Math.max(0, 1280 - (windowX + windowWidth))}" height="${windowHeight}" fill="#090d16" />

      <!-- Bottom Banner -->
      <rect x="${windowX}" y="${windowY + windowHeight}" width="${1280 - windowX}" height="${Math.max(0, 720 - (windowY + windowHeight))}" fill="url(#lbandBottomGrad)" />
      <rect x="${windowX}" y="${windowY + windowHeight}" width="${1280 - windowX}" height="3" fill="url(#accentBlue)" />

      <!-- Transparent Cutout Border Stroke -->
      <rect x="${windowX}" y="${windowY}" width="${windowWidth}" height="${windowHeight}" fill="none" stroke="rgba(59,130,246,0.7)" stroke-width="2" rx="4" />

      <!-- Left Sidebar Content -->
      <g transform="translate(20, 40)">
        <rect x="0" y="0" width="260" height="38" rx="8" fill="#1e293b" stroke="#334155" stroke-width="1" />
        <circle cx="20" cy="19" r="6" fill="#ef4444" />
        <text x="36" y="24" fill="#f8fafc" font-family="-apple-system, sans-serif" font-size="13" font-weight="800" letter-spacing="1.5">LIVE SPONSOR</text>

        <rect x="0" y="60" width="260" height="200" rx="12" fill="#0f172a" stroke="#1e293b" stroke-width="1.5" />
        <text x="130" y="145" text-anchor="middle" fill="#60a5fa" font-family="-apple-system, sans-serif" font-size="18" font-weight="900" letter-spacing="1">SPECIAL PROMO</text>
        <text x="130" y="175" text-anchor="middle" fill="#94a3b8" font-family="-apple-system, sans-serif" font-size="12" font-weight="600">OFFICIAL MEDIA PARTNER</text>

        <rect x="0" y="280" width="260" height="150" rx="12" fill="#141c2e" stroke="#2563eb" stroke-width="1" stroke-dasharray="4" />
        <text x="130" y="345" text-anchor="middle" fill="#38bdf8" font-family="-apple-system, sans-serif" font-size="15" font-weight="800">SCAN &amp; WATCH</text>
        <text x="130" y="375" text-anchor="middle" fill="#cbd5e1" font-family="-apple-system, sans-serif" font-size="11" font-weight="500">24x7 HD CLOUD PLAYOUT</text>
      </g>

      <!-- Bottom Banner Content -->
      <g transform="translate(${windowX + 30}, ${windowY + windowHeight + 25})">
        <rect x="0" y="0" width="140" height="30" rx="6" fill="#3b82f6" />
        <text x="70" y="20" text-anchor="middle" fill="#ffffff" font-family="-apple-system, sans-serif" font-size="12" font-weight="900" letter-spacing="1">SPECIAL AD</text>
        <text x="160" y="22" fill="#f8fafc" font-family="-apple-system, sans-serif" font-size="16" font-weight="800">CONNECT WITH OUR BROADCAST PLATFORM</text>
        <text x="160" y="52" fill="#94a3b8" font-family="-apple-system, sans-serif" font-size="12" font-weight="600">WWW.CLOUDPLAYOUT.TV | LIVE ON AIR ADVERTISING</text>
      </g>
    </svg>
  `;
};

/**
 * Generate default broadcast Ashton Band SVG
 */
export const generateDefaultAshtonSvg = ({ height = 160 } = {}) => {
  return `
    <svg width="1280" height="${height}" viewBox="0 0 1280 ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ashtonBg" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#0b0f19" />
          <stop offset="15%" stop-color="#111827" />
          <stop offset="85%" stop-color="#1e293b" />
          <stop offset="100%" stop-color="#0b0f19" />
        </linearGradient>
        <linearGradient id="ashtonGold" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#eab308" />
          <stop offset="100%" stop-color="#f59e0b" />
        </linearGradient>
        <linearGradient id="ashtonRed" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#ef4444" />
          <stop offset="100%" stop-color="#b91c1c" />
        </linearGradient>
      </defs>

      <!-- Main Lower Third Bar -->
      <rect x="0" y="0" width="1280" height="${height}" fill="url(#ashtonBg)" />
      <!-- Top Accent Line -->
      <rect x="0" y="0" width="1280" height="4" fill="url(#ashtonGold)" />

      <!-- Live / Special Badge -->
      <g transform="translate(35, 24)">
        <rect x="0" y="0" width="120" height="32" rx="6" fill="url(#ashtonRed)" />
        <circle cx="16" cy="16" r="5" fill="#ffffff" />
        <text x="30" y="21" fill="#ffffff" font-family="-apple-system, sans-serif" font-size="13" font-weight="900" letter-spacing="1.5">SPECIAL</text>
      </g>

      <!-- Headline & Subtitle -->
      <text x="175" y="47" fill="#ffffff" font-family="-apple-system, sans-serif" font-size="22" font-weight="900" letter-spacing="0.5">
        LIVE TRANSMISSION &amp; BROADCAST STREAM
      </text>
      <text x="175" y="82" fill="#cbd5e1" font-family="-apple-system, sans-serif" font-size="14" font-weight="600">
        CONTINUOUS PLAYOUT WITH ASHTON BAND GRAPHICS • FULL HD BROADCAST
      </text>

      <!-- Subtle bottom border line -->
      <line x1="35" y1="${height - 18}" x2="1245" y2="${height - 18}" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
    </svg>
  `;
};

export const generateDefaultLBandImageSync = (outputPath, options = {}) => {
  try {
    const svg = generateDefaultLBandSvg(options);
    sharp(Buffer.from(svg))
      .png()
      .toBuffer()
      .then((buf) => safeWriteFileSync(outputPath, buf))
      .catch((err) => console.warn('[Branding] Default LBand sync generate warning:', err.message));
  } catch (e) {
    console.warn('[Branding] Error building default LBand SVG:', e.message);
  }
};

export const generateDefaultAshtonImageSync = (outputPath, options = {}) => {
  try {
    const svg = generateDefaultAshtonSvg(options);
    sharp(Buffer.from(svg))
      .png()
      .toBuffer()
      .then((buf) => safeWriteFileSync(outputPath, buf))
      .catch((err) => console.warn('[Branding] Default Ashton sync generate warning:', err.message));
  } catch (e) {
    console.warn('[Branding] Error building default Ashton SVG:', e.message);
  }
};

export const atomicUpdateLBand = (sourcePath, destinationPath) => {
  if (!fs.existsSync(sourcePath)) return false;
  const buffer = fs.readFileSync(sourcePath);
  safeWriteFileSync(destinationPath, buffer);
  return true;
};

export const atomicUpdateAshton = (sourcePath, destinationPath) => {
  if (!fs.existsSync(sourcePath)) return false;
  const buffer = fs.readFileSync(sourcePath);
  safeWriteFileSync(destinationPath, buffer);
  return true;
};

/**
 * Automatically analyze uploaded L-Band image for transparent video cutout
 * and normalize it to a clean 1280x720 broadcast frame.
 */
export const analyzeAndNormalizeLBand = async (sourcePath, destinationPath) => {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source L-Band file not found: ${sourcePath}`);
  }

  // Resize to standard broadcast 1280x720 with alpha channel
  const normalizedBuffer = await sharp(sourcePath)
    .resize(1280, 720, { fit: 'fill' })
    .ensureAlpha()
    .png()
    .toBuffer();

  // Extract raw RGBA buffer to scan transparency
  const { data } = await sharp(normalizedBuffer)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = 1280;
  const height = 720;

  // Track column and row transparency counts
  const colTransCount = new Uint16Array(width);
  const rowTransCount = new Uint16Array(height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * width * 4;
    for (let x = 0; x < width; x++) {
      const alpha = data[rowOffset + x * 4 + 3];
      if (alpha < 40) {
        colTransCount[x]++;
        rowTransCount[y]++;
      }
    }
  }

  // Find transparent bounding box where transparency exceeds 15% of column/row
  const colThreshold = Math.round(height * 0.15); // ~108 pixels
  const rowThreshold = Math.round(width * 0.15);  // ~192 pixels

  let minX = -1;
  let maxX = -1;
  for (let x = 0; x < width; x++) {
    if (colTransCount[x] > colThreshold) {
      if (minX === -1) minX = x;
      maxX = x;
    }
  }

  let minY = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    if (rowTransCount[y] > rowThreshold) {
      if (minY === -1) minY = y;
      maxY = y;
    }
  }

  let windowX = 300;
  let windowY = 20;
  let windowWidth = 960;
  let windowHeight = 540;

  // If a valid transparent region was detected:
  if (minX !== -1 && maxX > minX + 200 && minY !== -1 && maxY > minY + 150) {
    windowX = minX;
    windowY = minY;
    windowWidth = maxX - minX + 1;
    windowHeight = maxY - minY + 1;

    // Clamp inside frame
    if (windowX + windowWidth > 1280) windowWidth = 1280 - windowX;
    if (windowY + windowHeight > 720) windowHeight = 720 - windowY;

    // Ensure dimensions and offsets are even numbers for FFmpeg
    windowX = windowX - (windowX % 2);
    windowY = windowY - (windowY % 2);
    windowWidth = windowWidth - (windowWidth % 2);
    windowHeight = windowHeight - (windowHeight % 2);
  }

  // Write normalized 1280x720 PNG
  safeWriteFileSync(destinationPath, normalizedBuffer);
  safeWriteFileSync(sourcePath, normalizedBuffer);

  return {
    windowX,
    windowY,
    windowWidth,
    windowHeight
  };
};

/**
 * Automatically analyze uploaded Ashton Band image for height and format,
 * and compose a 1280x720 broadcast frame with transparent top and banner at bottom.
 */
export const analyzeAndNormalizeAshton = async (sourcePath, destinationPath) => {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source Ashton file not found: ${sourcePath}`);
  }

  const meta = await sharp(sourcePath).metadata();
  const origW = meta.width || 1280;
  const origH = meta.height || 160;
  const aspectRatio = origW / origH;

  let detectedHeight = 160;
  let bannerBuffer = null;

  // Case 1: Cropped Banner (wide banner format, e.g. aspect ratio > 2.5 or height < 350)
  if (aspectRatio >= 2.5 || origH < 350) {
    detectedHeight = Math.min(300, Math.max(80, Math.round((1280 * origH) / origW)));
    detectedHeight = detectedHeight - (detectedHeight % 2);

    bannerBuffer = await sharp(sourcePath)
      .resize(1280, detectedHeight, { fit: 'fill' })
      .ensureAlpha()
      .png()
      .toBuffer();
  } else {
    // Case 2: Full 16:9 canvas with transparent upper area and banner at bottom
    const full720 = await sharp(sourcePath)
      .resize(1280, 720, { fit: 'fill' })
      .ensureAlpha()
      .png()
      .toBuffer();

    const { data } = await sharp(full720)
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Scan from bottom row (719) upwards to find where the opaque banner starts
    let topOpaqueRow = 719;
    for (let y = 719; y >= 0; y--) {
      let opaqueCount = 0;
      const rowOffset = y * 1280 * 4;
      for (let x = 0; x < 1280; x++) {
        if (data[rowOffset + x * 4 + 3] > 60) {
          opaqueCount++;
        }
      }
      if (opaqueCount > 250) {
        topOpaqueRow = y;
      } else if (y < 600 && opaqueCount < 100) {
        break;
      }
    }

    detectedHeight = Math.min(320, Math.max(80, 720 - topOpaqueRow));
    detectedHeight = detectedHeight - (detectedHeight % 2);

    bannerBuffer = await sharp(full720)
      .extract({ left: 0, top: 720 - detectedHeight, width: 1280, height: detectedHeight })
      .png()
      .toBuffer();
  }

  // Save normalized 1280xDetectedHeight lower-third banner PNG
  safeWriteFileSync(destinationPath, bannerBuffer);
  safeWriteFileSync(sourcePath, bannerBuffer);

  return {
    height: detectedHeight
  };
};

/**
 * Returns an existing TrueType font file on the host machine (cross-platform Windows & Linux)
 */
export const getSystemFontFile = (customFont = null) => {
  if (customFont && fs.existsSync(customFont)) return customFont;
  const candidates = process.platform === 'win32'
    ? [
      'C:\\Windows\\Fonts\\arialbd.ttf',
      'C:\\Windows\\Fonts\\arial.ttf',
      'C:\\Windows\\Fonts\\segoeuib.ttf',
      'C:\\Windows\\Fonts\\segoeui.ttf',
      'C:\\Windows\\Fonts\\tahoma.ttf'
    ]
    : [
      '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
      '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
      '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
      '/usr/share/fonts/truetype/freefont/FreeSansBold.ttf',
      '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf'
    ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
};

/**
 * Builds a high-precision, frame-accurate FFmpeg drawtext filter string for the Back In timer
 * Dynamically computes real-time countdown down to 00:00 (or 0s)
 */
export const buildBackInTimerFilter = (timerConfig = {}, countdownSeconds = 30) => {
  const rawLabel = timerConfig.label !== undefined ? String(timerConfig.label) : 'BACK IN ';
  // Sanitize label for FFmpeg drawtext: escape colons and backslashes, remove single quotes
  const label = rawLabel.replace(/'/g, '').replace(/\\/g, '\\\\').replace(/:/g, '\\:');
  const format = timerConfig.format || 'MM:SS';
  const fontSize = Number(timerConfig.fontSize) || 24;
  const fontColor = timerConfig.fontColor || '#ffffff';
  let bgColor = timerConfig.bgColor || 'black@0.75';

  if (bgColor.startsWith('#') && bgColor.length === 7) {
    bgColor = `${bgColor}@0.8`;
  }

  const position = timerConfig.position || 'top-left';
  let xExpr = '40';
  let yExpr = '40';

  if (position === 'top-left') {
    xExpr = '40';
    yExpr = '40';
  } else if (position === 'top-right') {
    xExpr = 'w-tw-40';
    yExpr = '40';
  } else if (position === 'bottom-left') {
    xExpr = '40';
    yExpr = 'h-th-40';
  } else if (position === 'bottom-right') {
    xExpr = 'w-tw-40';
    yExpr = 'h-th-40';
  } else if (position === 'custom') {
    const clampedX = Math.min(95, Math.max(5, Number(timerConfig.positionX) || 50));
    const clampedY = Math.min(95, Math.max(5, Number(timerConfig.positionY) || 50));
    xExpr = `(w-tw)*(${clampedX}/100)`;
    yExpr = `(h-th)*(${clampedY}/100)`;
  }

  const fontFile = getSystemFontFile();
  const fontParam = fontFile
    ? `fontfile='${fontFile.replace(/\\/g, '/').replace(/:/g, '\\:')}':`
    : '';

  const totalSec = Math.max(1, Math.ceil(countdownSeconds));

  let timeExpression = '';
  if (format === 'SS') {
    timeExpression = `%{eif\\:max(0\\,${totalSec}-t)\\:d}s`;
  } else {
    // MM:SS format: e.g. 00:30
    timeExpression = `%{eif\\:(max(0\\,${totalSec}-t)/60)\\:d\\:2}\\:%{eif\\:mod(max(0\\,${totalSec}-t)\\,60)\\:d\\:2}`;
  }

  return `drawtext=${fontParam}text='${label}${timeExpression}':fontsize=${fontSize}:fontcolor=${fontColor}:box=1:boxcolor=${bgColor}:boxborderw=10:x='${xExpr}':y='${yExpr}'`;
};

