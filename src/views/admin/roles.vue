<template>
  <div class="role-manage">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span>角色管理</span>
          <el-button type="primary" @click="showAddDialog">
            <el-icon><Plus /></el-icon>
            新增角色
          </el-button>
        </div>
      </template>

      <!-- 角色列表 -->
      <el-table :data="roleList" v-loading="loading" border>
        <el-table-column prop="id" label="角色ID" width="100" />
        <el-table-column prop="roleName" label="角色名称" width="150" />
        <el-table-column prop="roleCode" label="权限字符" width="150" />
        <el-table-column prop="remark" label="备注" />
        <el-table-column prop="createdAt" label="创建时间" width="170" />
        <el-table-column label="操作" fixed="right" width="200">
          <template #default="{ row }">
            <el-button type="primary" link @click="showEditDialog(row)">编辑</el-button>
            <el-button type="primary" link @click="showPermDialog(row)">权限</el-button>
            <el-button type="danger" link @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 新增/编辑角色弹窗 -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="500px">
      <el-form :model="roleForm" :rules="rules" ref="roleFormRef" label-width="80px">
        <el-form-item label="角色名称" prop="roleName">
          <el-input v-model="roleForm.roleName" placeholder="请输入角色名称" />
        </el-form-item>
        <el-form-item label="权限字符" prop="roleCode">
          <el-input v-model="roleForm.roleCode" placeholder="请输入权限字符" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="roleForm.remark" type="textarea" :rows="3" placeholder="请输入备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>

    <!-- 权限设置弹窗 -->
    <el-dialog v-model="permDialogVisible" title="权限设置" width="500px">
      <div class="perm-tree-container">
        <el-tree
          ref="permTreeRef"
          :data="menuTree"
          :props="{ label: 'menuName', children: 'children' }"
          show-checkbox
          node-key="menuId"
          :default-checked-keys="checkedMenuIds"
        />
      </div>
      <template #footer>
        <el-button @click="permDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handlePermSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { Plus } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getRoleList, createRole, updateRole, deleteRole, getRolePermissions, assignPermissions } from '@/api/admin/role'
import { getMenuTree } from '@/api/admin/menu'

const loading = ref(false)
const submitLoading = ref(false)
const roleList = ref([])

const dialogVisible = ref(false)
const dialogTitle = ref('新增角色')
const isEdit = ref(false)

const roleFormRef = ref(null)
const roleForm = reactive({
  id: null,
  roleName: '',
  roleCode: '',
  remark: ''
})

const rules = {
  roleName: [{ required: true, message: '请输入角色名称', trigger: 'blur' }],
  roleCode: [{ required: true, message: '请输入权限字符', trigger: 'blur' }]
}

const permDialogVisible = ref(false)
const permTreeRef = ref(null)
const menuTree = ref([])
const checkedMenuIds = ref([])
const currentRoleId = ref(null)

// 加载角色列表
async function loadRoleList() {
  loading.value = true
  try {
    const res = await getRoleList()
    roleList.value = res.data || []
  } catch (error) {
    console.error('加载角色列表失败', error)
  } finally {
    loading.value = false
  }
}

// 加载菜单树
async function loadMenuTree() {
  try {
    const res = await getMenuTree()
    menuTree.value = res.data || []
  } catch (error) {
    console.error('加载菜单树失败', error)
  }
}

function showAddDialog() {
  isEdit.value = false
  dialogTitle.value = '新增角色'
  resetForm()
  dialogVisible.value = true
}

function showEditDialog(row) {
  isEdit.value = true
  dialogTitle.value = '编辑角色'
  Object.assign(roleForm, {
    id: row.id,
    roleName: row.roleName,
    roleCode: row.roleCode,
    remark: row.remark
  })
  dialogVisible.value = true
}

async function showPermDialog(row) {
  currentRoleId.value = row.id
  try {
    const res = await getRolePermissions(row.id)
    checkedMenuIds.value = res.data || []
  } catch (error) {
    console.error('加载角色权限失败', error)
    checkedMenuIds.value = []
  }
  permDialogVisible.value = true
}

function resetForm() {
  Object.assign(roleForm, {
    id: null,
    roleName: '',
    roleCode: '',
    remark: ''
  })
}

async function handleSubmit() {
  if (!roleFormRef.value) return
  await roleFormRef.value.validate()
  
  submitLoading.value = true
  try {
    if (isEdit.value) {
      const { id, ...data } = roleForm
      await updateRole(id, data)
      ElMessage.success('更新成功')
    } else {
      await createRole(roleForm)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    loadRoleList()
  } catch (error) {
    console.error('操作失败', error)
  } finally {
    submitLoading.value = false
  }
}

async function handlePermSubmit() {
  if (!permTreeRef.value) return
  const checkedKeys = permTreeRef.value.getCheckedKeys()
  const halfCheckedKeys = permTreeRef.value.getHalfCheckedKeys()
  const menuIds = [...checkedKeys, ...halfCheckedKeys]
  
  submitLoading.value = true
  try {
    await assignPermissions(currentRoleId.value, { permissionIds: menuIds })
    ElMessage.success('权限设置成功')
    permDialogVisible.value = false
  } catch (error) {
    console.error('设置权限失败', error)
  } finally {
    submitLoading.value = false
  }
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm('确认删除该角色？', '提示', { type: 'warning' })
    await deleteRole(row.id)
    ElMessage.success('删除成功')
    loadRoleList()
  } catch {
    // 取消操作
  }
}

onMounted(() => {
  loadRoleList()
  loadMenuTree()
})
</script>

<style scoped>
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.perm-tree-container {
  max-height: 400px;
  overflow-y: auto;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  padding: 12px;
}
</style>