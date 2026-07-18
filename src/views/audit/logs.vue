<template>
  <div class="audit-logs">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <div>
            <span>审计日志</span>
            <span class="header-description">记录关键业务操作，便于追溯处理过程</span>
          </div>
          <el-button :icon="Refresh" :loading="loading" @click="loadData">刷新</el-button>
        </div>
      </template>

      <el-form :model="queryParams" inline class="query-form" @submit.prevent="handleQuery">
        <el-form-item label="业务类型">
          <el-select
            v-model="queryParams.bizType"
            class="biz-type-select"
            filterable
            allow-create
            default-first-option
            placeholder="请选择业务类型"
          >
            <el-option label="工单" value="WORK_ORDER" />
            <el-option label="租户集成配置" value="TENANT_INTEGRATION" />
          </el-select>
        </el-form-item>
        <el-form-item label="业务 ID">
          <el-input v-model.trim="queryParams.bizId" placeholder="输入完整业务 ID" clearable />
        </el-form-item>
        <el-form-item label="操作类型">
          <el-select v-model="queryParams.action" class="action-select" placeholder="全部操作" clearable>
            <el-option label="创建工单" value="CREATE" />
            <el-option label="派发工单" value="ASSIGN" />
            <el-option label="关闭工单" value="CLOSE" />
            <el-option label="驳回工单" value="REJECT" />
            <el-option label="强制驳回" value="FORCE_REJECT" />
            <el-option label="重新提交" value="RESUBMIT" />
            <el-option label="更新配置" value="UPDATE" />
          </el-select>
        </el-form-item>
        <el-form-item label="操作人 ID">
          <el-input v-model.trim="queryParams.operatorId" placeholder="输入完整用户 ID" clearable />
        </el-form-item>
        <el-form-item label="操作时间">
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
          <el-button native-type="submit" type="primary" :loading="loading">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>

      <div v-if="isMobileView" class="mobile-table-hint">日志字段较多，可左右滑动查看；点击“查看”可阅读完整详情。</div>
      <div :class="{ 'mobile-table-scroll': isMobileView }">
        <el-table :data="tableData" v-loading="loading" stripe row-key="id">
          <el-table-column label="日志 ID" width="190">
            <template #default="{ row }">
              <OpaqueId :value="row.id" copy-name="日志 ID" />
            </template>
          </el-table-column>
          <el-table-column label="业务对象" min-width="220">
            <template #default="{ row }">
              <div class="business-cell">
                <span class="business-type">{{ getBizTypeLabel(row.bizType) }}</span>
                <OpaqueId
                  :value="row.bizId"
                  :to="getBusinessRoute(row)"
                  copy-name="业务 ID"
                />
              </div>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="130">
            <template #default="{ row }">
              <el-tag :type="getActionTagType(row.action)" effect="light">
                {{ getActionLabel(row) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作人" min-width="150">
            <template #default="{ row }">
              <div class="operator-cell">
                <div>
                  <div class="operator-name">
                    <span>{{ getOperatorLabel(row) }}</span>
                    <OpaqueId
                      v-if="row.operatorId"
                      :value="row.operatorId"
                      label=""
                      empty-text=""
                      copy-name="操作人 ID"
                    />
                  </div>
                  <span v-if="row.requestSourceLabel || row.requestSource" class="request-source">
                    {{ row.requestSourceLabel || row.requestSource }}
                  </span>
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="详情" min-width="260">
            <template #default="{ row }">
              <div class="detail-cell">
                <span class="detail-text">{{ getDetailSummary(row) || '无补充详情' }}</span>
                <el-button v-if="hasDetail(row)" type="primary" link @click="showDetail(row)">查看</el-button>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="createdAt" label="操作时间" width="180" sortable />
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

    <el-dialog v-model="detailVisible" title="审计日志详情" width="min(680px, 92vw)" destroy-on-close>
      <el-descriptions v-if="selectedLog" :column="isMobileView ? 1 : 2" border>
        <el-descriptions-item label="日志 ID">
          <OpaqueId :value="selectedLog.id" copy-name="日志 ID" />
        </el-descriptions-item>
        <el-descriptions-item label="操作时间">{{ selectedLog.createdAt || '-' }}</el-descriptions-item>
        <el-descriptions-item label="业务类型">{{ getBizTypeLabel(selectedLog.bizType) }}</el-descriptions-item>
        <el-descriptions-item label="业务 ID">
          <OpaqueId
            :value="selectedLog.bizId"
            :to="getBusinessRoute(selectedLog)"
            copy-name="业务 ID"
          />
        </el-descriptions-item>
        <el-descriptions-item label="操作">
          <el-tag :type="getActionTagType(selectedLog.action)">{{ getActionLabel(selectedLog) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="操作人">{{ getOperatorLabel(selectedLog) }}</el-descriptions-item>
        <el-descriptions-item label="请求来源">
          {{ selectedLog.requestSourceLabel || selectedLog.requestSource || '-' }}
        </el-descriptions-item>
      </el-descriptions>

      <div class="detail-section">
        <h4>操作详情</h4>
        <el-descriptions v-if="selectedDetailEntries.length" :column="1" border>
          <el-descriptions-item
            v-for="item in selectedDetailEntries"
            :key="item.key"
            :label="item.label"
          >
            <span class="detail-value">{{ item.value }}</span>
          </el-descriptions-item>
        </el-descriptions>
        <el-empty v-else description="无补充详情" :image-size="60" />
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { Refresh } from '@element-plus/icons-vue'
import { getAuditLogs } from '@/api/audit'
import OpaqueId from '@/components/OpaqueId.vue'
import { isMobileView } from '@/utils/device'
import {
  getActionLabel,
  getActionTagType,
  getBizTypeLabel,
  getDetailEntries,
  getDetailSummary,
  getOperatorLabel,
  normalizeAuditRecords,
} from '@/utils/audit'

const loading = ref(false)
const tableData = ref([])
const detailVisible = ref(false)
const selectedLog = ref(null)

const queryParams = reactive({
  bizType: 'WORK_ORDER',
  bizId: '',
  action: '',
  operatorId: '',
  createdTimeRange: [],
})

const pagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0,
})

const selectedDetailEntries = computed(() => selectedLog.value ? getDetailEntries(selectedLog.value) : [])

function getBusinessRoute(row) {
  if (row.bizType !== 'WORK_ORDER' || !row.bizId) return ''
  return `/workorder/detail/${row.bizId}`
}

function hasDetail(row) {
  return Boolean(row.detailSummary || row.detail || row.detailFields)
}

function showDetail(row) {
  selectedLog.value = row
  detailVisible.value = true
}

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
      bizType: queryParams.bizType || 'WORK_ORDER',
    }
    if (queryParams.bizId) params.bizId = queryParams.bizId
    if (queryParams.action) params.action = queryParams.action
    if (queryParams.operatorId) params.operatorId = queryParams.operatorId
    if (queryParams.createdTimeRange?.length === 2) {
      params.createdStartTime = queryParams.createdTimeRange[0]
      params.createdEndTime = queryParams.createdTimeRange[1]
    }
    const res = await getAuditLogs(params)
    tableData.value = normalizeAuditRecords(res)
    pagination.total = Number(res.data?.total ?? res.total) || tableData.value.length
  } catch (error) {
    console.error('加载审计日志失败', error)
  } finally {
    loading.value = false
  }
}

