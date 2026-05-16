<template>
  <div class="file-upload" v-loading="loading">
    <!-- 图片列表（两种模式共用） -->
    <div class="file-list" v-if="fileList.length > 0">
      <div v-for="(file, index) in fileList" :key="file.fileId" class="file-item-wrapper">
        <div class="file-item" @click="handlePreviewByIndex(index)">
          <img v-if="file.url" :src="file.url" class="file-thumbnail" />
          <div v-else class="file-placeholder">
            <el-icon><Document /></el-icon>
          </div>
          <div class="file-name">{{ file.name }}</div>
        </div>
        <el-icon
          v-if="!readonly"
          class="file-delete-btn"
          @click.stop="handleDelete(file)"
        >
          <Delete />
        </el-icon>
      </div>
    </div>

    <!-- 上传按钮（非只读模式） -->
    <el-upload
      v-if="!readonly && fileList.length < limit"
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
import { ref, watch, onMounted } from 'vue'
import { Plus, ArrowLeft, ArrowRight, Document, Delete } from '@element-plus/icons-vue'
import { getPresignUrl, confirmUpload, getDownloadUrl, getFilesByBiz, deleteFile } from '@/api/file'
import { ElMessage, ElMessageBox } from 'element-plus'

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
    const previewUrl = URL.createObjectURL(file)
    pendingFiles.value.push({
      file,
      name: file.name,
      url: previewUrl
    })
    fileList.value.push({
      name: file.name,
      url: previewUrl,
      fileId: null,
      pending: true
    })
    ElMessage.success('文件已暂存')
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

    await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type }
    })

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
    ElMessage.error('上传失败')
    options.onError(error)
  }
}

async function uploadAll(bizId) {
  if (!bizId || pendingFiles.value.length === 0) return

  loading.value = true
  const uploadedIds = []

  try {
    for (const pending of pendingFiles.value) {
      const file = pending.file
      const presignRes = await getPresignUrl({
        originalName: file.name,
        contentType: file.type,
        fileSize: file.size,
        bizType: props.bizType,
        bizId: bizId
      })

      const { fileId, uploadUrl } = presignRes.data

      await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type }
      })

      await confirmUpload(fileId)

      const downloadRes = await getDownloadUrl(fileId)
      const downloadUrl = downloadRes.data?.downloadUrl || ''

      const index = fileList.value.findIndex(f => f.name === file.name && f.pending)
      if (index !== -1) {
        fileList.value[index] = {
          name: file.name,
          url: downloadUrl,
          fileId: fileId,
          pending: false
        }
      }

      uploadedIds.push(fileId)
    }

    pendingFiles.value = []
    emit('update:modelValue', uploadedIds)
    emit('upload-success', uploadedIds)
    ElMessage.success(`${uploadedIds.length} 个文件上传成功`)
  } catch (error) {
    ElMessage.error('文件上传失败')
    throw error
  } finally {
    loading.value = false
  }
}

defineExpose({ uploadAll })

async function handleDelete(file) {
  try {
    await ElMessageBox.confirm('确定要删除这张图片吗？', '确认删除', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })

    if (file.pending) {
      pendingFiles.value = pendingFiles.value.filter(f => f.name !== file.name)
      if (file.url) URL.revokeObjectURL(file.url)
    } else if (file.fileId != null) {
      await deleteFile(file.fileId)
    }

    fileList.value = fileList.value.filter(f => f.fileId !== file.fileId || f.name !== file.name)
    const newValue = props.modelValue.filter(id => id !== file.fileId)
    emit('update:modelValue', newValue)

    ElMessage.success('删除成功')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
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
