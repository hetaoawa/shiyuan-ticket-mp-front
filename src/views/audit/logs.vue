<template>
  <div class="audit-logs">
    <el-card shadow="never">
      <template #header>
        <span>审计日志</span>
      </template>

      <!-- 查询条件 -->
      <el-form :model="queryParams" inline class="query-form">
        <el-form-item label="业务类型">
          <el-input v-model="queryParams.bizType" placeholder="如 WORK_ORDER" clearable />
        </el-form-item>
        <el-form-item label="业务ID">
          <el-input v-model="queryParams.bizId" placeholder="请输入业务ID" clearable />
        </el-form-item>
        <el-form-item label="创建时间">
          <el-date-picker
            v-model="queryParams.createdTimeRange"
            type="datetimerange"
            range-separator="至"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            value-format="YYYY-MM-DD HH:mm:ss"
            clearable
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleQuery">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="tableData" v-loading="loading" stripe>
        <el-table-column label="ID" width="180">
          <template #default="{ row }"><OpaqueId :value="row.id" /></template>
        </el-table-column>
        <el-table-column prop="bizType" label="业务类型" width="120" />
        <el-table-column label="业务ID" width="180">
          <template #default="{ row }"><OpaqueId :value="row.bizId" /></template>
        </el-table-column>
        <el-table-column prop="action" label="操作" width="125">
          <template #default="{ row }">
            <el-tag>{{ row.action }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="detail" label="详情" min-width="200">
          <template #default="{ row }">
            <el-tooltip v-if="row.detail" :content="formatDetail(row.detail)" placement="top" :show-after="500">
              <span class="detail-text">{{ formatDetail(row.detail) }}</span>
            </el-tooltip>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="操作时间" width="180" />
      </el-table>

      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :page-sizes="[10, 20, 50]"
        :total="pagination.total"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="handleSizeChange"
        @current-change="loadData"
      />
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { getAuditLogs } from '@/api/audit'
import OpaqueId from '@/components/OpaqueId.vue'

const loading = ref(false)
const tableData = ref([])

const queryParams = reactive({
  bizType: '',
  bizId: '',
  createdTimeRange: [],
})

// 格式化详情内容
function formatDetail(detail) {
  if (!detail) return ''
  try {
    const obj = typeof detail === 'string' ? JSON.parse(detail) : detail
    if (typeof obj === 'object' && obj !== null) {
      const parts = []
      if (obj.reason) parts.push(`原因: ${obj.reason}`)
      if (obj.oldStatus && obj.newStatus) parts.push(`状态: ${obj.oldStatus} → ${obj.newStatus}`)
      if (obj.assigneeName) parts.push(`处理人: ${obj.assigneeName}`)
      if (obj.resolution) parts.push(`结论: ${obj.resolution}`)
      if (obj.remark) parts.push(`备注: ${obj.remark}`)
      return parts.length > 0 ? parts.join('；') : JSON.stringify(obj, null, 2)
    }
    return detail
  } catch {
    return detail
  }
}

const pagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0,
})

function handleSizeChange() {
  pagination.page = 1
  loadData()
}

async function loadData() {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      pageSize: pagination.pageSize,
    }
    if (queryParams.bizType) params.bizType = queryParams.bizType
    if (queryParams.bizId) params.bizId = queryParams.bizId
    if (queryParams.createdTimeRange?.length === 2) {
      params.createdStartTime = queryParams.createdTimeRange[0]
      params.createdEndTime = queryParams.createdTimeRange[1]
    }
    const res = await getAuditLogs(params)
    tableData.value = res.data?.records ?? res.data ?? []
    pagination.total = Number(res.data?.total ?? res.total) || 0
  } catch (error) {
    // 错误已在 request.js 中处理
  } finally {
    loading.value = false
  }
}

function handleQuery() {
  pagination.page = 1
  loadData()
}

function handleReset() {
  queryParams.bizType = ''
  queryParams.bizId = ''
  queryParams.createdTimeRange = []
  pagination.page = 1
  loadData()
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.query-form {
  margin-bottom: 16px;
}

.el-pagination {
  margin-top: 16px;
  justify-content: flex-end;
}

.detail-text {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
}
</style>
