<template>
  <div class="deadletter-list">
    <el-card shadow="never">
      <template #header>
        <span>死信队列管理</span>
      </template>

      <el-table :data="tableData" v-loading="loading" stripe>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="eventId" label="事件ID" width="200" show-overflow-tooltip />
        <el-table-column prop="eventType" label="事件类型" width="180" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'PENDING' ? 'warning' : 'info'">
              {{ row.status === 'PENDING' ? '待处理' : '已忽略' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="attempts" label="重试次数" width="80" />
        <el-table-column prop="lastError" label="最后错误" min-width="200" show-overflow-tooltip />
        <el-table-column prop="createdAt" label="创建时间" width="180" />
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button
              v-hasPermi="['deadletter:retry']"
              type="primary"
              link
              @click="handleRetry(row)"
            >
              重试
            </el-button>
            <el-button
              v-hasPermi="['deadletter:ignore']"
              type="danger"
              link
              @click="handleIgnore(row)"
            >
              忽略
            </el-button>
          </template>
        </el-table-column>
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
import { getDeadLetters, retryDeadLetter, ignoreDeadLetter } from '@/api/admin'
import { ElMessage, ElMessageBox } from 'element-plus'

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
    const res = await getDeadLetters({
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

async function handleRetry(row) {
  try {
    await ElMessageBox.confirm('确定要重试该死信吗？', '提示', { type: 'warning' })
    await retryDeadLetter(row.id)
    ElMessage.success('重试已触发')
    loadData()
  } catch (error) {
    if (error !== 'cancel') {
      // 错误已在 request.js 中处理
    }
  }
}

async function handleIgnore(row) {
  try {
    await ElMessageBox.confirm('确定要忽略该死信吗？', '提示', { type: 'warning' })
    await ignoreDeadLetter(row.id)
    ElMessage.success('已标记忽略')
    loadData()
  } catch (error) {
    if (error !== 'cancel') {
      // 错误已在 request.js 中处理
    }
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
