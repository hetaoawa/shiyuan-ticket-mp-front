import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import {
  buildLoginLocation,
  firstQueryString,
  resolvePostLoginTarget,
  resolveSafeRedirect,
  selectInitialTenant,
} from '../src/utils/tenant-login.js'

const loginViewUrl = new URL('../src/views/login/index.vue', import.meta.url)

async function readLoginView() {
  return readFile(loginViewUrl, 'utf8')
}

const options = [
  { tenantCode: 'platform', tenantName: '平台' },
  { tenantCode: 'acme', tenantName: 'Acme' },
  { tenantCode: 'old', tenantName: 'Old' },
]

test('URL tenant wins when it is available', () => {
  assert.deepEqual(
    selectInitialTenant({ requestedTenant: 'acme', rememberedTenant: 'old', options }),
    { tenantCode: 'acme', requestedUnavailable: false },
  )
})

test('unavailable URL tenant returns an empty selection without falling back', () => {
  assert.deepEqual(
    selectInitialTenant({ requestedTenant: 'missing', rememberedTenant: 'old', options }),
    { tenantCode: '', requestedUnavailable: true },
  )
})

test('remembered tenant is the first fallback', () => {
  assert.deepEqual(selectInitialTenant({ rememberedTenant: 'old', options }), {
    tenantCode: 'old',
    requestedUnavailable: false,
  })
})

test('platform tenant is preferred when there is no valid remembered tenant', () => {
  assert.deepEqual(selectInitialTenant({ rememberedTenant: 'missing', options }), {
    tenantCode: 'platform',
    requestedUnavailable: false,
  })
})

test('first option is used when platform is unavailable', () => {
  assert.deepEqual(
    selectInitialTenant({ options: [{ tenantCode: 'first', tenantName: 'First' }] }),
    { tenantCode: 'first', requestedUnavailable: false },
  )
})

test('empty options return an empty selection', () => {
  assert.deepEqual(selectInitialTenant({ options: [] }), {
    tenantCode: '',
    requestedUnavailable: false,
  })
})

test('query values normalize strings and arrays consistently', () => {
  assert.equal(firstQueryString('acme'), 'acme')
  assert.equal(firstQueryString(['acme', 'ignored']), 'acme')
  assert.equal(firstQueryString([123, 'acme']), 'acme')
  assert.equal(firstQueryString([]), '')
  assert.equal(firstQueryString(null), '')
})

test('login location preserves the complete deep link and normalizes tenant arrays', () => {
  assert.deepEqual(
    buildLoginLocation({
      path: '/workorder/detail/123',
      fullPath: '/workorder/detail/123?tenantCode=acme&foo=bar#timeline',
      query: { tenantCode: ['acme', 'ignored'], foo: 'bar' },
    }),
    {
      path: '/login',
      query: {
        tenant: 'acme',
        redirect: '/workorder/detail/123?tenantCode=acme&foo=bar#timeline',
      },
    },
  )
})

test('safe redirect rejects external, protocol-relative and login-loop values', () => {
  assert.equal(resolveSafeRedirect('https://evil.test'), '/')
  assert.equal(resolveSafeRedirect('//evil.test/path'), '/')
  assert.equal(resolveSafeRedirect('/login'), '/')
  assert.equal(resolveSafeRedirect('/login?redirect=/workorder/list'), '/')
  assert.equal(resolveSafeRedirect('/login#again'), '/')
})

test('safe redirect rejects normalized and encoded login loops', () => {
  assert.equal(resolveSafeRedirect('/LOGIN'), '/')
  assert.equal(resolveSafeRedirect('/login/'), '/')
  assert.equal(resolveSafeRedirect('/%6cogin?x=1'), '/')
  assert.equal(resolveSafeRedirect('/%E0%A4%A'), '/')
  assert.equal(resolveSafeRedirect('/login-help'), '/login-help')
})

test('safe redirect accepts a local path with query and hash', () => {
  assert.equal(
    resolveSafeRedirect('/workorder/list?foo=bar#top'),
    '/workorder/list?foo=bar#top',
  )
})

