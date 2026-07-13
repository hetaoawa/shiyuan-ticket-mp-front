import request from '@/utils/request'

// 登录
export function login(data) {
  return request({
    url: '/auth/login',
    method: 'post',
    data: new URLSearchParams(data),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  })
}

// 登出
export function logout() {
  return request({
    url: '/auth/logout',
    method: 'post',
  })
}

// 获取当前用户信息
export function getUserInfo() {
  return request({
    url: '/auth/me',
    method: 'get',
  })
}

// 获取当前用户菜单树
export function getMenuTree() {
  return request({
    url: '/menus',
    method: 'get',
  })
}

export function getLoginTenantOptions() {
  return request({
    url: '/auth/tenant-options',
    method: 'get',
  })
}

export function switchTenant(tenantId) {
  return request({
    url: '/auth/switch-tenant',
    method: 'post',
    data: { tenantId },
  })
}

// 修改当前用户密码
export function changePassword(data) {
  return request({
    url: '/auth/password',
    method: 'put',
    data,
  })
}

// 更新当前用户个人信息
export function updateProfile(data) {
  return request({
    url: '/auth/profile',
    method: 'put',
    data,
  })
}
