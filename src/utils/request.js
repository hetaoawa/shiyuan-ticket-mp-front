import axios from 'axios'
import JSONbig from 'json-bigint'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'
import router from '@/router'

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
      return response.data
    }

    const res = response.data

    // 分页响应直接返回
    if (res.total !== undefined) {
      return res
    }

    // 业务状态码判断
    if (res.code === 200) {
      return res
    }

    // 401 未登录 - 跳转登录
    if (res.code === 401) {
      ElMessage.error(res.message || '未登录或登录已过期')
      const userStore = useUserStore()
      userStore.logout()
      router.push('/login')
      return Promise.reject(new Error(res.message))
    }

    // 403 权限不足
    if (res.code === 403) {
      ElMessage.error(res.message || '操作权限不足')
      return Promise.reject(new Error(res.message))
    }

    // 其他业务错误
    ElMessage.error(res.message || '请求失败')
    return Promise.reject(new Error(res.message))
  },
  (error) => {
    // 网络错误等
    if (error.response) {
      const { status, data } = error.response
      switch (status) {
        case 401:
          ElMessage.error(data?.message || '未登录或登录已过期')
          const userStore = useUserStore()
          userStore.logout()
          router.push('/login')
          break
        case 403:
          ElMessage.error(data?.message || '操作权限不足')
          break
        case 400:
          ElMessage.error(data?.message || '请求参数错误')
          break
        case 500:
          ElMessage.error(data?.message || '服务器内部错误')
          break
        default:
          ElMessage.error(data?.message || '请求失败')
      }
    } else {
      ElMessage.error('网络连接失败，请检查网络')
    }
    return Promise.reject(error)
  }
)

export default service
