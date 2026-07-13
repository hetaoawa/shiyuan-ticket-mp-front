import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const routerUrl = new URL('../src/router/index.js', import.meta.url)
const requestUrl = new URL('../src/utils/request.js', import.meta.url)

async function readSource(url) {
  return readFile(url, 'utf8')
}

test('router sends both unauthenticated branches through the full-route login helper', async () => {
  const source = await readSource(routerUrl)

  assert.match(
    source,
    /import\s*\{\s*buildLoginLocation\s*\}\s*from\s*['"]@\/utils\/tenant-login['"]/,
  )
  assert.equal((source.match(/next\(buildLoginLocation\(to\)\)/g) ?? []).length, 2)
  assert.doesNotMatch(source, /next\(`\/login\?redirect=\$\{to\.path\}`\)/)
})

test('401 handling snapshots the complete route before resetting state and replaces with its login location', async () => {
  const source = await readSource(requestUrl)
  const handle401 = source.match(/function\s+handle401\(message\)\s*\{([\s\S]*?)\n\}/)?.[1] ?? ''

  assert.match(
    source,
    /import\s*\{\s*buildLoginLocation\s*\}\s*from\s*['"]@\/utils\/tenant-login['"]/,
  )
  assert.match(handle401, /const\s+routeSnapshot\s*=\s*\{[\s\S]*?path:[\s\S]*?fullPath:[\s\S]*?query:/)
  assert.match(handle401, /const\s+loginLocation\s*=\s*buildLoginLocation\(routeSnapshot\)/)
  assert.match(handle401, /router\.replace\(loginLocation\)/)
  assert.doesNotMatch(handle401, /router\.push\(/)
})

test('401 handling ignores concurrent redirects but still reports and resets the first response on login', async () => {
  const source = await readSource(requestUrl)
  const handle401 = source.match(/function\s+handle401\(message\)\s*\{([\s\S]*?)\n\}/)?.[1] ?? ''

  const earlyGuardIndex = handle401.indexOf('if (isRedirectingToLogin) return')
  const lockIndex = handle401.indexOf('isRedirectingToLogin = true')
  const showErrorIndex = handle401.indexOf('showError(')
  const resetIndex = handle401.indexOf('userStore.resetState()')
  const loginBranchIndex = handle401.search(/routeSnapshot\.path\s*===\s*['"]\/login['"]/) 

  assert.ok(earlyGuardIndex >= 0 && earlyGuardIndex < lockIndex)
  assert.ok(showErrorIndex > lockIndex && showErrorIndex < loginBranchIndex)
  assert.ok(resetIndex > showErrorIndex && resetIndex < loginBranchIndex)
  assert.match(
    handle401,
    /if\s*\(routeSnapshot\.path\s*===\s*['"]\/login['"]\)\s*\{[\s\S]*?isRedirectingToLogin\s*=\s*false[\s\S]*?return/,
  )
})

test('401 redirect lock is released only after navigation settles or throws synchronously', async () => {
  const source = await readSource(requestUrl)
  const handle401 = source.match(/function\s+handle401\(message\)\s*\{([\s\S]*?)\n\}/)?.[1] ?? ''

  assert.match(
    handle401,
    /router\.replace\(loginLocation\)[\s\S]*?\.catch\(\(error\)\s*=>[\s\S]*?console\.error[\s\S]*?\.finally\(\(\)\s*=>\s*\{[\s\S]*?isRedirectingToLogin\s*=\s*false/,
  )
  assert.match(
    handle401,
    /try\s*\{[\s\S]*?router\.replace\(loginLocation\)[\s\S]*?\}\s*catch\s*\([^)]*\)\s*\{[\s\S]*?isRedirectingToLogin\s*=\s*false/,
  )
})

test('successful, blob and paginated responses cannot unlock an active 401 redirect', async () => {
  const source = await readSource(requestUrl)
  const successHandler = source.match(
    /service\.interceptors\.response\.use\(\s*\(response\)\s*=>\s*\{([\s\S]*?)\n\s*\},\s*\(error\)/,
  )?.[1] ?? ''

  assert.ok(successHandler.includes("response.config.responseType === 'blob'"))
  assert.ok(successHandler.includes('res.total !== undefined'))
  assert.ok(successHandler.includes('res.code === 200'))
  assert.doesNotMatch(successHandler, /isRedirectingToLogin\s*=\s*false/)
})