test('safe redirect normalizes array and invalid values to the fallback', () => {
  assert.equal(resolveSafeRedirect(['/workorder/list']), '/')
  assert.equal(resolveSafeRedirect(null, '/fallback'), '/fallback')
})

test('platform login targets tenant management while other tenants use safe redirect', () => {
  assert.equal(
    resolvePostLoginTarget('/workorder/detail/123?tenantCode=platform', 'platform'),
    '/system/tenant',
  )
  assert.equal(
    resolvePostLoginTarget('/workorder/detail/123?tenantCode=acme', 'acme'),
    '/workorder/detail/123?tenantCode=acme',
  )
})

test('tenant selection matches requested and remembered codes after trim and case normalization', () => {
  assert.deepEqual(
    selectInitialTenant({
      requestedTenant: ' AcMe ',
      rememberedTenant: 'old',
      options: [{ tenantCode: 'acme', tenantName: 'Acme' }],
    }),
    { tenantCode: 'acme', requestedUnavailable: false },
  )
  assert.deepEqual(
    selectInitialTenant({
      rememberedTenant: ' OLD ',
      options: [{ tenantCode: 'old', tenantName: 'Old' }],
    }),
    { tenantCode: 'old', requestedUnavailable: false },
  )
})

test('tenant options ignore invalid and duplicate codes while preserving the first canonical code', () => {
  const normalizedOptions = [
    null,
    'invalid',
    {},
    { tenantCode: '   ', tenantName: 'Empty' },
    { tenantCode: 'AcMe', tenantName: 'First Acme' },
    { tenantCode: 'acme', tenantName: 'Duplicate Acme' },
    { tenantCode: 'beta', tenantName: 'Beta' },
  ]

  assert.deepEqual(selectInitialTenant({ requestedTenant: 'acme', options: normalizedOptions }), {
    tenantCode: 'AcMe',
    requestedUnavailable: false,
  })
  assert.deepEqual(selectInitialTenant({ options: [null, {}, { tenantCode: 'first' }] }), {
    tenantCode: 'first',
    requestedUnavailable: false,
  })
})

test('platform matching ignores case and surrounding whitespace', () => {
  assert.deepEqual(selectInitialTenant({ options: [{ tenantCode: 'PLATFORM' }] }), {
    tenantCode: 'PLATFORM',
    requestedUnavailable: false,
  })
  assert.equal(resolvePostLoginTarget('/workorder/list', ' PLATFORM '), '/system/tenant')
})

