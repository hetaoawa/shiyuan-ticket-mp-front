<template>
  <div class="profile-container">
    <el-row :gutter="20">
      <!-- 左侧用户信息卡片 -->
      <el-col :span="8">
        <el-card shadow="never">
          <template #header>
            <span>个人信息</span>
          </template>
          <div class="user-info-card">
            <div class="avatar-section">
              <el-avatar :size="80" :icon="UserFilled" />
              <h3>{{ userStore.nickname || userStore.username }}</h3>
              <p class="username">@{{ userStore.username }}</p>
            </div>
            <el-divider />
            <div class="info-section">
              <div class="info-item">
                <span class="label">用户ID</span>
                <span class="value">{{ userStore.userId }}</span>
              </div>
              <div class="info-item">
                <span class="label">用户名</span>
                <span class="value">{{ userStore.username }}</span>
              </div>
              <div class="info-item">
                <span class="label">昵称</span>
                <span class="value">{{ userStore.nickname || '-' }}</span>
              </div>
              <div class="info-item">
                <span class="label">角色</span>
                <span class="value">
                  <el-tag v-for="role in userStore.roles" :key="role" size="small" style="margin-right: 4px;">
                    {{ role }}
                  </el-tag>
                  <span v-if="!userStore.roles.length">-</span>
                </span>
              </div>
              <div class="info-item">
                <span class="label">手机号</span>
                <span class="value">{{ userStore.phone || '未填写' }}</span>
              </div>
              <div class="info-item">
                <span class="label">邮箱</span>
                <span class="value">{{ userStore.email || '未填写' }}</span>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>

      <!-- 右侧设置区域 -->
      <el-col :span="16">
        <!-- 基本信息修改 -->
        <el-card shadow="never" style="margin-bottom: 20px;">
          <template #header>
            <span>基本信息</span>
          </template>
          <el-form :model="profileForm" :rules="profileRules" ref="profileFormRef" label-width="80px">
            <el-form-item label="用户名">
              <el-input v-model="profileForm.username" disabled />
            </el-form-item>
            <el-form-item label="昵称" prop="nickname">
              <el-input v-model="profileForm.nickname" placeholder="请输入昵称" />
            </el-form-item>
            <el-form-item label="手机号" prop="phone">
              <el-input v-model="profileForm.phone" placeholder="请输入手机号" />
            </el-form-item>
            <el-form-item label="邮箱" prop="email">
              <el-input v-model="profileForm.email" placeholder="请输入邮箱" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="profileLoading" @click="handleUpdateProfile">保存修改</el-button>
            </el-form-item>
          </el-form>
        </el-card>

        <!-- 修改密码 -->
        <el-card shadow="never">
          <template #header>
            <span>修改密码</span>
          </template>
          <el-form :model="pwdForm" :rules="pwdRules" ref="pwdFormRef" label-width="100px">
            <el-form-item label="当前密码" prop="oldPassword">
              <el-input v-model="pwdForm.oldPassword" type="password" placeholder="请输入当前密码" show-password />
            </el-form-item>
            <el-form-item label="新密码" prop="newPassword">
              <el-input v-model="pwdForm.newPassword" type="password" placeholder="请输入新密码" show-password />
            </el-form-item>
            <el-form-item label="确认新密码" prop="confirmPassword">
              <el-input v-model="pwdForm.confirmPassword" type="password" placeholder="请再次输入新密码" show-password />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="pwdLoading" @click="handleChangePassword">修改密码</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { UserFilled } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'
import request from '@/utils/request'

const userStore = useUserStore()

const profileLoading = ref(false)
const pwdLoading = ref(false)
const profileFormRef = ref(null)
const pwdFormRef = ref(null)

const profileForm = reactive({
  username: '',
  nickname: '',
  phone: '',
  email: ''
})

const profileRules = {
  nickname: [{ required: true, message: '请输入昵称', trigger: 'blur' }]
}

const pwdForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const validateConfirmPassword = (rule, value, callback) => {
  if (value !== pwdForm.newPassword) {
    callback(new Error('两次输入的密码不一致'))
  } else {
    callback()
  }
}

const pwdRules = {
  oldPassword: [{ required: true, message: '请输入当前密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能少于6位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    { validator: validateConfirmPassword, trigger: 'blur' }
  ]
}

// 加载用户信息
async function loadUserInfo() {
  try {
    const res = await request({
      url: '/auth/me',
      method: 'get'
    })
    profileForm.username = res.username
    profileForm.nickname = res.nickname || ''
    profileForm.phone = res.phone || ''
    profileForm.email = res.email || ''
  } catch (error) {
    console.error('获取用户信息失败', error)
  }
}

// 更新个人信息
async function handleUpdateProfile() {
  if (!profileFormRef.value) return
  await profileFormRef.value.validate()
  
  profileLoading.value = true
  try {
    await request({
      url: '/auth/profile',
      method: 'put',
      data: {
        nickname: profileForm.nickname,
        phone: profileForm.phone,
        email: profileForm.email
      }
    })
    ElMessage.success('个人信息更新成功')
    // 更新 Store 中的昵称
    userStore.nickname = profileForm.nickname
  } catch (error) {
    console.error('更新个人信息失败', error)
  } finally {
    profileLoading.value = false
  }
}

// 修改密码
async function handleChangePassword() {
  if (!pwdFormRef.value) return
  await pwdFormRef.value.validate()
  
  pwdLoading.value = true
  try {
    await request({
      url: '/auth/password',
      method: 'put',
      data: {
        oldPassword: pwdForm.oldPassword,
        newPassword: pwdForm.newPassword
      }
    })
    ElMessage.success('密码修改成功，请重新登录')
    // 清空密码表单
    pwdForm.oldPassword = ''
    pwdForm.newPassword = ''
    pwdForm.confirmPassword = ''
  } catch (error) {
    console.error('修改密码失败', error)
  } finally {
    pwdLoading.value = false
  }
}

onMounted(() => {
  loadUserInfo()
})
</script>

<style scoped>
.profile-container {
  padding: 20px;
}

.user-info-card {
  text-align: center;
}

.avatar-section {
  margin-bottom: 16px;
}

.avatar-section h3 {
  margin: 12px 0 4px;
  font-size: 18px;
}

.avatar-section .username {
  color: #909399;
  font-size: 14px;
}

.info-section {
  text-align: left;
}

.info-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.info-item:last-child {
  border-bottom: none;
}

.info-item .label {
  color: #909399;
  font-size: 14px;
}

.info-item .value {
  color: #303133;
  font-size: 14px;
}
</style>
