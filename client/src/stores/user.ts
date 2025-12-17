import { defineStore } from 'pinia'
import { ref } from 'vue'
import request from '../utils/request'

export const useUserStore = defineStore('user', () => {
  const token = ref(localStorage.getItem('token') || '')
  const userInfo = ref(JSON.parse(localStorage.getItem('userInfo') || '{}'))
  const loading = ref(false)

  const login = async (loginForm: any) => {
    loading.value = true
    try {
      const res: any = await request.post('/auth/login', loginForm)
      token.value = res.token
      userInfo.value = res.user
      
      // 持久化存储
      localStorage.setItem('token', res.token)
      localStorage.setItem('userInfo', JSON.stringify(res.user))
      
      return res
    } catch (error) {
      throw error
    } finally {
      loading.value = false
    }
  }

  const register = async (registerForm: any) => {
    loading.value = true
    try {
      // 如果是 FormData 对象，需要设置 Content-Type 为 multipart/form-data
      // 但 axios 自动处理 FormData，所以通常不需要手动设置 header，除非有特殊拦截器配置
      // 这里为了保险起见，可以检查一下类型
      const config = registerForm instanceof FormData ? {
        headers: { 'Content-Type': 'multipart/form-data' }
      } : {}
      
      return await request.post('/auth/register', registerForm, config)
    } catch (error) {
      throw error
    } finally {
      loading.value = false
    }
  }

  const fetchUserInfo = async () => {
    if (!token.value) return
    try {
      const res: any = await request.get('/user/me')
      userInfo.value = res
      localStorage.setItem('userInfo', JSON.stringify(res))
    } catch (error) {
      console.error('获取用户信息失败', error)
    }
  }

  const checkIn = async () => {
    try {
      const res: any = await request.post('/user/checkin')
      // 更新积分
      if (userInfo.value) {
        userInfo.value.download_tickets += res.addedTickets
        // 更新签到时间，防止重复点击
        userInfo.value.last_check_in = new Date().toISOString()
        userInfo.value.is_checked_in = true
        localStorage.setItem('userInfo', JSON.stringify(userInfo.value))
      }
      return res
    } catch (error) {
      throw error
    }
  }

  const logout = () => {
    token.value = ''
    userInfo.value = {}
    localStorage.removeItem('token')
    localStorage.removeItem('userInfo')
  }

  return { token, userInfo, loading, login, register, logout, fetchUserInfo, checkIn }
})
