<template>
  <div class="workorder-list">
    <!-- 搜索区域 -->
    <el-card class="search-card" shadow="never">
      <el-form :model="searchForm" inline>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="全部状态" clearable>
            <el-option label="待处理" value="PENDING" />
            <el-option label="处理中" value="IN_PROGRESS" />
            <el-option label="已关闭" value="CLOSED" />
            <el-option label="已驳回" value="REJECTED" />
          </el-select>
        </el-form-item>
        <el-form-item label="物流单号">
          <el-input v-model="searchForm.trackingNo" placeholder="请输入物流单号" clearable />
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
          <el-button
            v-hasPermi="['workorder:create']"
            type="primary"
            icon="Plus"
            @click="handleCreate"
          >
            创建工单
          </el-button>
        </div>
      </template>

      <!-- 表格 -->
      <el-table :data="tableData" v-loading="loading" stripe>
        <el-table-column prop="id" label="工单ID" width="180" show-overflow-tooltip />
        <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />
        <el-table-column prop="trackingNo" label="物流单号" width="150" show-overflow-tooltip />
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
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getWorkOrderList } from '@/api/workorder'

const router = useRouter()

const loading = ref(false)
const tableData = ref([])

// 搜索表单
const searchForm = reactive({
  status: '',
  trackingNo: '',
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
async function loadData() {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      pageSize: pagination.pageSize,
    }
    if (searchForm.status) {
      params.status = searchForm.status
    }
    if (searchForm.trackingNo) {
      params.trackingNo = searchForm.trackingNo
    }
    const res = await getWorkOrderList(params)
    tableData.value = res.data || []
    pagination.total = res.total || 0
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
  handleSearch()
}

// 创建工单
function handleCreate() {
  router.push('/workorder/create')
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

.el-pagination {
  margin-top: 16px;
  justify-content: flex-end;
}
</style>
