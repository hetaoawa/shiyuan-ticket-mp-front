import request from '@/utils/request'

// 获取上传预签名 URL
export function getPresignUrl(data) {
  return request({
    url: '/files/presign',
    method: 'post',
    data,
  })
}

// 确认上传完成
export function confirmUpload(fileId) {
  return request({
    url: `/files/${fileId}/confirm`,
    method: 'post',
  })
}

// 获取下载预签名 URL
export function getDownloadUrl(fileId) {
  return request({
    url: `/files/${fileId}/download`,
    method: 'get',
  })
}

// 查询业务关联文件
export function getFilesByBiz(bizType, bizId) {
  return request({
    url: '/files',
    method: 'get',
    params: { bizType, bizId },
  })
}

// 删除文件
export function deleteFile(fileId) {
  return request({
    url: `/files/${fileId}`,
    method: 'delete',
  })
}
