const assert = require('node:assert/strict');
const { writeFileSync } = require('node:fs');
const { chromium } = require('playwright');

const BASE_URL = process.env.E2E_FRONTEND_URL || 'http://localhost:3000';
const PLATFORM_ACCOUNT = Object.freeze({ tenantCode: 'platform', username: 'admin', password: 'admin123' });

const issues = [];
const consoleErrors = [];
const pageErrors = [];
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

function addIssue(category, severity, description) {
  issues.push({ category, severity, description });
  log(`  ISSUE [${severity}] [${category}] ${description}`);
}

function skipBusinessTests() {
  skipped += 1;
  log('  SKIP business tenant E2E: set E2E_TENANT_CODE, E2E_USERNAME and E2E_PASSWORD to enable it.');
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

async function selectTenant(page, tenantCode, { expectSelected = false } = {}) {
  const select = page.locator('[data-testid="tenant-select"]');
  await select.waitFor({ state: 'visible' });

  if (!expectSelected) {
    await select.click();
    const option = page
      .locator('.el-select-dropdown:visible .el-select-dropdown__item')
      .filter({ hasText: `(${tenantCode})` })
      .first();
    await option.waitFor({ state: 'visible' });
    await option.click();
  }

  await select
    .locator('.el-select__selected-item')
    .filter({ hasText: tenantCode })
    .first()
    .waitFor({ state: 'visible' });
}

async function fillAndSubmitLogin(page, account) {
  await page.locator('[data-testid="username-input"] input').fill(account.username);
  await page.locator('[data-testid="password-input"] input').fill(account.password);
  await page.locator('[data-testid="login-button"]').click();
}

function collectPageErrors(page) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
}

async function testPlatformLogin(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  let page;
  try {
    page = await context.newPage();
    collectPageErrors(page);
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 15000 });
    await selectTenant(page, PLATFORM_ACCOUNT.tenantCode);
    await fillAndSubmitLogin(page, PLATFORM_ACCOUNT);
    await page.waitForURL((url) => url.pathname === '/system/tenant', { timeout: 10000 });
    assert.equal(new URL(page.url()).pathname, '/system/tenant');
    pass('platform administrator lands on /system/tenant');
  } finally {
    if (page && !page.isClosed()) await page.close();
    await context.close();
  }
}

async function testBusinessDeepLink(browser, account) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  let page;
  try {
    page = await context.newPage();
    collectPageErrors(page);
    const encodedTenantCode = encodeURIComponent(account.tenantCode);
    const deepLink = `/workorder/detail/123?tenantCode=${encodedTenantCode}&foo=bar#timeline`;

    await page.goto(`${BASE_URL}${deepLink}`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForURL((url) => url.pathname === '/login', { timeout: 10000 });

    const loginUrl = new URL(page.url());
    assert.equal(loginUrl.pathname, '/login');
    assert.equal(loginUrl.searchParams.get('tenant'), account.tenantCode);
    assert.equal(loginUrl.searchParams.get('redirect'), deepLink);
    await selectTenant(page, account.tenantCode, { expectSelected: true });

    await fillAndSubmitLogin(page, account);
    await page.waitForURL((url) => (
      url.pathname === '/workorder/detail/123'
      && url.search === `?tenantCode=${encodedTenantCode}&foo=bar`
      && url.hash === '#timeline'
    ), { timeout: 10000 });

    const finalUrl = new URL(page.url());
    assert.equal(finalUrl.pathname, '/workorder/detail/123');
    assert.equal(finalUrl.search, `?tenantCode=${encodedTenantCode}&foo=bar`);
    assert.equal(finalUrl.hash, '#timeline');
    pass('business tenant deep link survives login with exact query and hash');
  } finally {
    if (page && !page.isClosed()) await page.close();
    await context.close();
  }
}

