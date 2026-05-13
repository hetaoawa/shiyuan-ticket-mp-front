import request from '@/utils/request'

// 查询审计日志
export function getAuditLogs(params) {
  return request({
    url: '/audit-logs',
    method: 'get',
    params,
  })
}
