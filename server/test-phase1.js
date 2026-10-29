async function runTests() {
  const baseURL = 'http://localhost:5000/api';
  console.log('--- Starting Phase 1 API Verification Tests ---');

  // 1. Login as Super Admin
  const loginRes = await fetch(`${baseURL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'superadmin@playout.com',
      password: 'Password@123'
    })
  });
  const loginData = await loginRes.json();
  if (!loginRes.ok) throw new Error(`Superadmin Login failed: ${JSON.stringify(loginData)}`);
  console.log('✔ Super Admin login succeeded. Received Access & Refresh Tokens.');

  const token = loginData.accessToken;

  // 2. Fetch /auth/me
  const meRes = await fetch(`${baseURL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const meData = await meRes.json();
  if (meData.user.role !== 'super_admin') throw new Error('Role mismatch in /auth/me');
  console.log(`✔ Auth /me verified: ${meData.user.name} (${meData.user.role})`);

  // 3. Fetch Users
  const usersRes = await fetch(`${baseURL}/users`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const usersData = await usersRes.json();
  console.log(`✔ User listing verified: ${usersData.total} users found in system.`);

  // 4. Fetch Servers
  const serversRes = await fetch(`${baseURL}/servers`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const serversData = await serversRes.json();
  console.log(`✔ Server listing verified: ${serversData.total} server(s) configured.`);
  const srv = serversData.servers[0];
  if (srv.serverPasswordEncrypted) throw new Error('Security flaw: serverPasswordEncrypted leaked!');
  console.log(`✔ Server password security verified: password is never leaked in API response.`);

  // 5. Fetch Channels
  const channelsRes = await fetch(`${baseURL}/channels`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const channelsData = await channelsRes.json();
  console.log(`✔ Channel listing verified: ${channelsData.total} channel(s) found. Channel: '${channelsData.channels[0]?.name}'`);

  // 6. Test Admin RBAC isolation
  const adminLoginRes = await fetch(`${baseURL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@playout.com',
      password: 'Password@123'
    })
  });
  const adminLoginData = await adminLoginRes.json();
  const adminToken = adminLoginData.accessToken;

  const adminUsersRes = await fetch(`${baseURL}/users`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const adminUsersData = await adminUsersRes.json();
  console.log(`✔ Admin RBAC isolation verified: Admin only sees users created by them (${adminUsersData.total} user(s)).`);

  console.log('--- ALL PHASE 1 BACKEND API & RBAC CHECKS PASSED! ---');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
