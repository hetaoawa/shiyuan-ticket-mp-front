const ACTION_LABELS = {
  CREATE: '创建工单',
  ASSIGN: '派发工单',
  CLOSE: '关闭工单',
  REJECT: '驳回工单',
  FORCE_REJECT: '强制驳回',
  FORCE_CLOSE: '强制完结',
  RESUBMIT: '重新提交',
  UPDATE: '更新配置',
}

const STATUS_LABELS = {
  PENDING: '待处理',
  IN_PROGRESS: '处理中',
  CLOSED: '已关闭',
  REJECTED: '已驳回',
}

const DETAIL_LABELS = {
  reason: '原因',
  resolution: '处理结论',
  remark: '备注',
  oldStatus: '原状态',
  newStatus: '新状态',
  previousStatus: '原状态',
  currentStatus: '新状态',
  assigneeId: '处理人 ID',
  assigneeName: '处理人',
  assigneeRole: '处理角色',
  assigneeRoleCode: '处理角色',
  assigneeRoleName: '处理角色',
  title: '标题',
  description: '描述',
  trackingNo: '物流单号',
  targetAddress: '目标地址',
  priority: '优先级',
  type: '工单类型',
  autoAssignment: '自动派发',
}

const DETAIL_METADATA_KEYS = new Set([
  'actionLabel',
  'operatorName',
  'requestSource',
  'requestSourceLabel',
  'detailSummary',
  'createdViaWebhook',
])

const TENANT_INTEGRATION_DETAIL_LABELS = {
  type: '集成类型',
  enabled: '启用状态',
  publicFields: '公开配置字段',
}

function getDetailLabel(key, bizType) {
  if (bizType === 'TENANT_INTEGRATION' && TENANT_INTEGRATION_DETAIL_LABELS[key]) {
    return TENANT_INTEGRATION_DETAIL_LABELS[key]
  }
  return DETAIL_LABELS[key] || key
}

function parseDetail(detail) {
  if (!detail) return null
  if (typeof detail === 'object') return detail
  try {
    const parsed = JSON.parse(detail)
    return typeof parsed === 'object' && parsed !== null ? parsed : null
  } catch {
    return null
  }
}

function formatValue(key, value) {
  if (value === null || value === undefined || value === '') return '-'
  if (key.toLowerCase().includes('status')) return STATUS_LABELS[value] || value
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}

export function getActionLabel(logOrAction) {
  if (typeof logOrAction === 'object' && logOrAction !== null) {
    return logOrAction.actionLabel || ACTION_LABELS[logOrAction.action] || logOrAction.action || '-'
  }
  return ACTION_LABELS[logOrAction] || logOrAction || '-'
}

export function getActionTagType(action) {
  const map = {
    CREATE: 'success',
    ASSIGN: 'primary',
    CLOSE: 'success',
    REJECT: 'danger',
    FORCE_REJECT: 'danger',
    FORCE_CLOSE: 'success',
    RESUBMIT: 'warning',
    UPDATE: 'warning',
  }
  return map[action] || 'info'
}

export function getBizTypeLabel(bizType) {
  const map = { WORK_ORDER: '工单', TENANT_INTEGRATION: '租户集成配置' }
  return map[bizType] || bizType || '-'
}

export function getOperatorLabel(log) {
  return log.operatorName
    || log.operatorDisplayName
    || log.operatorNickname
    || log.operatorUsername
    || (log.operatorId ? `用户 ${log.operatorId}` : '系统')
}

export function getDetailEntries(logOrDetail) {
  const log = logOrDetail && typeof logOrDetail === 'object' && ('detail' in logOrDetail || 'detailFields' in logOrDetail)
    ? logOrDetail
    : { detail: logOrDetail }
  const detailFields = log.detailFields
  if (Array.isArray(detailFields)) {
    return detailFields.map((item) => ({
      key: item.key || item.label,
      label: item.label || getDetailLabel(item.key, log.bizType),
      value: formatValue(item.key || '', item.value),
    }))
  }
  const parsed = detailFields && typeof detailFields === 'object' ? detailFields : parseDetail(log.detail)
  if (!parsed || Array.isArray(parsed)) return []
  return Object.entries(parsed)
    .filter(([key, value]) => !DETAIL_METADATA_KEYS.has(key) && value !== null && value !== undefined && value !== '')
    .map(([key, value]) => ({
      key,
      label: getDetailLabel(key, log.bizType),
      value: formatValue(key, value),
    }))
}

export function getDetailSummary(logOrDetail) {
  if (logOrDetail && typeof logOrDetail === 'object' && logOrDetail.detailSummary) {
    return logOrDetail.detailSummary
  }
  const entries = getDetailEntries(logOrDetail)
  if (entries.length) return entries.map((item) => `${item.label}：${item.value}`).join('；')
  const detail = logOrDetail && typeof logOrDetail === 'object' && 'detail' in logOrDetail
    ? logOrDetail.detail
    : logOrDetail
  return detail ? String(detail) : ''
}

export function normalizeAuditRecords(response) {
  const data = response?.data
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.records)) return data.records
  if (Array.isArray(response?.records)) return response.records
  return []
}
