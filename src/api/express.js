import request from '@/utils/request'

/**
 * 查询物流轨迹（DB缓存优先）
 * @param {Object} data - { trackingNo, mobileLast4?, cpCode? }
 */
export function trackedExpress(data) {
  return request({
    url: '/express/tracked',
    method: 'post',
    data
  })
}

/**
 * 强制刷新物流轨迹（5min Redis缓存，不落库）
 * @param {Object} data - { trackingNo, mobileLast4?, cpCode? }
 */
export function traceExpress(data) {
  return request({
    url: '/express/trace',
    method: 'post',
    data
  })
}

/**
 * 获取快递公司列表
 */
export function getExpressCompanies() {
  return request({
    url: '/express/companies',
    method: 'get'
  })
}
