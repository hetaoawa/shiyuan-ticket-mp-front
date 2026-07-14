<template>
  <div class="login-container">
    <div class="login-panel">
      <div class="login-left">
        <img src="@/assets/project-logo.png" alt="Logo" class="login-logo" />
        <h1 class="login-title">中台工单流转系统</h1>
        <p class="login-subtitle">供应链工单流转管理平台</p>
      </div>
      <div class="login-right">
        <div class="login-form-wrapper">
          <h2 class="form-title">用户登录</h2>
          <el-form
            ref="loginFormRef"
            :model="loginForm"
            :rules="loginRules"
            label-width="0"
            size="large"
          >
            <el-form-item prop="tenantCode">
              <el-select
                ref="tenantSelectRef"
                v-model="loginForm.tenantCode"
                data-testid="tenant-select"
                placeholder="请选择租户"
                filterable
                :loading="tenantOptionsLoading"
                :disabled="tenantOptionsLoading || !!tenantOptionsError || tenantOptions.length === 0"
                @change="handleTenantChange"
                @keyup.enter.stop="focusUsername"
              >
                <el-option
                  v-for="option in tenantOptions"
                  :key="option.tenantCode"
                  :label="`${option.tenantName} (${option.tenantCode})`"
                  :value="option.tenantCode"
                />
              </el-select>
            </el-form-item>
            <div v-if="tenantOptionsLoading" class="tenant-options-status" role="status">
              正在加载租户列表...
            </div>
            <div v-else-if="tenantOptionsError" class="tenant-options-status is-error" role="alert">
              <span>{{ tenantOptionsError }}</span>
              <el-button link type="primary" @click="loadTenantOptions">重试</el-button>
            </div>
            <div
              v-else-if="tenantOptions.length === 0"
              class="tenant-options-status"
              role="status"
            >
              暂无可登录租户
            </div>
            <div
              v-if="requestedTenantUnavailable"
              class="tenant-options-status is-warning"
              role="alert"
            >
              当前链接指定的租户不可用，请重新选择
            </div>
            <el-form-item prop="username">
              <el-input
                ref="usernameInputRef"
                v-model="loginForm.username"
                data-testid="username-input"
                placeholder="请输入用户名"
                :prefix-icon="User"
                autocomplete="username"
                @keyup.enter.prevent="focusPassword"
              />
            </el-form-item>

            <el-form-item prop="password">
              <el-input
                ref="passwordInputRef"
                v-model="loginForm.password"
                data-testid="password-input"
                type="password"
                placeholder="请输入密码"
                :prefix-icon="Lock"
                show-password
                autocomplete="current-password"
                @keyup.enter="handleLogin"
              />
            </el-form-item>

            <el-form-item>
              <div class="remember-row">
                <el-checkbox v-model="rememberAccount">记住租户和账号</el-checkbox>
                <div class="remember-help" role="note">
                  仅在本机保存租户和账号；密码可由浏览器密码管理器安全保存。
                </div>
              </div>
            </el-form-item>

            <el-form-item>
              <el-button
                type="primary"
                data-testid="login-button"
                :loading="loginSubmitting"
                :disabled="loginDisabled"
                class="login-btn"
                @click="handleLogin"
              >
                登 录
              </el-button>
            </el-form-item>
          </el-form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { getLoginTenantOptions } from '@/api/auth'
import { parseRememberedLogin } from '@/utils/remembered-login'
import {
  extractTenantFromRedirect,
  firstQueryString,
  resolvePostLoginTarget,
  selectInitialTenant,
} from '@/utils/tenant-login'
import { ElMessage } from 'element-plus'
import { User, Lock } from '@element-plus/icons-vue'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const loginFormRef = ref(null)
const tenantSelectRef = ref(null)
const usernameInputRef = ref(null)
const passwordInputRef = ref(null)
const rememberAccount = ref(false)
const rememberedTenantCode = ref('')
const tenantOptions = ref([])
const tenantOptionsLoading = ref(false)
const tenantOptionsError = ref('')
const requestedTenantUnavailable = ref(false)
const loginSubmitting = ref(false)

const loginForm = reactive({
  tenantCode: '',
  username: '',
  password: '',
})

