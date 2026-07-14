<template>
  <div class="workorder-create-editor">
    <el-segmented v-model="mode" :options="modeOptions" :disabled="busy || hasCreatedOrders" />

    <el-card class="nlp-section" shadow="never">
      <template #header>
        <div class="section-header">
          <span>{{ mode === 'single' ? '智能解析' : '批量内容（一行一条）' }}</span>
          <span v-if="mode === 'batch'" class="counter">{{ batchText.length }}/2000</span>
        </div>
      </template>

      <template v-if="mode === 'single'">
        <el-input
          v-model="singleText"
          type="textarea"
          :rows="4"
          :disabled="busy || hasCreatedOrders"
          placeholder="示例：YT7621300222910 更址 上海市青浦区……"
        />
        <el-button type="primary" class="nlp-btn" :loading="aiLoading" :disabled="hasCreatedOrders" @click="parseSingle">
          智能识别
        </el-button>
      </template>

      <template v-else>
        <el-input
          v-model="batchText"
          type="textarea"
          :rows="6"
          maxlength="2000"
          show-word-limit
          :disabled="busy || hasCreatedOrders"
          placeholder="每行一条物流诉求，最多 20 条；重复行会在本地去重"
        />
        <div class="batch-actions">
          <el-button :disabled="busy || hasCreatedOrders" @click="extractLocally">本地提取并去重</el-button>
          <el-button type="primary" :loading="aiLoading" :disabled="hasCreatedOrders" @click="parseBatch">
            AI 批量识别
          </el-button>
        </div>
      </template>
    </el-card>

    <el-alert
      v-if="mixedTypeWarning"
      title="检测到混合工单类型，请确认统一的工单类型后再提交。"
      type="warning"
      :closable="false"
      show-icon
      class="type-warning"
    />

    <el-form
      v-if="mode === 'single'"
      ref="singleFormRef"
      :model="singleForm"
      :rules="singleRules"
      label-width="100px"
      class="workorder-form"
    >
      <el-form-item label="工单类型" prop="type">
        <el-select v-model="singleForm.type" :disabled="busy || hasCreatedOrders" placeholder="请选择工单类型">
          <el-option v-for="option in typeOptions" :key="option.value" v-bind="option" />
        </el-select>
      </el-form-item>
      <el-form-item label="物流单号" prop="trackingNo">
        <el-input v-model="singleForm.trackingNo" :disabled="busy || hasCreatedOrders" placeholder="请输入物流单号" />
      </el-form-item>
      <el-form-item label="工单标题" prop="title">
        <el-input v-model="singleForm.title" :disabled="busy || hasCreatedOrders" maxlength="200" show-word-limit />
      </el-form-item>
      <el-form-item label="工单描述" prop="description">
        <el-input v-model="singleForm.description" :disabled="busy || hasCreatedOrders" type="textarea" :rows="4" />
      </el-form-item>
      <el-form-item label="优先级" prop="priority">
        <el-radio-group v-model="singleForm.priority" :disabled="busy || hasCreatedOrders">
          <el-radio :value="1">低</el-radio>
          <el-radio :value="2">中</el-radio>
          <el-radio :value="3">高</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="诉求目标" prop="targetAddress">
        <el-input v-model="singleForm.targetAddress" :disabled="busy || hasCreatedOrders" maxlength="500" />
      </el-form-item>
      <el-divider content-position="left">外部货主信息（选填）</el-divider>
      <el-form-item label="外部发送人ID" prop="senderStaffId">
        <el-input v-model="singleForm.senderStaffId" :disabled="busy || hasCreatedOrders" />
      </el-form-item>
      <el-form-item label="外部群ID" prop="conversationId">
        <el-input v-model="singleForm.conversationId" :disabled="busy || hasCreatedOrders" />
      </el-form-item>
    </el-form>

    <template v-else>
      <el-form label-width="100px" class="workorder-form">
        <el-form-item label="统一类型" required>
          <el-select v-model="batchType" :disabled="busy || hasCreatedOrders" placeholder="请选择所有工单的统一类型">
            <el-option v-for="option in typeOptions" :key="option.value" v-bind="option" />
          </el-select>
        </el-form-item>
      </el-form>
      <el-empty v-if="batchItems.length === 0" description="请先输入内容并提取，或使用 AI 批量识别" />
      <div v-else class="batch-list">
        <el-card v-for="(item, index) in batchItems" :key="`${index}-${item.sourceLine}`" shadow="never" class="batch-item">
          <template #header>
            <div class="section-header">
              <strong>第 {{ index + 1 }} 条</strong>
              <el-tag v-if="item.detectedType && item.detectedType !== batchType" type="warning" size="small">
                AI 类型：{{ typeLabel(item.detectedType) }}
              </el-tag>
            </div>
          </template>
          <el-form :model="item" label-width="82px">
            <el-form-item label="原文"><span class="source-line">{{ item.sourceLine }}</span></el-form-item>
            <el-form-item label="物流单号"><el-input v-model="item.trackingNo" :disabled="busy || hasCreatedOrders" maxlength="50" /></el-form-item>
            <el-form-item label="标题" required><el-input v-model="item.title" :disabled="busy || hasCreatedOrders" maxlength="200" show-word-limit /></el-form-item>
            <el-form-item label="描述"><el-input v-model="item.description" :disabled="busy || hasCreatedOrders" type="textarea" :rows="2" /></el-form-item>
            <el-form-item label="目标地址"><el-input v-model="item.targetAddress" :disabled="busy || hasCreatedOrders" maxlength="500" /></el-form-item>
            <el-form-item label="优先级">
              <el-radio-group v-model="item.priority" :disabled="busy || hasCreatedOrders">
                <el-radio :value="1">低</el-radio><el-radio :value="2">中</el-radio><el-radio :value="3">高</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-form>
        </el-card>
      </div>
    </template>

    <el-form label-width="100px" class="attachment-form">
      <el-form-item :label="mode === 'batch' ? '公共附件' : '举证截图'">
        <FileUpload ref="fileUploadRef" v-model="fileIds" :limit="5" deferred :disabled="busy || hasCreatedOrders" />
        <div v-if="mode === 'batch'" class="attachment-tip">每个公共附件都会复制上传到本批次的每个工单。</div>
      </el-form-item>
    </el-form>

    <el-alert
      v-if="hasCreatedOrders && uploadFailed"
      :title="`${createdIds.length} 个工单已创建；失败附件可直接重试，已成功任务不会重复上传。`"
      type="warning"
      :closable="false"
      show-icon
      class="upload-warning"
    />

    <div class="editor-actions">
      <el-button v-if="showCancel" :disabled="busy" @click="$emit('cancel')">取消</el-button>
      <el-button :disabled="busy || hasCreatedOrders" @click="reset">重置</el-button>
      <el-button type="primary" :loading="submitLoading" @click="submit">
        {{ uploadFailed ? '重试失败附件' : mode === 'batch' ? '批量创建' : '提交工单' }}
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import FileUpload from '@/components/FileUpload.vue'
import { aiParse, aiParseBatch, createWorkOrder, createWorkOrdersBatch } from '@/api/workorder'
import { useUserStore } from '@/stores/user'
import {
  buildBatchCreatePayload,
  createIdempotencyKey,
  extractBatchItems,
  normalizeBatchCreateResponse,
  normalizeBatchLines,
  normalizeBatchParseResponse,
} from '@/utils/workorder-create'

