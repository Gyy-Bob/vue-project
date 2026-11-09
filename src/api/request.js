import axios from 'axios'
import { useUserStore } from '@/stores/user'
import router from '@/router'
import { toast } from '@/composables/toast'

/**
 * 统一响应约定（来自 02-接口规范）：HTTP 状态码一律 200，
 * 业务结果看 code：code === 0 成功，非 0 为业务错误。
 */
const request = axios.create({
  baseURL: '/api/v1',
  timeout: 10000,
})

// 请求拦截：自动携带 JWT
request.interceptors.request.use((config) => {
  const userStore = useUserStore()
  if (userStore.token) {
    config.headers.Authorization = `Bearer ${userStore.token}`
  }
  return config
})

// 响应拦截：code !== 0 统一转错误对象 { code, message }
request.interceptors.response.use(
  (res) => {
    const { code, message, data } = res.data || {}
    if (code === 0) return data
    if (code === 40100) {
      // 未登录或凭证无效：清凭证，回登录页
      const userStore = useUserStore()
      userStore.logout()
      toast.warning('登录已过期，请重新登录')
      router.push({ name: 'login' })
      return Promise.reject({ code, message: message || '未登录或凭证无效' })
    }
    return Promise.reject({ code, message: message || '操作失败' })
  },
  () => Promise.reject({ code: -1, message: '网络异常，请稍后重试' })
)

export default request
