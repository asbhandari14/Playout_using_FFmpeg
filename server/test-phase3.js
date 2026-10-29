async function runPhase3Tests() {
  const baseURL = 'http://localhost:5000/api';
  console.log('=== Starting Phase 3 Dashboard UI & Playlist API Tests ===');

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

  // 3. Fetch Assets for Channel
  const assetsRes = await fetch(`${baseURL}/assets?channelId=${channel._id}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const assetsData = await assetsRes.json();
  const testAsset = assetsData.assets[0];
  if (!testAsset) throw new Error('No asset available to test playlist');
  console.log(`✔ Found Asset: ${testAsset.originalName} (${testAsset.durationFormatted})`);

  // 4. Save Playlist with multiple items to verify cumulative start offsets
  const playlistItems = [
    { asset: testAsset._id, order: 1 },
    { asset: testAsset._id, order: 2 },
    { asset: testAsset._id, order: 3 }
  ];

  const saveRes = await fetch(`${baseURL}/channels/${channel._id}/playlist`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ items: playlistItems, loop: true })
  });
  const saveData = await saveRes.json();
  if (!saveRes.ok) throw new Error(`Playlist save failed: ${JSON.stringify(saveData)}`);

  console.log(`✔ Saved 3 items to Playlist. Total Duration: ${saveData.playlist.totalDurationFormatted}`);
  const items = saveData.playlist.items;
  console.log(`  - Item 1 Start: ${items[0].startOffsetFormatted} (Dur: ${items[0].asset?.durationFormatted})`);
  console.log(`  - Item 2 Start: ${items[1].startOffsetFormatted} (Dur: ${items[1].asset?.durationFormatted})`);
  console.log(`  - Item 3 Start: ${items[2].startOffsetFormatted} (Dur: ${items[2].asset?.durationFormatted})`);

  if (items[1].startOffset === 0 && items[0].asset?.duration > 0) {
    throw new Error('Cumulative start time calculation failed!');
  }
  console.log('✔ Live cumulative start time auto-calculation verified!');

  // 5. Test Logo Branding Update
  const logoRes = await fetch(`${baseURL}/channels/${channel._id}/logo`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      enabled: true,
      position: 'top-right',
      sizePercent: 25,
      marginX: 3,
      marginY: 3
    })
  });
  const logoData = await logoRes.json();
  if (!logoRes.ok) throw new Error('Logo update failed');
  console.log(`✔ Logo branding updated: position=${logoData.logo.position}, size=${logoData.logo.sizePercent}%`);

  // 6. Test Ticker Branding Update with Hindi Unicode Text
  const hindiTickerText = 'श्री साईं भक्ति धारा - लाइव प्रसारण सेवा';
  const tickerRes = await fetch(`${baseURL}/channels/${channel._id}/ticker`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      enabled: true,
      text: hindiTickerText,
      bgColor: '#000000ee',
      textColor: '#ffffff',
      fontSize: 22,
      fontFamily: 'Noto Sans Devanagari'
    })
  });
  const tickerData = await tickerRes.json();
  if (!tickerRes.ok) throw new Error('Ticker update failed');
  console.log(`✔ Hindi/Unicode Ticker pushed: "${tickerData.ticker.text}"`);

  console.log('=== ALL PHASE 3 TESTS PASSED PERFECTLY! ===');
}

runPhase3Tests().catch((err) => {
  console.error('Phase 3 test failed:', err);
  process.exit(1);
});
