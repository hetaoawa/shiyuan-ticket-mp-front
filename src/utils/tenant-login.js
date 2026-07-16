export function firstQueryString(value) {
  if (typeof value === 'string') return value
  if (!Array.isArray(value)) return ''

  return value.find((item) => typeof item === 'string') ?? ''
}

function normalizeTenantCode(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function validTenantOptions(options) {
  if (!Array.isArray(options)) return []

  const seen = new Set()
  const validOptions = []

  for (const option of options) {
    if (option === null || typeof option !== 'object') continue

    const tenantCode = typeof option.tenantCode === 'string' ? option.tenantCode.trim() : ''
    const normalizedCode = normalizeTenantCode(tenantCode)
    if (!normalizedCode || seen.has(normalizedCode)) continue

    seen.add(normalizedCode)
    validOptions.push({ tenantCode, normalizedCode })
  }

  return validOptions
}

export function selectInitialTenant({
  requestedTenant,
  redirectTenant,
  rememberedTenant,
  options,
} = {}) {
  const availableOptions = validTenantOptions(options)
  const findTenant = (tenantCode) => {
    const normalizedCode = normalizeTenantCode(tenantCode)
    return availableOptions.find((option) => option.normalizedCode === normalizedCode)
  }

  if (typeof requestedTenant === 'string' && requestedTenant.length > 0) {
    const requestedOption = findTenant(requestedTenant)
    return requestedOption
      ? { tenantCode: requestedOption.tenantCode, requestedUnavailable: false }
      : { tenantCode: '', requestedUnavailable: true }
  }

  if (typeof redirectTenant === 'string' && redirectTenant.length > 0) {
    const redirectOption = findTenant(redirectTenant)
    return redirectOption
      ? { tenantCode: redirectOption.tenantCode, requestedUnavailable: false }
      : { tenantCode: '', requestedUnavailable: true }
  }

  const rememberedOption = findTenant(rememberedTenant)
  if (rememberedOption && rememberedOption.normalizedCode !== 'platform') {
    return { tenantCode: rememberedOption.tenantCode, requestedUnavailable: false }
  }

  // 平台租户拥有跨租户管理权限，只能由 URL/重定向显式指定或由用户手动选择。
  // 普通登录入口默认选择首个业务租户，避免会话失效后误入 platform。
  const businessOption = availableOptions.find((option) => option.normalizedCode !== 'platform')
  if (businessOption) {
    return { tenantCode: businessOption.tenantCode, requestedUnavailable: false }
  }

  return {
    tenantCode: '',
    requestedUnavailable: false,
  }
}

export function extractTenantFromRedirect(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return ''

  try {
    const url = new URL(value, 'https://local.invalid')
    return url.searchParams.get('tenant') || url.searchParams.get('tenantCode') || ''
  } catch {
    return ''
  }
}

export function buildLoginLocation(route, activeTenantCode = '') {
  const redirect = typeof route?.fullPath === 'string' ? route.fullPath : '/'
  const tenant = normalizeTenantCode(activeTenantCode)
    || firstQueryString(route?.query?.tenant)
    || firstQueryString(route?.query?.tenantCode)
    || extractTenantFromRedirect(redirect)

  return {
    path: '/login',
    query: {
      ...(tenant ? { tenant } : {}),
      redirect,
    },
  }
}

export function resolveSafeRedirect(value, fallback = '/') {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    return fallback
  }

  const [path] = value.split(/[?#]/, 1)
  let decodedPath
  try {
    decodedPath = decodeURIComponent(path)
  } catch {
    return fallback
  }

  const normalizedPath = decodedPath.toLowerCase().replace(/\/+$/, '')
  return normalizedPath === '/login' ? fallback : value
}

export function resolvePostLoginTarget(value, tenantCode) {
  return normalizeTenantCode(tenantCode) === 'platform'
    ? '/system/tenant'
    : resolveSafeRedirect(value)
}
