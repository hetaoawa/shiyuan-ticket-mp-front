import request from '@/utils/request'

// 获取租户选项列表
export function getTenantOptions() {
  return request({
    url: '/admin/tenants/options',
    method: 'get',
  })
}

export function getTenantList() {
  return request({ url: '/admin/tenants', method: 'get' })
}

export function createTenant(data) {
  return request({ url: '/admin/tenants', method: 'post', data })
}

export function updateTenant(id, data) {
  return request({ url: `/admin/tenants/${id}`, method: 'put', data })
}

export function deleteTenant(id) {
  return request({ url: `/admin/tenants/${id}`, method: 'delete' })
}

export function getTenantSystemAdmins(tenantId) {
  return request({ url: `/admin/tenants/${tenantId}/system-admins`, method: 'get' })
}

export function replaceTenantSystemAdmins(tenantId, userIds) {
  return request({
    url: `/admin/tenants/${tenantId}/system-admins`,
    method: 'put',
    data: { userIds },
  })
}
