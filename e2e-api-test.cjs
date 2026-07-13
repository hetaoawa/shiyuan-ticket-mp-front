const assert = require('node:assert/strict');
const axios = require('axios');
const { chromium } = require('playwright');

const BASE_URL = process.env.E2E_API_URL || 'http://localhost:9860/api';
const FRONTEND_URL = process.env.E2E_FRONTEND_URL || 'http://localhost:3000';
const PLATFORM_ACCOUNT = Object.freeze({ tenantCode: 'platform', username: 'admin', password: 'admin123' });

const issues = [];
let passed = 0;
let failed = 0;
let skipped = 0;

function log(message) {
  console.log(`[${new Date().toLocaleTimeString()}] ${message}`);
}

function pass(message) {
  passed += 1;
  log(`  PASS ${message}`);
}

function fail(category, error) {
  failed += 1;
  const description = error instanceof Error ? error.message : String(error);
  issues.push({ category, severity: 'HIGH', description });
  log(`  FAIL [${category}] ${description}`);
}

function skipBusinessTests() {
  skipped += 1;
  log('  SKIP business tenant API E2E: set E2E_TENANT_CODE, E2E_USERNAME and E2E_PASSWORD to enable it.');
}

function getBusinessAccount() {
  const tenantCode = process.env.E2E_TENANT_CODE?.trim();
  const username = process.env.E2E_USERNAME?.trim();
  const password = process.env.E2E_PASSWORD;

  if (!tenantCode || !username || !password) {
    skipBusinessTests();
    return null;
  }

  return { tenantCode, username, password };
}

async function checkBackend() {
  try {
    await axios.get(`${BASE_URL}/auth/me`, { timeout: 5000 });
    return true;
  } catch (error) {
    return Boolean(error.response);
  }
}

async function login(account, label) {
  const form = new URLSearchParams({
    tenantCode: account.tenantCode,
    username: account.username,
    password: account.password,
  });
  const response = await axios.post(`${BASE_URL}/auth/login`, form.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 10000,
  });

  if (response.data?.code !== 200 || !response.data?.token) {
    throw new Error(`${label} login failed: ${response.data?.message || 'missing token'}`);
  }
  pass(`${label} API login`);
  return response.data.token;
}

function api(token) {
  return axios.create({
    baseURL: BASE_URL,
    headers: { Authorization: `Bearer ${token}` },
    timeout: 10000,
  });
}

async function testUserInfo(token, label) {
  const response = await api(token).get('/auth/me');
  if (response.data?.code !== 200) {
    throw new Error(`${label} user info failed: ${response.data?.message || 'unexpected response'}`);
  }
  pass(`${label} user info`);
  return response.data;
}

async function testPlatformApi() {
  const token = await login(PLATFORM_ACCOUNT, 'platform');
  await testUserInfo(token, 'platform');
}

async function testBusinessApi(account) {
  const token = await login(account, 'business');
  await testUserInfo(token, 'business');
  const response = await api(token).get('/workorders');
  if (response.data?.code !== 200) {
    throw new Error(`business work-order list failed: ${response.data?.message || 'unexpected response'}`);
  }
  pass('business work-order list');
}

async function selectTenant(page, tenantCode) {
  const select = page.locator('[data-testid="tenant-select"]');
  await select.waitFor({ state: 'visible' });
  await select.click();
  const option = page
    .locator('.el-select-dropdown:visible .el-select-dropdown__item')
    .filter({ hasText: `(${tenantCode})` })
    .first();
  await option.waitFor({ state: 'visible' });
  await option.click();
}

async function testPlatformUi() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  let page;
  try {
    page = await context.newPage();
    await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle', timeout: 15000 });
    await selectTenant(page, PLATFORM_ACCOUNT.tenantCode);
    await page.locator('[data-testid="username-input"] input').fill(PLATFORM_ACCOUNT.username);
    await page.locator('[data-testid="password-input"] input').fill(PLATFORM_ACCOUNT.password);
    await page.locator('[data-testid="login-button"]').click();
    await page.waitForURL((url) => url.pathname === '/system/tenant', { timeout: 10000 });
    assert.equal(new URL(page.url()).pathname, '/system/tenant');
    pass('platform UI login lands on /system/tenant');
  } finally {
    if (page && !page.isClosed()) await page.close();
    await context.close();
    await browser.close();
  }
}

async function main() {
  const businessAccount = getBusinessAccount();
  if (!await checkBackend()) {
    throw new Error('backend is not reachable; start it before running this E2E script');
  }

  try {
    await testPlatformApi();
  } catch (error) {
    fail('platform API', error);
  }

  if (businessAccount) {
    try {
      await testBusinessApi(businessAccount);
    } catch (error) {
      fail('business API', error);
    }
  }

  try {
    await testPlatformUi();
  } catch (error) {
    fail('platform UI', error);
  }

  log(`Summary: ${passed} passed, ${failed} failed, ${skipped} skipped`);
  if (issues.length > 0) {
    issues.forEach((issue) => log(`  [${issue.severity}] ${issue.category}: ${issue.description}`));
  }
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  fail('runner', error);
  log(`Summary: ${passed} passed, ${failed} failed, ${skipped} skipped`);
  process.exitCode = 1;
});
