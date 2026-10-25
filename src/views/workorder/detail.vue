<template>
  <div class="workorder-detail" v-loading="loading">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span>工单详情</span>
          <div class="detail-actions">
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
            <el-button
              v-if="detail.status === 'REJECTED'"
              v-hasPermi="['workorder:resubmit']"
              type="warning"
              @click="showResubmitDialog"
            >
              重新提交
            </el-button>
            <el-button
              v-if="detail.status && detail.status !== 'CLOSED'"
              v-hasPermi="['workorder:force-reject']"
              type="danger"
              @click="showForceRejectDialog"
            >
              强制驳回
            </el-button>
            <el-button :icon="ArrowLeft" @click="handleBack">返回</el-button>
            <el-button v-if="detail.status && detail.status !== 'CLOSED'" v-hasPermi="['workorder:force-close']"
              type="danger" @click="showForceCloseDialog">强制完结</el-button>
          </div>
        </div>
      </template>

      <el-row :gutter="24">
        <!-- 左侧基础信息 -->
        <el-col :span="isMobileView ? 24 : 12">
          <el-descriptions title="基础信息" :column="1" border>
            <el-descriptions-item label="工单ID">
              <OpaqueId :value="detail.id" copy-name="工单 ID" />
            </el-descriptions-item>
            <el-descriptions-item label="标题">{{ detail.title }}</el-descriptions-item>
            <el-descriptions-item label="发起人">
              {{ detail.submitterName || (detail.submitterId ? `用户 ${detail.submitterId}` : '-') }}
            </el-descriptions-item>
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
              <OpaqueId v-if="detail.trackingNo" :value="detail.trackingNo" copy-name="物流单号" />
              <span v-else>无</span>
            </el-descriptions-item>
            <el-descriptions-item label="目标地址">
              <OpaqueId
                v-if="detail.targetAddress"
                class="detail-copy-value"
                :value="detail.targetAddress"
                copy-name="目标地址"
              />
              <span v-else>无</span>
            </el-descriptions-item>
            <el-descriptions-item label="描述">
              {{ detail.description || '无' }}
            </el-descriptions-item>
            <el-descriptions-item label="处理人">
              <span v-if="detail.assigneeName">{{ detail.assigneeName }}</span>
              <span v-else-if="detail.assigneeRoleName">{{ detail.assigneeRoleName }}</span>
              <span v-else-if="detail.assigneeId">用户 {{ detail.assigneeId }}</span>
              <span v-else-if="detail.assigneeRole">角色 {{ detail.assigneeRole }}</span>
              <span v-else>未派发</span>
            </el-descriptions-item>
            <el-descriptions-item label="创建时间">{{ detail.createdAt }}</el-descriptions-item>
            <el-descriptions-item label="更新时间">{{ detail.updatedAt }}</el-descriptions-item>
          </el-descriptions>
        </el-col>

        <!-- 右侧轨迹信息 -->
        <el-col :span="isMobileView ? 24 : 12">
          <!-- 物流轨迹 -->
          <div v-if="detail.trackingNo" class="express-section">
            <div class="section-header">
              <h4>物流轨迹</h4>
              <el-button
                size="small"
                type="warning"
                :loading="expressForceLoading"
                @click="handleForceTraceExpress"
              >
                强刷轨迹
              </el-button>
            </div>
            <div v-if="expressData" class="express-info">
              <el-descriptions :column="isMobileView ? 1 : 2" size="small" border>
                <el-descriptions-item label="快递公司">{{ getExpressCompanyName(expressData.cpCode) }}</el-descriptions-item>
                <el-descriptions-item label="物流状态">
                  <el-tag :type="getExpressStatusType(expressData.logisticsStatus)">
                    {{ expressData.logisticsStatusDesc || '无物流信息' }}
                  </el-tag>
                </el-descriptions-item>
              </el-descriptions>
              <div v-if="expressData.logisticsTraceDetailList && expressData.logisticsTraceDetailList.length > 0" class="express-timeline-wrapper">
                <el-timeline class="express-timeline">
                  <el-timeline-item
                    v-for="(trace, index) in expressData.logisticsTraceDetailList"
                    :key="index"
                    :timestamp="trace.timeDesc"
                    placement="top"
                  >
                    <p class="trace-desc">{{ trace.desc }}</p>
                    <p class="trace-location" v-if="trace.areaName">{{ trace.areaName }}</p>
                  </el-timeline-item>
                </el-timeline>
              </div>
              <el-empty v-else description="暂无物流轨迹" :image-size="60" />
            </div>
            <el-empty v-else-if="!expressLoading" description="点击按钮查询物流信息" :image-size="60" />
          </div>

          <!-- 举证截图 -->
          <div class="file-section">
            <h4>举证截图</h4>
            <FileUpload v-model="fileIds" biz-type="WORK_ORDER_IMAGE" :biz-id="detail.id" :limit="5" />
          </div>

          <!-- 处理轨迹 -->
          <section class="process-section">
            <div class="section-header">
              <h4>处理轨迹</h4>
              <span class="record-count">共 {{ auditTotal }} 条记录</span>
            </div>
            <el-alert
              v-if="auditTruncated"
              class="trajectory-limit-alert"
              title="记录较多，仅展示最近 500 条"
              type="warning"
              :closable="false"
              show-icon
            />
            <el-timeline v-if="auditLogs.length" class="process-timeline">
              <el-timeline-item
                v-for="log in auditLogs"
                :key="log.id"
                :type="getActionTagType(log.action)"
                placement="top"
              >
                <el-card shadow="never" class="process-card">
                  <div class="process-card-header">
                    <el-tag :type="getActionTagType(log.action)" effect="light">
                      {{ getActionLabel(log) }}
                    </el-tag>
                    <time class="process-time">{{ log.createdAt || '-' }}</time>
                  </div>
                  <div class="process-operator">
                    <span class="process-label">操作人</span>
                    <span>{{ getOperatorLabel(log) }}</span>
                    <OpaqueId
                      v-if="log.operatorId"
                      class="operator-id-copy"
                      :value="log.operatorId"
                      label=""
                      empty-text=""
                      copy-name="操作人 ID"
                    />
                  </div>
                  <div v-if="getDetailEntries(log).length" class="process-detail-grid">
                    <div v-for="item in getDetailEntries(log)" :key="item.key" class="process-detail-item">
                      <span class="process-label">{{ item.label }}</span>
                      <span class="process-detail-value">{{ item.value }}</span>
                    </div>
                  </div>
                  <p v-else-if="getDetailSummary(log)" class="log-detail">{{ getDetailSummary(log) }}</p>
                  <p v-else class="log-detail is-empty">无补充详情</p>
                </el-card>
              </el-timeline-item>
            </el-timeline>
            <el-empty v-else description="暂无处理轨迹" :image-size="60" />
          </section>
        </el-col>
      </el-row>

      <!-- 评论区 -->
      <el-divider />
      <div class="comment-section">
        <h4>工单评论</h4>
        <div class="comment-input">
          <el-input
            v-model="commentText"
            type="textarea"
            :rows="3"
            placeholder="请输入评论内容..."
          />
          <el-button
            type="primary"
            :loading="commentLoading"
            style="margin-top: 8px;"
            @click="handleAddComment"
            v-hasPermi="['workorder:comment']"
          >
            发表评论
          </el-button>
        </div>
        <div class="comment-list" v-if="comments.length > 0">
          <div v-for="item in comments" :key="item.id" class="comment-item">
            <div class="comment-header">
              <span class="comment-author">{{ item.nickname || item.username || '匿名用户' }}</span>
              <span class="comment-time">{{ item.createdAt }}</span>
            </div>
            <div class="comment-content">{{ item.content }}</div>
          </div>
        </div>
        <el-empty v-else description="暂无评论" :image-size="60" />
      </div>
    </el-card>

    <!-- 派发弹窗 -->
    <el-dialog v-model="assignDialogVisible" title="派发工单" width="450px">
      <el-form :model="assignForm" label-width="80px">
        <el-form-item label="派发方式">
          <el-radio-group v-model="assignForm.assignType" @change="handleAssignTypeChange">
            <el-radio value="user">按用户</el-radio>
            <el-radio value="role">按角色</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="assignForm.assignType === 'user'" label="处理人" required>
          <el-select v-model="assignForm.assigneeId" placeholder="请选择处理人" filterable>
            <el-option
              v-for="user in userList"
              :key="user.id"
              :label="`${user.nickname || user.username} (${user.username})`"
              :value="user.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item v-if="assignForm.assignType === 'role'" label="角色" required>
          <el-select v-model="assignForm.assigneeRoleCode" placeholder="请选择角色" filterable>
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
        <el-button @click="assignDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="actionLoading" @click="handleAssign">确定</el-button>
      </template>
    </el-dialog>

    <!-- 关闭弹窗 -->
    <el-dialog v-model="closeDialogVisible" :title="forceClosing ? '强制完结工单' : '关闭工单'" width="400px">
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

    <!-- 重新提交弹窗 -->
    <el-dialog v-model="resubmitDialogVisible" title="重新提交工单" width="500px">
      <el-form :model="resubmitForm" label-width="100px">
        <el-form-item label="工单标题">
          <el-input v-model="resubmitForm.title" placeholder="留空则不修改" />
        </el-form-item>
        <el-form-item label="工单描述">
          <el-input v-model="resubmitForm.description" type="textarea" :rows="3" placeholder="留空则不修改" />
        </el-form-item>
        <el-form-item label="物流单号">
          <el-input v-model="resubmitForm.trackingNo" placeholder="留空则不修改" />
        </el-form-item>
        <el-form-item label="目标地址">
          <el-input v-model="resubmitForm.targetAddress" placeholder="留空则不修改" />
        </el-form-item>
        <el-form-item label="工单类型">
          <el-select v-model="resubmitForm.type" placeholder="不修改" clearable>
            <el-option label="不修改" value="" />
            <el-option label="改地址" value="CHANGE_ADDRESS" />
            <el-option label="拦截" value="INTERCEPT" />
            <el-option label="破损" value="DAMAGE" />
            <el-option label="丢失" value="LOST" />
            <el-option label="其他" value="OTHER" />
          </el-select>
        </el-form-item>
        <el-form-item label="优先级">
          <el-radio-group v-model="resubmitForm.priority">
            <el-radio :value="0">不修改</el-radio>
            <el-radio :value="1">低</el-radio>
            <el-radio :value="2">中</el-radio>
            <el-radio :value="3">高</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="resubmitDialogVisible = false">取消</el-button>
        <el-button type="warning" :loading="actionLoading" @click="handleResubmit">确定提交</el-button>
      </template>
    </el-dialog>

    <!-- 强制驳回弹窗 -->
    <el-dialog v-model="forceRejectDialogVisible" title="强制驳回工单" width="400px">
      <el-form :model="forceRejectForm" label-width="80px">
        <el-form-item label="驳回原因" required>
          <el-input
            v-model="forceRejectForm.reason"
            type="textarea"
            :rows="3"
            placeholder="请输入驳回原因"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="forceRejectDialogVisible = false">取消</el-button>
        <el-button type="danger" :loading="actionLoading" @click="handleForceReject">确定驳回</el-button>
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
import { computed, ref, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { isMobileView } from '@/utils/device'
import {
  getWorkOrderDetail,
  getWorkOrderAuditLogs,
  assignWorkOrder,
    closeWorkOrder,
    forceCloseWorkOrder,
  rejectWorkOrder,
  resubmitWorkOrder,
  forceRejectWorkOrder,
  getAssignmentUserOptions,
  getAssignmentRoleOptions,
} from '@/api/workorder'
import { trackedExpress, traceExpress, getExpressCompanies } from '@/api/express'
import { getComments, addComment } from '@/api/comment'
import { ElMessage } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import FileUpload from '@/components/FileUpload.vue'
import OpaqueId from '@/components/OpaqueId.vue'
import { useUserStore } from '@/stores/user'
import {
  getActionLabel,
  getActionTagType,
  getDetailEntries,
  getDetailSummary,
  getOperatorLabel,
  normalizeAuditRecords,
} from '@/utils/audit'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const canAssignWorkOrder = computed(() => userStore.permissions.includes('workorder:assign'))

const loading = ref(false)
const actionLoading = ref(false)
const expressLoading = ref(false)
const expressForceLoading = ref(false)
const detail = ref({})
const auditLogs = ref([])
const auditTotal = ref(0)
const auditTruncated = ref(false)
const expressData = ref(null)
const fileIds = ref([])
const expressCompanies = ref([])
const comments = ref([])
const commentText = ref('')
const commentLoading = ref(false)
const userList = ref([])
const warehouseRoleOptions = ref([])

function acquireWorkOrderOperation() {
  const releaseTenantContext = userStore.acquireTenantContextOperation()
  if (!releaseTenantContext) {
    ElMessage.warning('租户切换正在进行，请稍后重试')
  }
  return releaseTenantContext
}

// 弹窗控制
const assignDialogVisible = ref(false)
const closeDialogVisible = ref(false)
  const forceClosing = ref(false)
const rejectDialogVisible = ref(false)
const expressQueryVisible = ref(false)
const resubmitDialogVisible = ref(false)
const forceRejectDialogVisible = ref(false)

// 表单数据
const assignForm = reactive({ assignType: 'user', assigneeId: '', assigneeRoleCode: '' })
const closeForm = reactive({ resolution: '' })
const rejectForm = reactive({ reason: '' })
const expressQueryForm = reactive({ cpCode: '', mobileLast4: '' })
const resubmitForm = reactive({ title: '', description: '', trackingNo: '', targetAddress: '', type: '', priority: 0 })
const forceRejectForm = reactive({ reason: '' })

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
  const map = {
    ACCEPT: 'info',
    TRANSPORT: 'warning',
    DELIVERING: 'primary',
    DELIVERED: 'success',
    RETURN: 'danger'
  }
  return map[status] || 'info'
}

