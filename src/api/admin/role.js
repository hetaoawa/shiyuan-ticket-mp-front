import request from '@/utils/request'

// 获取角色列表
export function getRoleList(params) {
  return request({
    url: '/admin/roles',
    method: 'get',
    params,
  })
}

// 获取角色详情
export function getRoleDetail(id) {
  return request({
    url: `/admin/roles/${id}`,
    method: 'get',
  })
}

// 创建角色
export function createRole(data) {
  return request({
    url: '/admin/roles',
    method: 'post',
    data,
  })
}

// 更新角色
export function updateRole(id, data) {
  return request({
    url: `/admin/roles/${id}`,
    method: 'put',
    data,
  })
}

// 删除角色
export function deleteRole(id) {
  return request({
    url: `/admin/roles/${id}`,
    method: 'delete',
  })
}

// 获取角色权限
export function getRolePermissions(id) {
  return request({
    url: `/admin/roles/${id}/permissions`,
    method: 'get',
  })
}

// 分配权限
export function assignPermissions(id, data) {
  return request({
    url: `/admin/roles/${id}/permissions`,
    method: 'post',
    data,
  })
}
