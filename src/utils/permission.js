/**
 * Return whether at least one required permission is granted.
 * Routes and directives share this helper so authorization semantics cannot drift.
 */
export function hasPermission(required, permissions = []) {
  if (required === undefined || required === null || required === '') return true

  const requiredPermissions = Array.isArray(required) ? required : [required]
  if (requiredPermissions.length === 0) return true

  const grantedPermissions = Array.isArray(permissions) ? permissions : []
  return requiredPermissions.some(permission => grantedPermissions.includes(permission))
}

/**
 * Check declarative route requirements against the identity returned by /auth/me.
 */
export function canAccessRoute(routeMeta = {}, authState = {}) {
  if (routeMeta.globalAdmin === true && authState.globalAdmin !== true) return false
  return hasPermission(routeMeta.permission, authState.permissions)
}
