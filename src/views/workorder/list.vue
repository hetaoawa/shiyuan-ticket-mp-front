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
            @click="showCreateDialog = true"
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

    <!-- 创建工单弹窗 -->
    <el-dialog
      v-model="showCreateDialog"
      title="创建工单"
      width="700px"
      :close-on-click-modal="false"
      @closed="handleDialogClosed"
    >
      <!-- NLP 智能解析区域 -->
      <el-card class="nlp-section" shadow="never">
        <template #header>
          <span>NLP 智能解析</span>
        </template>
        <el-input
          v-model="nlpText"
          type="textarea"
          :rows="3"
          placeholder="请粘贴杂乱的物流诉求，例如：&#10;SF12345 改地址 广州天河区&#10;YTO98765 破损 外包装破裂"
        />
        <el-button
          type="primary"
          class="nlp-btn"
          size="small"
          :loading="nlpLoading"
          @click="handleNlpParse"
        >
          智能识别
        </el-button>
      </el-card>

      <!-- 工单表单 -->
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="100px"
        class="workorder-form"
      >
        <el-form-item label="工单类型" prop="type">
          <el-select v-model="form.type" placeholder="请选择工单类型">
            <el-option label="改地址" value="CHANGE_ADDRESS" />
            <el-option label="拦截" value="INTERCEPT" />
            <el-option label="破损" value="DAMAGE" />
            <el-option label="丢失" value="LOST" />
            <el-option label="其他" value="OTHER" />
          </el-select>
        </el-form-item>

        <el-form-item label="物流单号" prop="trackingNo">
          <el-input v-model="form.trackingNo" placeholder="请输入物流单号" />
        </el-form-item>

        <el-form-item label="工单标题" prop="title">
          <el-input v-model="form.title" placeholder="请输入工单标题" />
        </el-form-item>

        <el-form-item label="工单描述" prop="description">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="3"
            placeholder="请输入工单详细描述"
          />
        </el-form-item>

        <el-form-item label="优先级" prop="priority">
          <el-radio-group v-model="form.priority">
            <el-radio :value="1">低</el-radio>
            <el-radio :value="2">中</el-radio>
            <el-radio :value="3">高</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="诉求目标" prop="targetAddress">
          <el-input
            v-model="form.targetAddress"
            placeholder="如改地址的目标地址"
          />
        </el-form-item>

        <el-form-item label="举证截图">
          <FileUpload v-model="form.fileIds" :limit="5" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleSubmit">
          提交工单
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getWorkOrderList, createWorkOrder } from '@/api/workorder'
import { ElMessage } from 'element-plus'
import FileUpload from '@/components/FileUpload.vue'

const router = useRouter()

const loading = ref(false)
const tableData = ref([])
const showCreateDialog = ref(false)

// 创建工单相关
const formRef = ref(null)
const nlpText = ref('')
const nlpLoading = ref(false)
const submitLoading = ref(false)

const form = reactive({
  type: '',
  trackingNo: '',
  title: '',
  description: '',
  priority: 2,
  targetAddress: '',
  fileIds: [],
})

const rules = {
  title: [{ required: true, message: '请输入工单标题', trigger: 'blur' }],
  priority: [{ required: true, message: '请选择优先级', trigger: 'change' }],
}

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

// NLP 智能解析（Mock）
async function handleNlpParse() {
  if (!nlpText.value.trim()) {
    ElMessage.warning('请输入物流诉求文本')
    return
  }

  nlpLoading.value = true
  try {
    await new Promise((resolve) => setTimeout(resolve, 1000))

    const text = nlpText.value
    let type = 'OTHER'
    let trackingNo = ''
    let targetAddress = ''

    const trackingMatch = text.match(/[A-Z]{2}\d{6,}/i)
    if (trackingMatch) {
      trackingNo = trackingMatch[0]
    }

    if (text.includes('改地址') || text.includes('地址')) {
      type = 'CHANGE_ADDRESS'
      const addrMatch = text.match(/(?:改地址|地址)[：:]\s*(.+)/)
      if (addrMatch) targetAddress = addrMatch[1]
    } else if (text.includes('拦截')) {
      type = 'INTERCEPT'
    } else if (text.includes('破损') || text.includes('损坏')) {
      type = 'DAMAGE'
    } else if (text.includes('丢失') || text.includes('丢件')) {
      type = 'LOST'
    }

    form.type = type
    form.trackingNo = trackingNo
    form.title = `${getOrderTypeLabel(type)}工单${trackingNo ? ' - ' + trackingNo : ''}`
    form.description = text
    form.targetAddress = targetAddress

    ElMessage.success('智能识别完成，请检查并补充信息')
  } catch (error) {
    ElMessage.error('解析失败，请手动填写')
  } finally {
    nlpLoading.value = false
  }
}

// 获取工单类型标签
function getOrderTypeLabel(type) {
  const map = {
    CHANGE_ADDRESS: '改地址',
    INTERCEPT: '拦截',
    DAMAGE: '破损',
    LOST: '丢失',
    OTHER: '其他',
  }
  return map[type] || '其他'
}

// 提交表单
async function handleSubmit() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  submitLoading.value = true
  try {
    await createWorkOrder({
      title: form.title,
      description: form.description,
      trackingNo: form.trackingNo,
      targetAddress: form.targetAddress,
      type: form.type,
      priority: form.priority,
    })
    ElMessage.success('工单创建成功')
    showCreateDialog.value = false
    loadData()
  } catch (error) {
    // 错误已在 request.js 中处理
  } finally {
    submitLoading.value = false
  }
}

// 弹窗关闭时重置表单
function handleDialogClosed() {
  formRef.value?.resetFields()
  nlpText.value = ''
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

.nlp-section {
  margin-bottom: 16px;
  background-color: #f5f7fa;
}

.nlp-btn {
  margin-top: 8px;
}

.workorder-form {
  margin-top: 8px;
}
</style>
