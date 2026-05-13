<template>
  <div class="workorder-detail" v-loading="loading">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span>工单详情</span>
          <div>
            <el-button
              v-if="detail.status === 'PENDING'"
              v-hasPermi="['workorder:assign']"
              type="primary"
              @click="showAssignDialog"
            >
              派发
            </el-button>
            <el-button
              v-if="detail.status === 'IN_PROGRESS'"
              v-hasPermi="['workorder:close']"
              type="success"
              @click="showCloseDialog"
            >
              关闭
            </el-button>
            <el-button
              v-if="detail.status === 'IN_PROGRESS'"
              v-hasPermi="['workorder:reject']"
              type="danger"
              @click="showRejectDialog"
            >
              驳回
            </el-button>
            <el-button icon="ArrowLeft" @click="handleBack">返回</el-button>
          </div>
        </div>
      </template>

      <el-row :gutter="24">
        <!-- 左侧基础信息 -->
        <el-col :span="12">
          <el-descriptions title="基础信息" :column="1" border>
            <el-descriptions-item label="工单ID">{{ detail.id }}</el-descriptions-item>
            <el-descriptions-item label="标题">{{ detail.title }}</el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-tag :type="getStatusType(detail.status)">
                {{ getStatusLabel(detail.status) }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="优先级">
              <el-tag :type="getPriorityType(detail.priority)" size="small">
                {{ getPriorityLabel(detail.priority) }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="工单类型">
              {{ getOrderTypeLabel(detail.type) }}
            </el-descriptions-item>
            <el-descriptions-item label="物流单号">
              {{ detail.trackingNo || '无' }}
            </el-descriptions-item>
            <el-descriptions-item label="目标地址">
              {{ detail.targetAddress || '无' }}
            </el-descriptions-item>
            <el-descriptions-item label="描述">
              {{ detail.description || '无' }}
            </el-descriptions-item>
            <el-descriptions-item label="创建时间">{{ detail.createdAt }}</el-descriptions-item>
            <el-descriptions-item label="更新时间">{{ detail.updatedAt }}</el-descriptions-item>
          </el-descriptions>
        </el-col>

        <!-- 右侧轨迹信息 -->
        <el-col :span="12">
          <!-- 物流轨迹 -->
          <div v-if="detail.trackingNo" class="express-section">
            <div class="section-header">
              <h4>物流轨迹</h4>
              <el-button
                size="small"
                type="primary"
                :loading="expressLoading"
                @click="showExpressQueryDialog"
              >
                查询物流
              </el-button>
            </div>
            <div v-if="expressData" class="express-info">
              <el-descriptions :column="2" size="small" border>
                <el-descriptions-item label="快递公司">{{ expressData.cpName }}</el-descriptions-item>
                <el-descriptions-item label="物流状态">
                  <el-tag :type="getExpressStatusType(expressData.status)">
                    {{ expressData.statusDesc }}
                  </el-tag>
                </el-descriptions-item>
              </el-descriptions>
              <el-timeline class="express-timeline">
                <el-timeline-item
                  v-for="(trace, index) in expressData.traces"
                  :key="index"
                  :timestamp="trace.time"
                  placement="top"
                >
                  <p class="trace-desc">{{ trace.description }}</p>
                  <p class="trace-location" v-if="trace.location">{{ trace.location }}</p>
                </el-timeline-item>
              </el-timeline>
            </div>
            <el-empty v-else-if="!expressLoading" description="点击按钮查询物流信息" :image-size="60" />
          </div>

          <!-- 举证截图 -->
          <div class="file-section">
            <h4>举证截图</h4>
            <FileUpload v-model="fileIds" biz-type="WORK_ORDER_IMAGE" :biz-id="detail.id" :limit="5" />
          </div>

          <!-- 处理轨迹 -->
          <h4>处理轨迹</h4>
          <el-timeline>
            <el-timeline-item
              v-for="log in auditLogs"
              :key="log.id"
              :timestamp="log.createdAt"
              placement="top"
            >
              <el-card shadow="never">
                <p class="log-action">{{ getActionLabel(log.action) }}</p>
                <p class="log-detail" v-if="log.detail">{{ log.detail }}</p>
              </el-card>
            </el-timeline-item>
            <el-timeline-item v-if="auditLogs.length === 0" timestamp="暂无记录">
              <p>暂无处理轨迹</p>
            </el-timeline-item>
          </el-timeline>
        </el-col>
      </el-row>
    </el-card>

    <!-- 派发弹窗 -->
    <el-dialog v-model="assignDialogVisible" title="派发工单" width="400px">
      <el-form :model="assignForm" label-width="80px">
        <el-form-item label="处理人ID" required>
          <el-input v-model="assignForm.assigneeId" placeholder="请输入处理人用户ID" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="assignDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="actionLoading" @click="handleAssign">确定</el-button>
      </template>
    </el-dialog>

    <!-- 关闭弹窗 -->
    <el-dialog v-model="closeDialogVisible" title="关闭工单" width="400px">
      <el-form :model="closeForm" label-width="80px">
        <el-form-item label="处理结论" required>
          <el-input
            v-model="closeForm.resolution"
            type="textarea"
            :rows="3"
            placeholder="请输入处理结论"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="closeDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="actionLoading" @click="handleClose">确定</el-button>
      </template>
    </el-dialog>

    <!-- 驳回弹窗 -->
    <el-dialog v-model="rejectDialogVisible" title="驳回工单" width="400px">
      <el-form :model="rejectForm" label-width="80px">
        <el-form-item label="驳回原因" required>
          <el-input
            v-model="rejectForm.reason"
            type="textarea"
            :rows="3"
            placeholder="请输入驳回原因"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rejectDialogVisible = false">取消</el-button>
        <el-button type="danger" :loading="actionLoading" @click="handleReject">确定</el-button>
      </template>
    </el-dialog>

    <!-- 物流查询弹窗 -->
    <el-dialog v-model="expressQueryVisible" title="物流查询" width="500px">
      <el-form :model="expressQueryForm" label-width="100px">
        <el-form-item label="快递公司">
          <el-select v-model="expressQueryForm.cpCode" placeholder="自动识别" clearable>
            <el-option
              v-for="company in expressCompanies"
              :key="company.code"
              :label="company.name"
              :value="company.code"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="手机号后四位">
          <el-input v-model="expressQueryForm.mobileLast4" placeholder="顺丰、中通必填" maxlength="4" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="expressQueryVisible = false">取消</el-button>
        <el-button type="primary" :loading="expressLoading" @click="handleExpressQuery">查询</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getWorkOrderDetail, assignWorkOrder, closeWorkOrder, rejectWorkOrder } from '@/api/workorder'
import { getAuditLogs } from '@/api/audit'
import { traceExpress, getExpressCompanies } from '@/api/express'
import { ElMessage, ElMessageBox } from 'element-plus'
import FileUpload from '@/components/FileUpload.vue'

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const actionLoading = ref(false)
const expressLoading = ref(false)
const detail = ref({})
const auditLogs = ref([])
const expressData = ref(null)
const fileIds = ref([])
const expressCompanies = ref([])

// 弹窗控制
const assignDialogVisible = ref(false)
const closeDialogVisible = ref(false)
const rejectDialogVisible = ref(false)
const expressQueryVisible = ref(false)

// 表单数据
const assignForm = reactive({ assigneeId: '' })
const closeForm = reactive({ resolution: '' })
const rejectForm = reactive({ reason: '' })
const expressQueryForm = reactive({ cpCode: '', mobileLast4: '' })

// 状态标签类型
function getStatusType(status) {
  const map = { PENDING: 'warning', IN_PROGRESS: 'primary', CLOSED: 'success', REJECTED: 'danger' }
  return map[status] || 'info'
}

// 状态显示文本
function getStatusLabel(status) {
  const map = { PENDING: '待处理', IN_PROGRESS: '处理中', CLOSED: '已关闭', REJECTED: '已驳回' }
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

// 操作标签
function getActionLabel(action) {
  const map = {
    CREATE: '创建工单',
    ASSIGN: '派发工单',
    CLOSE: '关闭工单',
    REJECT: '驳回工单',
  }
  return map[action] || action
}

// 工单类型标签
function getOrderTypeLabel(type) {
  const map = {
    CHANGE_ADDRESS: '改地址',
    INTERCEPT: '拦截',
    DAMAGE: '破损',
    LOST: '丢失',
    OTHER: '其他',
  }
  return map[type] || '未指定'
}

// 物流状态类型
function getExpressStatusType(status) {
  const map = { 0: 'danger', 1: 'info', 2: 'warning', 3: 'success', 4: 'danger' }
  return map[status] || 'info'
}

// 显示物流查询弹窗
async function showExpressQueryDialog() {
  expressQueryForm.cpCode = ''
  expressQueryForm.mobileLast4 = ''
  expressQueryVisible.value = true
  if (expressCompanies.value.length === 0) {
    try {
      const res = await getExpressCompanies()
      expressCompanies.value = res.data || []
    } catch {}
  }
}

// 物流查询
async function handleExpressQuery() {
  if (!detail.value.trackingNo) return
  expressLoading.value = true
  try {
    const params = { trackingNo: detail.value.trackingNo }
    if (expressQueryForm.cpCode) params.cpCode = expressQueryForm.cpCode
    if (expressQueryForm.mobileLast4) params.mobileLast4 = expressQueryForm.mobileLast4
    const res = await traceExpress(params)
    expressData.value = res.data || null
    expressQueryVisible.value = false
  } catch (error) {
    const msg = error.response?.data?.message
    if (msg) {
      if (msg.includes('手机号')) {
        ElMessageBox.alert('该快递公司需要提供收件手机号后四位，请填写后重新查询', '提示', { type: 'warning' })
      } else {
        ElMessage.warning(msg)
      }
    }
  } finally {
    expressLoading.value = false
  }
}

// 加载详情
async function loadDetail() {
  const id = route.params.id
  if (!id) return

  loading.value = true
  try {
    const res = await getWorkOrderDetail(id)
    detail.value = res.data || {}
    // 加载审计日志
    await loadAuditLogs(id)
  } catch (error) {
    // 错误已在 request.js 中处理
  } finally {
    loading.value = false
  }
}

// 加载审计日志
async function loadAuditLogs(bizId) {
  try {
    const res = await getAuditLogs({ bizId, pageSize: 50 })
    auditLogs.value = res.data || []
  } catch (error) {
    // 忽略审计日志加载错误
  }
}

// 显示派发弹窗
function showAssignDialog() {
  assignForm.assigneeId = ''
  assignDialogVisible.value = true
}

// 显示关闭弹窗
function showCloseDialog() {
  closeForm.resolution = ''
  closeDialogVisible.value = true
}

// 显示驳回弹窗
function showRejectDialog() {
  rejectForm.reason = ''
  rejectDialogVisible.value = true
}

// 派发工单
async function handleAssign() {
  if (!assignForm.assigneeId) {
    ElMessage.warning('请输入处理人ID')
    return
  }
  actionLoading.value = true
  try {
    await assignWorkOrder(detail.value.id, assignForm.assigneeId)
    ElMessage.success('派发成功')
    assignDialogVisible.value = false
    loadDetail()
  } catch (error) {
    // 错误已在 request.js 中处理
  } finally {
    actionLoading.value = false
  }
}

// 关闭工单
async function handleClose() {
  if (!closeForm.resolution) {
    ElMessage.warning('请输入处理结论')
    return
  }
  actionLoading.value = true
  try {
    await closeWorkOrder(detail.value.id, closeForm.resolution)
    ElMessage.success('关闭成功')
    closeDialogVisible.value = false
    loadDetail()
  } catch (error) {
    // 错误已在 request.js 中处理
  } finally {
    actionLoading.value = false
  }
}

// 驳回工单
async function handleReject() {
  if (!rejectForm.reason) {
    ElMessage.warning('请输入驳回原因')
    return
  }
  actionLoading.value = true
  try {
    await rejectWorkOrder(detail.value.id, rejectForm.reason)
    ElMessage.success('驳回成功')
    rejectDialogVisible.value = false
    loadDetail()
  } catch (error) {
    // 错误已在 request.js 中处理
  } finally {
    actionLoading.value = false
  }
}

// 返回
function handleBack() {
  router.back()
}

onMounted(() => {
  loadDetail()
})
</script>

<style scoped>
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.log-action {
  font-weight: 600;
  margin: 0 0 4px;
}

.log-detail {
  color: #909399;
  font-size: 13px;
  margin: 0;
}

.express-section {
  margin-bottom: 24px;
  padding: 16px;
  background-color: #f5f7fa;
  border-radius: 4px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.section-header h4 {
  margin: 0;
}

.express-info {
  margin-top: 12px;
}

.express-timeline {
  margin-top: 16px;
  padding-left: 0;
}

.trace-desc {
  margin: 0;
  font-size: 14px;
}

.trace-location {
  margin: 4px 0 0;
  font-size: 12px;
  color: #909399;
}

.file-section {
  margin-top: 24px;
  padding: 16px;
  background-color: #f5f7fa;
  border-radius: 4px;
}

.file-section h4 {
  margin: 0 0 16px;
}
</style>
