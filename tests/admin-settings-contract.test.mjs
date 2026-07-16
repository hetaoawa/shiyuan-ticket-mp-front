import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import {
  INTEGRATION_TYPES,
  buildIntegrationUpdatePayload,
  createIntegrationForm,
  normalizeIntegrationCollection,
} from '../src/utils/integration-settings.js'

test('tenant integration collection normalizes all five stable types', () => {
  const normalized = normalizeIntegrationCollection({
    integrations: INTEGRATION_TYPES.map((type, index) => ({
      type,
      enabled: index === 0,
      configVersion: index + 1,
      config: { endpoint: 'https://example.test' },
      secretConfigured: { secret: true },
    })),
  })

  assert.deepEqual([...normalized.keys()], INTEGRATION_TYPES)
  assert.equal(normalized.get('DINGTALK').enabled, true)
  assert.equal(normalized.get('AI').configVersion, 5)
  assert.equal(normalized.get('S3').configured, true)
})

test('secret updates distinguish keep, replace and explicit clear', () => {
  const form = createIntegrationForm('DINGTALK')
  form.configVersion = 7
  form.enabled = true
  form.config.workOrderDetailBaseUrl = 'https://tickets.example.test'
  form.secretInputs.accessToken = '  next-token  '
  form.secretActions.accessToken = 'value'
  form.secretActions.secret = 'clear'

  assert.deepEqual(buildIntegrationUpdatePayload(form), {
    configVersion: 7,
    enabled: true,
    config: { workOrderDetailBaseUrl: 'https://tickets.example.test' },
    secrets: {
      accessToken: { value: 'next-token' },
      secret: { clear: true },
    },
  })

  form.secretInputs.accessToken = ''
  form.secretActions.accessToken = 'keep'
  assert.equal('accessToken' in buildIntegrationUpdatePayload(form).secrets, false)
})

test('API modules keep tenant integration and platform SSL paths centralized', async () => {
  const settingsApi = await readFile(new URL('../src/api/admin/settings.js', import.meta.url), 'utf8')
  const sslApi = await readFile(new URL('../src/api/admin/platform-ssl.js', import.meta.url), 'utf8')

  assert.match(settingsApi, /url:\s*['"]\/admin\/settings\/integrations['"]/)
  assert.match(settingsApi, /\/admin\/settings\/integrations\/\$\{encodeURIComponent\(type\)\}/)
  for (const suffix of ['/state', '/certificates', '/deploy-tokens', '/operations']) {
    assert.ok(sslApi.includes(suffix), `missing platform SSL endpoint ${suffix}`)
  }
  assert.match(sslApi, /new FormData\(\)/)
  assert.doesNotMatch(sslApi, /privateKey[^\n]*(response|return|console)/i)
})

test('platform SSL route requires global admin and the backend manage permission', async () => {
  const router = await readFile(new URL('../src/router/index.js', import.meta.url), 'utf8')
  const layout = await readFile(new URL('../src/layout/index.vue', import.meta.url), 'utf8')

  assert.match(router, /path:\s*['"]system\/platform-ssl['"]/)
  assert.match(router, /permission:\s*['"]platform:ssl:manage['"]/)
  assert.match(router, /globalAdmin:\s*true/)
  assert.match(router, /tenantNeutral:\s*true/)
  assert.match(layout, /userStore\.globalAdmin[\s\S]*platform:ssl:manage/)
})
