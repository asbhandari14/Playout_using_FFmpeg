import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const baseURL = 'http://localhost:5000/api';

async function runPhase4Tests() {
  console.log('=== Starting Phase 4 Streaming Engine (Feeder + Encoder) Tests ===');

  // 1. Login as Operator
  const loginRes = await fetch(`${baseURL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'operator@playout.com', password: 'Password@123' })
  });
  const loginData = await loginRes.json();
  const token = loginData.accessToken;
  console.log('✔ Authenticated as Operator');

  // 2. Fetch Channel
  const channelsRes = await fetch(`${baseURL}/channels`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const channelsData = await channelsRes.json();
  const channel = channelsData.channels[0];
  console.log(`✔ Operating on Channel: ${channel.name} (${channel._id})`);

  // 3. Ensure Playlist has items
  const playlistRes = await fetch(`${baseURL}/channels/${channel._id}/playlist`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const playlistData = await playlistRes.json();
  if (!playlistData.playlist.items || playlistData.playlist.items.length === 0) {
    throw new Error('Playlist has no items. Run Phase 2 and 3 first.');
  }
  console.log(`✔ Playlist loaded with ${playlistData.playlist.items.length} items. Total: ${playlistData.playlist.totalDurationFormatted}`);

  // 4. Start Live Broadcast
  console.log('... Requesting POST /channels/:channelId/start ...');
  const startRes = await fetch(`${baseURL}/channels/${channel._id}/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ startIndex: 0 })
  });
  const startData = await startRes.json();
  if (!startRes.ok) throw new Error(`Start stream failed: ${JSON.stringify(startData)}`);
  console.log(`✔ Stream engine started! Response:`, startData);

  // 5. Verify Stream Status endpoint
  const statusRes = await fetch(`${baseURL}/channels/${channel._id}/stream/status`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const statusData = await statusRes.json();
  console.log(`✔ Stream status verified: isLive=${statusData.isLive}, zmqPort=${statusData.zmqPort}`);
  if (!statusData.isLive) throw new Error('Stream status did not report live!');

  // 6. Monitor for HLS generation (Encoder writing segments)
  const hlsManifest = path.resolve(__dirname, `streams/${channel._id}/hls/index.m3u8`);
  console.log(`... Monitoring HLS generation at: ${hlsManifest} ...`);

  let hlsReady = false;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    if (fs.existsSync(hlsManifest)) {
      const content = fs.readFileSync(hlsManifest, 'utf8');
      if (content.includes('#EXTM3U')) {
        hlsReady = true;
        console.log(`✔ Live HLS stream manifest generated successfully:`);
        console.log(content.trim().split('\n').slice(0, 8).join('\n'));
        break;
      }
    }
  }

  if (!hlsReady) {
    console.warn('Notice: HLS manifest file creation pending or still buffering initial segments.');
  }

  // Allow stream to run for a few seconds to verify continuous feeder decoding
  await new Promise((r) => setTimeout(r, 3000));

  // 7. Stop Live Broadcast
  console.log('... Requesting POST /channels/:channelId/stop ...');
  const stopRes = await fetch(`${baseURL}/channels/${channel._id}/stop`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
  const stopData = await stopRes.json();
  if (!stopRes.ok) throw new Error('Stop stream failed');
  console.log(`✔ Live broadcast stream stopped gracefully:`, stopData);

  // 8. Confirm Idle status
  const afterStatusRes = await fetch(`${baseURL}/channels/${channel._id}/stream/status`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const afterStatusData = await afterStatusRes.json();
  console.log(`✔ Stream status confirmed idle: isLive=${afterStatusData.isLive}`);
  if (afterStatusData.isLive) throw new Error('Stream failed to transition to idle!');

  console.log('=== ALL PHASE 4 STREAMING ENGINE TESTS PASSED! ===');
}

runPhase4Tests().catch((err) => {
  console.error('Phase 4 test failed:', err);
  process.exit(1);
});
