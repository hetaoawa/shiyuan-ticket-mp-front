<template>
  <div class="deadletter-list">
    <el-card shadow="never">
      <template #header>
        <span>死信队列管理</span>
      </template>

      <div v-if="isMobileView" class="mobile-table-hint">死信字段较多，可在下方区域左右滑动查看；操作列位于最右侧。</div>
      <div :class="{ 'mobile-table-scroll': isMobileView }">
      <el-table :data="tableData" v-loading="loading" stripe>
        <el-table-column label="ID" width="140">
          <template #default="{ row }"><OpaqueId :value="row.id" /></template>
        </el-table-column>
        <el-table-column label="事件ID" width="200">
          <template #default="{ row }"><OpaqueId :value="row.eventId" /></template>
        </el-table-column>
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
        <el-table-column label="操作" width="150" :fixed="isMobileView ? false : 'right'">
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
      </div>

      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :page-sizes="[10, 20, 50]"
        :total="pagination.total"
        :layout="isMobileView ? 'total, prev, pager, next' : 'total, sizes, prev, pager, next, jumper'"
        @size-change="handleSizeChange"
        @current-change="loadData"
      />
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { getDeadLetters, retryDeadLetter, ignoreDeadLetter } from '@/api/admin'
import { ElMessage, ElMessageBox } from 'element-plus'
import OpaqueId from '@/components/OpaqueId.vue'
import { isMobileView } from '@/utils/device'

const loading = ref(false)
const tableData = ref([])

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
    const res = await getDeadLetters({
      page: pagination.page,
      pageSize: pagination.pageSize,
    })
    tableData.value = res.data?.records ?? res.data ?? []
    pagination.total = Number(res.data?.total ?? res.total) || 0
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
