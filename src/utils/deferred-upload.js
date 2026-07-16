export const DEFERRED_UPLOAD_STAGE = Object.freeze({
  PENDING: 'pending',
  PRESIGNING: 'presigning',
  PRESIGNED: 'presigned',
  PUTTING: 'putting',
  PUT_FAILED: 'put_failed',
  CONFIRMING: 'confirming',
  CONFIRMED: 'confirmed',
})

export function createDeferredUploadTask(workOrderId, localId) {
  return {
    workOrderId: String(workOrderId),
    localId,
    status: 'pending',
    stage: DEFERRED_UPLOAD_STAGE.PENDING,
    fileId: null,
    uploadUrl: null,
    presignInvalid: false,
    error: null,
  }
}

function rememberFailure(task, error) {
  task.status = 'failed'
  task.error = error
}

async function confirmTask(task, confirm) {
  task.status = 'uploading'
  task.stage = DEFERRED_UPLOAD_STAGE.CONFIRMING
  task.error = null
  try {
    await confirm(task.fileId)
    task.status = 'success'
    task.stage = DEFERRED_UPLOAD_STAGE.CONFIRMED
    return task
  } catch (error) {
    // Keep fileId and the confirming stage: a rejected client response does not
    // prove that the idempotent server-side confirmation failed.
    rememberFailure(task, error)
    throw error
  }
}

/**
 * Run or resume one (workOrderId, localId) upload task.
 *
 * A resumed task with a fileId always confirms that record first. A replacement
 * record is allowed only after both an explicitly invalid PUT URL and an
 * authoritative backend answer that the existing record was not confirmed.
 */
export async function runDeferredUploadTask(task, {
  file,
  presign,
  put,
  confirm,
  isDefinitelyUnconfirmed = () => false,
}) {
  if (task.status === 'success') return task

  const resumedWithFileId = task.fileId !== null && task.fileId !== undefined
  if (resumedWithFileId) {
    try {
      return await confirmTask(task, confirm)
    } catch (confirmError) {
      if (!isDefinitelyUnconfirmed(confirmError, task)) throw confirmError

      if (task.presignInvalid) {
        task.fileId = null
        task.uploadUrl = null
        task.stage = DEFERRED_UPLOAD_STAGE.PENDING
      } else if (task.uploadUrl) {
        task.stage = DEFERRED_UPLOAD_STAGE.PRESIGNED
      } else {
        throw confirmError
      }
    }
  }

  if (task.fileId === null || task.fileId === undefined) {
    task.status = 'uploading'
    task.stage = DEFERRED_UPLOAD_STAGE.PRESIGNING
    task.error = null
    try {
      const result = await presign()
      // Persist the server record identity before starting the object-store PUT.
      task.fileId = String(result.fileId)
      task.uploadUrl = result.uploadUrl
      task.presignInvalid = false
      task.stage = DEFERRED_UPLOAD_STAGE.PRESIGNED
    } catch (error) {
      rememberFailure(task, error)
      throw error
    }
  }

  task.status = 'uploading'
  task.stage = DEFERRED_UPLOAD_STAGE.PUTTING
  task.error = null
  try {
    await put(task.uploadUrl, file)
    task.presignInvalid = false
    task.stage = DEFERRED_UPLOAD_STAGE.CONFIRMING
  } catch (error) {
    task.stage = DEFERRED_UPLOAD_STAGE.PUT_FAILED
    task.presignInvalid = error?.presignInvalid === true
    rememberFailure(task, error)
    throw error
  }

  return confirmTask(task, confirm)
}
