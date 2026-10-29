import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const baseURL = 'http://localhost:5000/api';

const generateTestVideo = (outputPath) => {
  return new Promise((resolve, reject) => {
    // Generate a 4-second test video with video and audio tone
    const args = [
      '-y',
      '-f', 'lavfi', '-i', 'testsrc=duration=4:size=1280x720:rate=25',
      '-f', 'lavfi', '-i', 'sine=frequency=1000:duration=4',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '128k',
      outputPath
    ];
    const proc = spawn('ffmpeg', args);
    proc.on('close', (code) => {
      if (code === 0 && fs.existsSync(outputPath)) {
        resolve(outputPath);
      } else {
        reject(new Error(`Failed to generate test video, exit code: ${code}`));
      }
    });
  });
};

async function runPhase2Tests() {
  console.log('=== Starting Phase 2 Asset Upload & Processing Tests ===');

  // 1. Login as Operator
  const loginRes = await fetch(`${baseURL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'operator@playout.com', password: 'Password@123' })
  });
  const loginData = await loginRes.json();
  const token = loginData.accessToken;
  console.log('✔ Logged in as Operator User');

  // 2. Fetch Operator's Channel (SAI LEELA)
  const channelsRes = await fetch(`${baseURL}/channels`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const channelsData = await channelsRes.json();
  const channel = channelsData.channels[0];
  if (!channel) throw new Error('No channel found for operator');
  console.log(`✔ Found Channel: ${channel.name} (${channel._id})`);

  // 3. Generate a temporary real test video file
  const testVideoPath = path.resolve(__dirname, 'temp_test_video.mp4');
  await generateTestVideo(testVideoPath);
  const fileStats = fs.statSync(testVideoPath);
  console.log(`✔ Generated test MP4 file: ${testVideoPath} (${(fileStats.size / 1024).toFixed(1)} KB)`);

  // 4. Test Chunked Upload (2 chunks)
  const uploadId = `test_upload_${Date.now()}`;
  const totalChunks = 2;
  const half = Math.floor(fileStats.size / 2);
  const buffer = fs.readFileSync(testVideoPath);

  const chunk1 = buffer.subarray(0, half);
  const chunk2 = buffer.subarray(half);

  // Send chunk 0
  const form1 = new FormData();
  form1.append('uploadId', uploadId);
  form1.append('chunkIndex', '0');
  form1.append('totalChunks', '2');
  form1.append('fileName', 'test_video_sample.mp4');
  form1.append('fileSize', String(fileStats.size));
  form1.append('channelId', channel._id);
  form1.append('category', 'Promos');
  form1.append('chunk', new Blob([chunk1]), 'temp_test_video.mp4');

  const chunk1Res = await fetch(`${baseURL}/assets/upload/chunk`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form1
  });
  const chunk1Data = await chunk1Res.json();
  if (!chunk1Res.ok) throw new Error(`Chunk 0 failed: ${JSON.stringify(chunk1Data)}`);
  console.log('✔ Chunk 1/2 uploaded successfully');

  // Send chunk 1 (final)
  const form2 = new FormData();
  form2.append('uploadId', uploadId);
  form2.append('chunkIndex', '1');
  form2.append('totalChunks', '2');
  form2.append('fileName', 'test_video_sample.mp4');
  form2.append('fileSize', String(fileStats.size));
  form2.append('channelId', channel._id);
  form2.append('category', 'Promos');
  form2.append('chunk', new Blob([chunk2]), 'temp_test_video.mp4');

  const chunk2Res = await fetch(`${baseURL}/assets/upload/chunk`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form2
  });
  const chunk2Data = await chunk2Res.json();
  if (!chunk2Res.ok) throw new Error(`Chunk 1 failed: ${JSON.stringify(chunk2Data)}`);
  console.log('✔ Chunk 2/2 uploaded successfully. Asset created with status:', chunk2Data.asset.status);

  const createdAssetId = chunk2Data.asset._id;

  // 5. Poll for background processing completion (ready status)
  console.log('... Awaiting background ffprobe metadata & thumbnail extraction ...');
  let readyAsset = null;
  for (let attempt = 0; attempt < 20; attempt++) {
    await new Promise((r) => setTimeout(r, 1000));
    const assetCheckRes = await fetch(`${baseURL}/assets/${createdAssetId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const assetCheckData = await assetCheckRes.json();
    if (assetCheckData.asset.status === 'ready') {
      readyAsset = assetCheckData.asset;
      break;
    }
  }

  if (!readyAsset) throw new Error('Asset background processing timed out or failed');

  console.log(`✔ Asset status transitioned to READY!`);
  console.log(`  - Duration: ${readyAsset.duration}s (${readyAsset.durationFormatted})`);
  console.log(`  - Resolution: ${readyAsset.resolution}`);
  console.log(`  - Codec: ${readyAsset.codec}`);
  console.log(`  - Thumbnail path: ${readyAsset.thumbnailPath}`);

  // Verify thumbnail file exists on disk
  const thumbDiskPath = path.resolve(__dirname, readyAsset.thumbnailPath);
  if (!fs.existsSync(thumbDiskPath)) {
    throw new Error(`Thumbnail file missing on disk: ${thumbDiskPath}`);
  }
  console.log(`✔ Thumbnail verified on disk: ${thumbDiskPath}`);

  // 6. Test Asset List & Storage Quota
  const assetsListRes = await fetch(`${baseURL}/assets?channelId=${channel._id}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const assetsListData = await assetsListRes.json();
  console.log(`✔ Assets listing returned ${assetsListData.assets.length} item(s).`);
  console.log(`✔ Storage stats: ${assetsListData.storage.totalUsedMB} MB used / ${assetsListData.storage.quotaGB} GB quota`);

  // Clean up local temp test video
  if (fs.existsSync(testVideoPath)) {
    fs.unlinkSync(testVideoPath);
  }

  console.log('=== ALL PHASE 2 TESTS PASSED PERFECTLY! ===');
}

runPhase2Tests().catch((err) => {
  console.error('Phase 2 test failed:', err);
  process.exit(1);
});