defineProps({ showCancel: { type: Boolean, default: false } })
const emit = defineEmits(['cancel', 'completed'])
const userStore = useUserStore()

const modeOptions = [{ label: '单个创建', value: 'single' }, { label: '批量创建', value: 'batch' }]
const typeOptions = [
  { label: '改地址', value: 'CHANGE_ADDRESS' },
  { label: '拦截', value: 'INTERCEPT' },
  { label: '破损', value: 'DAMAGE' },
  { label: '丢失', value: 'LOST' },
  { label: '其他', value: 'OTHER' },
]
const mode = ref('single')
const singleText = ref('')
const batchText = ref('')
const batchType = ref('')
const batchItems = ref([])
const mixedTypeWarning = ref(false)
const fileIds = ref([])
const singleFormRef = ref(null)
const fileUploadRef = ref(null)
const aiLoading = ref(false)
const submitLoading = ref(false)
const createdIds = ref([])
const batchReplayed = ref(false)
const uploadFailed = ref(false)
const idempotencyKey = ref('')
const idempotencyPayload = ref('')
const hasCreatedOrders = computed(() => createdIds.value.length > 0)
const busy = computed(() => aiLoading.value || submitLoading.value)

const singleForm = reactive(newSingleForm())
const singleRules = {
  title: [{ required: true, message: '请输入工单标题', trigger: 'blur' }],
  priority: [{ required: true, message: '请选择优先级', trigger: 'change' }],
}