// 获取快递公司名称
function getExpressCompanyName(cpCode) {
  if (!cpCode) return '未知'
  const company = expressCompanies.value.find(c => c.code === cpCode)
  return company ? company.name : cpCode
}

// 强制刷新物流轨迹
async function handleForceTraceExpress() {
  if (!detail.value.trackingNo) return
  const releaseTenantContext = acquireWorkOrderOperation()
  if (!releaseTenantContext) return
  expressForceLoading.value = true
  try {
    const res = await traceExpress({ trackingNo: detail.value.trackingNo })
    expressData.value = res.data || null
  } catch (error) {
    const msg = error.response?.data?.message
    if (msg) {
      if (msg.includes('手机号')) {
        await showExpressQueryDialog()
      }
    }
    console.error('强制刷新物流轨迹失败', error)
  } finally {
    expressForceLoading.value = false
    releaseTenantContext()
  }
}

// 显示物流查询弹窗（用于需要填写手机号后四位的情况）
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

// 物流查询（弹窗确认后）
async function handleExpressQuery() {
  if (!detail.value.trackingNo) return
  const releaseTenantContext = acquireWorkOrderOperation()
  if (!releaseTenantContext) return
  expressLoading.value = true
  try {
    const params = { trackingNo: detail.value.trackingNo }
    if (expressQueryForm.cpCode) params.cpCode = expressQueryForm.cpCode
    if (expressQueryForm.mobileLast4) params.mobileLast4 = expressQueryForm.mobileLast4
    const res = await trackedExpress(params)
    expressData.value = res.data || null
    expressQueryVisible.value = false
  } catch (error) {
    console.error('查询物流轨迹失败', error)
  } finally {
    expressLoading.value = false
    releaseTenantContext()
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
    // 轨迹接口复用工单对象级权限，所有可查看当前工单的用户均可查看。
    await loadAuditLogs(id)
    // 加载评论
    await loadComments()
    // 自动加载物流信息
    if (detail.value.trackingNo) {
      loadExpressInfo()
    }
  } catch (error) {
    const resData = error.response?.data
    const msg = resData?.message || error.message || ''
    if (msg.includes('无权查看此工单') || (resData?.code === 400 && msg.includes('无权'))) {
      router.replace('/workorder/list')
    }
  } finally {
    loading.value = false
  }
}

