function normalizeId(value) {
  return value === null || value === undefined || value === '' ? null : String(value)
}

export function normalizeAuthContext(response = {}) {
  return {
    principalTenantId: normalizeId(response.principalTenantId),
    activeTenantId: normalizeId(response.activeTenantId),
    activeTenantName: response.activeTenantName || null,
    globalAdmin: response.globalAdmin === true,
  }
}

async function invokeRecoveryCallback(callback, error) {
  if (!callback) return
  try {
    await callback()
  } catch (callbackError) {
    error.callbackError = callbackError
  }
}

export async function synchronizeAdministratorAuthorization({
  refreshIdentity,
  isAuthorized,
  clearAdministratorState,
  invalidateAuthorizationState,
  leaveRestrictedPage,
  resetState,
  onUnrecoverable,
}) {
  try {
    await refreshIdentity()
  } catch (error) {
    clearAdministratorState()
    resetState()
    await invokeRecoveryCallback(onUnrecoverable, error)
    throw error
  }

  clearAdministratorState()
  if (!isAuthorized()) {
    invalidateAuthorizationState?.()
    try {
      await leaveRestrictedPage()
    } catch (error) {
      resetState()
      await invokeRecoveryCallback(onUnrecoverable, error)
      throw error
    }
  }
}

export async function synchronizeTenantSwitch({
  tenantId,
  requestSwitch,
  applyContext,
  clearTenantState,
  refreshIdentity,
  refreshTenants,
  refreshMenu,
  resetState,
  onUnrecoverable,
  isTargetTenantActive,
}) {
  const synchronizeTenantState = async () => {
    clearTenantState()
    await refreshIdentity()
    await refreshTenants()
    await refreshMenu()
  }

  const resetAfterFailedSynchronization = async (error, recoveryError) => {
    resetState()
    error.recoveryError = recoveryError
    await invokeRecoveryCallback(onUnrecoverable, error)
    throw error
  }

  let requestError = null
  try {
    const response = await requestSwitch(tenantId)
    applyContext(response)
  } catch (error) {
    requestError = error
  }

  if (requestError) {
    try {
      await synchronizeTenantState()
    } catch (recoveryError) {
      await resetAfterFailedSynchronization(requestError, recoveryError)
    }
    if (isTargetTenantActive(tenantId)) return
    throw requestError
  }

  let synchronizationError = null
  try {
    await synchronizeTenantState()
  } catch (error) {
    synchronizationError = error
  }

  if (synchronizationError) {
    try {
      await synchronizeTenantState()
    } catch (recoveryError) {
      await resetAfterFailedSynchronization(synchronizationError, recoveryError)
    }
  }

  if (!isTargetTenantActive(tenantId)) {
    throw new Error('租户切换结果与目标租户不一致')
  }
}
