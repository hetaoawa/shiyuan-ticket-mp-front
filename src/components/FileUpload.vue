<template>
  <div class="file-upload" v-loading="loading">
    <!-- 图片列表（两种模式共用） -->
    <div class="file-list" v-if="fileList.length > 0">
      <div v-for="(file, index) in fileList" :key="file.localId || file.fileId" class="file-item-wrapper">
        <div class="file-item" @click="handlePreviewByIndex(index)">
          <img v-if="file.url" :src="file.url" class="file-thumbnail" />
          <div v-else class="file-placeholder">
            <el-icon><Document /></el-icon>
          </div>
          <div class="file-name">{{ file.name }}</div>
        </div>
        <el-icon
          v-if="!readonly && !disabled"
          class="file-delete-btn"
          @click.stop="handleDelete(file)"
        >
          <Delete />
        </el-icon>
      </div>
    </div>

    <!-- 上传按钮（非只读模式） -->
    <el-upload
      v-if="!readonly && !disabled && fileList.length < limit"
      :show-file-list="false"
      :http-request="handleUpload"
      :before-upload="beforeUpload"
      accept="image/*"
    >
      <div class="upload-trigger">
        <el-icon><Plus /></el-icon>
      </div>
    </el-upload>

    <div v-if="!readonly" class="el-upload__tip">只能上传图片文件，且不超过 10MB</div>
    <div v-if="fileList.length === 0 && readonly" class="no-files">暂无文件</div>

    <!-- 图片预览弹窗（支持多图切换） -->
    <el-dialog v-model="previewVisible" title="图片预览" width="700px" destroy-on-close>
      <div class="preview-container">
        <el-icon v-if="previewList.length > 1" class="preview-arrow preview-prev" @click="prevImage">
          <ArrowLeft />
        </el-icon>
        <img :src="previewList[previewIndex]?.url" class="preview-image" />
        <el-icon v-if="previewList.length > 1" class="preview-arrow preview-next" @click="nextImage">
          <ArrowRight />
        </el-icon>
      </div>
      <div v-if="previewList.length > 1" class="preview-indicator">
        {{ previewIndex + 1 }} / {{ previewList.length }}
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { Plus, ArrowLeft, ArrowRight, Document, Delete } from '@element-plus/icons-vue'
import { getPresignUrl, confirmUpload, getDownloadUrl, getFilesByBiz, deleteFile } from '@/api/file'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useUserStore } from '@/stores/user'
import {
  createDeferredUploadTask,
  runDeferredUploadTask,
} from '@/utils/deferred-upload'

const userStore = useUserStore()

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => []
  },
  bizType: {
    type: String,
    default: 'WORK_ORDER_IMAGE'
  },
  bizId: {
    type: [String, Number],
    default: null
  },
  limit: {
    type: Number,
    default: 5
  },
  readonly: {
    type: Boolean,
    default: false
  },
  deferred: {
    type: Boolean,
    default: false
  },
  disabled: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue', 'upload-success'])

const fileList = ref([])
const previewVisible = ref(false)
const previewUrl = ref('')
const previewList = ref([])
const previewIndex = ref(0)
const loading = ref(false)
const pendingFiles = ref([])
const uploadTasks = new Map()
let localIdSequence = 0

