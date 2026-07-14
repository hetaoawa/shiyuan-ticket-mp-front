export const REGISTERED_MENU_PATHS = Object.freeze([
  '/workorder/list',
  '/workorder/create',
  '/system/deadletter',
  '/system/audit',
  '/profile',
  '/settings',
  '/system/platform-ssl',
  '/system/tenant',
  '/system/user',
  '/system/role',
  '/system/menu',
])

function normalizeMenuPath(value) {
  if (typeof value !== 'string') return ''

  const path = value.trim().split(/[?#]/, 1)[0]
  if (!path || path === '/' || path.includes(':') || path.includes('*')) return ''

  const withLeadingSlash = path.startsWith('/') ? path : `/${path}`
  return withLeadingSlash.replace(/\/{2,}/g, '/').replace(/\/$/, '')
}

/**
 * Treat the backend tree as authorization data, never as a source of new routes.
 * Only registered MENU paths survive, and the first occurrence owns a path.
 */
export function normalizeBackendMenus(rawMenus, registeredPaths = REGISTERED_MENU_PATHS) {
  const allowedPaths = new Set(registeredPaths.map(normalizeMenuPath).filter(Boolean))
  const usedPaths = new Set()

  function visit(nodes) {
    if (!Array.isArray(nodes)) return []

    const result = []
    for (const node of nodes) {
      if (node === null || typeof node !== 'object') continue

      const menuType = typeof node.menuType === 'string'
        ? node.menuType.trim().toUpperCase()
        : ''
      if (menuType === 'BUTTON') continue

      if (menuType === 'DIR') {
        const children = visit(node.children)
        if (children.length > 0) result.push({ ...node, menuType, children })
        continue
      }
      if (menuType !== 'MENU') continue

      const path = normalizeMenuPath(node.path)
      if (!path || !allowedPaths.has(path) || usedPaths.has(path)) continue

      usedPaths.add(path)
      result.push({ ...node, menuType, path, children: [] })
    }
    return result
  }

  return visit(rawMenus)
}

export function findFirstMenuPath(menus, predicate = () => true) {
  if (!Array.isArray(menus)) return ''

  for (const menu of menus) {
    if (menu?.menuType === 'MENU'
      && typeof menu.path === 'string'
      && predicate(menu.path, menu)) return menu.path
    const childPath = findFirstMenuPath(menu?.children, predicate)
    if (childPath) return childPath
  }
  return ''
}

export function containsMenuPath(menus, path) {
  if (!Array.isArray(menus)) return false
  return menus.some((menu) => menu?.path === path || containsMenuPath(menu?.children, path))
}
