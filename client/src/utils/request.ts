import axios from 'axios'

const request = axios.create({
  baseURL: 'http://localhost:3000/api', // 后端地址
  timeout: 5000
})

// 请求拦截器
request.interceptors.request.use(
  (config) => {
    // 可以在这里添加 token
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