function createLocalId() {
  localIdSequence += 1
  const random = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${localIdSequence}`
  return `local-${random}`
}

function releasePreviewUrl(file) {
  if (file?.previewUrl) URL.revokeObjectURL(file.previewUrl)
}

function reset() {
  pendingFiles.value.forEach(releasePreviewUrl)
  pendingFiles.value = []
  fileList.value = []
  uploadTasks.clear()
  emit('update:modelValue', [])
}

onBeforeUnmount(() => {
  pendingFiles.value.forEach(releasePreviewUrl)
})

function acquireFileOperation() {
  const releaseTenantContext = userStore.acquireTenantContextOperation()
  if (!releaseTenantContext) {
    ElMessage.warning('租户切换正在进行，请稍后重试')
  }
  return releaseTenantContext
}

onMounted(() => {
  if (props.bizId) {
    loadFilesFromServer()
  } else if (props.modelValue && props.modelValue.length > 0) {
    loadFileList(props.modelValue)
  }
})

watch(() => props.bizId, (val) => {
  if (val) {
    loadFilesFromServer()
  }
})

watch(() => props.modelValue, (val) => {
  if (!props.bizId && val && val.length > 0) {
    loadFileList(val)
  }
}, { immediate: true })

async function loadFilesFromServer() {
  if (!props.bizId) return
  loading.value = true
  try {
    const res = await getFilesByBiz(props.bizType, props.bizId)
    const files = res.data || []
    const list = []
    for (const file of files) {
      try {
        const downloadRes = await getDownloadUrl(file.id)
        list.push({
          name: file.originalName,
          url: downloadRes.data?.downloadUrl || '',
          fileId: file.id
        })
      } catch {
        list.push({ name: file.originalName, url: '', fileId: file.id })
      }
    }
    fileList.value = list
    const fileIds = files.map(f => f.id)
    emit('update:modelValue', fileIds)
  } catch (error) {
    console.error('加载文件列表失败', error)
  } finally {
    loading.value = false
  }
}

async function loadFileList(fileIds) {
  const list = []
  for (const fileId of fileIds) {
    try {
      const res = await getDownloadUrl(fileId)
      list.push({
        name: fileId,
        url: res.data?.downloadUrl || '',
        fileId: fileId
      })
    } catch {
      list.push({ name: fileId, url: '', fileId })
    }
  }
  fileList.value = list
}

function beforeUpload(file) {
  const isImage = file.type.startsWith('image/')
  const isLt10M = file.size / 1024 / 1024 < 10

  if (!isImage) {
    ElMessage.error('只能上传图片文件!')
    return false
  }
  if (!isLt10M) {
    ElMessage.error('图片大小不能超过 10MB!')
    return false
  }
  return true
}

async function handleUpload(options) {
  const file = options.file

  if (props.deferred) {
    const localId = createLocalId()
    const objectUrl = URL.createObjectURL(file)
    pendingFiles.value.push({
      localId,
      file,
      name: file.name,
      previewUrl: objectUrl,
    })
    fileList.value.push({
      localId,
      name: file.name,
      url: objectUrl,
      fileId: null,
      pending: true
    })
    ElMessage.success('文件已暂存')
    return
  }

  const releaseTenantContext = acquireFileOperation()
  if (!releaseTenantContext) {
    options.onError?.(new Error('租户切换正在进行，请稍后重试'))
    return
  }
  try {
    const presignRes = await getPresignUrl({
      originalName: file.name,
      contentType: file.type,
      fileSize: file.size,
      bizType: props.bizType,
      bizId: props.bizId || undefined
    })

    const { fileId, uploadUrl } = presignRes.data

    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type }
    })
    if (!uploadResponse.ok) {
      throw new Error(`对象存储上传失败（HTTP ${uploadResponse.status}）`)
    }

    await confirmUpload(fileId)

    const downloadRes = await getDownloadUrl(fileId)
    const downloadUrl = downloadRes.data?.downloadUrl || ''

    fileList.value.push({
      name: file.name,
      url: downloadUrl,
      fileId: fileId
    })

    const newValue = [...props.modelValue, fileId]
    emit('update:modelValue', newValue)

    ElMessage.success('上传成功')
  } catch (error) {
    console.error('上传失败', error)
    options.onError?.(error)
  } finally {
    releaseTenantContext()
  }
}

async function uploadOne(workOrderId, pending) {
  const taskKey = `${String(workOrderId)}::${pending.localId}`
  let task = uploadTasks.get(taskKey)
  if (!task) {
    task = createDeferredUploadTask(workOrderId, pending.localId)
    uploadTasks.set(taskKey, task)
  }

  const file = pending.file
  return runDeferredUploadTask(task, {
    file,
    presign: async () => {
      const response = await getPresignUrl({
        originalName: file.name,
        contentType: file.type,
        fileSize: file.size,
        bizType: props.bizType,
        bizId: String(workOrderId),
      })
      return response.data
    },
    put: async (uploadUrl) => {
      const response = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      })
      if (!response.ok) {
        const error = new Error(`对象存储上传失败（HTTP ${response.status}）`)
        error.presignInvalid = [400, 401, 403, 404, 410].includes(response.status)
        throw error
      }
    },
    confirm: confirmUpload,
    isDefinitelyUnconfirmed: (error, currentTask) => {
      const code = error?.response?.data?.errorCode || error?.response?.data?.code
      return code === 'FILE_NOT_UPLOADED'
        || code === 'UPLOAD_OBJECT_NOT_FOUND'
        || (currentTask.presignInvalid && error?.response?.status === 400)
    },
  })
}

async function uploadAll(bizIds) {
  const workOrderIds = (Array.isArray(bizIds) ? bizIds : [bizIds])
    .filter((id) => id !== null && id !== undefined && String(id))
    .map(String)
  if (workOrderIds.length === 0 || pendingFiles.value.length === 0) {
    return { succeeded: [], failed: [] }
  }

  loading.value = true
  const succeeded = []
  const failed = []
  try {
    for (const workOrderId of workOrderIds) {
      for (const pending of pendingFiles.value) {
        try {
          const task = await uploadOne(workOrderId, pending)
          succeeded.push(task)
        } catch (error) {
          failed.push({ workOrderId, localId: pending.localId, error })
        }
      }
    }
    if (failed.length > 0) {
      const error = new Error(`${failed.length} 个附件任务上传失败`)
      error.failedTasks = failed
      throw error
    }
    const uploadedIds = succeeded.map((task) => task.fileId)
    emit('update:modelValue', uploadedIds)
    emit('upload-success', uploadedIds)
    ElMessage.success(`${succeeded.length} 个附件任务上传成功`)
    return { succeeded, failed }
  } finally {
    loading.value = false
  }
}

function getUploadTasks() {
  return [...uploadTasks.values()].map((task) => ({ ...task }))
}

defineExpose({ uploadAll, reset, getUploadTasks })

async function handleDelete(file) {
  try {
    await ElMessageBox.confirm('确定要删除这张图片吗？', '确认删除', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })

  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      console.error('确认删除失败', error)
    }
    return
  }

  let releaseTenantContext = null
  try {
    if (file.pending) {
      const pending = pendingFiles.value.find(f => f.localId === file.localId)
      releasePreviewUrl(pending)
      pendingFiles.value = pendingFiles.value.filter(f => f.localId !== file.localId)
    } else if (file.fileId != null) {
      releaseTenantContext = acquireFileOperation()
      if (!releaseTenantContext) return
      await deleteFile(file.fileId)
    }

    fileList.value = fileList.value.filter(f => (file.localId
      ? f.localId !== file.localId
      : f.fileId !== file.fileId))
    const newValue = props.modelValue.filter(id => id !== file.fileId)
    emit('update:modelValue', newValue)

    ElMessage.success('删除成功')
  } catch (error) {
    console.error('删除失败', error)
  } finally {
    releaseTenantContext?.()
  }
}

function handlePreviewByIndex(index) {
  previewList.value = fileList.value.filter(f => f.url)
  previewIndex.value = index
  previewVisible.value = true
}

function prevImage() {
  previewIndex.value = (previewIndex.value - 1 + previewList.value.length) % previewList.value.length
}

function nextImage() {
  previewIndex.value = (previewIndex.value + 1) % previewList.value.length
}
</script>

<style scoped>
.file-upload {
  width: 100%;
}

.el-upload__tip {
  color: #909399;
  font-size: 12px;
  margin-top: 8px;
}

.file-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 12px;
}

.file-item-wrapper {
  position: relative;
  width: 148px;
  height: 148px;
}

.file-item {
  width: 100%;
  height: 100%;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.3s;
  display: flex;
  flex-direction: column;
}

.file-item:hover {
  border-color: #409eff;
}

.file-delete-btn {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 20px;
  height: 20px;
  background: #f56c6c;
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 12px;
  z-index: 10;
  transition: background 0.3s;
}

.file-delete-btn:hover {
  background: #f78989;
}

.upload-trigger {
  width: 148px;
  height: 148px;
  border: 1px dashed #dcdfe6;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: border-color 0.3s;
}

.upload-trigger:hover {
  border-color: #409eff;
}

.upload-trigger .el-icon {
  font-size: 28px;
  color: #909399;
}

.file-thumbnail {
  width: 100%;
  height: 120px;
  object-fit: cover;
}

.file-placeholder {
  width: 100%;
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
  font-size: 32px;
  color: #909399;
}

.file-name {
  padding: 4px 8px;
  font-size: 12px;
  color: #606266;
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
  text-align: center;
}

.no-files {
  color: #909399;
  font-size: 14px;
  padding: 20px;
}

.preview-container {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
}

.preview-image {
  max-width: 100%;
  max-height: 500px;
  object-fit: contain;
}

.preview-arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  font-size: 24px;
  color: #fff;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.3s;
}

.preview-arrow:hover {
  background: rgba(0, 0, 0, 0.7);
}

.preview-prev {
  left: 10px;
}

.preview-next {
  right: 10px;
}

.preview-indicator {
  text-align: center;
  margin-top: 12px;
  color: #606266;
  font-size: 14px;
}
</style>
