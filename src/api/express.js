import request from '@/utils/request'

/**
 * 查询物流轨迹
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
