import { computed, readonly, ref } from 'vue'

const MOBILE_UA_PATTERN = /Android.*Mobile|iPhone|iPod|Windows Phone|IEMobile|BlackBerry|BB10|webOS|Opera Mini|Mobile/i
const TABLET_UA_PATTERN = /iPad|Android(?!.*Mobile)|Tablet|PlayBook|Silk/i
const MOBILE_VIEW_MAX_WIDTH = 900

const deviceTypeState = ref('desktop')
const viewportWidthState = ref(typeof window === 'undefined' ? Number.POSITIVE_INFINITY : window.innerWidth)
let initialized = false

export function detectDeviceTypeByUa() {
  if (typeof navigator === 'undefined') return 'desktop'

  if (navigator.userAgentData?.mobile === true) return 'phone'

  const userAgent = navigator.userAgent || ''
  if (MOBILE_UA_PATTERN.test(userAgent)) return 'phone'
  if (TABLET_UA_PATTERN.test(userAgent)) return 'tablet'
  // iPadOS 13+ 可使用桌面级 Macintosh UA，需要结合触点数量识别。
  if (/Macintosh/i.test(userAgent) && navigator.maxTouchPoints > 1) return 'tablet'
  return 'desktop'
}

function updateRootClasses() {
  if (typeof document === 'undefined') return

  const root = document.documentElement
  const type = deviceTypeState.value
  const narrow = viewportWidthState.value <= MOBILE_VIEW_MAX_WIDTH
  const mobileView = type !== 'desktop' || narrow

  root.classList.remove('device-phone', 'device-tablet', 'device-desktop')
  root.classList.add(`device-${type}`)
  root.classList.toggle('is-narrow-viewport', narrow)
  root.classList.toggle('is-mobile-view', mobileView)
  root.dataset.deviceType = type
}

function updateViewport() {
  viewportWidthState.value = window.innerWidth
  updateRootClasses()
}

export function initDeviceDetection() {
  if (initialized || typeof window === 'undefined') return
  initialized = true
  deviceTypeState.value = detectDeviceTypeByUa()
  updateViewport()
  window.addEventListener('resize', updateViewport, { passive: true })
  window.addEventListener('orientationchange', updateViewport, { passive: true })
}

export const deviceType = readonly(deviceTypeState)
export const viewportWidth = readonly(viewportWidthState)
export const isMobileDevice = computed(() => deviceTypeState.value !== 'desktop')
export const isMobileView = computed(() => (
  isMobileDevice.value || viewportWidthState.value <= MOBILE_VIEW_MAX_WIDTH
))
