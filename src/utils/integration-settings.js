export const INTEGRATION_DEFINITIONS = Object.freeze([
  {
    type: 'DINGTALK',
    label: '钉钉通知',
    description: '工单派发与状态变化的钉钉机器人通知。',
    fields: [
      { key: 'accessToken', label: 'Access Token', secret: true },
      { key: 'secret', label: '签名密钥', secret: true },
      { key: 'workOrderDetailBaseUrl', label: '工单详情地址前缀', placeholder: 'https://example.com/workorder/detail' },
    ],
  },
  {
    type: 'CARGO_OWNER',
    label: '货主侧 Webhook',
    description: '对接货主侧自定义 Webhook（包括 QQ 机器人等 HTTP Webhook）。',
    fields: [
      { key: 'url', label: '目标 Webhook URL', placeholder: 'https://example.com/webhook' },
      { key: 'authorization', label: '调用凭证', secret: true },
      { key: 'workOrderDetailBaseUrl', label: '工单详情地址前缀', placeholder: 'https://example.com/workorder/detail' },
      { key: 'receiveAppId', label: '接收端 App ID' },
      { key: 'externalInboundEnabled', label: '允许外部递交工单', kind: 'boolean' },
      { key: 'externalCloseCallbackEnabled', label: '完结后回调货主侧', kind: 'boolean' },
      { key: 'receivePrivateKey', label: '接收端签名私钥', secret: true, multiline: true },
    ],
  },
  {
    type: 'S3',
    label: '对象存储',
    description: '租户文件使用的 S3 兼容对象存储。',
    fields: [
      { key: 'endpoint', label: 'Endpoint', placeholder: 'https://s3.example.com' },
      { key: 'accessKey', label: 'Access Key', secret: true },
      { key: 'secretKey', label: 'Secret Key', secret: true },
      { key: 'region', label: 'Region', placeholder: 'us-east-1' },
      { key: 'bucket', label: 'Bucket' },
      { key: 'pathStyle', label: 'Path-style 访问', kind: 'boolean' },
      { key: 'presignExpireSeconds', label: '预签名有效期（秒）', kind: 'number', min: 60, max: 86400 },
    ],
  },
  {
    type: 'EXPRESS',
    label: '物流查询',
    description: '物流轨迹查询服务配置。',
    fields: [
      { key: 'apiUrl', label: 'API URL' },
      { key: 'timeoutSeconds', label: '超时时间（秒）', kind: 'number', min: 1, max: 300 },
      { key: 'appcode', label: 'AppCode', secret: true },
    ],
  },
  {
    type: 'AI',
    label: 'AI 解析',
    description: '兼容 OpenAI Chat Completions 协议的工单解析服务。',
    fields: [
      { key: 'apiUrl', label: 'API URL', placeholder: 'https://example.com/v1/chat/completions' },
      { key: 'apiKey', label: 'API Key', secret: true },
      { key: 'model', label: '模型名称' },
      { key: 'timeoutSeconds', label: '超时时间（秒）', kind: 'number', min: 1, max: 300 },
    ],
  },
])

export const INTEGRATION_TYPES = Object.freeze(INTEGRATION_DEFINITIONS.map(({ type }) => type))

export function getIntegrationDefinition(type) {
  return INTEGRATION_DEFINITIONS.find((item) => item.type === type)
}

function defaultPublicFieldValue(field) {
  if (field.kind === 'boolean') return false
  if (field.kind === 'number') return null
  return ''
}

export function createIntegrationForm(type) {
  const definition = getIntegrationDefinition(type)
  if (!definition) throw new TypeError(`未知集成类型：${type}`)

  const config = {}
  const secretInputs = {}
  const secretActions = {}
  for (const field of definition.fields) {
    if (field.secret) {
      secretInputs[field.key] = ''
      secretActions[field.key] = 'keep'
    } else {
      config[field.key] = defaultPublicFieldValue(field)
    }
  }

  return {
    type,
    enabled: false,
    configVersion: 0,
    configured: false,
    secretConfigured: false,
    config,
    secretInputs,
    secretActions,
  }
}

export function normalizeIntegrationCollection(payload) {
  const source = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.integrations)
      ? payload.integrations
      : payload && typeof payload === 'object'
        ? Object.entries(payload).map(([type, value]) => ({ type, ...value }))
        : []

  const normalized = new Map()
  for (const item of source) {
    const type = String(item?.type || '').toUpperCase()
    if (!INTEGRATION_TYPES.includes(type)) continue
    const config = item.config && typeof item.config === 'object' ? { ...item.config } : {}
    const secretConfigured = item.secretConfigured ?? false
    const hasPublicConfig = Object.values(config).some((value) => value !== '' && value !== null && value !== undefined)
    const hasSecretConfig = typeof secretConfigured === 'boolean'
      ? secretConfigured
      : Object.values(secretConfigured).some(Boolean)
    normalized.set(type, {
      type,
      enabled: item.enabled === true,
      configVersion: Number(item.configVersion ?? 0),
      configured: typeof item.configured === 'boolean'
        ? item.configured
        : hasPublicConfig || hasSecretConfig,
      secretConfigured,
      config,
    })
  }
  return normalized
}

export function applyIntegrationResponse(form, response) {
  const normalized = normalizeIntegrationCollection([response]).get(form.type)
  if (!normalized) throw new TypeError(`集成 ${form.type} 的响应格式不完整`)

  const definition = getIntegrationDefinition(form.type)
  if (!definition) throw new TypeError(`未知集成类型：${form.type}`)

  form.enabled = normalized.enabled
  form.configVersion = normalized.configVersion
  form.configured = normalized.configured
  form.secretConfigured = normalized.secretConfigured
  const publicFields = definition.fields.filter((field) => !field.secret)
  const allowedKeys = new Set(publicFields.map((field) => field.key))
  for (const key of Object.keys(form.config)) {
    if (!allowedKeys.has(key)) delete form.config[key]
  }
  for (const field of publicFields) {
    form.config[field.key] = Object.prototype.hasOwnProperty.call(normalized.config, field.key)
      ? normalized.config[field.key]
      : defaultPublicFieldValue(field)
  }
  for (const key of Object.keys(form.secretInputs)) {
    form.secretInputs[key] = ''
    form.secretActions[key] = 'keep'
  }
  return form
}

export function buildIntegrationUpdatePayload(form) {
  const secrets = {}
  for (const [key, action] of Object.entries(form.secretActions)) {
    const value = form.secretInputs[key]?.trim()
    if (action === 'clear') secrets[key] = { clear: true }
    else if (value) secrets[key] = { value }
  }

  const definition = getIntegrationDefinition(form.type)
  if (!definition) throw new TypeError(`未知集成类型：${form.type}`)
  const config = Object.fromEntries(definition.fields
    .filter((field) => !field.secret)
    .map((field) => [field.key, form.config[field.key]])
    .filter(([, value]) => value !== null && value !== undefined))

  return {
    configVersion: Number(form.configVersion),
    enabled: Boolean(form.enabled),
    config,
    secrets,
  }
}

export function isSecretConfigured(secretConfigured, key) {
  if (typeof secretConfigured === 'boolean') return secretConfigured
  return secretConfigured?.[key] === true
}
