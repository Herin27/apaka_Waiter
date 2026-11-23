import { test, expect } from '@playwright/test';

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const API_URL = process.env.API_URL || 'http://localhost:5000/api/v1';

test('Full dining lifecycle: customer order -> waiter confirm -> kitchen ready -> served -> pay', async ({
  page,
  request,
}) => {
  // 1. Authenticate as admin via API to obtain a live table QR URL
  const loginRes = await request.post(`${API_URL}/auth/login`, {
    data: { email: 'admin@demo.com', password: 'Demo@123' },
  });
  expect(loginRes.ok()).toBeTruthy();
  const adminToken = (await loginRes.json()).data.token;

  const tablesRes = await request.get(`${API_URL}/tables`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const tables = (await tablesRes.json()).data.tables;
  const tableT1 = tables.find((t) => t.name === 'T1') || tables[0];

  // 2. Customer opens QR URL, views menu, adds item, places order
  await page.goto(`${CLIENT_URL}/t/demo-cafe/${tableT1.qrToken}`);
  await page.getByRole('button', { name: /view menu/i }).click();
  await page.getByRole('button', { name: /add/i }).first().click();
  await page.getByRole('button', { name: /add to cart/i }).click();
  await page.getByRole('button', { name: /view shared cart/i }).click();
  await page.getByRole('button', { name: /place order to kitchen/i }).click();
  await expect(page.getByText(/order placed/i)).toBeVisible({ timeout: 10000 });

  // 3. Waiter logs in and confirms order
  await page.goto(`${CLIENT_URL}/login`);
  await page.getByRole('button', { name: /waiter/i }).first().click();
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/dashboard\/waiter/);
  await page.getByRole('button', { name: /^confirm$/i }).first().click();

  // 4. Kitchen logs in, starts cooking, marks ready
  await page.goto(`${CLIENT_URL}/login`);
  await page.getByRole('button', { name: /kitchen/i }).first().click();
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/dashboard\/kitchen/);
  await page.getByRole('button', { name: /start cooking/i }).first().click();
  await page.getByRole('button', { name: /mark ready/i }).first().click();

  // 5. Waiter marks served
  await page.goto(`${CLIENT_URL}/login`);
  await page.getByRole('button', { name: /waiter/i }).first().click();
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.getByRole('button', { name: /mark served/i }).first().click();

  // 6. Customer goes to Pay Bill and settles
  await page.goto(`${CLIENT_URL}/t/demo-cafe/${tableT1.qrToken}`);
  await page.getByRole('button', { name: /pay bill/i }).first().click();
  await page.getByRole('button', { name: /pay online/i }).click();
  await expect(page.getByText(/payment complete|thank you for dining/i)).toBeVisible({
    timeout: 10000,
  });
});
