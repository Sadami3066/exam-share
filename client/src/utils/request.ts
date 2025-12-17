import axios from 'axios'

const request = axios.create({
  baseURL: '/api', // 使用相对路径，开发环境由 Vite 代理，生产环境由后端托管
  timeout: 5000
})

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
    console.error('Request Error:', error)
    return Promise.reject(error)
  }
)

export default request
