import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { killProcessTree } from './processHelper.js';

/**
 * Format seconds into HH:MM:SS or MM:SS
 */
export const formatDuration = (seconds) => {
  if (!seconds || isNaN(seconds) || seconds < 0) return '00:00';
  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

/**
 * Inspect video file metadata using ffprobe
 */
export const probeVideo = (filePath) => {
  return new Promise((resolve, reject) => {
    const args = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      filePath
    ];

    const proc = spawn('ffprobe', args);
    let stdout = '';
    let stderr = '';
    let isSettled = false;

    const timer = setTimeout(() => {
      if (isSettled) return;
      isSettled = true;
      killProcessTree(proc).catch(() => { });
      reject(new Error(`ffprobe timed out after 10000ms for file: ${filePath}`));
    }, 10000);

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (isSettled) return;
      isSettled = true;
      clearTimeout(timer);

      if (code !== 0) {
        return reject(new Error(`ffprobe failed with code ${code}: ${stderr}`));
      }

      try {
        const metadata = JSON.parse(stdout);
        const videoStream = metadata.streams?.find((s) => s.codec_type === 'video') || {};
        const rawAudioStream = metadata.streams?.find((s) => s.codec_type === 'audio');
        const audioStream = rawAudioStream || {};

        const duration = parseFloat(metadata.format?.duration || videoStream.duration || 0);
        const width = videoStream.width || 1280;
        const height = videoStream.height || 720;
        const codec = videoStream.codec_name || 'h264';
        const size = parseInt(metadata.format?.size || 0, 10);

        let fps = 25;
        if (videoStream.r_frame_rate) {
          const [num, den] = videoStream.r_frame_rate.split('/');
          if (den && den !== '0') {
            fps = Math.round(Number(num) / Number(den));
          }
        }

        resolve({
          duration,
          durationFormatted: formatDuration(duration),
          width,
          height,
          resolution: `${width}x${height}`,
          fps,
          codec,
          hasAudio: Boolean(rawAudioStream),
          audioCodec: audioStream.codec_name || 'aac',
          size
        });
      } catch (err) {
        reject(new Error(`Failed to parse ffprobe output: ${err.message}`));
      }
    });

    proc.on('error', (err) => {
      if (isSettled) return;
      isSettled = true;
      clearTimeout(timer);
      reject(new Error(`ffprobe process execution error: ${err.message}`));
    });
  });
};

/**
 * Generate a thumbnail preview using ffmpeg
 */
export const generateThumbnail = (videoPath, outputPath, duration = 10) => {
  return new Promise((resolve, reject) => {
    // Seek to 10% of duration or at least 1 second
    const seekTime = Math.max(1, Math.min(duration * 0.1, 5));

    const args = [
      '-y',
      '-ss', String(seekTime),
      '-i', videoPath,
      '-vframes', '1',
      '-q:v', '2',
      '-vf', 'scale=320:-1',
      outputPath
    ];

    const proc = spawn('ffmpeg', args);
    let stderr = '';

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0 && fs.existsSync(outputPath)) {
        resolve(outputPath);
      } else {
        // Fallback: seek to 0s if seekTime was past EOF
        const fallbackArgs = [
          '-y',
          '-ss', '0',
          '-i', videoPath,
          '-vframes', '1',
          '-q:v', '2',
          '-vf', 'scale=320:-1',
          outputPath
        ];
        const fallbackProc = spawn('ffmpeg', fallbackArgs);
        fallbackProc.on('error', (fErr) => {
          reject(new Error(`ffmpeg thumbnail fallback error: ${fErr.message}`));
        });
        fallbackProc.on('close', (fCode) => {
          if (fCode === 0 && fs.existsSync(outputPath)) {
            resolve(outputPath);
          } else {
            reject(new Error(`ffmpeg thumbnail generation failed: ${stderr}`));
          }
        });
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`ffmpeg thumbnail error: ${err.message}`));
    });
  });
};

/**
 * Normalization transcode to 1280x720 25fps libx264 AAC
 */
export const normalizeVideo = async (inputPath, outputPath, onProgress) => {
  const probe = await probeVideo(inputPath).catch(() => ({ hasAudio: true }));
  const hasAudio = probe.hasAudio !== false;

  return new Promise((resolve, reject) => {
    const args = [
      '-y',
      '-i', inputPath,
      ...(!hasAudio ? ['-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100'] : []),
      '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,fps=25',
      ...(!hasAudio ? ['-map', '0:v:0', '-map', '1:a:0', '-shortest'] : []),
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '23',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-ar', '44100',
      '-ac', '2',
      outputPath
    ];

    const proc = spawn('ffmpeg', args);
    let stderr = '';

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
      if (onProgress) {
        // Simple progress notification
        onProgress(data.toString());
      }
    });

    proc.on('close', (code) => {
      if (code === 0 && fs.existsSync(outputPath)) {
        resolve(outputPath);
      } else {
        reject(new Error(`ffmpeg normalization failed: ${stderr}`));
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
};

const runFfmpegWithTimeout = (args, outputPath, timeoutMs = 20000) => {
  return new Promise((resolve) => {
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'ignore'] });
    let finished = false;
    const timer = setTimeout(() => {
      if (!finished) {
        finished = true;
        try { proc.kill('SIGKILL'); } catch { }
        try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch { }
        resolve(false);
      }
    }, timeoutMs);

    proc.on('close', (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      const ok = code === 0 && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0;
      if (!ok) {
        try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch { }
      }
      resolve(ok);
    });

    proc.on('error', () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve(false);
    });
  });
};

/**
 * Generate a browser-playable preview for QuickTime MOV bugs (ProRes 4444 / qtrle etc. cannot play in Chromium <video>).
 * Prefers animated transparent VP9 WebM and falls back to a transparent PNG frame.
 */
export const generateMovBugPreview = async (inputMovPath, outputBaseNoExt, duration = 0) => {
  if (!inputMovPath || !fs.existsSync(inputMovPath)) return null;

  const webmPath = `${outputBaseNoExt}_preview.webm`;
  const webmArgs = [
    '-y',
    '-t', '10',
    '-i', inputMovPath,
    '-an',
    '-vf', "scale=w='min(240,iw)':h=-2:flags=lanczos,format=yuva420p",
    '-c:v', 'libvpx-vp9',
    '-pix_fmt', 'yuva420p',
    '-auto-alt-ref', '0',
    '-b:v', '350k',
    '-deadline', 'realtime',
    '-cpu-used', '4',
    webmPath
  ];

  if (await runFfmpegWithTimeout(webmArgs, webmPath, 20000)) {
    return webmPath;
  }

  const pngPath = `${outputBaseNoExt}_preview.png`;
  const seekTime = duration > 1 ? Math.min(duration * 0.25, 1.0) : 0;
  const extractPng = (ss) => runFfmpegWithTimeout([
    '-y',
    ...(ss > 0 ? ['-ss', String(ss)] : []),
    '-i', inputMovPath,
    '-vframes', '1',
    '-vf', "scale=w='min(240,iw)':h=-1:flags=lanczos,format=rgba",
    pngPath
  ], pngPath, 10000);

  if (seekTime > 0 && await extractPng(seekTime)) {
    return pngPath;
  }
  if (await extractPng(0)) {
    return pngPath;
  }

  return null;
};
