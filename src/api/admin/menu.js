import request from '@/utils/request'

// 获取完整菜单树（管理员视图）
export function getMenuTree() {
  return request({
    url: '/api/menus/admin/tree',
    method: 'get',
  })
}

// 创建菜单
export function createMenu(data) {
  return request({
    url: '/api/menus/admin',
    method: 'post',
    data,
  })
}

// 更新菜单
export function updateMenu(id, data) {
  return request({
    url: `/api/menus/admin/${id}`,
    method: 'put',
    data,
  })
}

// 删除菜单
export function deleteMenu(id) {
  return request({
    url: `/api/menus/admin/${id}`,
    method: 'delete',
  })
}