function handleQuery() {
  pagination.page = 1
  loadData()
}

function handleReset() {
  queryParams.bizType = 'WORK_ORDER'
  queryParams.bizId = ''
  queryParams.action = ''
  queryParams.operatorId = ''
  queryParams.createdTimeRange = []
  pagination.page = 1
  loadData()
}

onMounted(loadData)
</script>

<style scoped>
.card-header,
.detail-cell,
.operator-cell {
  display: flex;
  align-items: center;
}

.card-header {
  justify-content: space-between;
  gap: 16px;
}

.header-description {
  margin-left: 12px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.query-form {
  margin-bottom: 4px;
}

.biz-type-select,
.action-select {
  width: 180px;
}

.business-cell {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}

.business-type {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.operator-cell,
.operator-name {
  gap: 4px;
}

.operator-name {
  display: flex;
  align-items: center;
}

.operator-name :deep(.opaque-id__text) {
  display: none;
}

.request-source {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.detail-cell {
  min-width: 0;
  gap: 8px;
}

.detail-text {
  min-width: 0;
  overflow: hidden;
  color: var(--el-text-color-regular);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-cell .el-button {
  flex: 0 0 auto;
}

.detail-section {
  margin-top: 20px;
}

.detail-section h4 {
  margin: 0 0 12px;
}

.detail-value {
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.el-pagination {
  margin-top: 16px;
  justify-content: flex-end;
}

:global(html.is-mobile-view .audit-logs .card-header) {
  align-items: flex-start;
}

:global(html.is-mobile-view .audit-logs .header-description) {
  display: block;
  margin: 4px 0 0;
}
</style>
