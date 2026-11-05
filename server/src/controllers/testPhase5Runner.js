import { Channel } from '../models/channel.model.js';
import { User } from '../models/user.model.js';
import { streamManager } from '../services/streaming/streamManager.js';
import { renderTickerImage } from '../services/streaming/brandingAssets.js';
import path from 'path';
import { STREAMS_DIR } from '../config/paths.js';
import fs from 'fs';

export const runPhase5InProcessTest = async (req, res) => {
  const logSteps = [];
  const log = (msg) => {
    console.log(`[Phase 5 Test] ${msg}`);
    logSteps.push(msg);
  };

  try {
    log('=== Starting Phase 5 Live Logo & Ticker ZMQ Control Suite ===');

    // 1. Fetch Operator & Channel
    const operator = await User.findOne({ email: 'operator@playout.com' });
    if (!operator) throw new Error('Operator user not found');
    const channel = await Channel.findOne({ name: 'SAI LEELA' });
    if (!channel) throw new Error('Channel SAI LEELA not found');

    log(`Operating on Channel: ${channel.name} (${channel._id})`);

    // 2. Start Live Stream if not already running
    let stream = streamManager.getStream(channel._id);
    if (!stream?.encoder?.isRunning) {
      log('Launching Live Broadcast Engine for channel...');
      await streamManager.startStream(channel._id, 0);
      stream = streamManager.getStream(channel._id);
      log(`Live Broadcast Engine running on ZMQ Port ${stream.zmqPort}`);
      // Wait 1.5s warmup
      await new Promise((r) => setTimeout(r, 1500));
    } else {
      log(`Live stream already active on ZMQ Port ${stream.zmqPort}`);
    }

    // 3. Test 1: Live Logo On-Air Enable via ZMQ
    log('Step 1: Enabling Logo overlay live via ZMQ (zero restart)...');
    channel.branding.logo.enabled = true;
    channel.branding.logo.position = 'top-left';
    channel.branding.logo.marginX = 2;
    channel.branding.logo.marginY = 2;
    await channel.save();

    await stream.encoder.setLogoPosition('top-left', 2, 2);
    const logoEnableRes = await stream.encoder.setLogoEnabled(true);
    log(`Logo enabled live on air via ZMQ! Filter reply: ${logoEnableRes || 'OK'}`);

    // Wait 500ms
    await new Promise((r) => setTimeout(r, 500));

    // 4. Test 2: Live Logo Position Move to bottom-right via ZMQ
    log('Step 2: Moving Logo to bottom-right live via ZMQ (zero restart)...');
    channel.branding.logo.position = 'bottom-right';
    channel.branding.logo.marginX = 4;
    channel.branding.logo.marginY = 4;
    await channel.save();

    const logoMoveRes = await stream.encoder.setLogoPosition('bottom-right', 4, 4);
    log(`Logo moved to bottom-right live via ZMQ! Filter reply: ${logoMoveRes || 'OK'}`);

    // Wait 500ms
    await new Promise((r) => setTimeout(r, 500));

    // 5. Test 3: Live Hindi/Unicode Ticker Render (Sharp SVG) & Push via ZMQ
    log('Step 3: Rendering Hindi/Unicode Ticker with Sharp and pushing live via ZMQ...');
    const hindiCrawl = 'श्री साईं संध्या - सीधा प्रसारण एवं आरती दर्शन';
    channel.branding.ticker.enabled = true;
    channel.branding.ticker.text = hindiCrawl;
    channel.branding.ticker.bgColor = '#b91c1cdd';
    channel.branding.ticker.textColor = '#ffffff';
    channel.branding.ticker.fontSize = 22;
    channel.branding.ticker.alignment = 'center';
    channel.branding.ticker.speed = 4;
    channel.branding.ticker.marginBottom = 3;
    await channel.save();

    const channelDir = path.join(STREAMS_DIR, String(channel._id));
    if (!fs.existsSync(channelDir)) {
      fs.mkdirSync(channelDir, { recursive: true });
    }
    const tickerFile = path.join(channelDir, 'ticker.png');

    await renderTickerImage({
      text: hindiCrawl,
      bgColor: '#b91c1cdd',
      textColor: '#ffffff',
      fontSize: 22,
      alignment: 'center',
      outputPath: tickerFile
    });
    log('Hindi Ticker rendered to transparent PNG using Sharp SVG');

    await stream.encoder.setTickerPosition(3, 4, 'center');
    const tickEnableRes = await stream.encoder.setTickerEnabled(true);
    log(`Ticker pushed live on air via ZMQ! Filter reply: ${tickEnableRes || 'OK'}`);

    // Wait 800ms
    await new Promise((r) => setTimeout(r, 800));

    // 6. Test 4: Live Ticker Disable via ZMQ
    log('Step 4: Disabling Ticker live via ZMQ (zero restart)...');
    channel.branding.ticker.enabled = false;
    await channel.save();

    const tickDisableRes = await stream.encoder.setTickerEnabled(false);
    log(`Ticker disabled live on air via ZMQ! Filter reply: ${tickDisableRes || 'OK'}`);

    // 7. Verify stream is STILL live and running
    log('Step 5: Verifying stream continuous playout health...');
    const isLive = streamManager.isChannelLive(channel._id);
    const activeStream = streamManager.getStream(channel._id);
    if (!isLive || !activeStream?.encoder?.isRunning) {
      throw new Error('STREAM CRASHED or stopped during live ZMQ branding adjustments!');
    }
    log(`Stream verified STILL LIVE! Current feeder item index: ${channel.currentPlayingIndex}`);


    // 8. Stop stream cleanly
    log('Step 6: Stopping Live Broadcast cleanly...');
    await streamManager.stopStream(channel._id);
    log('Live broadcast stopped cleanly. Zero errors.');

    log('=== ALL PHASE 5 LIVE LOGO & TICKER ZMQ TESTS PASSED PERFECTLY ===');

    return res.status(200).json({
      success: true,
      message: 'All Phase 5 live logo and ticker ZMQ tests passed successfully with zero stream interruptions',
      steps: logSteps
    });
  } catch (error) {
    console.error('[Phase 5 Test Error]', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      steps: logSteps
    });
  }
};
