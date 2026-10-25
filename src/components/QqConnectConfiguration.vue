<template>
  <el-card shadow="never" class="qq-connect-card" v-loading="loading">
    <template #header>QQ 登录中间件（全平台）</template>
    <p>所有租户共用此配置，保存后生效。客户端密钥仅保存在后端，不会回显。</p>
    <el-alert v-if="failed" title="QQ 登录配置加载失败，请重新加载后编辑。" type="error" :closable="false" />
    <el-form :model="form" label-width="150px" :disabled="!ready || loading || saving">
      <el-form-item label="启用 QQ 登录"><el-switch v-model="form.enabled" /></el-form-item>
      <el-form-item label="中间件地址"><el-input v-model="form.url" placeholder="https://qq-bot.hetaoawa.cn" /></el-form-item>
      <el-form-item label="工单站点外部地址"><el-input v-model="form.publicBaseUrl" placeholder="https://ticket.example.com" /></el-form-item>
      <el-form-item label="中间件登记回调"><el-input :model-value="callbackUrl" readonly /></el-form-item>
      <el-form-item label="QQ 互联 App ID"><el-input v-model="form.appId" /></el-form-item>
      <el-form-item label="客户端标识"><span>ticket</span></el-form-item>
      <el-form-item label="客户端密钥">
        <div class="qq-secret">
          <el-input v-model="form.clientSecret" type="password" show-password autocomplete="new-password" placeholder="留空保持现有密钥" />
          <span>{{ configured ? '已配置' : '尚未配置' }}</span>
          <el-checkbox v-model="form.clearClientSecret">清除现有密钥</el-checkbox>
        </div>
      </el-form-item>
      <el-form-item label="允许本地 HTTP 回调"><el-switch v-model="form.allowLocalHttp" /></el-form-item>
      <el-form-item><el-button type="primary" :loading="saving" @click="save">保存 QQ 登录配置</el-button></el-form-item>
    </el-form>
    <el-button v-if="failed" @click="load">重新加载</el-button>
  </el-card>
</template>
<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getQqConnectSettings, updateQqConnectSettings } from '@/api/admin/settings'
const form = reactive({ enabled: false, url: 'https://qq-bot.hetaoawa.cn', publicBaseUrl: '', appId: '1905625642', allowLocalHttp: false, clientSecret: '', clearClientSecret: false, configVersion: 0 })
const loading = ref(false)
const saving = ref(false)
const ready = ref(false)
const failed = ref(false)
const configured = ref(false)
const callbackUrl = computed(() => form.publicBaseUrl.trim() ? `${form.publicBaseUrl.trim().replace(/\/+$/, '')}/api/auth/qq/callback` : '')
function apply(data) {
  Object.assign(form, data.config, { clientSecret: '', clearClientSecret: false })
  configured.value = data.clientSecretConfigured === true
  ready.value = true
}
async function load() {
  loading.value = true
  ready.value = false
  failed.value = false
  try { apply((await getQqConnectSettings()).data) }
  catch (error) { failed.value = true; console.error('读取 QQ 登录配置失败', error) }
  finally { loading.value = false }
}
async function save() {
  if (!ready.value || saving.value) return
  saving.value = true
  try { apply((await updateQqConnectSettings({ ...form })).data); ElMessage.success('QQ 登录配置已保存') }
  catch (error) {
    console.error('保存 QQ 登录配置失败', error)
    if (error.response?.status === 409) await load()
  } finally { saving.value = false }
}
onMounted(load)
</script>
<style scoped>
.qq-connect-card { margin-bottom: 20px; }
.qq-secret { display: flex; width: 100%; gap: 12px; flex-wrap: wrap; align-items: center; }
.qq-secret .el-input { flex: 1; min-width: 180px; }
</style>
