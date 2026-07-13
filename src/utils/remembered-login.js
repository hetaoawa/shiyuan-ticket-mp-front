const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key)

/**
 * Parse legacy remembered-login data without ever returning a password.
 */
export function parseRememberedLogin(rawValue) {
  if (typeof rawValue !== 'string') return null

  let parsed
  try {
    parsed = JSON.parse(rawValue)
  } catch {
    return null
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null

  const hasTenantCode = hasOwn(parsed, 'tenantCode')
  const hasUsername = hasOwn(parsed, 'username')
  if (!hasTenantCode && !hasUsername) return null
  if (hasTenantCode && typeof parsed.tenantCode !== 'string') return null
  if (hasUsername && typeof parsed.username !== 'string') return null

  return {
    tenantCode: hasTenantCode ? parsed.tenantCode : '',
    username: hasUsername ? parsed.username : '',
  }
}
