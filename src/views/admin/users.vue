<template>
  <div class="user-manage">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span>用户管理</span>
          <el-button type="primary" @click="showAddDialog" v-hasPermi="['user:create']">
            <el-icon><Plus /></el-icon>
            新增用户
          </el-button>
        </div>
      </template>

      <!-- 搜索栏 -->
      <el-form :inline="true" :model="searchForm" class="search-form">
        <el-form-item label="用户名">
          <el-input v-model="searchForm.username" placeholder="请输入用户名" clearable />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="全部" clearable class="status-select">
            <el-option label="启用" :value="1" />
            <el-option label="禁用" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">搜索</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>

      <!-- 用户列表 -->
      <el-table :data="userList" v-loading="loading" border>
        <el-table-column label="用户ID" width="140">
          <template #default="{ row }"><OpaqueId :value="row.id" /></template>
        </el-table-column>
        <el-table-column prop="username" label="用户名" width="120" />
        <el-table-column prop="nickname" label="昵称" width="120" />
        <el-table-column prop="phone" label="手机号" width="130">
          <template #default="{ row }">
            {{ row.phone || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="email" label="邮箱" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.email || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="外部用户ID" width="150">
          <template #default="{ row }">
            <OpaqueId :value="row.externalUserId" />
          </template>
        </el-table-column>
        <el-table-column label="租户ID" width="150">
          <template #default="{ row }">
            <OpaqueId :value="row.tenantId" :label="getTenantLabel(row.tenantId)" />
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'danger'" size="small">
              {{ row.status === 1 ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="170" />
        <el-table-column label="操作" fixed="right" width="200">
          <template #default="{ row }">
            <el-button type="primary" link @click="showEditDialog(row)" v-hasPermi="['user:update']">编辑</el-button>
            <el-button type="primary" link @click="showResetPwdDialog(row)" v-hasPermi="['user:update']">重置密码</el-button>
            <el-button type="danger" link @click="handleDelete(row)" v-hasPermi="['user:delete']">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <el-pagination
        v-if="total > 0"
        v-model:current-page="searchForm.pageNum"
        v-model:page-size="searchForm.pageSize"
        :total="total"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
        style="margin-top: 16px; justify-content: flex-end;"
      />
    </el-card>

    <!-- 新增/编辑用户弹窗 -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="500px">
      <el-form :model="userForm" :rules="rules" ref="userFormRef" label-width="90px">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="userForm.username" placeholder="请输入用户名" :disabled="isEdit" />
        </el-form-item>
        <el-form-item label="昵称" prop="nickname">
          <el-input v-model="userForm.nickname" placeholder="请输入昵称" />
        </el-form-item>
        <el-form-item label="手机号" prop="phone">
          <el-input v-model="userForm.phone" placeholder="请输入手机号" clearable />
        </el-form-item>
        <el-form-item label="邮箱" prop="email">
          <el-input v-model="userForm.email" placeholder="请输入邮箱" clearable />
        </el-form-item>
        <el-form-item label="外部用户ID" prop="externalUserId">
          <el-input v-model="userForm.externalUserId" placeholder="外部系统用户ID（选填）" clearable />
        </el-form-item>
        <el-form-item label="租户">
          <el-input :model-value="getTenantLabel(userForm.tenantId)" disabled />
        </el-form-item>
        <el-form-item v-if="!isEdit" label="密码" prop="password">
          <el-input v-model="userForm.password" type="password" placeholder="请输入密码" />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="userForm.status">
            <el-radio :value="1">启用</el-radio>
            <el-radio :value="0">禁用</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="userForm.roleIds" multiple placeholder="请选择角色">
            <el-option
              v-for="role in roleOptions"
              :key="role.id"
              :label="role.roleName"
              :value="role.id"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>

    <!-- 重置密码弹窗 -->
    <el-dialog v-model="resetPwdVisible" title="重置密码" width="400px">
      <el-form :model="resetPwdForm" label-width="80px">
        <el-form-item label="新密码" required>
          <el-input v-model="resetPwdForm.password" type="password" placeholder="请输入新密码" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="resetPwdVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleResetPwd">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { Plus } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getUserList, createUser, updateUser, deleteUser, resetPassword, getUserRoles, assignRoles } from '@/api/admin/user'
import { getRoleList } from '@/api/admin/role'
import { formatTenantLabel } from '@/utils/tenant'
import { useUserStore } from '@/stores/user'
import OpaqueId from '@/components/OpaqueId.vue'

const userStore = useUserStore()
const loading = ref(false)
const submitLoading = ref(false)
const userList = ref([])
const total = ref(0)
const roleOptions = ref([])
const RESERVED_ADMIN_ROLES = new Set(['SYSTEM_ADMIN', 'GLOBAL_SYSTEM_ADMIN'])

const searchForm = reactive({
  username: '',
  status: '',
  pageNum: 1,
  pageSize: 10
})

const dialogVisible = ref(false)
const dialogTitle = ref('新增用户')
const isEdit = ref(false)

const userFormRef = ref(null)
const userForm = reactive({
  id: null,
  username: '',
  nickname: '',
  phone: '',
  email: '',
  externalUserId: '',
  password: '',
  status: 1,
  tenantId: null,
  roleIds: []
})

const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  nickname: [{ required: true, message: '请输入昵称', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

const resetPwdVisible = ref(false)
const resetPwdForm = reactive({
  userId: null,
  password: ''
})

// 加载用户列表
async function loadUserList() {
  loading.value = true
  try {
    const params = {
      page: searchForm.pageNum,
      pageSize: searchForm.pageSize,
    }
    if (searchForm.username) params.username = searchForm.username
    if (searchForm.status !== '' && searchForm.status !== null && searchForm.status !== undefined) params.status = searchForm.status
    const res = await getUserList(params)
    userList.value = res.data?.records || res.data || []
    total.value = Number(res.data?.total) || 0
  } catch (error) {
    console.error('加载用户列表失败', error)
  } finally {
    loading.value = false
  }
}

// 加载角色选项
async function loadRoleOptions() {
  try {
    const res = await getRoleList()
    roleOptions.value = (res.data || []).filter(role => !RESERVED_ADMIN_ROLES.has(role.roleCode))
  } catch (error) {
    console.error('加载角色列表失败', error)
  }
}

function getTenantLabel(tenantId) {
  if (tenantId === null || tenantId === undefined) return '-'
  const id = String(tenantId)
  const name = id === userStore.activeTenantId ? userStore.activeTenantName : null
  return formatTenantLabel(name, id)
}

function getActiveTenantId() {
  return userStore.activeTenantId === null || userStore.activeTenantId === undefined
    ? null
    : String(userStore.activeTenantId)
}

function handleSearch() {
  searchForm.pageNum = 1
  loadUserList()
}

function handleReset() {
  searchForm.username = ''
  searchForm.status = ''
  searchForm.pageNum = 1
  loadUserList()
}

function handleSizeChange(size) {
  searchForm.pageSize = size
  loadUserList()
}

function handleCurrentChange(page) {
  searchForm.pageNum = page
  loadUserList()
}

function showAddDialog() {
  isEdit.value = false
  dialogTitle.value = '新增用户'
  resetForm()
  dialogVisible.value = true
}

async function showEditDialog(row) {
  isEdit.value = true
  dialogTitle.value = '编辑用户'
  Object.assign(userForm, {
    id: row.id,
    username: row.username,
    nickname: row.nickname,
    phone: row.phone,
    email: row.email,
    externalUserId: row.externalUserId || '',
    status: row.status,
    tenantId: row.tenantId === null || row.tenantId === undefined
      ? getActiveTenantId()
      : String(row.tenantId),
    roleIds: []
  })
  
  // 获取用户角色
  try {
    const res = await getUserRoles(row.id)
    const assignableIds = new Set(roleOptions.value.map(role => String(role.id)))
    userForm.roleIds = (res.data || []).filter(roleId => assignableIds.has(String(roleId)))
  } catch {
    // 忽略错误
  }
  
  dialogVisible.value = true
}

function showResetPwdDialog(row) {
  resetPwdForm.userId = row.id
  resetPwdForm.password = ''
  resetPwdVisible.value = true
}

function resetForm() {
  Object.assign(userForm, {
    id: null,
    username: '',
    nickname: '',
    phone: '',
    email: '',
    externalUserId: '',
    password: '',
    status: 1,
    tenantId: getActiveTenantId(),
    roleIds: []
  })
}

async function handleSubmit() {
  if (!userFormRef.value) return
  await userFormRef.value.validate()
  
  submitLoading.value = true
  try {
    const assignableIds = new Set(roleOptions.value.map(role => String(role.id)))
    const assignableRoleIds = userForm.roleIds.filter(roleId => assignableIds.has(String(roleId)))
    if (isEdit.value) {
      const updatePayload = {
        nickname: userForm.nickname,
        phone: userForm.phone || null,
        email: userForm.email || null,
        externalUserId: userForm.externalUserId || null,
        status: userForm.status,
        tenantId: userForm.tenantId,
      }
      await updateUser(userForm.id, updatePayload)
      // 分配角色（始终调用，空列表表示清除所有角色）
      await assignRoles(userForm.id, { role_ids: assignableRoleIds })
      ElMessage.success('更新成功')
    } else {
      await createUser({
        username: userForm.username,
        nickname: userForm.nickname,
        phone: userForm.phone || null,
        email: userForm.email || null,
        externalUserId: userForm.externalUserId || null,
        password: userForm.password,
        status: userForm.status,
        tenantId: userForm.tenantId,
        roleIds: assignableRoleIds,
      })
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    loadUserList()
  } catch (error) {
    console.error('操作失败', error)
  } finally {
    submitLoading.value = false
  }
}

async function handleResetPwd() {
  if (!resetPwdForm.password) {
    ElMessage.warning('请输入新密码')
    return
  }
  submitLoading.value = true
  try {
    await resetPassword(resetPwdForm.userId, { newPassword: resetPwdForm.password })
    ElMessage.success('密码重置成功')
    resetPwdVisible.value = false
  } catch (error) {
    console.error('重置密码失败', error)
  } finally {
    submitLoading.value = false
  }
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm('确认删除该用户？', '提示', { type: 'warning' })
    await deleteUser(row.id)
    ElMessage.success('删除成功')
    loadUserList()
  } catch {
    // 取消操作
  }
}

onMounted(() => {
  loadUserList()
  loadRoleOptions()
})
</script>

<style scoped>
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.search-form {
  margin-bottom: 16px;
}

.status-select {
  width: 140px;
}
</style>
