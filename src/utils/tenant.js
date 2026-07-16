/**
 * 格式化租户名称，同时将 ID 当作不透明字符串处理，避免雪花 ID 精度丢失。
 */
export function formatTenantLabel(tenantName, tenantId) {
  const id = tenantId === null || tenantId === undefined ? '' : String(tenantId)
  const name = typeof tenantName === 'string' ? tenantName.trim() : ''
  if (name && id) return `${name}（${id}）`
  if (name) return name
  if (id) return `租户 ${id}`
  return '未知租户'
}
