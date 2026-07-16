import request from '@/utils/request'

export function getIntegrationSettings() {
  return request({
    url: '/admin/settings/integrations',
    method: 'get',
  })
}

export function getIntegrationSetting(type) {
  return request({
    url: `/admin/settings/integrations/${encodeURIComponent(type)}`,
    method: 'get',
  })
}

export function updateIntegrationSettings(type, data) {
  return request({
    url: `/admin/settings/integrations/${encodeURIComponent(type)}`,
    method: 'put',
    data,
  })
}
