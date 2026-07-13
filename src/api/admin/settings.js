import request from '@/utils/request'

export function getExternalIntegrationSettings() {
  return request({
    url: '/admin/settings/external-integrations',
    method: 'get',
  })
}

export function updateExternalIntegrationSettings(data) {
  return request({
    url: '/admin/settings/external-integrations',
    method: 'put',
    data,
  })
}
