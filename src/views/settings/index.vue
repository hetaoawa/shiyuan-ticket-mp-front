<template>
  <div class="settings-container">
    <el-card shadow="never">
      <template #header>
        <span>系统设置</span>
      </template>

      <el-tabs v-model="activeTab">
        <!-- 基础设置 -->
        <el-tab-pane label="基础设置" name="basic">
          <el-form :model="basicForm" label-width="120px" style="max-width: 600px;">
            <el-form-item label="系统名称">
              <el-input v-model="basicForm.systemName" placeholder="请输入系统名称" />
            </el-form-item>
            <el-form-item label="系统Logo">
              <el-input v-model="basicForm.systemLogo" placeholder="请输入Logo URL" />
            </el-form-item>
            <el-form-item label="版权信息">
              <el-input v-model="basicForm.copyright" placeholder="请输入版权信息" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="handleSaveBasic">保存设置</el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <!-- 邮件设置 -->
        <el-tab-pane label="邮件设置" name="email">
          <el-form :model="emailForm" label-width="120px" style="max-width: 600px;">
            <el-form-item label="SMTP服务器">
              <el-input v-model="emailForm.smtpHost" placeholder="请输入SMTP服务器地址" />
            </el-form-item>
            <el-form-item label="SMTP端口">
              <el-input-number v-model="emailForm.smtpPort" :min="1" :max="65535" />
            </el-form-item>
            <el-form-item label="发件人邮箱">
              <el-input v-model="emailForm.fromEmail" placeholder="请输入发件人邮箱" />
            </el-form-item>
            <el-form-item label="邮箱密码">
              <el-input v-model="emailForm.password" type="password" placeholder="请输入邮箱密码" show-password />
            </el-form-item>
            <el-form-item label="启用SSL">
              <el-switch v-model="emailForm.enableSsl" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="handleSaveEmail">保存设置</el-button>
              <el-button @click="handleTestEmail">发送测试邮件</el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <!-- 存储设置 -->
        <el-tab-pane label="存储设置" name="storage">
          <el-form :model="storageForm" label-width="120px" style="max-width: 600px;">
            <el-form-item label="存储类型">
              <el-select v-model="storageForm.type" placeholder="请选择存储类型">
                <el-option label="本地存储" value="local" />
                <el-option label="阿里云OSS" value="aliyun" />
                <el-option label="腾讯云COS" value="tencent" />
                <el-option label="MinIO" value="minio" />
              </el-select>
            </el-form-item>
            <el-form-item label="Access Key">
              <el-input v-model="storageForm.accessKey" placeholder="请输入Access Key" />
            </el-form-item>
            <el-form-item label="Secret Key">
              <el-input v-model="storageForm.secretKey" type="password" placeholder="请输入Secret Key" show-password />
            </el-form-item>
            <el-form-item label="Bucket">
              <el-input v-model="storageForm.bucket" placeholder="请输入Bucket名称" />
            </el-form-item>
            <el-form-item label="Endpoint">
              <el-input v-model="storageForm.endpoint" placeholder="请输入Endpoint地址" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="handleSaveStorage">保存设置</el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <!-- 安全设置 -->
        <el-tab-pane label="安全设置" name="security">
          <el-form :model="securityForm" label-width="120px" style="max-width: 600px;">
            <el-form-item label="登录失败锁定">
              <el-switch v-model="securityForm.loginLock" />
            </el-form-item>
            <el-form-item label="最大失败次数" v-if="securityForm.loginLock">
              <el-input-number v-model="securityForm.maxLoginAttempts" :min="1" :max="10" />
            </el-form-item>
            <el-form-item label="锁定时间(分钟)" v-if="securityForm.loginLock">
              <el-input-number v-model="securityForm.lockDuration" :min="1" :max="60" />
            </el-form-item>
            <el-form-item label="Token过期时间(小时)">
              <el-input-number v-model="securityForm.tokenExpireHours" :min="1" :max="72" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="handleSaveSecurity">保存设置</el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <!-- 系统信息 -->
        <el-tab-pane label="系统信息" name="info">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="前端版本">{{ frontendVersionInfo.version }}</el-descriptions-item>
            <el-descriptions-item label="前端提交">{{ frontendVersionInfo.commit }}</el-descriptions-item>
            <el-descriptions-item label="后端版本">{{ backendVersionInfo.version }}</el-descriptions-item>
            <el-descriptions-item label="后端提交">{{ backendVersionInfo.commit }}</el-descriptions-item>
            <el-descriptions-item label="前端框架">Vue 3 + Element Plus</el-descriptions-item>
            <el-descriptions-item label="后端框架">Spring Boot</el-descriptions-item>
            <el-descriptions-item label="数据库">MySQL</el-descriptions-item>
            <el-descriptions-item label="JDK版本">{{ systemInfo.javaVersion || '-' }}</el-descriptions-item>
            <el-descriptions-item label="操作系统">{{ systemInfo.osName || '-' }}</el-descriptions-item>
            <el-descriptions-item label="服务器IP">{{ systemInfo.serverIp || '-' }}</el-descriptions-item>
            <el-descriptions-item label="启动时间">{{ systemInfo.startTime || '-' }}</el-descriptions-item>
          </el-descriptions>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getSystemVersion } from '@/api/version'
import { frontendVersionInfo } from '@/utils/version'

const activeTab = ref('basic')

const basicForm = reactive({
  systemName: '供应链工单流转管理平台',
  systemLogo: '',
  copyright: '© 2026 Shiyuan. All rights reserved.'
})

const emailForm = reactive({
  smtpHost: '',
  smtpPort: 465,
  fromEmail: '',
  password: '',
  enableSsl: true
})

const storageForm = reactive({
  type: 'local',
  accessKey: '',
  secretKey: '',
  bucket: '',
  endpoint: ''
})

const securityForm = reactive({
  loginLock: false,
  maxLoginAttempts: 5,
  lockDuration: 30,
  tokenExpireHours: 24
})

const systemInfo = reactive({
  javaVersion: '',
  osName: '',
  serverIp: '',
  startTime: ''
})

const backendVersionInfo = reactive({
  version: 'unknown',
  commit: 'unknown',
})

async function loadBackendVersion() {
  try {
    const response = await getSystemVersion()
    backendVersionInfo.version = response.data?.version || 'unknown'
    backendVersionInfo.commit = response.data?.commit?.slice(0, 7) || 'unknown'
  } catch (error) {
    console.warn('加载后端版本信息失败', error)
  }
}

// 保存基础设置
function handleSaveBasic() {
  ElMessage.success('基础设置保存成功')
}

// 保存邮件设置
function handleSaveEmail() {
  ElMessage.success('邮件设置保存成功')
}

// 发送测试邮件
function handleTestEmail() {
  ElMessage.info('测试邮件发送中...')
  // TODO: 调用后端接口发送测试邮件
}

// 保存存储设置
function handleSaveStorage() {
  ElMessage.success('存储设置保存成功')
}

// 保存安全设置
function handleSaveSecurity() {
  ElMessage.success('安全设置保存成功')
}

onMounted(() => {
  void loadBackendVersion()
})
</script>

<style scoped>
.settings-container {
  padding: 20px;
}
</style>
