import { io } from 'socket.io-client';

const BASE_URL = process.env.API_URL || 'http://localhost:5000';
const API = `${BASE_URL}/api/v1`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const apiRequest = async (path, { method = 'GET', token, sessionToken, body } = {}) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (sessionToken) headers['x-session-token'] = sessionToken;

  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(`${method} ${path} failed (${res.status}): ${json.message}`);
  }
  return json.data;
};

const runE2E = async () => {
  console.log('🚀 Starting Aapka Waiter End-to-End Realtime Flow Test...\n');

  // 1. Login as Admin, Waiter, and Kitchen
  const adminAuth = await apiRequest('/auth/login', {
    method: 'POST',
    body: { email: 'admin@demo.com', password: 'Demo@123' },
  });
  const waiterAuth = await apiRequest('/auth/login', {
    method: 'POST',
    body: { email: 'waiter@demo.com', password: 'Demo@123' },
  });
  const kitchenAuth = await apiRequest('/auth/login', {
    method: 'POST',
    body: { email: 'kitchen@demo.com', password: 'Demo@123' },
  });
  console.log('✅ 1. Staff authenticated (Admin, Waiter, Kitchen)');

  // 2. Fetch Table T1 qrToken
  const { tables } = await apiRequest('/tables', { token: adminAuth.token });
  const tableT1 = tables.find((t) => t.name === 'T1') || tables[0];
  console.log(`✅ 2. Found table ${tableT1.name} (qrToken: ${tableT1.qrToken})`);

  // 3. Connect Staff Socket (Waiter)
  const staffSocket = io(BASE_URL, {
    auth: { token: waiterAuth.token },
    transports: ['websocket'],
  });

  await new Promise((resolve, reject) => {
    staffSocket.on('connect', resolve);
    staffSocket.on('connect_error', reject);
  });

  staffSocket.on('order:new', ({ order }) => {
    console.log(`📡 [STAFF SOCKET] order:new -> ${order.orderNo} (status: ${order.status})`);
  });
  staffSocket.on('order:updated', ({ order }) => {
    console.log(`📡 [STAFF SOCKET] order:updated -> ${order.orderNo} (status: ${order.status})`);
  });
  staffSocket.on('table:updated', ({ table }) => {
    console.log(`📡 [STAFF SOCKET] table:updated -> ${table.name} (status: ${table.status})`);
  });

  // 4. Customer scans QR and starts session
  const sessionData = await apiRequest('/public/session/start', {
    method: 'POST',
    body: { branchSlug: 'demo-cafe', qrToken: tableT1.qrToken },
  });
  const { sessionToken, guest, session } = sessionData;
  console.log(`✅ 3. Customer session started (${guest.nickname}, sessionId: ${session._id})`);

  // 5. Connect Customer Socket
  const customerSocket = io(BASE_URL, {
    auth: { sessionToken },
    transports: ['websocket'],
  });

  await new Promise((resolve, reject) => {
    customerSocket.on('connect', resolve);
    customerSocket.on('connect_error', reject);
  });

  customerSocket.on('cart:updated', ({ cart, subtotal }) => {
    console.log(`📡 [CUSTOMER SOCKET] cart:updated -> items: ${cart.length}, subtotal: ₹${subtotal}`);
  });
  customerSocket.on('order:updated', ({ order }) => {
    console.log(`📡 [CUSTOMER SOCKET] order:updated -> ${order.orderNo} (status: ${order.status})`);
  });

  await sleep(200);

  // 6. Fetch public menu and add 2 items to shared cart
  const publicMenu = await apiRequest(`/public/menu/demo-cafe/${tableT1.qrToken}`);
  const firstItem = publicMenu.items[0];
  const secondItem = publicMenu.items[1];

  await apiRequest('/public/session/cart', {
    method: 'POST',
    sessionToken,
    body: { menuItemId: firstItem._id, qty: 2, note: 'Less spicy' },
  });
  await apiRequest('/public/session/cart', {
    method: 'POST',
    sessionToken,
    body: { menuItemId: secondItem._id, qty: 1 },
  });
  console.log(`✅ 4. Added items to shared cart (${firstItem.name.en} x2, ${secondItem.name.en} x1)`);
  await sleep(200);

  // 7. Place Order with Idempotency Key
  const idempotencyKey = `e2e_key_${Date.now()}`;
  const placed1 = await apiRequest('/public/orders', {
    method: 'POST',
    sessionToken,
    body: { idempotencyKey },
  });
  const orderId = placed1.order._id;
  console.log(`✅ 5. Order placed: ${placed1.order.orderNo} | Total: ₹${placed1.order.total}`);

  // 8. Test Duplicate Idempotency Key
  const placedDuplicate = await apiRequest('/public/orders', {
    method: 'POST',
    sessionToken,
    body: { idempotencyKey },
  });
  if (placedDuplicate.order._id !== orderId || !placedDuplicate.idempotentReplay) {
    throw new Error('Idempotency check failed: duplicate key did not return the same order!');
  }
  console.log(`✅ 6. Duplicate idempotencyKey verified -> returned same order ${placedDuplicate.order.orderNo}`);
  await sleep(200);

  // 9. Waiter confirms order (PLACED -> CONFIRMED)
  await apiRequest(`/orders/${orderId}/confirm`, {
    method: 'PATCH',
    token: waiterAuth.token,
  });
  console.log('✅ 7. Waiter confirmed order');
  await sleep(200);

  // 10. Kitchen marks PREPARING (CONFIRMED -> PREPARING)
  await apiRequest(`/orders/${orderId}/status`, {
    method: 'PATCH',
    token: kitchenAuth.token,
    body: { status: 'PREPARING' },
  });
  console.log('✅ 8. Kitchen marked PREPARING');
  await sleep(200);

  // 11. Kitchen marks READY (PREPARING -> READY)
  await apiRequest(`/orders/${orderId}/status`, {
    method: 'PATCH',
    token: kitchenAuth.token,
    body: { status: 'READY' },
  });
  console.log('✅ 9. Kitchen marked READY');
  await sleep(200);

  // 12. Waiter marks SERVED (READY -> SERVED)
  await apiRequest(`/orders/${orderId}/status`, {
    method: 'PATCH',
    token: waiterAuth.token,
    body: { status: 'SERVED' },
  });
  console.log('✅ 10. Waiter marked SERVED');
  await sleep(300);

  // 13. Close session so table resets cleanly
  await apiRequest(`/sessions/${session._id}/close`, {
    method: 'POST',
    token: waiterAuth.token,
  });
  console.log('✅ 11. Waiter closed session and reset table to EMPTY\n');

  staffSocket.disconnect();
  customerSocket.disconnect();
  console.log('🎉 E2E Realtime Flow Completed Successfully!');
  process.exit(0);
};

runE2E().catch((err) => {
  console.error('❌ E2E Flow Error:', err.message);
  process.exit(1);
});
