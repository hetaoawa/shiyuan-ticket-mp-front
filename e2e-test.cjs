const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:3000';

const issues = [];
let passed = 0;
let failed = 0;

function log(msg) {
  console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);
}

function addIssue(category, severity, description) {
  issues.push({ category, severity, description });
  log(`  ❌ [${severity}] ${description}`);
}

function pass(msg) {
  passed++;
  log(`  ✅ ${msg}`);
}

function fail(category, msg) {
  failed++;
  addIssue(category, 'HIGH', msg);
}

async function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// 等待页面内容加载（更健壮的方式）
async function waitForContent(page, timeout = 5000) {
  try {
    await page.waitForFunction(() => {
      const body = document.body;
      return body && body.innerText && body.innerText.trim().length > 10;
    }, { timeout });
  } catch (e) {
    // 超时也继续测试
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  // ========== 1. 登录页测试 ==========
  log('\n========== 1. 登录页测试 ==========');
  try {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 15000 });
    await waitForContent(page);
    await page.screenshot({ path: 'screenshots/01-login.png', fullPage: true });

    const hasInput = await page.locator('input').count();
    if (hasInput > 0) {
      pass('登录页面正常加载，包含输入框');
    } else {
      fail('登录页', '登录页面未正常加载');
    }
  } catch (e) {
    fail('登录页', `登录页面加载失败: ${e.message}`);
  }

  // ========== 2. 登录功能测试 ==========
  log('\n========== 2. 登录功能测试 ==========');
  try {
    const inputs = page.locator('input');
    const inputCount = await inputs.count();
    log(`  找到 ${inputCount} 个输入框`);

    if (inputCount >= 2) {
      await inputs.first().fill('admin');
      await inputs.nth(1).fill('admin123');
      pass('成功输入用户名和密码');

      await page.screenshot({ path: 'screenshots/02-login-filled.png', fullPage: true });

      const loginBtn = page.locator('button').filter({ hasText: /登录|Login/ }).first();
      if (await loginBtn.count() > 0) {
        await loginBtn.click();
        await delay(3000);

        const url = page.url();
        log(`  登录后跳转到: ${url}`);

        if (!url.includes('/login')) {
          pass('登录成功，已跳转离开登录页');
        } else {
          fail('登录功能', '登录后仍在登录页面');
        }
      } else {
        fail('登录功能', '未找到登录按钮');
      }
    } else {
      fail('登录功能', '未找到足够的输入框');
    }
  } catch (e) {
    fail('登录功能', `登录操作失败: ${e.message}`);
  }

  // ========== 3. 主布局测试 ==========
  log('\n========== 3. 主布局测试 ==========');
  try {
    await waitForContent(page);
    await page.screenshot({ path: 'screenshots/03-after-login.png', fullPage: true });

    const bodyText = await page.locator('body').innerText();
    const hasLayout = bodyText.includes('工单') || bodyText.includes('管理') || bodyText.includes('系统');
    if (hasLayout) {
      pass('主布局已渲染，包含菜单文字');
    } else {
      addIssue('主布局', 'MEDIUM', '主布局可能未正常渲染');
    }
  } catch (e) {
    fail('主布局', `主布局测试失败: ${e.message}`);
  }

  // ========== 4. 工单列表页测试 ==========
  log('\n========== 4. 工单列表页测试 ==========');
  try {
    await page.goto(`${BASE_URL}/workorder/list`, { waitUntil: 'networkidle', timeout: 15000 });
    await waitForContent(page);
    await delay(1000);
    await page.screenshot({ path: 'screenshots/04-workorder-list.png', fullPage: true });

    const bodyText = await page.locator('body').innerText();
    const hasTableContent = bodyText.includes('工单') || bodyText.includes('列表') || bodyText.includes('状态');
    if (hasTableContent) {
      pass('工单列表页面已渲染');
    } else {
      addIssue('工单列表', 'MEDIUM', '工单列表页面可能未正常渲染');
    }
  } catch (e) {
    fail('工单列表', `工单列表页测试失败: ${e.message}`);
  }

  // ========== 5. 创建工单弹窗测试 ==========
  log('\n========== 5. 创建工单弹窗测试 ==========');
  try {
    await page.goto(`${BASE_URL}/workorder/list`, { waitUntil: 'networkidle', timeout: 15000 });
    await waitForContent(page);
    await delay(1000);

    // 点击创建工单按钮
    const createBtn = page.locator('button').filter({ hasText: '创建工单' }).first();
    if (await createBtn.count() > 0) {
      await createBtn.click();
      await delay(500);
      await page.screenshot({ path: 'screenshots/05-workorder-create-dialog.png', fullPage: true });

      const bodyText = await page.locator('body').innerText();
      const hasFormContent = bodyText.includes('NLP') || bodyText.includes('智能解析') || bodyText.includes('提交工单');
      if (hasFormContent) {
        pass('创建工单弹窗已打开');
      } else {
        addIssue('创建工单', 'MEDIUM', '创建工单弹窗可能未正常打开');
      }
      // 关闭弹窗
      const cancelBtn = page.locator('button').filter({ hasText: '取消' }).first();
      if (await cancelBtn.count() > 0) await cancelBtn.click();
    } else {
      addIssue('创建工单', 'MEDIUM', '未找到创建工单按钮');
    }
  } catch (e) {
    fail('创建工单', `创建工单弹窗测试失败: ${e.message}`);
  }

  // ========== 6. 工单详情页测试 ==========
  log('\n========== 6. 工单详情页测试 ==========');
  try {
    await page.goto(`${BASE_URL}/workorder/detail/1`, { waitUntil: 'networkidle', timeout: 15000 });
    await waitForContent(page);
    await delay(1000);
    await page.screenshot({ path: 'screenshots/06-workorder-detail.png', fullPage: true });

    const bodyText = await page.locator('body').innerText();
    const hasDetailContent = bodyText.includes('详情') || bodyText.includes('暂无') || bodyText.includes('工单');
    if (hasDetailContent) {
      pass('工单详情页面已渲染');
    } else {
      addIssue('工单详情', 'MEDIUM', '工单详情页面可能未正常渲染');
    }
  } catch (e) {
    fail('工单详情', `工单详情页测试失败: ${e.message}`);
  }

  // ========== 7. 死信管理页测试 ==========
  log('\n========== 7. 死信管理页测试 ==========');
  try {
    await page.goto(`${BASE_URL}/system/deadletter`, { waitUntil: 'networkidle', timeout: 15000 });
    await waitForContent(page);
    await delay(2000);
    await page.screenshot({ path: 'screenshots/07-deadletters.png', fullPage: true });

    const bodyText = await page.locator('body').innerText();
    log(`  页面文本片段: ${bodyText.substring(0, 200)}`);
    const hasContent = bodyText.includes('死信') || bodyText.includes('事件') || bodyText.includes('暂无') || bodyText.includes('数据');
    if (hasContent) {
      pass('死信管理页面已渲染');
    } else {
      addIssue('死信管理', 'MEDIUM', '死信管理页面可能未正常渲染');
    }
  } catch (e) {
    fail('死信管理', `死信管理页测试失败: ${e.message}`);
  }

  // ========== 8. 审计日志页测试 ==========
  log('\n========== 8. 审计日志页测试 ==========');
  try {
    await page.goto(`${BASE_URL}/system/audit`, { waitUntil: 'networkidle', timeout: 15000 });
    await waitForContent(page);
    await delay(2000);
    await page.screenshot({ path: 'screenshots/08-audit-logs.png', fullPage: true });

    const bodyText = await page.locator('body').innerText();
    log(`  页面文本片段: ${bodyText.substring(0, 200)}`);
    const hasContent = bodyText.includes('审计') || bodyText.includes('日志') || bodyText.includes('操作') || bodyText.includes('暂无');
    if (hasContent) {
      pass('审计日志页面已渲染');
    } else {
      addIssue('审计日志', 'MEDIUM', '审计日志页面可能未正常渲染');
    }
  } catch (e) {
    fail('审计日志', `审计日志页测试失败: ${e.message}`);
  }

  // ========== 9. 用户管理页测试 ==========
  log('\n========== 9. 用户管理页测试 ==========');
  try {
    await page.goto(`${BASE_URL}/system/user`, { waitUntil: 'networkidle', timeout: 15000 });
    await waitForContent(page);
    await delay(1000);
    await page.screenshot({ path: 'screenshots/09-users.png', fullPage: true });

    const bodyText = await page.locator('body').innerText();
    const hasContent = bodyText.includes('用户') || bodyText.includes('管理') || bodyText.includes('新增');
    if (hasContent) {
      pass('用户管理页面已渲染');
    } else {
      addIssue('用户管理', 'MEDIUM', '用户管理页面可能未正常渲染');
    }
  } catch (e) {
    fail('用户管理', `用户管理页测试失败: ${e.message}`);
  }

  // ========== 10. 角色管理页测试 ==========
  log('\n========== 10. 角色管理页测试 ==========');
  try {
    await page.goto(`${BASE_URL}/system/role`, { waitUntil: 'networkidle', timeout: 15000 });
    await waitForContent(page);
    await delay(1000);
    await page.screenshot({ path: 'screenshots/10-roles.png', fullPage: true });

    const bodyText = await page.locator('body').innerText();
    const hasContent = bodyText.includes('角色') || bodyText.includes('管理') || bodyText.includes('新增');
    if (hasContent) {
      pass('角色管理页面已渲染');
    } else {
      addIssue('角色管理', 'MEDIUM', '角色管理页面可能未正常渲染');
    }
  } catch (e) {
    fail('角色管理', `角色管理页测试失败: ${e.message}`);
  }

  // ========== 11. 菜单管理页测试 ==========
  log('\n========== 11. 菜单管理页测试 ==========');
  try {
    await page.goto(`${BASE_URL}/system/menu`, { waitUntil: 'networkidle', timeout: 15000 });
    await waitForContent(page);
    await delay(1000);
    await page.screenshot({ path: 'screenshots/11-menus.png', fullPage: true });

    const bodyText = await page.locator('body').innerText();
    const hasContent = bodyText.includes('菜单') || bodyText.includes('管理') || bodyText.includes('新增');
    if (hasContent) {
      pass('菜单管理页面已渲染');
    } else {
      addIssue('菜单管理', 'MEDIUM', '菜单管理页面可能未正常渲染');
    }
  } catch (e) {
    fail('菜单管理', `菜单管理页测试失败: ${e.message}`);
  }

  // ========== 12. 个人中心页测试 ==========
  log('\n========== 12. 个人中心页测试 ==========');
  try {
    await page.goto(`${BASE_URL}/profile`, { waitUntil: 'networkidle', timeout: 15000 });
    await waitForContent(page);
    await delay(2000);
    await page.screenshot({ path: 'screenshots/12-profile.png', fullPage: true });

    const bodyText = await page.locator('body').innerText();
    log(`  页面文本片段: ${bodyText.substring(0, 200)}`);
    const hasContent = bodyText.includes('个人') || bodyText.includes('头像') || bodyText.includes('用户') || bodyText.includes('昵称');
    if (hasContent) {
      pass('个人中心页面已渲染');
    } else {
      addIssue('个人中心', 'MEDIUM', '个人中心页面可能未正常渲染');
    }
  } catch (e) {
    fail('个人中心', `个人中心页测试失败: ${e.message}`);
  }

  // ========== 13. 系统设置页测试 ==========
  log('\n========== 13. 系统设置页测试 ==========');
  try {
    await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle', timeout: 15000 });
    await waitForContent(page);
    await delay(1000);
    await page.screenshot({ path: 'screenshots/13-settings.png', fullPage: true });

    const bodyText = await page.locator('body').innerText();
    const hasContent = bodyText.includes('设置') || bodyText.includes('基础') || bodyText.includes('系统');
    if (hasContent) {
      pass('系统设置页面已渲染');
    } else {
      addIssue('系统设置', 'MEDIUM', '系统设置页面可能未正常渲染');
    }
  } catch (e) {
    fail('系统设置', `系统设置页测试失败: ${e.message}`);
  }

  // ========== 14. 404页面测试 ==========
  log('\n========== 14. 404页面测试 ==========');
  try {
    await page.goto(`${BASE_URL}/nonexistent-page`, { waitUntil: 'networkidle', timeout: 15000 });
    await waitForContent(page);
    await delay(2000);
    await page.screenshot({ path: 'screenshots/14-404.png', fullPage: true });

    const bodyText = await page.locator('body').innerText();
    const has404 = bodyText.includes('404') || bodyText.includes('不存在') || bodyText.includes('返回');
    if (has404) {
      pass('404 页面正常渲染');
    } else {
      addIssue('404页面', 'MEDIUM', '404 页面可能未正常渲染');
    }
  } catch (e) {
    fail('404页面', `404页面测试失败: ${e.message}`);
  }

  // ========== 15. 动态菜单测试 ==========
  log('\n========== 15. 动态菜单测试 ==========');
  try {
    await page.goto(`${BASE_URL}/workorder/list`, { waitUntil: 'networkidle', timeout: 15000 });
    await waitForContent(page);
    await delay(1000);

    const bodyText = await page.locator('body').innerText();
    const menuKeywords = ['工单', '管理', '系统', '审计', '用户'];
    const foundMenus = menuKeywords.filter(kw => bodyText.includes(kw));
    log(`  找到菜单关键字: ${foundMenus.join(', ')}`);

    if (foundMenus.length >= 3) {
      pass('动态菜单已加载');
    } else {
      addIssue('动态菜单', 'HIGH', '侧边栏菜单可能未正常加载');
    }
  } catch (e) {
    addIssue('动态菜单', 'HIGH', `动态菜单测试失败: ${e.message}`);
  }

  // ========== 汇总 ==========
  log('\n========== 控制台错误汇总 ==========');
  const uniqueConsoleErrors = [...new Set(consoleErrors)];
  if (uniqueConsoleErrors.length > 0) {
    log(`  发现 ${uniqueConsoleErrors.length} 个控制台错误:`);
    uniqueConsoleErrors.forEach(err => log(`    - ${err.substring(0, 200)}`));
    addIssue('控制台错误', 'MEDIUM', `页面存在 ${uniqueConsoleErrors.length} 个控制台错误`);
  } else {
    pass('无控制台错误');
  }

  const uniquePageErrors = [...new Set(pageErrors)];
  if (uniquePageErrors.length > 0) {
    log(`  发现 ${uniquePageErrors.length} 个页面 JS 错误:`);
    uniquePageErrors.forEach(err => log(`    - ${err.substring(0, 200)}`));
    addIssue('JS错误', 'HIGH', `页面存在 ${uniquePageErrors.length} 个 JS 运行时错误`);
  } else {
    pass('无页面 JS 错误');
  }

  // ========== 测试结果汇总 ==========
  log('\n========================================');
  log('测试结果汇总');
  log('========================================');
  log(`  ✅ 通过: ${passed}`);
  log(`  ❌ 失败: ${failed}`);
  log(`  ⚠️  问题: ${issues.length}`);

  if (issues.length > 0) {
    log('\n发现的问题清单:');
    issues.forEach((issue, i) => {
      log(`  ${i + 1}. [${issue.severity}] ${issue.category}: ${issue.description}`);
    });
  }

  const result = { passed, failed, issues, consoleErrors: uniqueConsoleErrors, pageErrors: uniquePageErrors };
  require('fs').writeFileSync('test-result.json', JSON.stringify(result, null, 2));
  log('\n测试结果已保存到 test-result.json');

  await browser.close();
})();
