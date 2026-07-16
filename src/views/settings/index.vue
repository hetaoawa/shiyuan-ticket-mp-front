<template>
  <div class="settings-container">
    <el-card shadow="never">
      <template #header>
        <div class="page-header">
          <div>
            <div class="page-title">租户集成配置</div>
            <div class="page-subtitle">配置仅作用于当前租户，秘密字段不会回显。</div>
          </div>
          <el-tag type="info">{{ userStore.activeTenantName || '未选择租户' }}</el-tag>
        </div>
      </template>

      <el-alert
        v-if="loadFailed"
        title="集成配置加载失败，已禁止编辑。请重新加载后再操作。"
        type="error"
        :closable="false"
        show-icon
        class="settings-alert"
      />

      <el-tabs v-model="activeType" class="integration-tabs">
        <el-tab-pane
          v-for="definition in INTEGRATION_DEFINITIONS"
          :key="definition.type"
          :name="definition.type"
          :label="definition.label"
        >
          <div class="integration-summary">
            <div>
              <h3>{{ definition.label }}</h3>
              <p>{{ definition.description }}</p>
            </div>
            <el-space wrap>
              <el-tag :type="forms[definition.type].enabled ? 'success' : 'info'">
                {{ forms[definition.type].enabled ? '已启用' : '已停用' }}
              </el-tag>
              <el-tag :type="forms[definition.type].configured ? 'success' : 'warning'">
                {{ forms[definition.type].configured ? '配置完整' : '配置未完成' }}
              </el-tag>
              <el-tag :type="hasAnySecret(definition.type) ? 'success' : 'info'">
                {{ hasAnySecret(definition.type) ? '秘密已配置' : '秘密未配置' }}
              </el-tag>
              <el-tag type="info">版本 {{ forms[definition.type].configVersion }}</el-tag>
            </el-space>
          </div>

          <el-form
            v-loading="loading"
            :model="forms[definition.type]"
            label-width="190px"
            class="integration-form"
          >
            <el-form-item label="启用此集成">
              <el-switch
                v-model="forms[definition.type].enabled"
                :disabled="controlsDisabled(definition.type)"
              />
            </el-form-item>

            <template v-for="field in definition.fields" :key="field.key">
              <el-form-item v-if="field.secret" :label="field.label">
                <div class="secret-field">
                  <el-input
                    v-model="forms[definition.type].secretInputs[field.key]"
                    :type="field.multiline ? 'textarea' : 'password'"
                    :rows="field.multiline ? 4 : undefined"
                    :show-password="!field.multiline"
                    :disabled="controlsDisabled(definition.type)"
                    placeholder="留空保持现有值"
                    autocomplete="new-password"
                    @input="markSecretValue(definition.type, field.key)"
                  />
                  <el-button
                    type="danger"
                    plain
                    :disabled="controlsDisabled(definition.type)"
                    @click="markSecretClear(definition.type, field.key)"
                  >
                    明确清除
                  </el-button>
                </div>
                <div class="secret-state">
                  <el-tag
                    v-if="forms[definition.type].secretActions[field.key] === 'clear'"
                    type="danger"
                    size="small"
                  >
                    保存后清除
                  </el-tag>
                  <span v-else>
                    {{ secretHint(definition.type, field.key) }}；输入新值后将覆盖，留空保持。
                  </span>
                </div>
              </el-form-item>

              <el-form-item v-else :label="field.label">
                <el-switch
                  v-if="field.kind === 'boolean'"
                  v-model="forms[definition.type].config[field.key]"
                  :disabled="controlsDisabled(definition.type)"
                />
                <el-input-number
                  v-else-if="field.kind === 'number'"
                  v-model="forms[definition.type].config[field.key]"
                  :min="field.min"
                  :max="field.max"
                  :disabled="controlsDisabled(definition.type)"
                />
                <el-input
                  v-else
                  v-model="forms[definition.type].config[field.key]"
                  :placeholder="field.placeholder"
                  :disabled="controlsDisabled(definition.type)"
                />
              </el-form-item>
            </template>

            <el-form-item>
              <el-button
                v-if="canUpdateSettings"
                type="primary"
                :loading="savingType === definition.type"
                :disabled="controlsDisabled(definition.type)"
                @click="saveIntegration(definition.type)"
              >
                保存 {{ definition.label }}
              </el-button>
              <el-button
                v-if="loadFailed"
                :disabled="loading || Boolean(savingType)"
                @click="loadIntegrations"
              >
                重新加载
              </el-button>
              <span v-if="!canUpdateSettings" class="setting-help">当前账号仅可查看设置。</span>
            </el-form-item>
          </el-form>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useRoute } from 'vue-router'
import { getIntegrationSettings, updateIntegrationSettings } from '@/api/admin/settings'
import { useUserStore } from '@/stores/user'
import {
  INTEGRATION_DEFINITIONS,
  applyIntegrationResponse,
  buildIntegrationUpdatePayload,
  createIntegrationForm,
  isSecretConfigured,
  normalizeIntegrationCollection,
} from '@/utils/integration-settings'