// 加载物流信息
async function loadExpressInfo() {
  expressLoading.value = true
  try {
    const res = await trackedExpress({ trackingNo: detail.value.trackingNo })
    expressData.value = res.data || null
  } catch {
    // 忽略物流加载错误
  } finally {
    expressLoading.value = false
  }
}

// 加载审计日志
async function loadAuditLogs(bizId) {
  try {
    const res = await getWorkOrderAuditLogs(bizId)
    const records = normalizeAuditRecords(res).sort((left, right) => {
      const timeResult = String(left.createdAt || '').localeCompare(String(right.createdAt || ''))
      if (timeResult !== 0) return timeResult
      return String(left.id || '').localeCompare(String(right.id || ''))
    })
    auditLogs.value = records
    const responseTotal = Number(res.total)
    auditTotal.value = Number.isFinite(responseTotal) ? responseTotal : records.length
    auditTruncated.value = res.truncated === true
  } catch (error) {
    auditLogs.value = []
    auditTotal.value = 0
    auditTruncated.value = false
    console.error('加载工单处理轨迹失败', error)
  }
}

// 加载评论列表
async function loadComments() {
  const id = route.params.id
  if (!id) return
  try {
    const res = await getComments(id)
    comments.value = res.data || []
  } catch {
    // 忽略评论加载错误
  }
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

// 提交评论
async function handleAddComment() {
  if (!commentText.value.trim()) {
    ElMessage.warning('请输入评论内容')
    return
  }
  const releaseTenantContext = acquireWorkOrderOperation()
  if (!releaseTenantContext) return
  commentLoading.value = true
  try {
    await addComment(detail.value.id, { content: commentText.value.trim() })
    ElMessage.success('评论成功')
    commentText.value = ''
    await loadComments()
  } catch {
    // 错误已在 request.js 中处理
  } finally {
    commentLoading.value = false
    releaseTenantContext()
  }
}

// 显示派发弹窗
async function showAssignDialog() {
  if (!canAssignWorkOrder.value || !await loadAssignmentOptions()) return
  assignForm.assignType = 'user'
  assignForm.assigneeId = ''
  assignForm.assigneeRoleCode = ''
  assignDialogVisible.value = true
}

// 派发方式切换
function handleAssignTypeChange() {
  assignForm.assigneeId = ''
  assignForm.assigneeRoleCode = ''
}

// 显示关闭弹窗
function showCloseDialog() {
    forceClosing.value = false
  closeForm.resolution = ''
  closeDialogVisible.value = true
}

  function showForceCloseDialog() {
    closeForm.resolution = ''
    forceClosing.value = true
    closeDialogVisible.value = true
  }

// 显示驳回弹窗
function showRejectDialog() {
  rejectForm.reason = ''
  rejectDialogVisible.value = true
}

// 显示重新提交弹窗
function showResubmitDialog() {
  resubmitForm.title = ''
  resubmitForm.description = ''
  resubmitForm.trackingNo = ''
  resubmitForm.targetAddress = ''
  resubmitForm.type = ''
  resubmitForm.priority = 0
  resubmitDialogVisible.value = true
}

// 显示强制驳回弹窗
function showForceRejectDialog() {
  forceRejectForm.reason = ''
  forceRejectDialogVisible.value = true
}

// 派发工单
async function handleAssign() {
  if (assignForm.assignType === 'user' && !assignForm.assigneeId) {
    ElMessage.warning('请选择处理人')
    return
  }
  if (assignForm.assignType === 'role' && !assignForm.assigneeRoleCode) {
    ElMessage.warning('请选择角色')
    return
  }
  const releaseTenantContext = acquireWorkOrderOperation()
  if (!releaseTenantContext) return
  actionLoading.value = true
  try {
    if (assignForm.assignType === 'user') {
      await assignWorkOrder(detail.value.id, { assigneeId: assignForm.assigneeId })
    } else {
      await assignWorkOrder(detail.value.id, { assigneeRoleCode: assignForm.assigneeRoleCode })
    }
    ElMessage.success('派发成功')
    assignDialogVisible.value = false
    await loadDetail()
  } catch (error) {
    console.error('派发工单失败', error)
  } finally {
    actionLoading.value = false
    releaseTenantContext()
  }
}

// 关闭工单
async function handleClose() {
  if (!closeForm.resolution) {
    ElMessage.warning('请输入处理结论')
    return
  }
  const releaseTenantContext = acquireWorkOrderOperation()
  if (!releaseTenantContext) return
  actionLoading.value = true
  try {
      await (forceClosing.value ? forceCloseWorkOrder : closeWorkOrder)(detail.value.id, closeForm.resolution)
    ElMessage.success('关闭成功')
    closeDialogVisible.value = false
    await loadDetail()
  } catch (error) {
    console.error('关闭工单失败', error)
  } finally {
    actionLoading.value = false
    releaseTenantContext()
  }
}

// 驳回工单
async function handleReject() {
  if (!rejectForm.reason) {
    ElMessage.warning('请输入驳回原因')
    return
  }
  const releaseTenantContext = acquireWorkOrderOperation()
  if (!releaseTenantContext) return
  actionLoading.value = true
  try {
    await rejectWorkOrder(detail.value.id, rejectForm.reason)
    ElMessage.success('驳回成功')
    rejectDialogVisible.value = false
    await loadDetail()
  } catch (error) {
    console.error('驳回工单失败', error)
  } finally {
    actionLoading.value = false
    releaseTenantContext()
  }
}

// 重新提交工单
async function handleResubmit() {
  const data = {}
  if (resubmitForm.title) data.title = resubmitForm.title
  if (resubmitForm.description) data.description = resubmitForm.description
  if (resubmitForm.trackingNo) data.trackingNo = resubmitForm.trackingNo
  if (resubmitForm.targetAddress) data.targetAddress = resubmitForm.targetAddress
  if (resubmitForm.type) data.type = resubmitForm.type
  if (resubmitForm.priority > 0) data.priority = resubmitForm.priority

  const releaseTenantContext = acquireWorkOrderOperation()
  if (!releaseTenantContext) return
  actionLoading.value = true
  try {
    await resubmitWorkOrder(detail.value.id, data)
    ElMessage.success('重新提交成功')
    resubmitDialogVisible.value = false
    await loadDetail()
  } catch (error) {
    console.error('重新提交工单失败', error)
  } finally {
    actionLoading.value = false
    releaseTenantContext()
  }
}

// 强制驳回工单
async function handleForceReject() {
  if (!forceRejectForm.reason) {
    ElMessage.warning('请输入驳回原因')
    return
  }
  const releaseTenantContext = acquireWorkOrderOperation()
  if (!releaseTenantContext) return
  actionLoading.value = true
  try {
    await forceRejectWorkOrder(detail.value.id, forceRejectForm.reason)
    ElMessage.success('强制驳回成功')
    forceRejectDialogVisible.value = false
    await loadDetail()
  } catch (error) {
    console.error('强制驳回工单失败', error)
  } finally {
    actionLoading.value = false
    releaseTenantContext()
  }
}

// 返回
function handleBack() {
  router.back()
}

// 加载快递公司列表
async function loadExpressCompanies() {
  try {
    const res = await getExpressCompanies()
    expressCompanies.value = res.data || []
  } catch {}
}

onMounted(() => {
  loadDetail()
  loadExpressCompanies()
})
</script>

<style scoped>
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.detail-actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
}

