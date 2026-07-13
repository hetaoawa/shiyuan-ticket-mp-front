<template>
  <div class="settings-container">
    <el-card shadow="never">
      <template #header>
        <span>系统设置</span>
      </template>

      <el-tabs v-model="activeTab">
        <el-tab-pane label="外部集成" name="external">
          <el-alert
            v-if="integrationLoadFailed"
            title="外部集成设置加载失败，已禁用编辑。请重试后再操作。"
            type="error"
            :closable="false"
            show-icon
            class="settings-alert"
          />
          <el-form
            v-loading="integrationLoading"
            :model="integrationForm"
            label-width="220px"
            class="integration-form"
          >
            <el-form-item label="允许外部递交工单">
              <el-switch
                v-model="integrationForm.externalInboundEnabled"
                :disabled="integrationControlsDisabled"
              />
              <span class="setting-help">关闭后，外部入站请求仍会验签，但不会解析或创建工单。</span>
            </el-form-item>
            <el-form-item label="处理完毕后回调外部系统">
              <el-switch
                v-model="integrationForm.externalCloseCallbackEnabled"
                :disabled="integrationControlsDisabled"
              />
              <span class="setting-help">关闭后，工单仍可正常关闭，但不会推送完成回调。</span>
            </el-form-item>
            <el-form-item label="派发工单时推送钉钉">
              <el-switch
                v-model="integrationForm.dingTalkPushEnabled"
                :disabled="integrationControlsDisabled"
              />
              <span class="setting-help">关闭后，派发仍会成功，但不会发送钉钉通知。</span>
            </el-form-item>
            <el-form-item>
              <el-button
                v-if="canUpdateSettings"
                type="primary"
                :loading="integrationSaving"
                :disabled="!integrationReady || integrationLoading || integrationSaving"
                @click="saveIntegrationSettings"
              >
                保存外部集成设置
              </el-button>
              <el-button
                v-if="integrationLoadFailed"
                :disabled="integrationLoading || integrationSaving"
                @click="loadIntegrationSettings"
              >
                重新加载
              </el-button>
              <span v-if="!canUpdateSettings" class="setting-help">当前账号仅可查看设置。</span>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="基础设置" name="basic">
          <el-alert
            title="基础设置当前仅供查看，尚未提供持久化接口。"
            type="info"
            :closable="false"
            class="settings-alert"
          />
          <el-descriptions :column="1" border class="readonly-settings">
            <el-descriptions-item label="系统名称">供应链工单流转管理平台</el-descriptions-item>
            <el-descriptions-item label="版权信息">© 2026 Shiyuan. All rights reserved.</el-descriptions-item>
          </el-descriptions>
        </el-tab-pane>

        <el-tab-pane label="邮件设置" name="email">
          <el-alert
            title="邮件设置尚未提供持久化接口，当前不可编辑。"
            type="info"
            :closable="false"
          />
        </el-tab-pane>

        <el-tab-pane label="存储设置" name="storage">
          <el-alert
            title="存储设置尚未提供持久化接口，当前不可编辑。"
            type="info"
            :closable="false"
          />
        </el-tab-pane>

        <el-tab-pane label="安全设置" name="security">
          <el-alert
            title="安全设置尚未提供持久化接口，当前不可编辑。"
            type="info"
            :closable="false"
          />
        </el-tab-pane>

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
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useRoute } from 'vue-router'
import {
  getExternalIntegrationSettings,
  updateExternalIntegrationSettings,
} from '@/api/admin/settings'
import { getSystemVersion } from '@/api/version'
import { useUserStore } from '@/stores/user'
import { frontendVersionInfo } from '@/utils/version'

const userStore = useUserStore()
const route = useRoute()
const activeTab = ref('external')
const integrationLoading = ref(false)
const integrationSaving = ref(false)
const integrationReady = ref(false)
const integrationLoadFailed = ref(false)
const integrationSnapshot = ref(null)

const integrationForm = reactive({
  externalInboundEnabled: true,
  externalCloseCallbackEnabled: true,
  dingTalkPushEnabled: true,
})