function newSingleForm() {
  return { type: '', trackingNo: '', title: '', description: '', priority: 2, targetAddress: '', senderStaffId: '', conversationId: '' }
}

function typeLabel(type) {
  return typeOptions.find((option) => option.value === type)?.label || type
}

function acquireOperation() {
  const release = userStore.acquireTenantContextOperation()
  if (!release) ElMessage.warning('租户切换正在进行，请稍后重试')
  return release
}

async function withTenantLock(loadingRef, operation) {
  const release = acquireOperation()
  if (!release) return
  loadingRef.value = true
  try {
    return await operation()
  } finally {
    loadingRef.value = false
    release()
  }
}

async function parseSingle() {
  if (!singleText.value.trim()) return ElMessage.warning('请输入物流诉求文本')
  await withTenantLock(aiLoading, async () => {
    try {
      const response = await aiParse(singleText.value)
      const data = response.data || {}
      Object.assign(singleForm, {
        type: data.type || 'OTHER', trackingNo: data.trackingNo || '', title: data.title || '',
        description: data.description || '', targetAddress: data.targetAddress || '', priority: Number(data.priority) || 2,
      })
      ElMessage.success('识别完成，请检查并补充信息')
    } catch (error) {
      console.error('智能解析失败', error)
    }
  })
}

function useExtracted(result) {
  if (result.error) return ElMessage.warning(result.error)
  if (result.items.length === 0) return ElMessage.warning('请输入至少一条非空内容')
  batchItems.value = result.items
  mixedTypeWarning.value = false
  if (result.duplicates.length) ElMessage.warning(`已去除 ${result.duplicates.length} 条重复内容`)
  else ElMessage.success(`已提取 ${result.items.length} 条内容`)
}

function extractLocally() {
  useExtracted(extractBatchItems(batchText.value))
}

async function parseBatch() {
  const linesResult = normalizeBatchLines(batchText.value)
  if (linesResult.error) return ElMessage.warning(linesResult.error)
  if (!linesResult.lines.length) return ElMessage.warning('请输入至少一条非空内容')
  if (linesResult.duplicates.length) {
    batchText.value = linesResult.lines.join('\n')
    ElMessage.warning(`已去除 ${linesResult.duplicates.length} 条重复内容后再识别`)
  }
  await withTenantLock(aiLoading, async () => {
    try {
      const response = await aiParseBatch(linesResult.lines.join('\n'), batchType.value || undefined)
      const normalized = normalizeBatchParseResponse(response, linesResult.lines)
      if (normalized.items.length !== linesResult.lines.length) throw new Error('批量解析返回条数与输入不一致')
      batchItems.value = normalized.items
      if (normalized.type) batchType.value = normalized.type
      mixedTypeWarning.value = normalized.detectedTypes.length > 1
        || normalized.items.some((item) => item.warnings.some((warning) => warning.startsWith('TYPE_CONFLICT:')))
      ElMessage.success('批量识别完成，请逐条校对')
    } catch (error) {
      console.error('批量智能解析失败', error)
      if (!(error?.isAxiosError)) ElMessage.warning(error.message || '批量解析结果无效')
    }
  })
}

function validateBatch() {
  if (!batchType.value) return '请选择统一工单类型'
  if (!batchItems.value.length) return '请先提取批量内容'
  if (batchItems.value.length > 20) return '一次最多创建 20 个工单'
  const trackingNumbers = new Set()
  for (let index = 0; index < batchItems.value.length; index += 1) {
    const item = batchItems.value[index]
    if (!item.title?.trim()) return `第 ${index + 1} 条标题不能为空`
    const trackingNo = item.trackingNo?.trim().toLocaleLowerCase()
    if (trackingNo && trackingNumbers.has(trackingNo)) return `批内物流单号重复：${item.trackingNo.trim()}`
    if (trackingNo) trackingNumbers.add(trackingNo)
  }
  return ''
}

