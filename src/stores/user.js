import { defineStore } from 'pinia'
import { ref } from 'vue'
import request from '@/utils/request'

export const useUserStore = defineStore('user', () => {
  const token = ref(localStorage.getItem('token') || '')
  const userId = ref(null)
  const username = ref('')
  const nickname = ref('')
  const phone = ref('')
  const email = ref('')
  const tenantId = ref(null)
  const externalUserId = ref(null)
  const roles = ref([])
  const permissions = ref([])
  const menuTree = ref([])
  const routerLoaded = ref(false)

  function setToken(val) {
    token.value = val
    if (val) {
      localStorage.setItem('token', val)
    } else {
      localStorage.removeItem('token')
    }
  }

  async function login(loginData) {
    // backend expects form-urlencoded for login
    const res = await request({
      url: '/auth/login',
      method: 'post',
      data: new URLSearchParams(loginData),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    })
    setToken(res.token)
    userId.value = res.userId
    username.value = res.username
    tenantId.value = res.tenantId
    return res
  }

  async function getUserInfo() {
    const res = await request({
      url: '/auth/me',
      method: 'get'
    })
    userId.value = res.userId
    username.value = res.username
    nickname.value = res.nickname || res.username
    phone.value = res.phone || ''
    email.value = res.email || ''
    tenantId.value = res.tenantId
    externalUserId.value = res.externalUserId || null
    roles.value = res.roles || []
    permissions.value = res.permissions || []
    return res
  }

  async function getMenuTree() {
    const res = await request({
      url: '/menus',
      method: 'get'
    })
    menuTree.value = res.data || res || []
    return menuTree.value
  }

  function resetState() {
    token.value = ''
    userId.value = null
    username.value = ''
    nickname.value = ''
    phone.value = ''
    email.value = ''
    tenantId.value = null
    externalUserId.value = null
    roles.value = []
    permissions.value = []
    menuTree.value = []
    routerLoaded.value = false
    localStorage.removeItem('token')
  }

  async function logout() {
    try {
      await request({ url: '/auth/logout', method: 'post' })
    } catch (e) {
      // 即使后端登出失败也要清理前端状态
    }
    resetState()
  }

  function setRouterLoaded(val) {
    routerLoaded.value = val
  }

  return {
    token,
    userId,
    username,
    nickname,
    phone,
    email,
    tenantId,
    externalUserId,
    roles,
    permissions,
    menuTree,
    routerLoaded,
    setToken,
    login,
    getUserInfo,
    getMenuTree,
    resetState,
    logout,
    setRouterLoaded
  }
})
