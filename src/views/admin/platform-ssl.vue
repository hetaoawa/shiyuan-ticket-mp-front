<template>
  <div class="ssl-page">
    <el-card shadow="never">
      <template #header>
        <div class="page-header">
          <div>
            <div class="page-title">平台 SSL</div>
            <div class="page-subtitle">仅全局系统管理员可管理平台入口协议与证书。</div>
          </div>
          <el-button :loading="loading" @click="loadAll">刷新</el-button>
        </div>
      </template>

      <el-alert
        title="启停 SSL 会在同一 server.port 上切换 HTTP/HTTPS，当前连接可能立即中断；请随后使用对应协议重新访问。"
        type="warning"
        :closable="false"
        show-icon
        class="notice"
      />
      <el-alert
        title="Docker 建议映射 443:9860；证书自动化应使用 DNS-01，避免依赖容器内 80/443 端口。"
        type="info"
        :closable="false"
        show-icon
        class="notice"
      />

      <section v-loading="loading" class="section-block">
        <div class="section-title-row">
          <h3>运行状态</h3>
          <el-button
            v-if="canUpdate"
            :type="status.desiredEnabled ? 'danger' : 'primary'"
            :loading="stateSaving"
            @click="changeState(!status.desiredEnabled)"
          >
            {{ status.desiredEnabled ? '停用 SSL' : '启用 SSL' }}
          </el-button>
        </div>
        <el-descriptions :column="isMobileView ? 1 : 2" border>
          <el-descriptions-item label="期望状态">
            <el-tag :type="status.desiredEnabled ? 'success' : 'info'">
              {{ status.desiredEnabled ? 'HTTPS' : 'HTTP' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="实际状态">
            <el-tag :type="status.effectiveEnabled ? 'success' : 'warning'">
              {{ status.effectiveEnabled ? 'HTTPS' : 'HTTP' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="域名">{{ status.domainName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="验证方式">{{ status.challengeType || 'DNS-01' }}</el-descriptions-item>
          <el-descriptions-item label="根密钥">
            <el-tag :type="status.rootKeyConfigured ? 'success' : 'danger'">
              {{ status.rootKeyConfigured ? '已配置' : '未配置' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="最近错误">
            <span :class="{ 'error-text': status.lastError }">{{ status.lastError || '无' }}</span>
          </el-descriptions-item>
        </el-descriptions>
      </section>

      <section class="section-block">
        <h3>当前证书</h3>
        <el-alert
          v-if="!status.certificate"
          title="尚未安装证书。证书上传是可选操作；如已有有效证书，可直接启停 SSL。"
          type="info"
          :closable="false"
        />
        <el-descriptions v-else :column="isMobileView ? 1 : 2" border>
          <el-descriptions-item label="主题">{{ status.certificate.subjectDn || '-' }}</el-descriptions-item>
          <el-descriptions-item label="算法">{{ status.certificate.keyAlgorithm || '-' }}</el-descriptions-item>
          <el-descriptions-item label="生效时间">{{ formatDate(status.certificate.notBefore) }}</el-descriptions-item>
          <el-descriptions-item label="到期时间">
            <span :class="{ 'error-text': isExpired(status.certificate.notAfter) }">
              {{ formatDate(status.certificate.notAfter) }}
            </span>
          </el-descriptions-item>
          <el-descriptions-item label="SAN" :span="2">
            <el-space v-if="status.certificate.subjectAlternativeNames?.length" wrap>
              <el-tag
                v-for="name in status.certificate.subjectAlternativeNames"
                :key="name"
                type="info"
              >
                {{ name }}
              </el-tag>
            </el-space>
            <span v-else>-</span>
          </el-descriptions-item>
          <el-descriptions-item label="SHA-256 指纹" :span="2">
            <span class="fingerprint">{{ status.certificate.fingerprintSha256 || '-' }}</span>
          </el-descriptions-item>
        </el-descriptions>
      </section>

      <section v-if="canUpdate" class="section-block">
        <h3>上传证书（可选）</h3>
        <p class="section-help">上传 PEM 证书链与对应私钥。页面不会读取或展示私钥内容。</p>
        <el-form label-width="130px" class="action-form">
          <el-form-item label="证书 PEM">
            <el-upload
              v-model:file-list="certificateFiles"
              action="#"
              accept=".pem,.crt,.cer"
              :auto-upload="false"
              :limit="1"
            >
              <el-button>选择证书</el-button>
            </el-upload>
          </el-form-item>
          <el-form-item label="私钥 PEM">
            <el-upload
              v-model:file-list="privateKeyFiles"
              action="#"
              accept=".pem,.key"
              :auto-upload="false"
              :limit="1"
            >
              <el-button>选择私钥</el-button>
            </el-upload>
          </el-form-item>
          <el-form-item label="域名（可选）">
            <el-input v-model="certificateDomain" placeholder="example.com" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="certificateUploading" @click="uploadCertificate">
              验证并安装
            </el-button>
          </el-form-item>
        </el-form>
      </section>

      <section v-if="canUpdate" class="section-block">
        <h3>部署令牌</h3>
        <p class="section-help">令牌仅在创建成功后展示一次，请立即保存到安全位置。</p>
        <el-form :inline="true">
          <el-form-item label="名称">
            <el-input v-model="tokenForm.name" maxlength="80" placeholder="acme-dns01" />
          </el-form-item>
          <el-form-item label="有效期（分钟）">
            <el-input-number v-model="tokenForm.expiresInMinutes" :min="1" :max="1440" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="tokenCreating" @click="createDeployToken">创建令牌</el-button>
          </el-form-item>
        </el-form>
      </section>

      <section class="section-block">
        <div class="section-title-row">
          <h3>最近操作</h3>
          <el-button :loading="operationsLoading" @click="loadOperations">刷新记录</el-button>
        </div>
        <div v-if="isMobileView" class="mobile-table-hint">操作记录字段较多，可在下方区域左右滑动查看。</div>
        <div :class="{ 'mobile-table-scroll': isMobileView }">
        <el-table v-loading="operationsLoading" :data="operations" border>
          <el-table-column prop="id" label="ID" width="90" />
          <el-table-column prop="operationType" label="操作" min-width="130" />
          <el-table-column label="状态" width="100">
            <template #default="scope">
              <el-tag :type="operationTagType(scope.row.status)">{{ scope.row.status }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="协议变化" width="130">
            <template #default="scope">
              {{ scope.row.fromHttps ? 'HTTPS' : 'HTTP' }} → {{ scope.row.toHttps ? 'HTTPS' : 'HTTP' }}
            </template>
          </el-table-column>
          <el-table-column prop="message" label="结果" min-width="220" show-overflow-tooltip />
          <el-table-column label="创建时间" width="180">
            <template #default="scope">{{ formatDate(scope.row.createdAt) }}</template>
          </el-table-column>
        </el-table>
        </div>
      </section>
    </el-card>

    <el-dialog v-model="tokenDialogVisible" title="部署令牌（仅显示一次）" width="620px" :close-on-click-modal="false">
      <el-alert title="关闭后无法再次查看此令牌。" type="warning" :closable="false" show-icon />
      <el-input v-model="createdToken.token" readonly class="token-value">
        <template #append>
          <el-button @click="copyToken">复制</el-button>
        </template>
      </el-input>
      <p class="section-help">到期时间：{{ formatDate(createdToken.expiresAt) }}</p>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { isMobileView } from '@/utils/device'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  createPlatformSslDeployToken,
  getPlatformSslOperations,
  getPlatformSslStatus,
  updatePlatformSslState,
  uploadPlatformSslCertificate,
} from '@/api/admin/platform-ssl'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()
const loading = ref(false)
const stateSaving = ref(false)
const certificateUploading = ref(false)
const operationsLoading = ref(false)
const tokenCreating = ref(false)
const certificateFiles = ref([])
const privateKeyFiles = ref([])
const certificateDomain = ref('')
const operations = ref([])
const tokenDialogVisible = ref(false)
const status = reactive({
  desiredEnabled: false,
  effectiveEnabled: false,
  domainName: '',
  challengeType: 'DNS-01',
  legacyImportCompleted: false,
  rootKeyConfigured: false,
  lastError: '',
  certificate: null,
})
const tokenForm = reactive({ name: '', expiresInMinutes: 60 })
const createdToken = reactive({ token: '', expiresAt: '' })

const canUpdate = computed(() => userStore.globalAdmin
  && userStore.permissions.includes('platform:ssl:manage'))

async function loadStatus() {
  const response = await getPlatformSslStatus()
  Object.assign(status, response.data || {})
}

async function loadOperations() {
  operationsLoading.value = true
  try {
    const response = await getPlatformSslOperations()
    operations.value = Array.isArray(response.data) ? response.data : []
  } catch (error) {
    console.error('加载平台 SSL 操作记录失败', error)
  } finally {
    operationsLoading.value = false
  }
}

async function loadAll() {
  if (loading.value) return
  loading.value = true
  try {
    await Promise.all([loadStatus(), loadOperations()])
  } catch (error) {
    console.error('加载平台 SSL 状态失败', error)
  } finally {
    loading.value = false
  }
}

async function changeState(enabled) {
  if (!canUpdate.value || stateSaving.value) return
  try {
    await ElMessageBox.confirm(
      `切换为 ${enabled ? 'HTTPS' : 'HTTP'} 会改变同一 server.port 的协议并可能断开当前连接，确定继续吗？`,
      `${enabled ? '启用' : '停用'} SSL`,
      { type: 'warning', confirmButtonText: '继续切换', cancelButtonText: '取消' },
    )
  } catch {
    return
  }

  stateSaving.value = true
  try {
    await updatePlatformSslState(enabled)
    ElMessage.success('协议切换任务已提交，请使用对应协议重新连接。')
    await loadAll()
  } catch (error) {
    console.error('提交平台 SSL 状态变更失败', error)
  } finally {
    stateSaving.value = false
  }
}

async function uploadCertificate() {
  const certificate = certificateFiles.value[0]?.raw
  const privateKey = privateKeyFiles.value[0]?.raw
  if (!certificate || !privateKey) {
    ElMessage.warning('请选择证书 PEM 与对应的私钥 PEM。')
    return
  }

  certificateUploading.value = true
  try {
    await uploadPlatformSslCertificate({ certificate, privateKey, domain: certificateDomain.value })
    certificateFiles.value = []
    privateKeyFiles.value = []
    ElMessage.success('证书验证通过，安装任务已提交。')
    await loadAll()
  } catch (error) {
    console.error('上传平台 SSL 证书失败', error)
  } finally {
    certificateUploading.value = false
  }
}

async function createDeployToken() {
  if (!tokenForm.name.trim()) {
    ElMessage.warning('请输入部署令牌名称。')
    return
  }
  tokenCreating.value = true
  try {
    const response = await createPlatformSslDeployToken({
      name: tokenForm.name.trim(),
      expiresInMinutes: Number(tokenForm.expiresInMinutes),
    })
    Object.assign(createdToken, response.data || {})
    tokenDialogVisible.value = true
    tokenForm.name = ''
  } catch (error) {
    console.error('创建平台 SSL 部署令牌失败', error)
  } finally {
    tokenCreating.value = false
  }
}

async function copyToken() {
  try {
    await navigator.clipboard.writeText(createdToken.token)
    ElMessage.success('令牌已复制。')
  } catch {
    ElMessage.warning('复制失败，请手动复制令牌。')
  }
}

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('zh-CN', { hour12: false })
}

function isExpired(value) {
  return value ? new Date(value).getTime() < Date.now() : false
}

function operationTagType(value) {
  const statusValue = String(value || '').toUpperCase()
  if (statusValue === 'SUCCEEDED' || statusValue === 'SUCCESS') return 'success'
  if (statusValue === 'FAILED') return 'danger'
  if (statusValue === 'PENDING' || statusValue === 'RUNNING') return 'warning'
  return 'info'
}

onMounted(() => {
  void loadAll()
})
</script>

<style scoped>
.page-header,
.section-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.page-title {
  font-size: 18px;
  font-weight: 600;
}

.page-subtitle,
.section-help {
  margin-top: 5px;
  color: #909399;
  font-size: 13px;
}

.notice {
  margin-bottom: 12px;
}

.section-block {
  margin-top: 24px;
}

.section-block h3 {
  margin: 0 0 14px;
}

.section-title-row h3 {
  margin-bottom: 14px;
}

.action-form {
  max-width: 760px;
}

.fingerprint,
.token-value :deep(input) {
  font-family: Consolas, Monaco, monospace;
  word-break: break-all;
}

.error-text {
  color: #f56c6c;
}

.token-value {
  margin-top: 18px;
}
</style>
