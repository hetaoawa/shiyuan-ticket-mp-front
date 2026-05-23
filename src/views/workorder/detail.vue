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
          </div>
        </div>
      </template>

      <el-row :gutter="24">
        <!-- 左侧基础信息 -->
        <el-col :span="12">
          <el-descriptions title="基础信息" :column="1" border>
            <el-descriptions-item label="工单ID">
              <span class="copyable" @click="handleCopy(detail.id)">
                {{ detail.id }}
                <el-icon class="copy-icon"><CopyDocument /></el-icon>
              </span>
            </el-descriptions-item>
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
              <span v-if="detail.trackingNo" class="copyable" @click="handleCopy(detail.trackingNo)">
                {{ detail.trackingNo }}
                <el-icon class="copy-icon"><CopyDocument /></el-icon>
              </span>
              <span v-else>无</span>
            </el-descriptions-item>
            <el-descriptions-item label="目标地址">
              <span v-if="detail.targetAddress" class="copyable" @click="handleCopy(detail.targetAddress)">
                {{ detail.targetAddress }}
                <el-icon class="copy-icon"><CopyDocument /></el-icon>
              </span>
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
        <el-col :span="12">
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
              <el-descriptions :column="2" size="small" border>
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
                <p class="log-detail" v-if="log.detail">{{ formatDetail(log.detail) }}</p>
              </el-card>
            </el-timeline-item>
            <el-timeline-item v-if="auditLogs.length === 0" timestamp="暂无记录">
              <p>暂无处理轨迹</p>
            </el-timeline-item>
          </el-timeline>
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
import { ref, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getWorkOrderDetail, assignWorkOrder, closeWorkOrder, rejectWorkOrder, resubmitWorkOrder, forceRejectWorkOrder } from '@/api/workorder'
import { getAuditLogs } from '@/api/audit'
import { trackedExpress, traceExpress, getExpressCompanies } from '@/api/express'
import { getComments, addComment } from '@/api/comment'
import { getSimpleUserList } from '@/api/admin/user'
import { getRoleList } from '@/api/admin/role'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CopyDocument, ArrowLeft } from '@element-plus/icons-vue'
import FileUpload from '@/components/FileUpload.vue'

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const actionLoading = ref(false)
const expressLoading = ref(false)
const expressForceLoading = ref(false)
const detail = ref({})
const auditLogs = ref([])
const expressData = ref(null)
const fileIds = ref([])
const expressCompanies = ref([])
const comments = ref([])
const commentText = ref('')
const commentLoading = ref(false)
const userList = ref([])
const warehouseRoleOptions = ref([])

// 弹窗控制
const assignDialogVisible = ref(false)
const closeDialogVisible = ref(false)
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

// 复制到剪贴板
async function handleCopy(text) {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('已复制')
  } catch {
    ElMessage.error('复制失败')
  }
}

// 强制刷新物流轨迹
async function handleForceTraceExpress() {
  if (!detail.value.trackingNo) return
  expressForceLoading.value = true
  try {
    const res = await traceExpress({ trackingNo: detail.value.trackingNo })
    expressData.value = res.data || null
  } catch (error) {
    const msg = error.response?.data?.message
    if (msg) {
      if (msg.includes('手机号')) {
        showExpressQueryDialog()
      } else {
        ElMessage.warning(msg)
      }
    }
  } finally {
    expressForceLoading.value = false
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
  expressLoading.value = true
  try {
    const params = { trackingNo: detail.value.trackingNo }
    if (expressQueryForm.cpCode) params.cpCode = expressQueryForm.cpCode
    if (expressQueryForm.mobileLast4) params.mobileLast4 = expressQueryForm.mobileLast4
    const res = await trackedExpress(params)
    expressData.value = res.data || null
    expressQueryVisible.value = false
  } catch (error) {
    const msg = error.response?.data?.message
    if (msg) {
      ElMessage.warning(msg)
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
    const res = await getAuditLogs({ bizId, pageSize: 50 })
    auditLogs.value = res.data || []
  } catch (error) {
    // 忽略审计日志加载错误
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

// 加载用户列表
async function loadUserList() {
  try {
    const res = await getSimpleUserList()
    userList.value = res.data || []
  } catch {
    // 忽略用户列表加载错误
  }
}

// 加载云仓侧角色列表
async function loadWarehouseRoles() {
  try {
    const res = await getRoleList()
    const allRoles = res.data || []
    warehouseRoleOptions.value = allRoles.filter(r => r.roleCode === 'WAREHOUSE_ADMIN')
  } catch {
    // 忽略角色列表加载错误
  }
}

// 提交评论
async function handleAddComment() {
  if (!commentText.value.trim()) {
    ElMessage.warning('请输入评论内容')
    return
  }
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
  }
}

// 显示派发弹窗
function showAssignDialog() {
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
  closeForm.resolution = ''
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
  actionLoading.value = true
  try {
    if (assignForm.assignType === 'user') {
      await assignWorkOrder(detail.value.id, { assigneeId: assignForm.assigneeId })
    } else {
      await assignWorkOrder(detail.value.id, { assigneeRoleCode: assignForm.assigneeRoleCode })
    }
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

// 重新提交工单
async function handleResubmit() {
  const data = {}
  if (resubmitForm.title) data.title = resubmitForm.title
  if (resubmitForm.description) data.description = resubmitForm.description
  if (resubmitForm.trackingNo) data.trackingNo = resubmitForm.trackingNo
  if (resubmitForm.targetAddress) data.targetAddress = resubmitForm.targetAddress
  if (resubmitForm.type) data.type = resubmitForm.type
  if (resubmitForm.priority > 0) data.priority = resubmitForm.priority

  actionLoading.value = true
  try {
    await resubmitWorkOrder(detail.value.id, data)
    ElMessage.success('重新提交成功')
    resubmitDialogVisible.value = false
    loadDetail()
  } catch (error) {
    // 错误已在 request.js 中处理
  } finally {
    actionLoading.value = false
  }
}

// 强制驳回工单
async function handleForceReject() {
  if (!forceRejectForm.reason) {
    ElMessage.warning('请输入驳回原因')
    return
  }
  actionLoading.value = true
  try {
    await forceRejectWorkOrder(detail.value.id, forceRejectForm.reason)
    ElMessage.success('强制驳回成功')
    forceRejectDialogVisible.value = false
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

// 加载快递公司列表
async function loadExpressCompanies() {
  try {
    const res = await getExpressCompanies()
    expressCompanies.value = res.data || []
  } catch {}
}

onMounted(() => {
  loadDetail()
  loadUserList()
  loadWarehouseRoles()
  loadExpressCompanies()
})
</script>

<style scoped>
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.copyable {
  cursor: pointer;
  color: #409eff;
  transition: opacity 0.2s;
}

.copyable:hover {
  opacity: 0.8;
}

.copy-icon {
  margin-left: 4px;
  font-size: 12px;
  vertical-align: middle;
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
</style>
