import request from '@/utils/request'

// 获取工单评论列表
export function getComments(workOrderId) {
  return request({
    url: `/workorders/${workOrderId}/comments`,
    method: 'get',
  })
}

// 添加工单评论
export function addComment(workOrderId, data) {
  return request({
    url: `/workorders/${workOrderId}/comments`,
    method: 'post',
    data,
  })
}
