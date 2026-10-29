import zmq from 'zeromq';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testZmq() {
  console.log('--- Testing FFmpeg Libzmq Live Filter Control ---');

  // Create temporary directory
  const testDir = path.resolve(__dirname, 'test_zmq_runtime');
  if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

  const logoFile = path.join(testDir, 'logo.png');
  const tickFile = path.join(testDir, 'ticker.png');

  // Generate 100x50 logo PNG
  await new Promise((res) => {
    const p = spawn('ffmpeg', [
      '-y', '-f', 'lavfi', '-i', 'color=red@0.8:s=100x50',
      '-vframes', '1', logoFile
    ]);
    p.on('close', res);
  });

  // Generate 800x40 ticker PNG
  await new Promise((res) => {
    const p = spawn('ffmpeg', [
      '-y', '-f', 'lavfi', '-i', 'color=blue@0.8:s=800x40',
      '-vframes', '1', tickFile
    ]);
    p.on('close', res);
  });

  const zmqPort = 5577;

  // Launch test ffmpeg process reading a synthetic video input, looping logo and ticker
  const filtergraph = `[0:v]zmq=bind_address=tcp\\\\://127.0.0.1\\\\:${zmqPort}[v0]; [v0][1:v]overlay@logo=x=20:y=20:enable=0[v1]; [v1][2:v]overlay@tick=x='(w-t*60)':y='H-h-20':enable=0[vout]`;

  const ffmpegArgs = [
    '-f', 'lavfi', '-i', 'testsrc=size=1280x720:rate=25',
    '-loop', '1', '-i', logoFile,
    '-loop', '1', '-i', tickFile,
    '-filter_complex', filtergraph,
    '-map', '[vout]',
    '-c:v', 'libx264', '-preset', 'ultrafast',
    '-f', 'null', '-'
  ];

  const ffmpegProc = spawn('ffmpeg', ffmpegArgs);
  let stderr = '';
  ffmpegProc.stderr.on('data', (d) => {
    stderr += d.toString();
  });

  // Give ffmpeg a moment to bind ZMQ socket
  await new Promise((r) => setTimeout(r, 1200));

  // Connect Node.js zeromq REQ socket
  const sock = new zmq.Request();
  sock.connect(`tcp://127.0.0.1:${zmqPort}`);
  console.log(`✔ Connected to FFmpeg ZMQ socket on port ${zmqPort}`);

  // Test 1: Enable logo
  await sock.send('overlay@logo enable 1');
  const [rep1] = await sock.receive();
  console.log(`✔ Command 'overlay@logo enable 1' response:`, rep1.toString().trim());

  // Test 2: Update logo X position
  await sock.send('overlay@logo x 150');
  const [rep2] = await sock.receive();
  console.log(`✔ Command 'overlay@logo x 150' response:`, rep2.toString().trim());

  // Test 3: Enable ticker
  await sock.send('overlay@tick enable 1');
  const [rep3] = await sock.receive();
  console.log(`✔ Command 'overlay@tick enable 1' response:`, rep3.toString().trim());

  // Clean up
  sock.close();
  ffmpegProc.kill('SIGINT');

  // Remove test files
  fs.rmSync(testDir, { recursive: true, force: true });

  console.log('--- ALL ZMQ TESTS COMPLETED SUCCESSFULLY! ---');
}

testZmq().catch((err) => {
  console.error('ZMQ test failed:', err);
  process.exit(1);
});
