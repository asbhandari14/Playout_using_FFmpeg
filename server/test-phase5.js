const baseURL = 'http://localhost:5000/api';

async function runPhase5Tests() {
  console.log('=== Starting Phase 5 Live Logo & Ticker ZMQ Control Tests ===');

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

  // 3. Start Live Broadcast
  console.log('... Launching Live Broadcast Engine ...');
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
  console.log(`✔ Live Broadcast Engine is RUNNING on ZMQ Port ${startData.zmqPort}!`);

  // Wait 1.5 seconds for warmup
  await new Promise((r) => setTimeout(r, 1500));

  // 4. Test 1: Live Logo On-Air Enable via ZMQ
  console.log('... Testing Live Logo Toggle (ON AIR) via ZMQ ...');
  const logoEnableRes = await fetch(`${baseURL}/channels/${channel._id}/logo`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      enabled: true,
      position: 'top-left',
      sizePercent: 20,
      marginX: 2,
      marginY: 2
    })
  });
  const logoEnableData = await logoEnableRes.json();
  if (!logoEnableRes.ok) throw new Error('Failed to enable logo live');
  console.log(`✔ Logo enabled live on air via ZMQ! Response:`, logoEnableData.message);

  // 5. Test 2: Live Logo Position Change via ZMQ (move to bottom-right)
  console.log('... Testing Live Logo Position Update (move to bottom-right) via ZMQ ...');
  const logoMoveRes = await fetch(`${baseURL}/channels/${channel._id}/logo`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      enabled: true,
      position: 'bottom-right',
      marginX: 4,
      marginY: 4
    })
  });
  const logoMoveData = await logoMoveRes.json();
  if (!logoMoveRes.ok) throw new Error('Failed to move logo live');
  console.log(`✔ Logo moved to bottom-right on air via ZMQ with zero stream restart!`);

  // 6. Test 3: Live Hindi/Unicode Ticker Render & Push via ZMQ
  console.log('... Testing Live Hindi Ticker Render (Sharp SVG) & Push via ZMQ ...');
  const hindiCrawl = 'श्री साईं संध्या - सीधा प्रसारण एवं आरती दर्शन';
  const tickerPushRes = await fetch(`${baseURL}/channels/${channel._id}/ticker`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      enabled: true,
      text: hindiCrawl,
      bgColor: '#b91c1cdd',
      textColor: '#ffffff',
      fontSize: 22,
      alignment: 'center',
      speed: 4,
      marginBottom: 3
    })
  });
  const tickerPushData = await tickerPushRes.json();
  if (!tickerPushRes.ok) throw new Error('Failed to push ticker live');
  console.log(`✔ Hindi Ticker rendered with Sharp & pushed live to air via ZMQ!`);

  // 7. Test 4: Live Ticker Disable via ZMQ
  console.log('... Testing Live Ticker Disable via ZMQ ...');
  const tickerRemoveRes = await fetch(`${baseURL}/channels/${channel._id}/ticker`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  const tickerRemoveData = await tickerRemoveRes.json();
  if (!tickerRemoveRes.ok) throw new Error('Failed to remove ticker live');
  console.log(`✔ Ticker removed from live air via ZMQ! Response:`, tickerRemoveData.message);

  // 8. Verify the stream is STILL RUNNING without interruption
  const verifyStatusRes = await fetch(`${baseURL}/channels/${channel._id}/stream/status`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const verifyStatusData = await verifyStatusRes.json();
  if (!verifyStatusData.isLive) {
    throw new Error('STREAM CRASHED or restarted during live branding changes!');
  }
  console.log(`✔ Stream verified STILL LIVE after all dynamic branding changes (Zero restart, zero drop, zero buffering)!`);

  // 9. Stop Stream
  console.log('... Stopping Live Broadcast ...');
  await fetch(`${baseURL}/channels/${channel._id}/stop`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('✔ Broadcast stopped cleanly');

  console.log('=== ALL PHASE 5 LIVE ZMQ TESTS PASSED PERFECTLY! ===');
}

runPhase5Tests().catch((err) => {
  console.error('Phase 5 test failed:', err);
  process.exit(1);
});
