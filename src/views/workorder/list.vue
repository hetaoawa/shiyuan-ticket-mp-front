<template>
  <div class="workorder-list">
    <!-- 搜索区域 -->
    <el-card class="search-card" shadow="never">
      <el-form :model="searchForm" inline>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="全部状态" clearable class="status-select">
            <el-option label="待处理" value="PENDING" />
            <el-option label="处理中" value="IN_PROGRESS" />
            <el-option label="已关闭" value="CLOSED" />
            <el-option label="已驳回" value="REJECTED" />
          </el-select>
        </el-form-item>
        <el-form-item label="物流单号">
          <el-input v-model="searchForm.trackingNo" placeholder="请输入物流单号" clearable />
        </el-form-item>
        <el-form-item label="创建时间">
          <el-date-picker
            v-model="searchForm.createdTimeRange"
            type="datetimerange"
            range-separator="至"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            value-format="YYYY-MM-DD HH:mm:ss"
            clearable
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 操作栏 -->
    <el-card class="table-card" shadow="never">
      <template #header>
        <div class="card-header">
          <span>工单列表</span>
          <div class="header-actions">
            <el-button
              v-hasPermi="['workorder:export']"
              type="success"
              :icon="Download"
              @click="handleExport"
            >
              导出 CSV
            </el-button>
            <el-button
              v-hasPermi="['workorder:assign']"
              type="warning"
              :icon="Promotion"
              :disabled="selectedRows.length === 0"
              @click="showBatchAssignDialog"
            >
              批量派发 ({{ selectedRows.length }})
            </el-button>
            <el-button
              v-hasPermi="['workorder:create']"
              type="primary"
              :icon="Plus"
              @click="showCreateDialog = true"
            >
              创建工单
            </el-button>
          </div>
        </div>
      </template>

      <!-- 表格 -->
      <el-table :data="tableData" v-loading="loading" stripe @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="55" />
        <el-table-column label="工单ID" width="180">
          <template #default="{ row }"><OpaqueId :value="row.id" /></template>
        </el-table-column>
        <el-table-column label="所属租户" min-width="180">
          <template #default="{ row }">
            <OpaqueId
              :value="row.tenantId"
              :label="formatTenantLabel(row.tenantName, row.tenantId)"
            />
          </template>
        </el-table-column>
        <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />
        <el-table-column label="物流单号" width="150">
          <template #default="{ row }"><OpaqueId :value="row.trackingNo" /></template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">
              {{ getStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="priority" label="优先级" width="80">
          <template #default="{ row }">
            <el-tag :type="getPriorityType(row.priority)" size="small">
              {{ getPriorityLabel(row.priority) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="处理人" width="130" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.assigneeName">{{ row.assigneeName }}</span>
            <span v-else-if="row.assigneeRoleName">{{ row.assigneeRoleName }}</span>
            <OpaqueId
              v-else-if="row.assigneeId"
              :value="row.assigneeId"
              :label="`用户 ${row.assigneeId}`"
            />
            <span v-else-if="row.assigneeRole">{{ row.assigneeRole }}</span>
            <span v-else style="color: #909399;">未派发</span>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="180" />
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="handleDetail(row)">
              详情
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :page-sizes="[10, 20, 50]"
        :total="pagination.total"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="handleSizeChange"
        @current-change="handlePageChange"
      />
    </el-card>

    <!-- 创建工单弹窗 -->
    <el-dialog
      v-model="showCreateDialog"
      title="创建工单"
      width="min(960px, 92vw)"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <WorkOrderCreateEditor
        show-cancel
        @cancel="showCreateDialog = false"
        @completed="handleCreateCompleted"
      />
    </el-dialog>

    <!-- 批量派发弹窗 -->
    <el-dialog v-model="batchAssignVisible" title="批量派发工单" width="480px">
      <el-alert
        :title="`已选择 ${selectedRows.length} 个工单`"
        type="info"
        :closable="false"
        show-icon
        style="margin-bottom: 16px;"
      />
      <el-form :model="batchAssignForm" label-width="80px">
        <el-form-item label="派发方式">
          <el-radio-group v-model="batchAssignForm.assignType" @change="handleBatchAssignTypeChange">
            <el-radio value="user">按用户</el-radio>
            <el-radio value="role">按角色</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="batchAssignForm.assignType === 'user'" label="处理人" required>
          <el-select v-model="batchAssignForm.assigneeId" placeholder="请选择处理人" filterable>
            <el-option
              v-for="user in userList"
              :key="user.id"
              :label="`${user.nickname || user.username} (${user.username})`"
              :value="user.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item v-if="batchAssignForm.assignType === 'role'" label="角色" required>
          <el-select v-model="batchAssignForm.assigneeRoleCode" placeholder="请选择角色" filterable>
            <el-option
              v-for="role in warehouseRoleOptions"
              :key="role.roleCode"
              :label="role.roleName"
              :value="role.roleCode"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="batchAssignVisible = false">取消</el-button>
        <el-button type="primary" :loading="batchLoading" @click="handleBatchAssign">确定派发</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, ref, reactive, onMounted } from 'vue'
import { formatTenantLabel } from '@/utils/tenant'
import { useRouter } from 'vue-router'
import {
  getWorkOrderList,
  batchAssignWorkOrder,
  exportWorkOrders,
  getAssignmentUserOptions,
  getAssignmentRoleOptions,
} from '@/api/workorder'
import { useUserStore } from '@/stores/user'
import { ElMessage } from 'element-plus'
import { Download, Promotion, Plus } from '@element-plus/icons-vue'
import WorkOrderCreateEditor from '@/components/WorkOrderCreateEditor.vue'
import OpaqueId from '@/components/OpaqueId.vue'

const router = useRouter()
const userStore = useUserStore()
const canAssignWorkOrder = computed(() => userStore.permissions.includes('workorder:assign'))

const loading = ref(false)
const tableData = ref([])
const showCreateDialog = ref(false)
const selectedRows = ref([])
const batchAssignVisible = ref(false)
const batchLoading = ref(false)
const batchAssignForm = reactive({ assignType: 'user', assigneeId: '', assigneeRoleCode: '' })
const userList = ref([])
const warehouseRoleOptions = ref([])

function acquireWorkOrderOperation() {
  const releaseTenantContext = userStore.acquireTenantContextOperation()
  if (!releaseTenantContext) {
    ElMessage.warning('租户切换正在进行，请稍后重试')
  }
  return releaseTenantContext
}

// 搜索表单
const searchForm = reactive({
  status: '',
  trackingNo: '',
  createdTimeRange: [],
})

// 分页参数
const pagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0,
})

// 状态标签类型
function getStatusType(status) {
  const map = {
    PENDING: 'warning',
    IN_PROGRESS: 'primary',
    CLOSED: 'success',
    REJECTED: 'danger',
  }
  return map[status] || 'info'
}

// 状态显示文本
function getStatusLabel(status) {
  const map = {
    PENDING: '待处理',
    IN_PROGRESS: '处理中',
    CLOSED: '已关闭',
    REJECTED: '已驳回',
  }
  return map[status] || status
}

// 优先级标签类型
function getPriorityType(priority) {
  const map = { 1: 'info', 2: 'warning', 3: 'danger' }
  return map[priority] || 'info'
}

// 优先级显示文本
function getPriorityLabel(priority) {
  const map = { 1: '低', 2: '中', 3: '高' }
  return map[priority] || '未知'
}

// 加载数据
function buildSearchParams(includePage = true) {
  const params = {}
  if (includePage) {
    Object.assign(params, {
      page: pagination.page,
      pageSize: pagination.pageSize,
    })
  }
  if (searchForm.status) params.status = searchForm.status
  if (searchForm.trackingNo) params.trackingNo = searchForm.trackingNo
  if (searchForm.createdTimeRange?.length === 2) {
    params.createdStartTime = searchForm.createdTimeRange[0]
    params.createdEndTime = searchForm.createdTimeRange[1]
  }
  return params
}

async function loadData() {
  loading.value = true
  try {
    const params = buildSearchParams()
    const res = await getWorkOrderList(params)
    tableData.value = res.data || []
    pagination.total = Number(res.total) || 0
  } catch (error) {
    // 错误已在 request.js 中处理
  } finally {
    loading.value = false
  }
}

// 搜索
function handleSearch() {
  pagination.page = 1
  loadData()
}

// 重置
function handleReset() {
  searchForm.status = ''
  searchForm.trackingNo = ''
  searchForm.createdTimeRange = []
  handleSearch()
}

// 查看详情
function handleDetail(row) {
  router.push(`/workorder/detail/${row.id}`)
}

// 分页大小变化
function handleSizeChange() {
  pagination.page = 1
  loadData()
}

// 页码变化
function handlePageChange() {
  loadData()
}

// 表格选择变化
function handleSelectionChange(rows) {
  selectedRows.value = rows
}

// 显示批量派发弹窗
async function showBatchAssignDialog() {
  if (!canAssignWorkOrder.value || !await loadAssignmentOptions()) return
  batchAssignForm.assignType = 'user'
  batchAssignForm.assigneeId = ''
  batchAssignForm.assigneeRoleCode = ''
  batchAssignVisible.value = true
}

// 派发方式切换
function handleBatchAssignTypeChange() {
  batchAssignForm.assigneeId = ''
  batchAssignForm.assigneeRoleCode = ''
}

// 批量派发
async function handleBatchAssign() {
  if (batchAssignForm.assignType === 'user' && !batchAssignForm.assigneeId) {
    ElMessage.warning('请选择处理人')
    return
  }
  if (batchAssignForm.assignType === 'role' && !batchAssignForm.assigneeRoleCode) {
    ElMessage.warning('请选择角色')
    return
  }
  const releaseTenantContext = acquireWorkOrderOperation()
  if (!releaseTenantContext) return
  batchLoading.value = true
  try {
    const data = {
      workOrderIds: selectedRows.value.map((r) => r.id),
    }
    if (batchAssignForm.assignType === 'user') {
      data.assigneeId = batchAssignForm.assigneeId
    } else {
      data.assigneeRoleCode = batchAssignForm.assigneeRoleCode
    }
    await batchAssignWorkOrder(data)
    ElMessage.success(`成功派发 ${selectedRows.value.length} 个工单`)
    batchAssignVisible.value = false
    await loadData()
  } catch (error) {
    console.error('批量派发工单失败', error)
  } finally {
    batchLoading.value = false
    releaseTenantContext()
  }
}

// 导出 CSV
async function handleExport() {
  try {
    const params = buildSearchParams(false)
    const res = await exportWorkOrders(params)
    const blob = new Blob([res], { type: 'text/csv;charset=utf-8' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `工单列表_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    window.URL.revokeObjectURL(url)
    ElMessage.success('导出成功')
  } catch (error) {
    console.error('导出失败', error)
  }
}

async function handleCreateCompleted() {
  showCreateDialog.value = false
  await loadData()
}

// 加载当前租户内的派发候选项
async function loadAssignmentOptions() {
  if (!canAssignWorkOrder.value) return false
  const releaseTenantContext = acquireWorkOrderOperation()
  if (!releaseTenantContext) return false
  try {
    const [userResult, roleResult] = await Promise.allSettled([
      getAssignmentUserOptions(),
      getAssignmentRoleOptions(),
    ])
    const failedResult = [userResult, roleResult].find((result) => result.status === 'rejected')
    if (failedResult) throw failedResult.reason
    const userResponse = userResult.value
    const roleResponse = roleResult.value
    userList.value = userResponse.data || []
    warehouseRoleOptions.value = (roleResponse.data || [])
      .filter((role) => role.roleCode === 'WAREHOUSE_ADMIN')
    return true
  } catch (error) {
    console.error('加载派发候选项失败', error)
    return false
  } finally {
    releaseTenantContext()
  }
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.workorder-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.search-card {
  margin-bottom: 0;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.el-pagination {
  margin-top: 16px;
  justify-content: flex-end;
}

.status-select {
  width: 180px;
}
</style>
