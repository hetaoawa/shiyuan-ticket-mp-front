import request from '@/utils/request'

// 获取租户选项列表
export function getTenantOptions() {
  return request({
    url: '/admin/tenants/options',
    method: 'get',
  })
}
