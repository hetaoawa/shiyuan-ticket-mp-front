<template>
  <el-card shadow="never" style="margin-bottom: 20px" v-loading="loading">
    <template #header>租户绑定群</template>
    <p>当前租户：{{ userStore.activeTenantName }}。每行填写一个 Bot 群 OpenID，可绑定多个群；一个群只能属于一个租户。</p>
    <p>该租户内已绑定 QQ、已启用且有创建工单权限的用户，都可在这些群提交工单。无需为每位用户单独绑定群。</p>
    <el-alert v-if="failed" title="群绑定加载失败，请重新加载后编辑。" type="error" :closable="false" style="margin-bottom: 12px" />
    <el-input v-model="groupsText" type="textarea" :rows="5" placeholder="每行一个群 OpenID，不能填写数字群号" :disabled="!canEdit" />
    <el-space style="margin-top: 12px">
      <el-button v-if="canUpdate" type="primary" :loading="saving" :disabled="!canEdit" @click="save">保存群绑定</el-button>
      <el-button :disabled="loading || saving || userStore.tenantSwitching" @click="load">重新加载</el-button>
    </el-space>
    <p>从列表移除群并保存即可解绑；如需改绑到其他租户，请先在原租户解绑。</p>
  </el-card>
</template>
<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { getTenantBotGroups, updateTenantBotGroups } from '@/api/admin/settings'
const userStore = useUserStore()
const groupsText = ref('')
const configVersion = ref(0)
const loading = ref(false)
const saving = ref(false)
const ready = ref(false)
const failed = ref(false)
const canUpdate = computed(() => userStore.permissions.includes('settings:update'))
const canEdit = computed(() => ready.value && canUpdate.value && !loading.value && !saving.value && !userStore.tenantSwitching)
function apply(data) {
  if (String(data.tenantId) !== String(userStore.activeTenantId)) {
    ready.value = false
    ElMessage.warning('当前租户已变化，请刷新页面后重试')
    throw new Error('群绑定响应的租户与当前界面不一致')
  }
  groupsText.value = (data.groups || []).join('\n')
  configVersion.value = Number(data.configVersion)
  ready.value = true
}
async function load() {
  if (!userStore.activeTenantId || userStore.tenantSwitching || loading.value || saving.value) return
  const release = userStore.acquireTenantContextOperation()
  if (!release) return
  loading.value = true
  ready.value = false
  failed.value = false
  try { apply((await getTenantBotGroups()).data) }
  catch (error) { failed.value = true; console.error('读取租户群绑定失败', error) }
  finally { loading.value = false; release() }
}
async function save() {
  if (!canEdit.value) return
  const release = userStore.acquireTenantContextOperation()
  if (!release) return
  saving.value = true
  let reload = false
  try {
    const groups = [...new Set(groupsText.value.split(/\s+/).filter(Boolean))]
    apply((await updateTenantBotGroups(groups, configVersion.value, userStore.activeTenantId)).data)
    ElMessage.success('租户群绑定已保存')
  } catch (error) {
    console.error('保存租户群绑定失败', error)
    if (error.response?.status === 409) reload = true
  } finally { saving.value = false; release() }
  if (reload) await load()
}
watch(() => [userStore.activeTenantId, userStore.tenantSwitching], () => {
  groupsText.value = ''
  ready.value = false
  failed.value = false
  if (!userStore.tenantSwitching) void load()
}, { immediate: true })
</script>
