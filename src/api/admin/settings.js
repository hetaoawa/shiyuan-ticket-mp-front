import request from '@/utils/request'

export const getQqConnectSettings = () => request.get('/admin/settings/qq-connect')
export const updateQqConnectSettings = (data) => request.put('/admin/settings/qq-connect', data)
export const getTenantBotGroups = () => request.get('/admin/settings/bot-groups')
export const updateTenantBotGroups = (groups, configVersion, tenantId) => request.put('/admin/settings/bot-groups', { groups, configVersion, tenantId })

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
