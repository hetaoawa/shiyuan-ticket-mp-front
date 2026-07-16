export function createTenantContextOperationGate(onChange = () => {}) {
  let operationCount = 0
  let tenantSwitching = false

  function notify() {
    onChange({ operationCount, tenantSwitching })
  }

  function tryAcquireOperation() {
    if (tenantSwitching) return null
    operationCount += 1
    notify()

    let released = false
    return () => {
      if (released) return
      released = true
      operationCount = Math.max(0, operationCount - 1)
      notify()
    }
  }

  function tryBeginSwitch() {
    if (tenantSwitching || operationCount > 0) return null
    tenantSwitching = true
    notify()

    let finished = false
    return () => {
      if (finished) return
      finished = true
      tenantSwitching = false
      notify()
    }
  }

  return {
    get operationCount() {
      return operationCount
    },
    get tenantContextBusy() {
      return operationCount > 0
    },
    get tenantSwitching() {
      return tenantSwitching
    },
    tryAcquireOperation,
    tryBeginSwitch,
  }
}