const loginRules = {
  tenantCode: [{ required: true, message: '请选择租户', trigger: 'change' }],
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

const loginDisabled = computed(() => tenantOptionsLoading.value
  || !!tenantOptionsError.value
  || tenantOptions.value.length === 0
  || requestedTenantUnavailable.value
  || loginSubmitting.value)

function loadSavedLogin() {
  loginForm.password = ''
  const saved = localStorage.getItem('rememberedLogin')
  if (saved === null) return

  const rememberedLogin = parseRememberedLogin(saved)
  if (!rememberedLogin) {
    localStorage.removeItem('rememberedLogin')
    rememberAccount.value = false
    return
  }

  rememberedTenantCode.value = rememberedLogin.tenantCode
  loginForm.username = rememberedLogin.username
  rememberAccount.value = true
  localStorage.setItem('rememberedLogin', JSON.stringify(rememberedLogin))
}

function replaceLoginTenant(tenantCode) {
  if (!tenantCode || firstQueryString(route.query.tenant) === tenantCode) return

  const normalizedQuery = { ...route.query }
  delete normalizedQuery.tenantCode

  void router.replace({
    path: '/login',
    query: {
      ...normalizedQuery,
      tenant: tenantCode,
    },
  })
}

function applyTenantSelection(selection) {
  loginForm.tenantCode = selection.tenantCode
  requestedTenantUnavailable.value = selection.requestedUnavailable
  if (selection.tenantCode) replaceLoginTenant(selection.tenantCode)
}

function applyInitialTenant() {
  const selection = selectInitialTenant({
    requestedTenant: firstQueryString(route.query.tenant),
    redirectTenant: extractTenantFromRedirect(firstQueryString(route.query.redirect)),
    rememberedTenant: rememberedTenantCode.value,
    options: tenantOptions.value,
  })

  applyTenantSelection(selection)
}

function applyRequestedTenant(requestedTenant) {
  applyTenantSelection(selectInitialTenant({
    requestedTenant,
    redirectTenant: extractTenantFromRedirect(firstQueryString(route.query.redirect)),
    rememberedTenant: rememberedTenantCode.value,
    options: tenantOptions.value,
  }))
}

async function loadTenantOptions() {
  tenantOptionsLoading.value = true
  tenantOptionsError.value = ''
  tenantOptions.value = []

  try {
    const res = await getLoginTenantOptions()
    tenantOptions.value = Array.isArray(res.data) ? res.data : []
    applyInitialTenant()
  } catch (error) {
    tenantOptionsError.value = '租户列表加载失败'
    loginForm.tenantCode = ''
    console.error('租户列表加载失败:', error)
  } finally {
    tenantOptionsLoading.value = false
    await nextTick()
    tenantSelectRef.value?.focus()
  }
}

function focusUsername() {
  if (!loginForm.tenantCode) return
  usernameInputRef.value?.focus()
}

function focusPassword() {
  passwordInputRef.value?.focus()
}

function handleTenantChange() {
  requestedTenantUnavailable.value = false
  replaceLoginTenant(loginForm.tenantCode)
}

function saveLoginInfo() {
  if (rememberAccount.value) {
    localStorage.setItem('rememberedLogin', JSON.stringify({
      tenantCode: loginForm.tenantCode,
      username: loginForm.username,
    }))
  } else {
    localStorage.removeItem('rememberedLogin')
  }
}

async function handleLogin() {
  if (loginDisabled.value) return

  const valid = await loginFormRef.value.validate().catch(() => false)
  if (!valid) return

  loginSubmitting.value = true
  try {
    await userStore.login(loginForm)
    saveLoginInfo()
    ElMessage.success('登录成功')
    await router.replace(resolvePostLoginTarget(route.query.redirect, loginForm.tenantCode))
  } catch (error) {
    console.error('登录失败:', error)
  } finally {
    loginSubmitting.value = false
  }
}

watch(
  () => firstQueryString(route.query.tenant),
  (requestedTenant) => {
    if (!tenantOptionsLoading.value && !tenantOptionsError.value && tenantOptions.value.length > 0) {
      applyRequestedTenant(requestedTenant)
    }
  },
)

onMounted(async () => {
  loadSavedLogin()
  await loadTenantOptions()
})
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f0f2f5;
}

.login-panel {
  display: flex;
  width: 820px;
  min-height: 440px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.login-left {
  width: 360px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #409eff 0%, #337ecc 100%);
  padding: 40px;
}

.login-logo {
  width: 80px;
  height: 80px;
  border-radius: 16px;
  object-fit: cover;
  margin-bottom: 24px;
}

.login-title {
  margin: 0;
  font-size: 26px;
  font-weight: 700;
  color: #fff;
}

.login-subtitle {
  margin: 8px 0 0;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.85);
}

.login-right {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
}

.login-form-wrapper {
  width: 100%;
  max-width: 340px;
}

.form-title {
  margin: 0 0 32px;
  font-size: 22px;
  font-weight: 600;
  color: #303133;
}

.login-btn {
  width: 100%;
}

.tenant-options-status {
  display: flex;
  min-height: 28px;
  margin: -12px 0 12px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: #909399;
  font-size: 13px;
}

.tenant-options-status.is-error {
  color: #f56c6c;
}

.tenant-options-status.is-warning {
  color: #e6a23c;
}

.remember-row {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.remember-help {
  margin-top: 4px;
  color: #909399;
  font-size: 12px;
  line-height: 1.5;
}
</style>
