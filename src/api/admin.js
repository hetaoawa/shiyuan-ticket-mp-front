import request from '@/utils/request'

// 获取队列状态
export function getQueueStatus() {
  return request({
    url: '/admin/webhook/queue/status',
    method: 'get',
  })
}

// 死信列表
export function getDeadLetters(params) {
  return request({
    url: '/admin/deadletters',
    method: 'get',
    params,
  })
}

// 重试死信
export function retryDeadLetter(id) {
  return request({
    url: `/admin/deadletters/${id}/retry`,
    method: 'post',
  })
}

// 忽略死信
export function ignoreDeadLetter(id) {
  return request({
    url: `/admin/deadletters/${id}/ignore`,
    method: 'post',
  })
}
