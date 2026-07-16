export const BATCH_MAX_ITEMS = 20
export const BATCH_MAX_TEXT_LENGTH = 2000

const WORK_ORDER_TYPES = new Set([
  'CHANGE_ADDRESS',
  'INTERCEPT',
  'DAMAGE',
  'LOST',
  'OTHER',
])

function text(value) {
  return value === null || value === undefined ? '' : String(value).trim()
}

export function normalizeBatchLines(value) {
  const source = String(value || '')
  if (source.length > BATCH_MAX_TEXT_LENGTH) {
    return { lines: [], duplicates: [], error: `批量内容不能超过 ${BATCH_MAX_TEXT_LENGTH} 个字符` }
  }

  const lines = []
  const duplicates = []
  const seen = new Set()
  const nonEmptyLines = source.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  if (nonEmptyLines.length > BATCH_MAX_ITEMS) {
    return { lines: [], duplicates, error: `一次最多处理 ${BATCH_MAX_ITEMS} 条内容` }
  }
  for (const line of nonEmptyLines) {
    const fingerprint = line.toLocaleLowerCase()
    if (seen.has(fingerprint)) {
      duplicates.push(line)
      continue
    }
    seen.add(fingerprint)
    lines.push(line)
  }
  return { lines, duplicates, error: '' }
}

export function extractBatchItems(value) {
  const result = normalizeBatchLines(value)
  if (result.error) return { ...result, items: [] }
  return {
    ...result,
    items: result.lines.map((sourceLine) => {
      const trackingNo = sourceLine.match(/\b[A-Za-z0-9][A-Za-z0-9_-]{5,49}\b/)?.[0] || ''
      return {
        sourceLine,
        trackingNo,
        title: sourceLine.slice(0, 200),
        description: sourceLine,
        targetAddress: '',
        priority: 2,
        detectedType: '',
      }
    }),
  }
}

export function normalizeBatchParseResponse(response, fallbackLines = []) {
  let payload = response?.data ?? response ?? {}
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload)
    } catch {
      payload = {}
    }
  }
  if (payload?.data !== undefined && !Array.isArray(payload?.items)) {
    payload = payload.data
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload)
      } catch {
        payload = {}
      }
    }
  }

  const items = Array.isArray(payload?.items) ? payload.items : []
  const normalizedItems = items.map((item, index) => ({
    sourceLine: text(item?.sourceLine) || fallbackLines[index] || '',
    trackingNo: text(item?.trackingNo),
    title: text(item?.title),
    description: text(item?.description),
    targetAddress: text(item?.targetAddress),
    priority: [1, 2, 3].includes(Number(item?.priority)) ? Number(item.priority) : 2,
    detectedType: WORK_ORDER_TYPES.has(item?.type) ? item.type : '',
    warnings: Array.isArray(item?.warnings) ? item.warnings.map(text).filter(Boolean) : [],
  }))
  const detectedTypes = [...new Set(normalizedItems.map((item) => item.detectedType).filter(Boolean))]
  const type = WORK_ORDER_TYPES.has(payload?.type) ? payload.type : ''
  return {
    type,
    items: normalizedItems,
    mixedTypes: !type && detectedTypes.length > 1,
    detectedTypes,
  }
}

export function buildBatchCreatePayload(items, type) {
  return {
    items: items.map((item) => ({
      title: text(item.title),
      description: text(item.description),
      trackingNo: text(item.trackingNo),
      targetAddress: text(item.targetAddress),
      type: text(type),
      priority: [1, 2, 3].includes(Number(item.priority)) ? Number(item.priority) : 2,
    })),
  }
}

export function createIdempotencyKey(randomUUID = globalThis.crypto?.randomUUID?.bind(globalThis.crypto)) {
  const random = randomUUID
    ? randomUUID().replace(/-/g, '')
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`
  return `batch_${random}`.slice(0, 64).padEnd(8, '0')
}

export function normalizeBatchCreateResponse(response) {
  const candidates = [response?.data?.data, response?.data, response]
  const payload = candidates.find((candidate) => (
    Array.isArray(candidate?.workOrderIds) || Array.isArray(candidate?.ids)
  )) || {}
  const rawIds = Array.isArray(payload.workOrderIds)
    ? payload.workOrderIds
    : Array.isArray(payload.ids)
      ? payload.ids
      : []
  return {
    workOrderIds: rawIds.map((id) => String(id)),
    replayed: payload.replayed === true,
  }
}
