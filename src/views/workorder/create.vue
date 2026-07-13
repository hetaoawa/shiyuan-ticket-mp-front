<template>
  <div class="workorder-create">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span>创建工单</span>
          <el-button :icon="ArrowLeft" @click="handleBack">返回</el-button>
        </div>
      </template>

      <!-- 智能解析区域 -->
      <el-card class="nlp-section" shadow="never">
        <template #header>
          <span>智能解析</span>
        </template>
        <el-input
          v-model="nlpText"
          type="textarea"
          :rows="4"
          placeholder="建议按照示例输入:运单号+售后类型（如退回、催件）格式填写。&#10;示例：YT7621300222910 退回&#10;更址：请按运单号+更址+新地址格式填写。示例：YT7621300222910 更址 小李18200000000上海市青浦区盈港东路6679号"
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
import { ArrowLeft } from '@element-plus/icons-vue'
import FileUpload from '@/components/FileUpload.vue'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()

const formRef = ref(null)
const fileUploadRef = ref(null)
const nlpText = ref('')
const nlpLoading = ref(false)
const submitLoading = ref(false)
const createdWorkOrderId = ref(null)

function acquireWorkOrderOperation() {
  const releaseTenantContext = userStore.acquireTenantContextOperation()
  if (!releaseTenantContext) {
    ElMessage.warning('租户切换正在进行，请稍后重试')
  }
  return releaseTenantContext
}

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
    ElMessage.warning('请输入文本')
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

    ElMessage.success('识别完成，请检查并补充信息')
  } catch (error) {
    console.error('智能解析失败', error)
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

  if (createdWorkOrderId.value) {
    ElMessage.warning('工单已创建，请在工单详情中继续上传附件')
    await router.push(`/workorder/detail/${createdWorkOrderId.value}`)
    return
  }

  const releaseTenantContext = acquireWorkOrderOperation()
  if (!releaseTenantContext) return
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
    createdWorkOrderId.value = workOrderId || null
    if (fileUploadRef.value && workOrderId) {
      try {
        await fileUploadRef.value.uploadAll(workOrderId)
      } catch (error) {
        console.error('工单已创建但附件上传失败', error)
        ElMessage.warning(`工单已创建（ID：${workOrderId}），但附件上传失败，请在详情中重新上传`)
        await router.push(`/workorder/detail/${workOrderId}`)
        return
      }
    }

    ElMessage.success('工单创建成功')
    await router.push('/workorder/list')
  } catch (error) {
    console.error('创建工单失败', error)
  } finally {
    submitLoading.value = false
    releaseTenantContext()
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
