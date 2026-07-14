import request from '@/utils/request'

const BASE_URL = '/admin/platform/ssl'

export function getPlatformSslStatus() {
  return request({ url: BASE_URL, method: 'get' })
}

export function updatePlatformSslState(enabled) {
  return request({
    url: `${BASE_URL}/state`,
    method: 'put',
    data: { enabled: Boolean(enabled) },
  })
}

export function uploadPlatformSslCertificate({ certificate, privateKey, domain }) {
  const data = new FormData()
  data.append('certificate', certificate)
  data.append('privateKey', privateKey)
  if (domain?.trim()) data.append('domain', domain.trim())

  return request({
    url: `${BASE_URL}/certificates`,
    method: 'post',
    data,
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export function createPlatformSslDeployToken(data) {
  return request({
    url: `${BASE_URL}/deploy-tokens`,
    method: 'post',
    data,
  })
}

export function getPlatformSslOperations(limit = 20) {
  return request({
    url: `${BASE_URL}/operations`,
    method: 'get',
    params: { limit },
  })
}
