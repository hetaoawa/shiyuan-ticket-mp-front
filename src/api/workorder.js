import request from '@/utils/request'

// 创建工单
export function createWorkOrder(data) {
  return request({
    url: '/workorders',
    method: 'post',
    data,
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

// 派发工单
export function assignWorkOrder(id, assigneeId) {
  return request({
    url: `/workorders/${id}/assign`,
    method: 'post',
    params: { assigneeId },
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