test('auth API exports the public tenant-options request', async () => {
  const authSource = await readFile(new URL('../src/api/auth.js', import.meta.url), 'utf8')
  const functionMatch = authSource.match(
    /export function getLoginTenantOptions\(\) \{([\s\S]*?)\r?\n\}/,
  )

  assert.ok(functionMatch)
  assert.match(
    functionMatch[1],
    /url:\s*['"]\/auth\/tenant-options['"][\s\S]*?method:\s*['"]get['"]/,
  )
})

test('login view renders a filterable tenant selector and stable test ids', async () => {
  const source = await readLoginView()

  assert.match(
    source,
    /<el-select\b(?=[\s\S]*?v-model="loginForm\.tenantCode")(?=[\s\S]*?filterable)(?=[\s\S]*?data-testid="tenant-select")[\s\S]*?<\/el-select>/,
  )
  assert.match(source, /<el-option\b[\s\S]*?:label="`\$\{option\.tenantName\} \(\$\{option\.tenantCode\}\)`"/)
  assert.match(source, /tenantCode:\s*\[\{[^}]*trigger:\s*['"]change['"]/)
  assert.match(source, /<el-input\b(?=[\s\S]*?v-model="loginForm\.username")(?=[\s\S]*?data-testid="username-input")[\s\S]*?>/)
  assert.match(source, /<el-input\b(?=[\s\S]*?v-model="loginForm\.password")(?=[\s\S]*?data-testid="password-input")[\s\S]*?>/)
  assert.match(source, /<el-button\b(?=[\s\S]*?data-testid="login-button")[\s\S]*?>/)
})

test('login view loads res.data tenant options with independent loading and failure states', async () => {
  const source = await readLoginView()

  assert.match(source, /import\s*\{\s*getLoginTenantOptions\s*\}\s*from\s*['"]@\/api\/auth['"]/)
  assert.match(source, /const\s+tenantOptionsLoading\s*=\s*ref\(false\)/)
  assert.match(source, /const\s+tenantOptionsError\s*=\s*ref\(['"]['"]\)/)
  assert.match(source, /const\s+loginSubmitting\s*=\s*ref\(false\)/)
  assert.match(source, /const\s+res\s*=\s*await\s+getLoginTenantOptions\(\)/)
  assert.match(source, /tenantOptions\.value\s*=\s*Array\.isArray\(res\.data\)\s*\?\s*res\.data\s*:\s*\[\]/)
  assert.match(source, /role="alert"/)
  assert.match(source, /@click="loadTenantOptions"/)
  assert.match(source, /tenantOptions\.length\s*===\s*0/)
  assert.match(source, /:disabled="loginDisabled"/)
  assert.match(source, /loginDisabled\s*=\s*computed\(\(\)\s*=>[\s\S]*tenantOptionsLoading\.value[\s\S]*tenantOptionsError\.value[\s\S]*tenantOptions\.value\.length\s*===\s*0[\s\S]*requestedTenantUnavailable\.value[\s\S]*loginSubmitting\.value/)
})

test('login view restores only remembered username and selects tenant after options arrive', async () => {
  const source = await readLoginView()

  assert.match(source, /const\s+rememberedTenantCode\s*=\s*ref\(['"]['"]\)/)
  assert.match(source, /rememberedTenantCode\.value\s*=\s*rememberedLogin\.tenantCode/)
  assert.match(source, /loginForm\.username\s*=\s*rememberedLogin\.username/)
  assert.match(source, /loginForm\.password\s*=\s*['"]['"]/)
  assert.match(source, /localStorage\.removeItem\(['"]rememberedLogin['"]\)/)
  assert.doesNotMatch(source, /rememberedLogin\.password/)
  assert.match(
    source,
    /selectInitialTenant\(\{[\s\S]*requestedTenant:\s*firstQueryString\(route\.query\.tenant\)[\s\S]*rememberedTenant:\s*rememberedTenantCode\.value[\s\S]*options:\s*tenantOptions\.value[\s\S]*\}\)/,
  )
})

test('login view keeps unavailable explicit tenants visible and canonically syncs valid selections', async () => {
  const source = await readLoginView()

  assert.match(source, /const\s+requestedTenantUnavailable\s*=\s*ref\(false\)/)
  assert.match(source, /v-if="requestedTenantUnavailable"[^>]*role="alert"/)
  assert.match(source, /loginForm\.tenantCode\s*=\s*selection\.tenantCode/)
  assert.match(source, /requestedTenantUnavailable\.value\s*=\s*selection\.requestedUnavailable/)
  assert.match(source, /function\s+handleTenantChange\([^)]*\)\s*\{[\s\S]*requestedTenantUnavailable\.value\s*=\s*false[\s\S]*replaceLoginTenant/)
  assert.match(source, /function\s+replaceLoginTenant\([^)]*\)\s*\{[\s\S]*router\.replace\(\{[\s\S]*path:\s*['"]\/login['"][\s\S]*query:\s*\{[\s\S]*\.\.\.route\.query[\s\S]*tenant:\s*tenantCode/)
})

test('login view follows normalized tenant query changes and uses replace after login', async () => {
  const source = await readLoginView()

  assert.match(source, /watch\(\s*\(\)\s*=>\s*firstQueryString\(route\.query\.tenant\)/)
  assert.match(source, /route\.query\.tenant\s*===\s*tenantCode/)
  assert.match(source, /resolvePostLoginTarget\(route\.query\.redirect,\s*loginForm\.tenantCode\)/)
  assert.match(source, /router\.replace\(resolvePostLoginTarget\(route\.query\.redirect,\s*loginForm\.tenantCode\)\)/)
  assert.doesNotMatch(source, /router\.push\(/)
})
