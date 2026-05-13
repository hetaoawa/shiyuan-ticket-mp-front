<template>
  <div class="file-upload" v-loading="loading">
    <el-upload
      v-if="!readonly"
      :file-list="fileList"
      :http-request="handleUpload"
      :before-upload="beforeUpload"
      :on-remove="handleRemove"
      :on-preview="handlePreview"
      :limit="limit"
      :on-exceed="handleExceed"
      accept="image/*"
      list-type="picture-card"
    >
      <el-icon><Plus /></el-icon>
      <template #tip>
        <div class="el-upload__tip">只能上传图片文件，且不超过 10MB</div>
      </template>
    </el-upload>

    <!-- 只读模式：只展示图片列表 -->
    <div v-else class="file-list-readonly">
      <div v-for="(file, index) in fileList" :key="file.fileId" class="file-item" @click="handlePreviewByIndex(index)">
        <img v-if="file.url" :src="file.url" class="file-thumbnail" />
        <div v-else class="file-placeholder">
          <el-icon><Document /></el-icon>
        </div>
        <div class="file-name">{{ file.name }}</div>
      </div>
      <div v-if="fileList.length === 0" class="no-files">暂无文件</div>
    </div>

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
import { Plus, ArrowLeft, ArrowRight, Document } from '@element-plus/icons-vue'
import { getPresignUrl, confirmUpload, getDownloadUrl, getFilesByBiz } from '@/api/file'
import { ElMessage } from 'element-plus'

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
  }
})

const emit = defineEmits(['update:modelValue'])

const fileList = ref([])
const previewVisible = ref(false)
const previewUrl = ref('')
const previewList = ref([])
const previewIndex = ref(0)
const loading = ref(false)

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

function handleRemove(file) {
  const newValue = props.modelValue.filter(id => id !== file.fileId)
  emit('update:modelValue', newValue)
}

function handleExceed() {
  ElMessage.warning(`最多上传 ${props.limit} 个文件`)
}

function handlePreview(file) {
  const index = fileList.value.findIndex(f => f.fileId === file.fileId)
  if (index !== -1) {
    previewList.value = fileList.value.filter(f => f.url)
    previewIndex.value = previewList.value.findIndex(f => f.fileId === file.fileId)
    if (previewIndex.value === -1) previewIndex.value = 0
    previewVisible.value = true
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

.file-list-readonly {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.file-item {
  width: 148px;
  height: 148px;
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