async function createOrders() {
  if (mode.value === 'single') {
    const valid = await singleFormRef.value?.validate().catch(() => false)
    if (!valid) return false
    const data = {
      title: singleForm.title, description: singleForm.description, trackingNo: singleForm.trackingNo,
      targetAddress: singleForm.targetAddress, priority: singleForm.priority,
    }
    if (singleForm.type) data.type = singleForm.type
    if (singleForm.senderStaffId) data.senderStaffId = singleForm.senderStaffId
    if (singleForm.conversationId) data.conversationId = singleForm.conversationId
    const response = await createWorkOrder(data)
    const id = response.data?.id ?? response.data?.data?.id
    if (id === null || id === undefined) throw new Error('创建响应缺少工单 ID')
    createdIds.value = [String(id)]
    return true
  }

  const validationError = validateBatch()
  if (validationError) {
    ElMessage.warning(validationError)
    return false
  }
  const payload = buildBatchCreatePayload(batchItems.value, batchType.value)
  const payloadFingerprint = JSON.stringify(payload)
  if (!idempotencyKey.value || idempotencyPayload.value !== payloadFingerprint) {
    idempotencyKey.value = createIdempotencyKey()
    idempotencyPayload.value = payloadFingerprint
  }
  const response = await createWorkOrdersBatch(payload, idempotencyKey.value)
  const normalized = normalizeBatchCreateResponse(response)
  if (normalized.workOrderIds.length !== batchItems.value.length) throw new Error('批量创建响应 ID 数量与提交条数不一致')
  createdIds.value = normalized.workOrderIds
  batchReplayed.value = normalized.replayed
  return true
}

async function submit() {
  await withTenantLock(submitLoading, async () => {
    try {
      if (!hasCreatedOrders.value && !(await createOrders())) return
      if (fileUploadRef.value) await fileUploadRef.value.uploadAll(createdIds.value)
      uploadFailed.value = false
      ElMessage.success(batchReplayed.value ? '幂等重放完成，附件已核对' : `${createdIds.value.length} 个工单创建成功`)
      emit('completed', { mode: mode.value, workOrderIds: [...createdIds.value], replayed: batchReplayed.value })
    } catch (error) {
      console.error('创建工单或上传附件失败', error)
      if (hasCreatedOrders.value) {
        uploadFailed.value = true
        ElMessage.warning(`工单已创建，但有附件上传失败：${error.message || '请重试'}`)
      } else if (!error?.isAxiosError) {
        ElMessage.warning(error.message || '创建工单失败')
      }
    }
  })
}

function reset() {
  Object.assign(singleForm, newSingleForm())
  singleFormRef.value?.clearValidate()
  singleText.value = ''
  batchText.value = ''
  batchType.value = ''
  batchItems.value = []
  mixedTypeWarning.value = false
  fileIds.value = []
  createdIds.value = []
  batchReplayed.value = false
  uploadFailed.value = false
  idempotencyKey.value = ''
  idempotencyPayload.value = ''
  fileUploadRef.value?.reset()
}

watch(mode, () => reset())
defineExpose({ reset })
</script>

<style scoped>
.nlp-section { margin-top: 16px; background: #f5f7fa; }
.nlp-btn { margin-top: 12px; }
.section-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.counter, .attachment-tip { color: #909399; font-size: 12px; }
.batch-actions { display: flex; gap: 10px; margin-top: 12px; }
.workorder-form, .attachment-form { margin-top: 20px; }
.type-warning, .upload-warning { margin-top: 16px; }
.batch-list { display: grid; gap: 12px; max-height: 52vh; overflow: auto; padding-right: 4px; }
.batch-item { background: #fafafa; }
.source-line { word-break: break-all; color: #606266; }
.attachment-tip { width: 100%; margin-top: 6px; }
.editor-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
</style>
