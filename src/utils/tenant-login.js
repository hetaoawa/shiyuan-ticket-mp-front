export function firstQueryString(value) {
  if (typeof value === 'string') return value
  if (!Array.isArray(value)) return ''

  return value.find((item) => typeof item === 'string') ?? ''
}

export function selectInitialTenant({ requestedTenant, rememberedTenant, options } = {}) {
  const availableOptions = Array.isArray(options) ? options : []
  const hasTenant = (tenantCode) => availableOptions.some(
    (option) => option?.tenantCode === tenantCode,
  )

  if (requestedTenant) {
    return hasTenant(requestedTenant)
      ? { tenantCode: requestedTenant, requestedUnavailable: false }
      : { tenantCode: '', requestedUnavailable: true }
  }

  if (rememberedTenant && hasTenant(rememberedTenant)) {
    return { tenantCode: rememberedTenant, requestedUnavailable: false }
  }

  if (hasTenant('platform')) {
    return { tenantCode: 'platform', requestedUnavailable: false }
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
  return path === '/login' ? fallback : value
}

export function resolvePostLoginTarget(value, tenantCode) {
  return tenantCode === 'platform' ? '/system/tenant' : resolveSafeRedirect(value)
}
