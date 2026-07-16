import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const uiScriptUrl = new URL('../e2e-test.cjs', import.meta.url)
const apiScriptUrl = new URL('../e2e-api-test.cjs', import.meta.url)

async function readScripts() {
  return {
    ui: await readFile(uiScriptUrl, 'utf8'),
    api: await readFile(apiScriptUrl, 'utf8'),
  }
}

test('E2E defaults contain only the platform tenant administrator', async () => {
  const { ui, api } = await readScripts()
  const combined = `${ui}\n${api}`

  for (const source of [ui, api]) {
    assert.match(
      source,
      /PLATFORM_ACCOUNT\s*=\s*Object\.freeze\(\{\s*tenantCode:\s*['"]platform['"],\s*username:\s*['"]admin['"],\s*password:\s*['"]admin123['"]\s*\}\)/,
    )
  }
  assert.doesNotMatch(combined, /warehouse01|cargo01|wh123|cargo123/)
})

test('business tenant credentials require the complete environment triplet and otherwise skip', async () => {
  const { ui, api } = await readScripts()

  for (const source of [ui, api]) {
    assert.match(source, /process\.env\.E2E_TENANT_CODE/)
    assert.match(source, /process\.env\.E2E_USERNAME/)
    assert.match(source, /process\.env\.E2E_PASSWORD/)
    assert.match(source, /if\s*\(!tenantCode\s*\|\|\s*!username\s*\|\|\s*!password\)/)
    assert.match(source, /SKIP[^\n]*E2E_TENANT_CODE[^\n]*E2E_USERNAME[^\n]*E2E_PASSWORD/)
  }
})

test('API login always includes tenantCode and platform checks avoid work orders', async () => {
  const { api } = await readScripts()
  const loginBody = api.match(/async function login\([^)]*\)\s*\{([\s\S]*?)\n\}/)?.[1] ?? ''
  const platformBlock = api.match(/async function testPlatformApi\([^)]*\)\s*\{([\s\S]*?)\n\}/)?.[1] ?? ''

  assert.match(loginBody, /new URLSearchParams\(\{[\s\S]*tenantCode:\s*account\.tenantCode/)
  assert.match(platformBlock, /login\(PLATFORM_ACCOUNT/)
  assert.match(platformBlock, /testUserInfo/)
  assert.doesNotMatch(platformBlock, /workorders|testWorkOrder/)
  assert.match(api, /if\s*\(businessAccount\)\s*\{[\s\S]*testBusinessApi/)
})

test('all UI login controls use stable test ids and platform lands on tenant management', async () => {
  const { ui, api } = await readScripts()

  for (const source of [ui, api]) {
    assert.match(source, /\[data-testid="tenant-select"\]/)
    assert.match(source, /\[data-testid="username-input"\]/)
    assert.match(source, /\[data-testid="password-input"\]/)
    assert.match(source, /\[data-testid="login-button"\]/)
    assert.match(source, /pathname\s*===\s*['"]\/system\/tenant['"]/)
    assert.doesNotMatch(source, /waitForURL\(['"]\*\*\/workorder\/\*\*['"]/)
  }
})

test('business deep-link test uses a fresh context and restores the exact query and hash', async () => {
  const { ui } = await readScripts()
  const deepLinkBody = ui.match(/async function testBusinessDeepLink\([^)]*\)\s*\{([\s\S]*?)\n\}/)?.[1] ?? ''

  assert.match(deepLinkBody, /browser\.newContext\(/)
  assert.match(deepLinkBody, /\/workorder\/detail\/123\?tenantCode=\$\{encodedTenantCode\}&foo=bar#timeline/)
  assert.match(deepLinkBody, /loginUrl\.pathname,\s*['"]\/login['"]/)
  assert.match(deepLinkBody, /loginUrl\.searchParams\.get\(['"]tenant['"]\),\s*account\.tenantCode/)
  assert.match(deepLinkBody, /loginUrl\.searchParams\.get\(['"]redirect['"]\),\s*deepLink/)
  assert.match(deepLinkBody, /selectTenant\(page,\s*account\.tenantCode,\s*\{\s*expectSelected:\s*true\s*\}\)/)
  assert.match(deepLinkBody, /finalUrl\.pathname,\s*['"]\/workorder\/detail\/123['"]/)
  assert.match(deepLinkBody, /finalUrl\.search,\s*`\?tenantCode=\$\{encodedTenantCode\}&foo=bar`/)
  assert.match(deepLinkBody, /finalUrl\.hash,\s*['"]#timeline['"]/)
  assert.match(deepLinkBody, /finally\s*\{[\s\S]*await page\.close\(\)[\s\S]*await context\.close\(\)/)
})

test('business-only smoke coverage retains every legacy page and interactive create check', async () => {
  const { ui } = await readScripts()
  const smokeBody = ui.match(/async function testBusinessSmoke\([^)]*\)\s*\{([\s\S]*?)\n\}/)?.[1] ?? ''

  assert.match(smokeBody, /browser\.newContext\(/)
  assert.match(smokeBody, /fillAndSubmitLogin\(page,\s*account\)/)
  assert.match(smokeBody, /\/workorder\/list/)
  assert.match(smokeBody, /创建工单/)
  assert.match(smokeBody, /\/workorder\/detail\/1/)
  assert.match(smokeBody, /\/system\/deadletter/)
  assert.match(smokeBody, /\/system\/audit/)
  assert.match(smokeBody, /\/system\/user/)
  assert.match(smokeBody, /\/system\/role/)
  assert.match(smokeBody, /\/system\/menu/)
  assert.match(smokeBody, /\/profile/)
  assert.match(smokeBody, /\/settings/)
  assert.match(smokeBody, /\/nonexistent-page/)
  assert.match(smokeBody, /menuKeywords/)
  assert.match(smokeBody, /finally\s*\{[\s\S]*await page\.close\(\)[\s\S]*await context\.close\(\)/)

  assert.match(
    ui,
    /if\s*\(businessAccount\)\s*\{[\s\S]*?testBusinessDeepLink\(browser,\s*businessAccount\)[\s\S]*?testBusinessSmoke\(browser,\s*businessAccount\)/,
  )
})

test('business smoke records browser console and page errors in the result', async () => {
  const { ui } = await readScripts()

  assert.match(ui, /const\s+consoleErrors\s*=\s*\[\]/)
  assert.match(ui, /const\s+pageErrors\s*=\s*\[\]/)
  assert.match(ui, /page\.on\(['"]console['"][\s\S]*msg\.type\(\)\s*===\s*['"]error['"]/)
  assert.match(ui, /page\.on\(['"]pageerror['"]/)
  assert.match(ui, /addIssue\(['"]console errors['"]/)
  assert.match(ui, /addIssue\(['"]page errors['"]/)
  assert.match(ui, /const\s+result\s*=\s*\{\s*passed,\s*failed,\s*skipped,\s*issues,\s*consoleErrors,\s*pageErrors\s*\}/)
})
