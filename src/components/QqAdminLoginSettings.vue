<template>
  <el-card v-if="isAdmin" shadow="never" style="margin-bottom: 20px" v-loading="loading">
    <template #header>QQ 账号与登录设置</template>
    <p>当前租户：{{ userStore.activeTenantName || '平台' }}。关闭密码登录后，货主和管理员须使用 QQ 登录，纯云仓管理员账号不受影响。</p>
    <el-switch v-model="passwordEnabled" :disabled="loading || !loaded" active-text="允许货主和管理员使用密码登录" @change="savePolicy" />
    <el-divider />
    <p>管理员可在此生成自己的 QQ 绑定链接。绑定成功后，其他用户的链接从“用户管理”发放。</p>
    <el-checkbox v-model="rebind">重新绑定我的 QQ（绑定成功后撤销旧会话）</el-checkbox>
    <el-button :disabled="loading" @click="createOwnLink">生成我的绑定链接</el-button>
    <el-input v-if="link" :model-value="link" readonly style="margin-top: 12px" @focus="$event.target.select()" />
    <p v-if="link">链接 24 小时有效，仅供本人使用；生成新链接会使旧链接失效。</p>
  </el-card>
</template>
<script setup>
import { computed, ref, watch } from 'vue'
import { useUserStore } from '@/stores/user'
import { getAuthPolicy, updateAuthPolicy, generateOwnQqLink } from '@/api/auth'
const userStore = useUserStore()
const isAdmin = computed(() => userStore.roles.some(role => ['SYSTEM_ADMIN', 'GLOBAL_SYSTEM_ADMIN'].includes(role)))
const loading = ref(false)
const loaded = ref(false)
const passwordEnabled = ref(true)
const rebind = ref(false)
const link = ref('')
async function load() {
  loaded.value = false
  if (!isAdmin.value || userStore.tenantSwitching) return
  const release = userStore.acquireTenantContextOperation()
  if (!release) return
  loading.value = true
  try { passwordEnabled.value = (await getAuthPolicy()).data.passwordLoginEnabled; loaded.value = true }
  catch (error) { console.error('读取登录设置失败', error) }
  finally { loading.value = false; release() }
}
async function savePolicy() {
  const release = userStore.acquireTenantContextOperation()
  if (!release) return
  loading.value = true
  try { passwordEnabled.value = (await updateAuthPolicy(passwordEnabled.value)).data.passwordLoginEnabled }
  catch (error) { console.error('保存登录设置失败', error); passwordEnabled.value = !passwordEnabled.value }
  finally { loading.value = false; release() }
}
async function createOwnLink() {
  const release = userStore.acquireTenantContextOperation()
  if (!release) return
  loading.value = true
  try { link.value = (await generateOwnQqLink(rebind.value)).data.url }
  catch (error) { console.error('生成 QQ 绑定链接失败', error) }
  finally { loading.value = false; release() }
}
watch(() => [userStore.activeTenantId, isAdmin.value, userStore.tenantSwitching], () => { link.value = ''; void load() }, { immediate: true })
</script>
