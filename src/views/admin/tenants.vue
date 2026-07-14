<template>
  <el-card shadow="never">
    <template #header>
      <div class="header">
        <div>
          <strong>租户管理</strong>
          <div v-if="userStore.globalAdmin && !userStore.activeTenantId" class="hint">
            请先创建或选择一个启用的业务租户，再进入工单与用户管理。
          </div>
          <div v-else-if="!userStore.globalAdmin" class="subtle">
            当前页面仅管理活动租户及其系统管理员。
          </div>
        </div>
        <el-button v-if="userStore.globalAdmin" type="primary" @click="openCreate">新增租户</el-button>
      </div>
    </template>

    <el-table :data="tenants" v-loading="loading" border>
      <el-table-column label="租户ID" min-width="160">
        <template #default="{ row }"><OpaqueId :value="row.id" /></template>
      </el-table-column>
      <el-table-column prop="tenantCode" label="租户编码" min-width="160" />
      <el-table-column prop="tenantName" label="租户名称" min-width="180" />
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="row.status === 1 ? 'success' : 'info'">
            {{ row.status === 1 ? '启用' : '停用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" min-width="300" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="userStore.globalAdmin && String(row.id) !== '0'"
            type="primary"
            link
            :loading="tenantActivatingId === String(row.id)"
            :disabled="row.status !== 1
              || String(row.id) === userStore.activeTenantId
              || tenantActivatingId !== null
              || userStore.tenantSwitching
              || userStore.tenantContextBusy"
            @click="activate(row)"
          >切换至此租户</el-button>
          <el-button
            v-if="String(row.id) !== '0'"
            type="primary"
            link
            :disabled="!canManageAdmins(row)"
            @click="openAdminDialog(row)"
          >设置系统管理员</el-button>
          <el-button v-if="userStore.globalAdmin" type="primary" link @click="openEdit(row)">编辑</el-button>
          <el-button
            v-if="userStore.globalAdmin && String(row.id) !== '0'"
            type="danger"
            link
            @click="remove(row)"
          >删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑租户' : '新增租户'" width="460px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="租户编码" prop="tenantCode">
          <el-input v-model="form.tenantCode" :disabled="Boolean(editingId)" />
        </el-form-item>
        <el-form-item label="租户名称" prop="tenantName">
          <el-input v-model="form.tenantName" />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio :value="1">启用</el-radio>
            <el-radio :value="0">停用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="adminDialogVisible"
      :title="`设置 ${adminTenant?.tenantName || ''} 的系统管理员`"
      width="520px"
    >
      <el-alert
        title="此操作替换该租户的系统管理员成员，不会改变这些用户的其他角色。"
        type="info"
        :closable="false"
        show-icon
        class="admin-alert"
      />
      <el-select
        v-model="selectedAdminIds"
        multiple
        filterable
        placeholder="请选择当前租户用户"
        class="admin-select"
      >
        <el-option
          v-for="user in adminUserOptions"
          :key="user.id"
          :label="user.nickname ? `${user.nickname} (${user.username})` : user.username"
          :value="user.id"
        />
      </el-select>
      <template #footer>
        <el-button @click="adminDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="adminSaving" @click="saveAdmins">保存</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  createTenant,
  deleteTenant,
  getTenantList,
  getTenantOptions,
  getTenantSystemAdmins,
  replaceTenantSystemAdmins,
  updateTenant,
} from '@/api/admin/tenant'
import { getSimpleUserList } from '@/api/admin/user'
import { useUserStore } from '@/stores/user'
import { synchronizeAdministratorAuthorization } from '@/utils/auth'
import OpaqueId from '@/components/OpaqueId.vue'

const router = useRouter()
const userStore = useUserStore()
const tenants = ref([])
const loading = ref(false)
const saving = ref(false)
const tenantActivatingId = ref(null)
const dialogVisible = ref(false)
const editingId = ref(null)
const formRef = ref(null)
const form = reactive({ tenantCode: '', tenantName: '', status: 1 })
const rules = {
  tenantCode: [{ required: true, message: '请输入租户编码', trigger: 'blur' }],
  tenantName: [{ required: true, message: '请输入租户名称', trigger: 'blur' }],
}

const adminDialogVisible = ref(false)
const adminSaving = ref(false)
const adminTenant = ref(null)
const adminUserOptions = ref([])
const selectedAdminIds = ref([])

async function load() {
  loading.value = true
  try {
    const response = userStore.globalAdmin ? await getTenantList() : await getTenantOptions()
    tenants.value = response.data || []
  } catch (error) {
    console.error('加载租户失败', error)
  } finally {
    loading.value = false
  }
}

function canManageAdmins(row) {
  if (String(row.id) === '0' || String(row.id) !== userStore.activeTenantId) return false
  return userStore.globalAdmin || userStore.roles.includes('SYSTEM_ADMIN')
}

function openCreate() {
  editingId.value = null
  Object.assign(form, { tenantCode: '', tenantName: '', status: 1 })
  dialogVisible.value = true
}

function openEdit(row) {
  editingId.value = String(row.id)
  Object.assign(form, {
    tenantCode: row.tenantCode,
    tenantName: row.tenantName,
    status: row.status,
  })
  dialogVisible.value = true
}

async function save() {
  if (!await formRef.value.validate().catch(() => false)) return
  saving.value = true
  try {
    if (editingId.value) await updateTenant(editingId.value, { ...form })
    else await createTenant({ ...form })
    dialogVisible.value = false
    await Promise.all([load(), userStore.loadAvailableTenants()])
    ElMessage.success('保存成功')
  } catch (error) {
    console.error('保存租户失败', error)
  } finally {
    saving.value = false
  }
}

async function activate(row) {
  const tenantId = String(row.id)
  if (tenantId === '0'
    || row.status !== 1
    || tenantId === userStore.activeTenantId
    || tenantActivatingId.value !== null
    || userStore.tenantSwitching
    || userStore.tenantContextBusy) return

  tenantActivatingId.value = tenantId
  try {
    await userStore.switchTenant(tenantId, {
      onUnrecoverable: () => router.replace('/login'),
    })
    ElMessage.success(`已切换至 ${row.tenantName}`)
    await router.replace({
      path: '/workorder/list',
      query: { tenant: userStore.activeTenantCode },
    })
  } catch (error) {
    console.error('切换租户失败', error)
  } finally {
    if (tenantActivatingId.value === tenantId) {
      tenantActivatingId.value = null
    }
  }
}

async function openAdminDialog(row) {
  if (!canManageAdmins(row)) {
    ElMessage.warning('请先切换至目标租户')
    return
  }
  const [usersResponse, adminsResponse] = await Promise.all([
    getSimpleUserList(),
    getTenantSystemAdmins(row.id),
  ])
  const users = (usersResponse.data || []).map(normalizeUser)
  const admins = (adminsResponse.data || []).map(normalizeUser)
  const merged = new Map(users.map((user) => [user.id, user]))
  admins.forEach((user) => merged.set(user.id, user))
  adminTenant.value = { ...row, id: String(row.id) }
  adminUserOptions.value = Array.from(merged.values())
  selectedAdminIds.value = admins.map((user) => user.id)
  adminDialogVisible.value = true
}

async function saveAdmins() {
  if (!adminTenant.value || !canManageAdmins(adminTenant.value)) return
  adminSaving.value = true
  try {
    await replaceTenantSystemAdmins(adminTenant.value.id, selectedAdminIds.value)
    await synchronizeAdministratorAuthorization({
      refreshIdentity: userStore.getUserInfo,
      isAuthorized: () => userStore.globalAdmin || userStore.roles.includes('SYSTEM_ADMIN'),
      clearAdministratorState: clearAdministratorState,
      invalidateAuthorizationState: userStore.invalidateAuthorizationState,
      leaveRestrictedPage: () => router.replace('/'),
      resetState: userStore.resetState,
      onUnrecoverable: () => router.replace('/login'),
    })
    ElMessage.success('系统管理员设置成功')
  } catch (error) {
    console.error('设置系统管理员失败', error)
  } finally {
    adminSaving.value = false
  }
}

function clearAdministratorState() {
  adminDialogVisible.value = false
  adminTenant.value = null
  adminUserOptions.value = []
  selectedAdminIds.value = []
}

function normalizeUser(user) {
  return { ...user, id: String(user.id) }
}

async function remove(row) {
  try {
    await ElMessageBox.confirm(`确认删除租户“${row.tenantName}”？`, '提示', { type: 'warning' })
    await deleteTenant(row.id)
    await Promise.all([load(), userStore.loadAvailableTenants()])
    ElMessage.success('删除成功')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') console.error('删除租户失败', error)
  }
}

onMounted(load)
</script>

<style scoped>
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.hint {
  margin-top: 6px;
  color: #e6a23c;
  font-size: 13px;
}

.subtle {
  margin-top: 6px;
  color: #909399;
  font-size: 13px;
}

.admin-alert {
  margin-bottom: 16px;
}

.admin-select {
  width: 100%;
}
</style>
