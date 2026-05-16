<template>
  <div class="menu-manage">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span>菜单管理</span>
          <el-button type="primary" @click="showAddDialog(null)">
            <el-icon><Plus /></el-icon>
            新增菜单
          </el-button>
        </div>
      </template>

      <!-- 菜单树表格 -->
      <el-table
        :data="menuTree"
        v-loading="loading"
        row-key="id"
        :tree-props="{ children: 'children', hasChildren: 'hasChildren' }"
        border
        default-expand-all
      >
        <el-table-column prop="menuName" label="菜单名称" min-width="200" />
        <el-table-column prop="menuCode" label="菜单编码" width="150" />
        <el-table-column prop="menuType" label="菜单类型" width="100">
          <template #default="{ row }">
            <el-tag :type="getMenuTypeTag(row.menuType)">
              {{ getMenuTypeLabel(row.menuType) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="path" label="路由路径" width="200" />
        <el-table-column prop="icon" label="图标" width="80">
          <template #default="{ row }">
            <el-icon v-if="row.icon"><component :is="row.icon" /></el-icon>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="sortOrder" label="排序" width="80" />
        <el-table-column prop="permissionCode" label="权限编码" width="150" />
        <el-table-column label="操作" fixed="right" width="200">
          <template #default="{ row }">
            <el-button type="primary" link @click="showAddDialog(row)">添加子菜单</el-button>
            <el-button type="primary" link @click="showEditDialog(row)">编辑</el-button>
            <el-button type="danger" link @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 新增/编辑菜单弹窗 -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="600px">
      <el-form :model="menuForm" :rules="rules" ref="menuFormRef" label-width="100px">
        <el-form-item label="上级菜单">
          <el-tree-select
            v-model="menuForm.parentId"
            :data="menuTreeOptions"
            :props="{ label: 'menuName', value: 'id', children: 'children' }"
            placeholder="请选择上级菜单（留空为顶级菜单）"
            clearable
            check-strictly
          />
        </el-form-item>
        <el-form-item label="菜单类型" prop="menuType">
          <el-radio-group v-model="menuForm.menuType">
            <el-radio label="DIR">目录</el-radio>
            <el-radio label="MENU">菜单</el-radio>
            <el-radio label="BUTTON">按钮</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="菜单名称" prop="menuName">
          <el-input v-model="menuForm.menuName" placeholder="请输入菜单名称" />
        </el-form-item>
        <el-form-item label="菜单编码" prop="menuCode">
          <el-input v-model="menuForm.menuCode" placeholder="请输入菜单编码" />
        </el-form-item>
        <el-form-item label="路由路径" v-if="menuForm.menuType !== 'BUTTON'">
          <el-input v-model="menuForm.path" placeholder="请输入路由路径" />
        </el-form-item>
        <el-form-item label="图标" v-if="menuForm.menuType !== 'BUTTON'">
          <el-input v-model="menuForm.icon" placeholder="请输入图标名称" />
        </el-form-item>
        <el-form-item label="排序" prop="sortOrder">
          <el-input-number v-model="menuForm.sortOrder" :min="0" :max="999" />
        </el-form-item>
        <el-form-item label="权限编码" v-if="menuForm.menuType === 'BUTTON'">
          <el-input v-model="menuForm.permissionCode" placeholder="请输入权限编码" />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="menuForm.status">
            <el-radio value="0">正常</el-radio>
            <el-radio value="1">停用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { Plus } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getMenuTree, createMenu, updateMenu, deleteMenu } from '@/api/admin/menu'

const loading = ref(false)
const submitLoading = ref(false)
const menuTree = ref([])

const dialogVisible = ref(false)
const dialogTitle = ref('新增菜单')
const isEdit = ref(false)

const menuFormRef = ref(null)
const menuForm = reactive({
  id: null,
  parentId: null,
  menuName: '',
  menuCode: '',
  menuType: 'MENU',
  path: '',
  icon: '',
  sortOrder: 0,
  permissionCode: '',
  status: '0'
})

const rules = {
  menuName: [{ required: true, message: '请输入菜单名称', trigger: 'blur' }],
  menuCode: [{ required: true, message: '请输入菜单编码', trigger: 'blur' }],
  menuType: [{ required: true, message: '请选择菜单类型', trigger: 'change' }]
}

// 菜单树选项（用于上级菜单选择）
const menuTreeOptions = computed(() => {
  return [{ id: 0, menuName: '顶级菜单', children: menuTree.value }]
})

// 获取菜单类型标签样式
function getMenuTypeTag(type) {
  const map = { DIR: '', MENU: 'success', BUTTON: 'warning' }
  return map[type] || ''
}

// 获取菜单类型标签文本
function getMenuTypeLabel(type) {
  const map = { DIR: '目录', MENU: '菜单', BUTTON: '按钮' }
  return map[type] || type
}

// 加载菜单树
async function loadMenuTree() {
  loading.value = true
  try {
    const res = await getMenuTree()
    menuTree.value = res.data || []
  } catch (error) {
    console.error('加载菜单树失败', error)
  } finally {
    loading.value = false
  }
}

// 显示新增弹窗
function showAddDialog(parent) {
  isEdit.value = false
  dialogTitle.value = '新增菜单'
  resetForm()
  if (parent) {
    menuForm.parentId = parent.id
  }
  dialogVisible.value = true
}

// 显示编辑弹窗
function showEditDialog(row) {
  isEdit.value = true
  dialogTitle.value = '编辑菜单'
  Object.assign(menuForm, {
    id: row.id,
    parentId: row.parentId || 0,
    menuName: row.menuName,
    menuCode: row.menuCode,
    menuType: row.menuType || 'MENU',
    path: row.path || '',
    icon: row.icon || '',
    sortOrder: row.sortOrder || 0,
    permissionCode: row.permissionCode || '',
    status: row.status ?? '0'
  })
  dialogVisible.value = true
}

// 重置表单
function resetForm() {
  Object.assign(menuForm, {
    id: null,
    parentId: null,
    menuName: '',
    menuCode: '',
    menuType: 'MENU',
    path: '',
    icon: '',
    sortOrder: 0,
    permissionCode: '',
    status: '0'
  })
}

// 提交表单
async function handleSubmit() {
  if (!menuFormRef.value) return
  await menuFormRef.value.validate()
  
  submitLoading.value = true
  try {
    if (isEdit.value) {
      const { id, ...data } = menuForm
      await updateMenu(id, data)
      ElMessage.success('更新成功')
    } else {
      await createMenu(menuForm)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    loadMenuTree()
  } catch (error) {
    console.error('操作失败', error)
  } finally {
    submitLoading.value = false
  }
}

// 删除菜单
async function handleDelete(row) {
  try {
    await ElMessageBox.confirm('确认删除该菜单？删除后子菜单也将被删除！', '提示', { type: 'warning' })
    await deleteMenu(row.id)
    ElMessage.success('删除成功')
    loadMenuTree()
  } catch {
    // 取消操作
  }
}

onMounted(() => {
  loadMenuTree()
})
</script>

<style scoped>
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>
