import axios from 'axios'

const request = axios.create({
  baseURL: '/api', // 使用相对路径，开发环境由 Vite 代理，生产环境由后端托管
  timeout: 5000
})

const clearAuthStorage = () => {
  localStorage.removeItem('token')
  localStorage.removeItem('userInfo')
}

const redirectToLogin = () => {
  const baseUrl = import.meta.env.BASE_URL || '/'
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  const loginUrl = `${normalizedBase}login`
  window.location.assign(loginUrl)
}

// 请求拦截器
request.interceptors.request.use(
  (config) => {
    // 可以在这里添加 token
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器
request.interceptors.response.use(
  (response) => {
    return response.data
  },
  (error) => {
    if (error?.response?.status === 401) {
      clearAuthStorage()
      redirectToLogin()
    }
    return Promise.reject(error)
  }
)

export default request
