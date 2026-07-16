import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const componentUrl = new URL('../src/components/OpaqueId.vue', import.meta.url)
const tableUrls = [
  '../src/views/workorder/list.vue',
  '../src/views/admin/users.vue',
  '../src/views/admin/tenants.vue',
  '../src/views/admin/roles.vue',
  '../src/views/audit/logs.vue',
  '../src/views/admin/deadletters.vue',
].map((path) => new URL(path, import.meta.url))

test('OpaqueId supports tooltip, keyboard copy, and single-line ellipsis', async () => {
  const source = await readFile(componentUrl, 'utf8')

  assert.match(source, /<el-tooltip[\s\S]*?:content="copyText"/)
  assert.match(source, /:tabindex="hasValue \? 0 : undefined"/)
  assert.match(source, /:role="hasValue \? 'button' : undefined"/)
  assert.match(source, /@keydown\.enter\.prevent="copy"/)
  assert.match(source, /@keydown\.space\.prevent="copy"/)
  assert.match(source, /navigator\?\.clipboard\?\.writeText/)
  assert.match(source, /document\.execCommand\('copy'\)/)
  assert.match(source, /white-space:\s*nowrap/)
  assert.match(source, /text-overflow:\s*ellipsis/)
  assert.match(source, /overflow:\s*hidden/)
})

test('business tables render opaque identifiers without Number coercion', async () => {
  for (const url of tableUrls) {
    const source = await readFile(url, 'utf8')
    assert.match(source, /import OpaqueId from ['"]@\/components\/OpaqueId\.vue['"]/)
    assert.match(source, /<OpaqueId\b/)
    assert.doesNotMatch(source, /Number\([^)]*(?:\.id|Id\b)/)
  }
})
