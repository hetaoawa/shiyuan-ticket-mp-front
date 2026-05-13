import request from '@/utils/request'

// 获取用户列表
export function getUserList(params) {
  return request({
    url: '/admin/users',
    method: 'get',
    params,
  })
}

// 获取用户详情
export function getUserDetail(id) {
  return request({
    url: `/admin/users/${id}`,
    method: 'get',
  })
}

// 创建用户
export function createUser(data) {
  return request({
    url: '/admin/users',
    method: 'post',
    data,
  })
}

// 更新用户
export function updateUser(id, data) {
  return request({
    url: `/admin/users/${id}`,
    method: 'put',
    data,
  })
}

// 删除用户
export function deleteUser(id) {
  return request({
    url: `/admin/users/${id}`,
    method: 'delete',
  })
}

// 重置密码
export function resetPassword(id, data) {
  return request({
    url: `/admin/users/${id}/reset-password`,
    method: 'post',
    data,
  })
}

// 获取用户角色
export function getUserRoles(id) {
  return request({
    url: `/admin/users/${id}/roles`,
    method: 'get',
  })
}

// 分配角色
export function assignRoles(id, data) {
  return request({
    url: `/admin/users/${id}/roles`,
    method: 'post',
    data,
  })
}
