import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  buildBatchCreatePayload,
  createIdempotencyKey,
  extractBatchItems,
  normalizeBatchCreateResponse,
  normalizeBatchLines,
  normalizeBatchParseResponse,
} from '../src/utils/workorder-create.js'
import {
  DEFERRED_UPLOAD_STAGE,
  createDeferredUploadTask,
  runDeferredUploadTask,
} from '../src/utils/deferred-upload.js'

test('batch lines are trimmed, locally deduplicated, limited, and extracted in order', () => {
  const extracted = extractBatchItems('  YT123456 更址 上海  \n\nyt123456 更址 上海\nSF987654 拦截')
  assert.deepEqual(extracted.lines, ['YT123456 更址 上海', 'SF987654 拦截'])
  assert.deepEqual(extracted.duplicates, ['yt123456 更址 上海'])
  assert.deepEqual(extracted.items.map((item) => item.trackingNo), ['YT123456', 'SF987654'])
  assert.match(normalizeBatchLines(`${'x\n'.repeat(20)}x`).error, /最多处理 20 条/)
  assert.match(normalizeBatchLines('x'.repeat(2001)).error, /不能超过 2000/)
})

test('batch AI responses are normalized centrally and expose mixed detected types', () => {
  const normalized = normalizeBatchParseResponse({
    code: 200,
    data: JSON.stringify({
      type: null,
      items: [
        { sourceLine: 'A', trackingNo: '', title: 'A', description: '', targetAddress: '', type: 'INTERCEPT', priority: 1, warnings: [] },
        { sourceLine: 'B', trackingNo: '', title: 'B', description: '', targetAddress: '', type: 'DAMAGE', priority: 3, warnings: [] },
      ],
    }),
  }, ['A', 'B'])
  assert.equal(normalized.mixedTypes, true)
  assert.deepEqual(normalized.detectedTypes, ['INTERCEPT', 'DAMAGE'])
  assert.deepEqual(normalized.items.map((item) => item.priority), [1, 3])
})

test('batch payload applies one top-level reviewed type and excludes external conversation fields', () => {
  const payload = buildBatchCreatePayload([
    { title: ' A ', description: ' D ', trackingNo: ' T ', targetAddress: ' X ', priority: 3, senderStaffId: 'forbidden' },
  ], 'CHANGE_ADDRESS')
  assert.deepEqual(payload, {
    items: [{ title: 'A', description: 'D', trackingNo: 'T', targetAddress: 'X', type: 'CHANGE_ADDRESS', priority: 3 }],
  })
  assert.equal(JSON.stringify(payload).includes('senderStaffId'), false)
  assert.equal(JSON.stringify(payload).includes('conversationId'), false)
})

test('idempotency keys match the backend contract and batch IDs remain ordered strings', () => {
  const key = createIdempotencyKey(() => '12345678-1234-1234-1234-123456789abc')
  assert.equal(key, 'batch_12345678123412341234123456789abc')
  assert.match(key, /^[A-Za-z0-9_-]{8,64}$/)

  const normalized = normalizeBatchCreateResponse({
    data: { workOrderIds: ['9007199254740993', 17], replayed: true },
  })
  assert.deepEqual(normalized, { workOrderIds: ['9007199254740993', '17'], replayed: true })
  assert.deepEqual(normalizeBatchCreateResponse({ data: { ids: [3, 2, 1] } }).workOrderIds, ['3', '2', '1'])
})

test('deferred attachment retries confirm on the same fileId after a lost success response', async () => {
  const task = createDeferredUploadTask('work-order-1', 'local-image-1')
  const calls = { presign: 0, put: 0, confirm: 0 }
  let serverConfirmed = false
  const adapters = {
    file: { name: 'proof.png' },
    presign: async () => {
      calls.presign += 1
      return { fileId: 'file-9007199254740993', uploadUrl: 'https://storage.test/upload' }
    },
    put: async () => {
      calls.put += 1
      assert.equal(task.fileId, 'file-9007199254740993')
      assert.equal(task.stage, DEFERRED_UPLOAD_STAGE.PUTTING)
    },
    confirm: async (fileId) => {
      calls.confirm += 1
      assert.equal(fileId, 'file-9007199254740993')
      if (!serverConfirmed) {
        serverConfirmed = true
        throw new Error('client timed out after server committed confirmation')
      }
    },
  }

  await assert.rejects(runDeferredUploadTask(task, adapters), /client timed out/)
  assert.deepEqual(calls, { presign: 1, put: 1, confirm: 1 })
  assert.equal(task.fileId, 'file-9007199254740993')
  assert.equal(task.stage, DEFERRED_UPLOAD_STAGE.CONFIRMING)
  assert.equal(task.status, 'failed')

  const result = await runDeferredUploadTask(task, adapters)
  assert.equal(result.status, 'success')
  assert.equal(result.stage, DEFERRED_UPLOAD_STAGE.CONFIRMED)
  assert.deepEqual(calls, { presign: 1, put: 1, confirm: 2 })
})

test('shared editor and deferred uploader preserve retry and tenant-lock invariants', async () => {
  const editor = await readFile(new URL('../src/components/WorkOrderCreateEditor.vue', import.meta.url), 'utf8')
  const uploader = await readFile(new URL('../src/components/FileUpload.vue', import.meta.url), 'utf8')
  const createPage = await readFile(new URL('../src/views/workorder/create.vue', import.meta.url), 'utf8')
  const listPage = await readFile(new URL('../src/views/workorder/list.vue', import.meta.url), 'utf8')

  assert.match(editor, /acquireTenantContextOperation\(\)/)
  assert.match(editor, /await fileUploadRef\.value\.uploadAll\(createdIds\.value\)/)
  assert.match(editor, /idempotencyPayload\.value !== payloadFingerprint[\s\S]*idempotencyKey\.value = createIdempotencyKey\(\)/)
  assert.match(uploader, /taskKey = `\$\{String\(workOrderId\)\}::\$\{pending\.localId\}`/)
  assert.match(uploader, /uploadTasks\.get\(taskKey\)/)
  assert.match(uploader, /runDeferredUploadTask\(task/)
  assert.match(uploader, /onBeforeUnmount[\s\S]*releasePreviewUrl/)
  assert.match(createPage, /<WorkOrderCreateEditor/)
  assert.match(listPage, /<WorkOrderCreateEditor/)
  assert.doesNotMatch(listPage, /<FileUpload/)
})
