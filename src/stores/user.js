import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import * as authApi from '@/api/auth'
import { getTenantOptions } from '@/api/admin/tenant'
import { normalizeAuthContext, synchronizeTenantSwitch } from '@/utils/auth'
import { createTenantContextOperationGate } from '@/utils/tenant-context-gate'

export const useUserStore = defineStore('user', () => {
  const token = ref(localStorage.getItem('token') || '')
  const userId = ref(null)
  const username = ref('')
  const nickname = ref('')
  const phone = ref('')
  const email = ref('')
  const externalUserId = ref(null)
  const principalTenantId = ref(null)
  const activeTenantId = ref(null)
  const activeTenantName = ref(null)
  const globalAdmin = ref(false)
  const availableTenants = ref([])
  const roles = ref([])
  const permissions = ref([])
  const menuTree = ref([])
  const routerLoaded = ref(false)
  const tenantSwitching = ref(false)
  const tenantContextOperationCount = ref(0)
  const tenantId = computed(() => activeTenantId.value)
  const tenantContextBusy = computed(() => tenantContextOperationCount.value > 0)
  const tenantContextGate = createTenantContextOperationGate((state) => {
    tenantSwitching.value = state.tenantSwitching
    tenantContextOperationCount.value = state.operationCount
  })

  function setToken(value) {
    token.value = value || ''
    if (token.value) localStorage.setItem('token', token.value)
    else localStorage.removeItem('token')
  }

  function applyAuthContext(response) {
    const context = normalizeAuthContext(response)
    principalTenantId.value = context.principalTenantId
    activeTenantId.value = context.activeTenantId
    activeTenantName.value = context.activeTenantName
    globalAdmin.value = context.globalAdmin
  }

  async function login(loginData) {
    const response = await authApi.login(loginData)
    setToken(response.token)
    userId.value = response.userId === null || response.userId === undefined
      ? null : String(response.userId)
    username.value = response.username || ''
    applyAuthContext(response)
    return response
  }

  async function getUserInfo() {
    const response = await authApi.getUserInfo()
    userId.value = response.userId === null || response.userId === undefined
      ? null : String(response.userId)
    username.value = response.username || ''
    nickname.value = response.nickname || response.username || ''
    phone.value = response.phone || ''
    email.value = response.email || ''
    externalUserId.value = response.externalUserId || null
    roles.value = response.roles || []
    permissions.value = response.permissions || []
    applyAuthContext(response)
    return response
  }

  async function loadAvailableTenants() {
    const response = await getTenantOptions()
    availableTenants.value = (response.data || [])
      .filter((tenant) => String(tenant.id) !== '0' && tenant.status === 1)
      .map((tenant) => ({ ...tenant, id: String(tenant.id) }))
    return availableTenants.value
  }

  async function getMenuTree() {
    if (!activeTenantId.value) {
      menuTree.value = []
      return menuTree.value
    }
    const response = await authApi.getMenuTree()
    menuTree.value = response.data || response || []
    return menuTree.value
  }

  function clearTenantScopedState() {
    roles.value = []
    permissions.value = []
    invalidateAuthorizationState()
  }

  function invalidateAuthorizationState() {
    menuTree.value = []
    routerLoaded.value = false
  }

  function acquireTenantContextOperation() {
    return tenantContextGate.tryAcquireOperation()
  }

  async function switchTenant(tenant, { onUnrecoverable } = {}) {
    const finishTenantSwitch = tenantContextGate.tryBeginSwitch()
    if (!finishTenantSwitch) {
      throw new Error(tenantSwitching.value
        ? '租户切换正在进行，请稍后重试'
        : '当前存在租户相关操作，请等待操作完成后再切换租户')
    }
    const tenantIdValue = typeof tenant === 'object' ? tenant?.id : tenant
    try {
      await synchronizeTenantSwitch({
        tenantId: tenantIdValue,
        requestSwitch: authApi.switchTenant,
        applyContext: applyAuthContext,
        clearTenantState: clearTenantScopedState,
        refreshIdentity: getUserInfo,
        refreshTenants: loadAvailableTenants,
        refreshMenu: getMenuTree,
        resetState,
        onUnrecoverable,
        isTargetTenantActive: () => activeTenantId.value !== null
          && String(activeTenantId.value) === String(tenantIdValue),
      })
      routerLoaded.value = true
    } finally {
      finishTenantSwitch()
    }
  }

  function resetState() {
    setToken('')
    userId.value = null
    username.value = ''
    nickname.value = ''
    phone.value = ''
    email.value = ''
    externalUserId.value = null
    principalTenantId.value = null
    activeTenantId.value = null
    activeTenantName.value = null
    globalAdmin.value = false
    availableTenants.value = []
    clearTenantScopedState()
  }

  async function logout() {
    try {
      await authApi.logout()
    } catch {
      // The local session must still be cleared if the server is unavailable.
    }
    resetState()
  }

  function setRouterLoaded(value) {
    routerLoaded.value = value
  }

  return {
    token,
    userId,
    username,
    nickname,
    phone,
    email,
    externalUserId,
    tenantId,
    principalTenantId,
    activeTenantId,
    activeTenantName,
    globalAdmin,
    availableTenants,
    roles,
    permissions,
    menuTree,
    routerLoaded,
    tenantSwitching,
    tenantContextBusy,
    setToken,
    login,
    getUserInfo,
    loadAvailableTenants,
    getMenuTree,
    clearTenantScopedState,
    invalidateAuthorizationState,
    acquireTenantContextOperation,
    switchTenant,
    resetState,
    logout,
    setRouterLoaded,
  }
})