.detail-actions .el-button {
  margin-left: 0;
}

.detail-copy-value {
  max-width: 100%;
}

.detail-copy-value :deep(.opaque-id__text) {
  overflow: visible;
  text-overflow: clip;
  white-space: normal;
  word-break: break-word;
}

.process-section {
  margin-top: 24px;
}

.record-count {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.trajectory-limit-alert {
  margin-bottom: 16px;
}

.process-timeline {
  max-height: 600px;
  padding: 2px 4px 0 0;
  overflow-y: auto;
}

.process-card :deep(.el-card__body) {
  padding: 14px;
}

.process-card-header,
.process-operator,
.process-detail-item {
  display: flex;
  align-items: center;
}

.process-card-header {
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.process-time {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.process-operator {
  gap: 8px;
  margin-bottom: 10px;
}

.process-label {
  flex: 0 0 auto;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.operator-id-copy :deep(.opaque-id__text) {
  display: none;
}

.process-detail-grid {
  display: grid;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.process-detail-item {
  align-items: flex-start;
  gap: 10px;
}

.process-detail-item .process-label {
  min-width: 64px;
}

.process-detail-value {
  min-width: 0;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.log-detail {
  color: var(--el-text-color-regular);
  font-size: 13px;
  margin: 0;
  line-height: 1.5;
  white-space: pre-wrap;
}

.log-detail.is-empty {
  color: var(--el-text-color-placeholder);
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

.express-timeline-wrapper {
  max-height: 400px;
  overflow-y: auto;
  margin-top: 16px;
  padding-right: 8px;
}

.express-timeline-wrapper::-webkit-scrollbar {
  width: 6px;
}

.express-timeline-wrapper::-webkit-scrollbar-thumb {
  background-color: #dcdfe6;
  border-radius: 3px;
}

.express-timeline-wrapper::-webkit-scrollbar-track {
  background-color: transparent;
}

.express-timeline {
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

.comment-section {
  padding: 0 8px;
}

.comment-section h4 {
  margin: 0 0 16px;
}

.comment-input {
  margin-bottom: 24px;
}

.comment-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.comment-item {
  padding: 16px;
  background-color: #f5f7fa;
  border-radius: 4px;
}

.comment-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.comment-author {
  font-weight: 600;
  color: #303133;
}

.comment-time {
  font-size: 12px;
  color: #909399;
}

.comment-content {
  font-size: 14px;
  color: #606266;
  line-height: 1.6;
  white-space: pre-wrap;
}

:global(html.is-mobile-view .workorder-detail .card-header) {
  align-items: flex-start;
  flex-direction: column;
  gap: 10px;
}

:global(html.is-mobile-view .workorder-detail .detail-actions) {
  width: 100%;
  justify-content: flex-start;
}

:global(html.is-mobile-view .express-section),
:global(html.is-mobile-view .file-section),
:global(html.is-mobile-view .comment-item) {
  padding: 12px;
}

:global(html.is-mobile-view .process-card-header) {
  align-items: flex-start;
  flex-direction: column;
  gap: 6px;
}

:global(html.is-mobile-view .comment-header) {
  align-items: flex-start;
  flex-direction: column;
}
</style>
