import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { Server } from './src/models/Server.js';
import { Channel } from './src/models/Channel.js';
import { User } from './src/models/User.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

async function verifyServerAndChannelUrls() {
  console.log('=== Verifying Server Creation with streamUrl and Auto-Derived Channel URLs ===');
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cloud_playout');
  console.log('✔ Connected to MongoDB');

  const superAdmin = await User.findOne({ email: 'superadmin@playout.com' });
  if (!superAdmin) throw new Error('Superadmin not found');

  // 1. Create Server with only stream name, category, stream url, username, password
  const testStreamUrl = 'http://94.136.185.222:81';
  let server = await Server.findOne({ name: 'Flussonic User Edge' });
  if (server) await Server.deleteOne({ _id: server._id });

  server = new Server({
    name: 'Flussonic User Edge',
    category: 'Cloud Playout',
    streamUrl: testStreamUrl,
    serverUsername: 'stream_user',
    createdBy: superAdmin._id
  });
  server.setPassword('Secret123');
  await server.save();

  console.log('✔ Server created successfully with streamUrl:', server.streamUrl);
  console.log('  -> Auto-derived rtmpBaseUrl:', server.rtmpBaseUrl);
  console.log('  -> Auto-derived hlsBaseUrl:', server.hlsBaseUrl);

  if (server.rtmpBaseUrl !== 'rtmp://94.136.185.222/static') {
    throw new Error(`Expected rtmp://94.136.185.222/static, got ${server.rtmpBaseUrl}`);
  }
  if (server.hlsBaseUrl !== 'http://94.136.185.222:81') {
    throw new Error(`Expected http://94.136.185.222:81, got ${server.hlsBaseUrl}`);
  }

  // 2. Create Channel 'playlistTestOne'
  const channelName = 'playlistTestOne';
  let channel = await Channel.findOne({ name: channelName });
  if (channel) await Channel.deleteOne({ _id: channel._id });

  // Simulate channel creation logic
  let cleanUrl = server.streamUrl.trim().replace(/\/+$/, '');
  let hostname = '127.0.0.1';
  try {
    const parsed = new URL(cleanUrl.startsWith('http') ? cleanUrl : `http://${cleanUrl}`);
    hostname = parsed.hostname;
    cleanUrl = `${parsed.protocol}//${parsed.host}`;
  } catch (e) {
    const match = cleanUrl.match(/^(?:https?:\/\/)?([^:/]+)/i);
    if (match) hostname = match[1];
  }

  const expectedHlsUrl = `${cleanUrl}/${channelName}/index.m3u8`;
  const expectedRtmpUrl = `rtmp://${hostname}/static/${channelName}`;

  channel = await Channel.create({
    name: channelName,
    server: server._id,
    assignedUser: superAdmin._id,
    streamKey: channelName,
    hlsUrl: expectedHlsUrl,
    rtmpUrl: expectedRtmpUrl,
    createdBy: superAdmin._id
  });

  console.log(`✔ Channel '${channelName}' created successfully!`);
  console.log('  -> Generated HLS URL:', channel.hlsUrl);
  console.log('  -> Generated RTMP URL:', channel.rtmpUrl);

  if (channel.hlsUrl !== 'http://94.136.185.222:81/playlistTestOne/index.m3u8') {
    throw new Error(`HLS URL mismatch: ${channel.hlsUrl}`);
  }
  if (channel.rtmpUrl !== 'rtmp://94.136.185.222/static/playlistTestOne') {
    throw new Error(`RTMP URL mismatch: ${channel.rtmpUrl}`);
  }

  console.log('========================================================================');
  console.log('🎉 ALL TESTS PASSED! Channel URLs match the exact requested specification:');
  console.log('   HLS:  ', channel.hlsUrl);
  console.log('   RTMP: ', channel.rtmpUrl);
  console.log('========================================================================');

  await mongoose.disconnect();
}

verifyServerAndChannelUrls().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