const canViewSettings = computed(() => userStore.permissions.includes('settings:view'))
const canUpdateSettings = computed(() => userStore.permissions.includes('settings:update'))
const integrationControlsDisabled = computed(() => !integrationReady.value
  || !canUpdateSettings.value
  || integrationLoading.value
  || integrationSaving.value
  || userStore.tenantSwitching
  || userStore.tenantContextBusy)

const systemInfo = reactive({
  javaVersion: '',
  osName: '',
  serverIp: '',
  startTime: '',
})

const backendVersionInfo = reactive({
  version: 'unknown',
  commit: 'unknown',
})

function normalizeIntegrationSettings(data) {
  const fields = [
    'externalInboundEnabled',
    'externalCloseCallbackEnabled',
    'dingTalkPushEnabled',
  ]
  if (!data || fields.some((field) => typeof data[field] !== 'boolean')) {
    throw new TypeError('外部集成设置响应缺少完整的布尔字段')
  }
  return Object.fromEntries(fields.map((field) => [field, data[field]]))
}

function applyIntegrationSettings(data) {
  const settings = normalizeIntegrationSettings(data)
  Object.assign(integrationForm, settings)
  integrationSnapshot.value = { ...settings }
}

function invalidateIntegrationSettings() {
  integrationReady.value = false
  integrationSnapshot.value = null
  integrationLoadFailed.value = false
}

async function loadIntegrationSettings() {
  if (!canViewSettings.value
    || !userStore.activeTenantId
    || integrationLoading.value
    || integrationSaving.value
    || userStore.tenantSwitching) return
  const releaseTenantContext = userStore.acquireTenantContextOperation()
  if (!releaseTenantContext) return
  integrationLoading.value = true
  integrationLoadFailed.value = false
  try {
    const response = await getExternalIntegrationSettings()
    applyIntegrationSettings(response.data)
    integrationReady.value = true
  } catch (error) {
    integrationReady.value = false
    integrationLoadFailed.value = true
    console.error('加载外部集成设置失败', error)
  } finally {
    integrationLoading.value = false
    releaseTenantContext()
  }
}

async function saveIntegrationSettings() {
  if (!canUpdateSettings.value
    || !integrationReady.value
    || integrationSaving.value
    || userStore.tenantSwitching) return
  const releaseTenantContext = userStore.acquireTenantContextOperation()
  if (!releaseTenantContext) return
  const payload = {
    externalInboundEnabled: Boolean(integrationForm.externalInboundEnabled),
    externalCloseCallbackEnabled: Boolean(integrationForm.externalCloseCallbackEnabled),
    dingTalkPushEnabled: Boolean(integrationForm.dingTalkPushEnabled),
  }
  integrationSaving.value = true
  try {
    const response = await updateExternalIntegrationSettings(payload)
    applyIntegrationSettings(response.data)
    ElMessage.success('外部集成设置已保存')
  } catch (error) {
    if (integrationSnapshot.value) {
      Object.assign(integrationForm, integrationSnapshot.value)
    }
    console.error('保存外部集成设置失败', error)
  } finally {
    integrationSaving.value = false
    releaseTenantContext()
  }
}

async function loadBackendVersion() {
  try {
    const response = await getSystemVersion()
    backendVersionInfo.version = response.data?.version || 'unknown'
    backendVersionInfo.commit = response.data?.commit?.slice(0, 7) || 'unknown'
  } catch (error) {
    console.warn('加载后端版本信息失败', error)
  }
}

watch(() => userStore.activeTenantId, (tenantId, previousTenantId) => {
  if (String(tenantId ?? '') === String(previousTenantId ?? '')) return
  invalidateIntegrationSettings()
}, { flush: 'sync' })

watch(() => userStore.tenantSwitching, (switching, wasSwitching) => {
  if (!wasSwitching || switching) return
  if (route.name !== 'Settings' || !canViewSettings.value || !userStore.activeTenantId) return
  void loadIntegrationSettings()
})

onMounted(() => {
  if (canViewSettings.value) {
    void loadIntegrationSettings()
  }
  void loadBackendVersion()
})
</script>

<style scoped>
.settings-container {
  padding: 20px;
}

.settings-alert {
  margin-bottom: 20px;
}

.integration-form {
  max-width: 760px;
}

.setting-help {
  margin-left: 12px;
  color: #909399;
  font-size: 13px;
}

.readonly-settings {
  max-width: 760px;
}
</style>