const userStore = useUserStore()
const route = useRoute()
const activeType = ref(INTEGRATION_DEFINITIONS[0].type)
const loading = ref(false)
const savingType = ref('')
const ready = ref(false)
const loadFailed = ref(false)
const forms = reactive(Object.fromEntries(
  INTEGRATION_DEFINITIONS.map(({ type }) => [type, createIntegrationForm(type)]),
))

const canViewSettings = computed(() => userStore.permissions.includes('settings:view'))
const canUpdateSettings = computed(() => userStore.permissions.includes('settings:update'))

function controlsDisabled(type) {
  return !ready.value
    || !canUpdateSettings.value
    || loading.value
    || Boolean(savingType.value)
    || userStore.tenantSwitching
    || userStore.tenantContextBusy
    || !forms[type]
}

function resetForms() {
  for (const { type } of INTEGRATION_DEFINITIONS) {
    Object.assign(forms[type], createIntegrationForm(type))
  }
  ready.value = false
  loadFailed.value = false
}

function applyCollection(payload) {
  const integrations = normalizeIntegrationCollection(payload)
  for (const { type } of INTEGRATION_DEFINITIONS) {
    const integration = integrations.get(type)
    if (!integration) throw new TypeError(`响应缺少 ${type} 集成配置`)
    applyIntegrationResponse(forms[type], integration)
  }
}

async function loadIntegrations() {
  if (!canViewSettings.value
    || !userStore.activeTenantId
    || loading.value
    || savingType.value
    || userStore.tenantSwitching) return
  const releaseTenantContext = userStore.acquireTenantContextOperation()
  if (!releaseTenantContext) return

  loading.value = true
  loadFailed.value = false
  try {
    const response = await getIntegrationSettings()
    applyCollection(response.data)
    ready.value = true
  } catch (error) {
    ready.value = false
    loadFailed.value = true
    console.error('加载租户集成配置失败', error)
  } finally {
    loading.value = false
    releaseTenantContext()
  }
}

async function saveIntegration(type) {
  if (controlsDisabled(type)) return
  const releaseTenantContext = userStore.acquireTenantContextOperation()
  if (!releaseTenantContext) return

  savingType.value = type
  try {
    const response = await updateIntegrationSettings(type, buildIntegrationUpdatePayload(forms[type]))
    applyIntegrationResponse(forms[type], response.data)
    ElMessage.success(`${INTEGRATION_DEFINITIONS.find((item) => item.type === type)?.label}已保存`)
  } catch (error) {
    if (error?.response?.status === 409) {
      ElMessage.warning('配置已被其他管理员修改，已重新加载最新版本。')
      ready.value = false
      savingType.value = ''
      releaseTenantContext()
      await loadIntegrations()
      return
    }
    console.error(`保存 ${type} 集成配置失败`, error)
  } finally {
    if (savingType.value) {
      savingType.value = ''
      releaseTenantContext()
    }
  }
}

function markSecretValue(type, key) {
  const form = forms[type]
  form.secretActions[key] = form.secretInputs[key]?.trim() ? 'value' : 'keep'
}

function markSecretClear(type, key) {
  forms[type].secretInputs[key] = ''
  forms[type].secretActions[key] = 'clear'
}

function secretHint(type, key) {
  return isSecretConfigured(forms[type].secretConfigured, key) ? '当前已配置' : '当前未配置'
}

function hasAnySecret(type) {
  const state = forms[type].secretConfigured
  return typeof state === 'boolean' ? state : Object.values(state || {}).some(Boolean)
}

watch(() => userStore.activeTenantId, (tenantId, previousTenantId) => {
  if (String(tenantId ?? '') === String(previousTenantId ?? '')) return
  resetForms()
}, { flush: 'sync' })

watch(() => userStore.tenantSwitching, (switching, wasSwitching) => {
  if (!wasSwitching || switching) return
  if (route.name !== 'Settings' || !canViewSettings.value || !userStore.activeTenantId) return
  void loadIntegrations()
})

onMounted(() => {
  if (canViewSettings.value) void loadIntegrations()
})
</script>

<style scoped>
.settings-container {
  padding: 0;
}

.page-header,
.integration-summary,
.secret-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.page-title {
  font-size: 18px;
  font-weight: 600;
}

.page-subtitle,
.integration-summary p,
.secret-state,
.setting-help {
  color: #909399;
  font-size: 13px;
}

.page-subtitle {
  margin-top: 5px;
}

.settings-alert {
  margin-bottom: 18px;
}

.integration-tabs {
  min-height: 520px;
}

.integration-summary {
  align-items: flex-start;
  margin-bottom: 20px;
  padding: 14px 16px;
  background: #f8fafc;
  border-radius: 6px;
}

.integration-summary h3,
.integration-summary p {
  margin: 0;
}

.integration-summary p {
  margin-top: 6px;
}

.integration-form {
  max-width: 860px;
}

.secret-field {
  width: 100%;
  align-items: flex-start;
}

.secret-field .el-button {
  flex: none;
}

.secret-state {
  width: 100%;
  margin-top: 7px;
}

@media (max-width: 760px) {
  .page-header,
  .integration-summary,
  .secret-field {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
