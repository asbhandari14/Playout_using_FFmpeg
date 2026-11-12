export const resolveMediaUrl = (imagePath) => {
  if (!imagePath) return '';
  if (imagePath.startsWith('blob:') || imagePath.startsWith('data:') || imagePath.startsWith('http')) {
    return imagePath;
  }
  return imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
};

const toEven = (num, fallback) => {
  const n = Number(num);
  if (!Number.isFinite(n)) return fallback;
  const rounded = Math.round(n);
  return rounded - (rounded % 2);
};

export const sanitizeVideoWindow = (win = {}) => {
  const windowX = Math.max(0, Math.min(1216, toEven(win.windowX ?? 300, 300)));
  const windowY = Math.max(0, Math.min(656, toEven(win.windowY ?? 20, 20)));
  const windowWidth = Math.max(64, Math.min(1280 - windowX, toEven(win.windowWidth ?? 960, 960)));
  const windowHeight = Math.max(64, Math.min(720 - windowY, toEven(win.windowHeight ?? 540, 540)));
  return { windowX, windowY, windowWidth, windowHeight };
};

const loadImageElement = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });

/**
 * Mirrors server-side Sharp transparent cutout detection on a 1280x720 canvas
 * so L-Band X, Y, Width, Height populate automatically as soon as an image is chosen.
 */
export const detectLBandCutoutFromUrl = async (src) => {
  const fallback = { windowX: 300, windowY: 20, windowWidth: 960, windowHeight: 540, detected: false };
  if (!src) return fallback;

  try {
    const img = await loadImageElement(src);
    const width = 1280;
    const height = 720;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return fallback;

    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    const { data } = ctx.getImageData(0, 0, width, height);

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

    const colThreshold = Math.round(height * 0.15);
    const rowThreshold = Math.round(width * 0.15);

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

    if (minX !== -1 && maxX > minX + 200 && minY !== -1 && maxY > minY + 150) {
      return {
        ...sanitizeVideoWindow({
          windowX: minX,
          windowY: minY,
          windowWidth: maxX - minX + 1,
          windowHeight: maxY - minY + 1
        }),
        detected: true
      };
    }

    return fallback;
  } catch {
    return fallback;
  }
};

/**
 * Mirrors server-side Ashton Band lower-third height detection so Ashton height
 * populates automatically when an image is chosen.
 */
export const detectAshtonHeightFromUrl = async (src) => {
  const fallback = { ashtonHeight: 160, detected: false };
  if (!src) return fallback;

  try {
    const img = await loadImageElement(src);
    const origW = img.naturalWidth || 1280;
    const origH = img.naturalHeight || 160;
    const aspectRatio = origW / Math.max(1, origH);

    if (aspectRatio >= 2.5 || origH < 350) {
      const h = Math.min(300, Math.max(80, toEven((1280 * origH) / origW, 160)));
      return { ashtonHeight: h, detected: true };
    }

    const width = 1280;
    const height = 720;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return fallback;

    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    const { data } = ctx.getImageData(0, 0, width, height);

    let topOpaqueRow = 719;
    for (let y = 719; y >= 0; y--) {
      let opaqueCount = 0;
      const rowOffset = y * width * 4;
      for (let x = 0; x < width; x++) {
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

    const detectedHeight = Math.min(320, Math.max(80, toEven(720 - topOpaqueRow, 160)));
    return { ashtonHeight: detectedHeight, detected: true };
  } catch {
    return fallback;
  }
};

