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

export function selectInitialTenant({ requestedTenant, rememberedTenant, options } = {}) {
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

  const rememberedOption = findTenant(rememberedTenant)
  if (rememberedOption) {
    return { tenantCode: rememberedOption.tenantCode, requestedUnavailable: false }
  }

  const platformOption = findTenant('platform')
  if (platformOption) {
    return { tenantCode: platformOption.tenantCode, requestedUnavailable: false }
  }

  return {
    tenantCode: availableOptions[0]?.tenantCode ?? '',
    requestedUnavailable: false,
  }
}

export function buildLoginLocation(route) {
  return {
    path: '/login',
    query: {
      tenant: firstQueryString(route?.query?.tenantCode),
      redirect: route?.fullPath,
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
