import request from '@/utils/request'

// 获取上传预签名 URL
export function getPresignUrl(data) {
  return request({
    url: '/api/files/presign',
    method: 'post',
    data,
  })
}

// 确认上传完成
export function confirmUpload(fileId) {
  return request({
    url: `/api/files/${fileId}/confirm`,
    method: 'post',
  })
}

// 获取下载预签名 URL
export function getDownloadUrl(fileId) {
  return request({
    url: `/api/files/${fileId}/download`,
    method: 'get',
  })
}

// 查询业务关联文件
export function getFilesByBiz(bizType, bizId) {
  return request({
    url: '/api/files',
    method: 'get',
    params: { bizType, bizId },
  })
}
