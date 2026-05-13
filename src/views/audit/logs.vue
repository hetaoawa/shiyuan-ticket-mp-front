<template>
  <div class="audit-logs">
    <el-card shadow="never">
      <template #header>
        <span>审计日志</span>
      </template>

      <el-table :data="tableData" v-loading="loading" stripe>
        <el-table-column prop="id" label="ID" width="180" show-overflow-tooltip />
        <el-table-column prop="bizType" label="业务类型" width="120" />
        <el-table-column prop="bizId" label="业务ID" width="180" show-overflow-tooltip />
        <el-table-column prop="action" label="操作" width="100">
          <template #default="{ row }">
            <el-tag>{{ row.action }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="detail" label="详情" min-width="200" show-overflow-tooltip />
        <el-table-column prop="createdAt" label="操作时间" width="180" />
      </el-table>

      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :total="pagination.total"
        layout="total, prev, pager, next"
        @current-change="loadData"
      />
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { getAuditLogs } from '@/api/audit'

const loading = ref(false)
const tableData = ref([])

const pagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0,
})

async function loadData() {
  loading.value = true
  try {
    const res = await getAuditLogs({
      page: pagination.page,
      pageSize: pagination.pageSize,
    })
    tableData.value = res.data || []
    pagination.total = res.total || 0
  } catch (error) {
    // 错误已在 request.js 中处理
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.el-pagination {
  margin-top: 16px;
  justify-content: flex-end;
}
</style>
