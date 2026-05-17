<template>
  <div class="workorder-create">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span>创建工单</span>
          <el-button icon="ArrowLeft" @click="handleBack">返回</el-button>
        </div>
      </template>

      <!-- NLP 智能解析区域 -->
      <el-card class="nlp-section" shadow="never">
        <template #header>
          <span>NLP 智能解析</span>
        </template>
        <el-input
          v-model="nlpText"
          type="textarea"
          :rows="4"
          placeholder="请粘贴杂乱的物流诉求，例如：&#10;SF12345 改地址 广州天河区&#10;YTO98765 破损 外包装破裂"
        />
        <el-button
          type="primary"
          class="nlp-btn"
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
            :rows="4"
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
          <FileUpload ref="fileUploadRef" v-model="form.fileIds" :limit="5" deferred />
        </el-form-item>

        <el-divider content-position="left">外部货主信息（选填）</el-divider>

        <el-form-item label="外部发送人ID" prop="senderStaffId">
          <el-input v-model="form.senderStaffId" placeholder="货主侧发送人ID（选填）" />
        </el-form-item>

        <el-form-item label="外部群ID" prop="conversationId">
          <el-input v-model="form.conversationId" placeholder="货主侧群ID（选填）" />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" :loading="submitLoading" @click="handleSubmit">
            提交工单
          </el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { createWorkOrder, aiParse } from '@/api/workorder'
import { ElMessage } from 'element-plus'
import FileUpload from '@/components/FileUpload.vue'

const router = useRouter()

const formRef = ref(null)
const fileUploadRef = ref(null)
const nlpText = ref('')
const nlpLoading = ref(false)
const submitLoading = ref(false)

// 工单表单
const form = reactive({
  type: '',
  trackingNo: '',
  title: '',
  description: '',
  priority: 2,
  targetAddress: '',
  senderStaffId: '',
  conversationId: '',
  fileIds: [],
})

// 表单验证规则
const rules = {
  title: [{ required: true, message: '请输入工单标题', trigger: 'blur' }],
  priority: [{ required: true, message: '请选择优先级', trigger: 'change' }],
}

// NLP 智能解析
async function handleNlpParse() {
  if (!nlpText.value.trim()) {
    ElMessage.warning('请输入物流诉求文本')
    return
  }

  nlpLoading.value = true
  try {
    const res = await aiParse(nlpText.value)
    const data = res.data

    form.type = data.type || 'OTHER'
    form.trackingNo = data.trackingNo || ''
    form.title = data.title || ''
    form.description = data.description || ''
    form.targetAddress = data.targetAddress || ''
    form.priority = data.priority || 2

    ElMessage.success('智能识别完成，请检查并补充信息')
  } catch (error) {
    if (error.response?.status === 429) {
      ElMessage.error('请求过于频繁，请稍后再试（每分钟最多10次）')
    } else if (error.response?.status === 400) {
      ElMessage.error('不合法的输入')
    } else {
      ElMessage.error('解析失败，请手动填写')
    }
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
    const data = {
      title: form.title,
      description: form.description,
      trackingNo: form.trackingNo,
      targetAddress: form.targetAddress,
      priority: form.priority,
    }
    if (form.type) data.type = form.type
    if (form.senderStaffId) data.senderStaffId = form.senderStaffId
    if (form.conversationId) data.conversationId = form.conversationId
    const res = await createWorkOrder(data)

    const workOrderId = res.data?.id
    if (fileUploadRef.value && workOrderId) {
      await fileUploadRef.value.uploadAll(workOrderId)
    }

    ElMessage.success('工单创建成功')
    router.push('/workorder/list')
  } catch (error) {
    // 错误已在 request.js 中处理
  } finally {
    submitLoading.value = false
  }
}

// 重置表单
function handleReset() {
  formRef.value.resetFields()
}

// 返回
function handleBack() {
  router.back()
}
</script>

<style scoped>
.workorder-create {
  max-width: 800px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.nlp-section {
  margin-bottom: 24px;
  background-color: #f5f7fa;
}

.nlp-btn {
  margin-top: 12px;
}

.workorder-form {
  margin-top: 24px;
}
</style>
