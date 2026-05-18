import request from '@/utils/request'

// 创建工单
export function createWorkOrder(data) {
  return request({
    url: '/workorders',
    method: 'post',
    data,
  })
}

// AI 智能解析
export function aiParse(text) {
  return request({
    url: '/ai/parse',
    method: 'post',
    data: { text },
  })
}

// 工单列表（分页）
export function getWorkOrderList(params) {
  return request({
    url: '/workorders',
    method: 'get',
    params,
  })
}

// 工单详情
export function getWorkOrderDetail(id) {
  return request({
    url: `/workorders/${id}`,
    method: 'get',
  })
}

// 派发工单（支持按用户或按角色派发）
export function assignWorkOrder(id, params) {
  return request({
    url: `/workorders/${id}/assign`,
    method: 'post',
    params,
  })
}

// 关闭工单
export function closeWorkOrder(id, resolution) {
  return request({
    url: `/workorders/${id}/close`,
    method: 'post',
    params: { resolution },
  })
}

// 驳回工单
export function rejectWorkOrder(id, reason) {
  return request({
    url: `/workorders/${id}/reject`,
    method: 'post',
    params: { reason },
  })
}

// 重新提交工单（REJECTED → PENDING）
export function resubmitWorkOrder(id, data) {
  return request({
    url: `/workorders/${id}/resubmit`,
    method: 'post',
    data,
  })
}

// 强制驳回工单（任意非CLOSED → REJECTED）
export function forceRejectWorkOrder(id, reason) {
  return request({
    url: `/workorders/${id}/force-reject`,
    method: 'post',
    params: { reason },
  })
}

// 批量派发工单
export function batchAssignWorkOrder(data) {
  return request({
    url: '/workorders/batch-assign',
    method: 'post',
    data,
  })
}

// 导出工单 CSV
export function exportWorkOrders(params) {
  return request({
    url: '/workorders/export',
    method: 'get',
    params,
    responseType: 'blob',
  })
}
