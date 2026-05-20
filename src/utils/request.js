import axios from 'axios'
import JSONbig from 'json-bigint'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'
import router from '@/router'

// --- 最大同时错误提示数量 ---
const MAX_ERROR_MESSAGES = 3
const activeErrorMessages = []

function showError(msg) {
  // Purge already-closed stale refs
  for (let i = activeErrorMessages.length - 1; i >= 0; i--) {
    if (activeErrorMessages[i].closed) {
      activeErrorMessages.splice(i, 1)
    }
  }

  while (activeErrorMessages.length >= MAX_ERROR_MESSAGES) {
    const oldest = activeErrorMessages.shift()
    try { oldest.close() } catch (_) {}
  }

  const instance = ElMessage({
    type: 'error',
    message: msg,
    duration: 3000,
    onClose: () => {
      const idx = activeErrorMessages.indexOf(instance)
      if (idx !== -1) activeErrorMessages.splice(idx, 1)
    },
  })
  activeErrorMessages.push(instance)
}

// --- 401 redirect guard ---
let isRedirectingToLogin = false

function handle401(message) {
  if (isRedirectingToLogin) return
  isRedirectingToLogin = true
  showError(message || '未登录或登录已过期')
  const userStore = useUserStore()
  userStore.resetState()
  const currentPath = router.currentRoute.value.path
  if (currentPath !== '/login') {
    router.push(`/login?redirect=${currentPath}`)
  }
}

// 创建 Axios 实例
const service = axios.create({
  baseURL: '/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
  // 使用 json-bigint 解析响应，避免大整数精度丢失
  transformResponse: [
    function (data) {
      try {
        return JSONbig.parse(data)
      } catch (e) {
        return data
      }
    },
  ],
})

// 请求拦截器 - 自动携带 Sa-Token
service.interceptors.request.use(
  (config) => {
    const userStore = useUserStore()
    if (userStore.token) {
      config.headers['Authorization'] = `Bearer ${userStore.token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器 - 统一处理错误
service.interceptors.response.use(
  (response) => {
    // 如果是 blob 类型响应（文件下载），直接返回
    if (response.config.responseType === 'blob') {
      isRedirectingToLogin = false
      return response.data
    }

    const res = response.data

    // 分页响应直接返回
    if (res.total !== undefined) {
      isRedirectingToLogin = false
      return res
    }

    // 业务状态码判断
    if (res.code === 200) {
      isRedirectingToLogin = false
      return res
    }

    // 401 未登录 - 跳转登录
    if (res.code === 401) {
      handle401(res.message)
      return Promise.reject(new Error(res.message))
    }

    // 403 权限不足
    if (res.code === 403) {
      showError(res.message || '操作权限不足')
      return Promise.reject(new Error(res.message))
    }

    // 其他业务错误
    showError(res.message || '请求失败')
    return Promise.reject(new Error(res.message))
  },
  (error) => {
    // 网络错误等
    if (error.response) {
      const { status, data } = error.response
      switch (status) {
        case 401:
          handle401(data?.message)
          break
        case 403:
          showError(data?.message || '操作权限不足')
          break
        case 400:
          showError(data?.message || '请求参数错误')
          break
        case 500:
          showError(data?.message || '服务器内部错误')
          break
        default:
          showError(data?.message || '请求失败')
      }
    } else {
      showError('网络连接失败，请检查网络')
    }
    return Promise.reject(error)
  }
)

export default service
