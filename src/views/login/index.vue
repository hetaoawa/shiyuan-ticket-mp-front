<template>
  <div class="login-container">
    <el-card class="login-card">
      <template #header>
        <div class="login-header">
          <h2>云仓工单系统</h2>
          <p>柔性供应链管理平台</p>
        </div>
      </template>

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
            prefix-icon="User"
          />
        </el-form-item>

        <el-form-item prop="password">
          <el-input
            v-model="loginForm.password"
            type="password"
            placeholder="请输入密码"
            prefix-icon="Lock"
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
            登录
          </el-button>
        </el-form-item>
      </el-form>

      <div class="test-accounts">
        <p class="test-title">测试账号：</p>
        <el-space wrap>
          <el-tag
            v-for="account in testAccounts"
            :key="account.username"
            class="account-tag"
            @click="fillAccount(account)"
          >
            {{ account.username }} ({{ account.role }})
          </el-tag>
        </el-space>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { ElMessage } from 'element-plus'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const loginFormRef = ref(null)
const loading = ref(false)
const rememberPassword = ref(false)

// 登录表单
const loginForm = reactive({
  username: '',
  password: '',
})

// 表单验证规则
const loginRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

// 测试账号
const testAccounts = [
  { username: 'admin', password: 'admin123', role: '系统管理员' },
  { username: 'warehouse01', password: 'admin123', role: '云仓管理员' },
  { username: 'cargo01', password: 'admin123', role: '货主' },
]

// 填充测试账号
function fillAccount(account) {
  loginForm.username = account.username
  loginForm.password = account.password
}

// 加载保存的登录信息
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

// 保存登录信息
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

// 登录
async function handleLogin() {
  const valid = await loginFormRef.value.validate().catch(() => false)
  if (!valid) return

  loading.value = true
  try {
    await userStore.login(loginForm)
    saveLoginInfo()
    ElMessage.success('登录成功')

    // 跳转到之前的页面或首页
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
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.login-card {
  width: 420px;
  border-radius: 12px;
}

.login-header {
  text-align: center;
}

.login-header h2 {
  margin: 0;
  font-size: 24px;
  color: #303133;
}

.login-header p {
  margin: 8px 0 0;
  font-size: 14px;
  color: #909399;
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

.test-accounts {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #ebeef5;
}

.test-title {
  font-size: 13px;
  color: #909399;
  margin: 0 0 8px;
}

.account-tag {
  cursor: pointer;
  transition: all 0.2s;
}

.account-tag:hover {
  transform: scale(1.05);
}
</style>
