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
            <el-form-item prop="username">
              <el-input
                v-model="loginForm.username"
                placeholder="请输入用户名"
                :prefix-icon="User"
              />
            </el-form-item>

            <el-form-item prop="password">
              <el-input
                v-model="loginForm.password"
                type="password"
                placeholder="请输入密码"
                :prefix-icon="Lock"
                show-password
                @keyup.enter="handleLogin"
              />
            </el-form-item>

            <el-form-item>
              <div class="remember-row">
                <el-checkbox v-model="rememberPassword">记住密码</el-checkbox>
              </div>
            </el-form-item>

            <el-form-item>
              <el-button
                type="primary"
                :loading="loading"
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
import { ref, reactive, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { ElMessage } from 'element-plus'
import { User, Lock } from '@element-plus/icons-vue'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const loginFormRef = ref(null)
const loading = ref(false)
const rememberPassword = ref(false)

const loginForm = reactive({
  username: '',
  password: '',
})

const loginRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

function loadSavedLogin() {
  const saved = localStorage.getItem('rememberedLogin')
  if (saved) {
    try {
      const { username, password } = JSON.parse(saved)
      loginForm.username = username || ''
      loginForm.password = password || ''
      rememberPassword.value = true
    } catch {
      // 解析失败则忽略
    }
  }
}

function saveLoginInfo() {
  if (rememberPassword.value) {
    localStorage.setItem('rememberedLogin', JSON.stringify({
      username: loginForm.username,
      password: loginForm.password,
    }))
  } else {
    localStorage.removeItem('rememberedLogin')
  }
}

async function handleLogin() {
  const valid = await loginFormRef.value.validate().catch(() => false)
  if (!valid) return

  loading.value = true
  try {
    await userStore.login(loginForm)
    saveLoginInfo()
    ElMessage.success('登录成功')

    const redirect = route.query.redirect || '/'
    router.push(redirect)
  } catch (error) {
    // 错误已在 request.js 中处理
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadSavedLogin()
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

.remember-row {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