async function testBusinessSmoke(browser, account) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  let page;
  try {
    page = await context.newPage();
    collectPageErrors(page);
    const encodedTenantCode = encodeURIComponent(account.tenantCode);
    await page.goto(`${BASE_URL}/login?tenant=${encodedTenantCode}`, {
      waitUntil: 'networkidle',
      timeout: 15000,
    });
    await selectTenant(page, account.tenantCode, { expectSelected: true });
    await fillAndSubmitLogin(page, account);
    await page.waitForURL((url) => url.pathname !== '/login', { timeout: 10000 });

    const initialBody = await page.locator('body').innerText();
    if (['工单', '管理', '系统'].some((keyword) => initialBody.includes(keyword))) {
      pass('business main layout renders');
    } else {
      addIssue('main layout', 'MEDIUM', 'business main layout did not expose expected menu text');
    }

    async function runPageSmoke(name, path, keywords) {
      try {
        await page.goto(`${BASE_URL}${path}`, { waitUntil: 'networkidle', timeout: 15000 });
        const bodyText = await page.locator('body').innerText();
        if (keywords.some((keyword) => bodyText.includes(keyword))) {
          pass(`${name} renders`);
        } else {
          addIssue(name, 'MEDIUM', `${path} rendered without expected content; permissions or routing may restrict this account`);
        }
      } catch (error) {
        addIssue(name, 'MEDIUM', `${path} smoke could not complete: ${error.message}`);
      }
    }

    await runPageSmoke('work-order list', '/workorder/list', ['工单', '列表', '状态']);

    try {
      const createButton = page.locator('button').filter({ hasText: '创建工单' }).first();
      if (await createButton.count() > 0) {
        await createButton.click();
        const bodyText = await page.locator('body').innerText();
        if (['NLP', '智能解析', '提交工单'].some((keyword) => bodyText.includes(keyword))) {
          pass('create work-order dialog opens');
        } else {
          addIssue('create work order', 'MEDIUM', '创建工单 dialog opened without expected form content');
        }
      } else {
        addIssue('create work order', 'MEDIUM', '创建工单 is not available to the configured business account');
      }
    } catch (error) {
      addIssue('create work order', 'MEDIUM', `创建工单 smoke could not complete: ${error.message}`);
    }

    await runPageSmoke('work-order detail', '/workorder/detail/1', ['详情', '暂无', '工单']);
    await runPageSmoke('dead letters', '/system/deadletter', ['死信', '事件', '暂无', '数据']);
    await runPageSmoke('audit log', '/system/audit', ['审计', '日志', '操作', '暂无']);
    await runPageSmoke('user management', '/system/user', ['用户', '管理', '新增']);
    await runPageSmoke('role management', '/system/role', ['角色', '管理', '新增']);
    await runPageSmoke('menu management', '/system/menu', ['菜单', '管理', '新增']);
    await runPageSmoke('profile', '/profile', ['个人', '头像', '用户', '昵称']);
    await runPageSmoke('settings', '/settings', ['设置', '基础', '系统']);
    await runPageSmoke('404 page', '/nonexistent-page', ['404', '不存在', '返回']);

    await page.goto(`${BASE_URL}/workorder/list`, { waitUntil: 'networkidle', timeout: 15000 });
    const menuText = await page.locator('body').innerText();
    const menuKeywords = ['工单', '管理', '系统', '审计', '用户'];
    const foundMenus = menuKeywords.filter((keyword) => menuText.includes(keyword));
    if (foundMenus.length >= 3) {
      pass('dynamic menu renders');
    } else {
      addIssue('dynamic menu', 'MEDIUM', `only found menu keywords: ${foundMenus.join(', ') || 'none'}`);
    }
  } finally {
    if (page && !page.isClosed()) await page.close();
    await context.close();
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    try {
      await testPlatformLogin(browser);
    } catch (error) {
      fail('platform login', error);
    }

    const businessAccount = getBusinessAccount();
    if (businessAccount) {
      try {
        await testBusinessDeepLink(browser, businessAccount);
      } catch (error) {
        fail('business deep link', error);
      }
      try {
        await testBusinessSmoke(browser, businessAccount);
      } catch (error) {
        fail('business smoke', error);
      }
    }
  } finally {
    await browser.close();
  }

  const uniqueConsoleErrors = [...new Set(consoleErrors)];
  const uniquePageErrors = [...new Set(pageErrors)];
  if (uniqueConsoleErrors.length > 0) {
    addIssue('console errors', 'MEDIUM', `${uniqueConsoleErrors.length} unique browser console errors captured`);
  }
  if (uniquePageErrors.length > 0) {
    addIssue('page errors', 'HIGH', `${uniquePageErrors.length} unique page errors captured`);
  }

  consoleErrors.splice(0, consoleErrors.length, ...uniqueConsoleErrors);
  pageErrors.splice(0, pageErrors.length, ...uniquePageErrors);
  const result = { passed, failed, skipped, issues, consoleErrors, pageErrors };
  writeFileSync('test-result.json', JSON.stringify(result, null, 2));
  log(`Summary: ${passed} passed, ${failed} failed, ${skipped} skipped`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  fail('runner', error);
  log(`Summary: ${passed} passed, ${failed} failed, ${skipped} skipped`);
  process.exitCode = 1;
});
