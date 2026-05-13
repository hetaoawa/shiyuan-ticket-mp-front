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
