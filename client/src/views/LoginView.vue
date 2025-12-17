<script setup lang="ts">
import { ref, reactive, onUnmounted } from 'vue'
import { useUserStore } from '../stores/user'
import { useRouter } from 'vue-router'
import { ElMessage, type UploadInstance } from 'element-plus'
import { User, Lock, Reading, Camera, Message, Key } from '@element-plus/icons-vue'
import request from '../utils/request'

const userStore = useUserStore()
const router = useRouter()
const activeTab = ref('login')

const loginForm = reactive({
  account: '',
  password: ''
})

const registerForm = reactive({
  account: '',
  username: '',
  password: '',
  confirmPassword: '',
  email: '',
  code: '',
  avatar: null as File | null
})

const avatarUploadRef = ref<UploadInstance>()
const avatarPreview = ref('')
const codeLoading = ref(false)
const codeTimer = ref(0)
let timerInterval: any = null

const handleAvatarChange = (file: any) => {
  const isLt5M = file.size / 1024 / 1024 < 5
  if (!isLt5M) {
    ElMessage.error('头像大小不能超过 5MB!')
    return
  }
  registerForm.avatar = file.raw
  avatarPreview.value = URL.createObjectURL(file.raw)
}

const sendCode = async () => {
  if (!registerForm.email) {
    ElMessage.warning('请输入邮箱')
    return
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(registerForm.email)) {
    ElMessage.warning('邮箱格式不正确')
    return
  }

  codeLoading.value = true
  try {
    await request.post('/auth/send-code', { email: registerForm.email })
    ElMessage.success('验证码已发送，请查收邮件')
    
    // 开始倒计时
    codeTimer.value = 60
    timerInterval = setInterval(() => {
      codeTimer.value--
      if (codeTimer.value <= 0) {
        clearInterval(timerInterval)
      }
    }, 1000)
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '发送失败')
  } finally {
    codeLoading.value = false
  }
}

onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval)
})

const handleLogin = async () => {
  if (!loginForm.account || !loginForm.password) {
    ElMessage.warning('请输入账号和密码')
    return
  }
  try {
    await userStore.login(loginForm)
    ElMessage.success('登录成功')
    router.push('/')
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '登录失败')
  }
}

const handleRegister = async () => {
  if (!registerForm.account || !registerForm.username || !registerForm.password || !registerForm.email || !registerForm.code) {
    ElMessage.warning('请填写完整信息')
    return
  }
  
  // 验证账号格式 (至少6位，仅数字+字母)
  const accountRegex = /^[a-zA-Z0-9]{6,}$/
  if (!accountRegex.test(registerForm.account)) {
    ElMessage.warning('账号需至少6位，且仅包含字母和数字')
    return
  }

  // 验证用户名长度 (2-7个字)
  if (registerForm.username.length < 2 || registerForm.username.length > 7) {
    ElMessage.warning('用户名长度需在2-7个字符之间')
    return
  }

  // 验证密码复杂度 (至少6位，包含字母和数字)
  const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$/
  if (!passwordRegex.test(registerForm.password)) {
    ElMessage.warning('密码需至少6位，且包含字母和数字')
    return
  }

  if (registerForm.password !== registerForm.confirmPassword) {
    ElMessage.warning('两次输入的密码不一致')
    return
  }
  try {
    const formData = new FormData()
    formData.append('account', registerForm.account)
    formData.append('username', registerForm.username)
    formData.append('password', registerForm.password)
    formData.append('email', registerForm.email)
    formData.append('code', registerForm.code)
    if (registerForm.avatar) {
      formData.append('avatar', registerForm.avatar)
    }

    await userStore.register(formData)
    ElMessage.success('注册成功，请登录')
    activeTab.value = 'login'
    // 重置表单
    registerForm.account = ''
    registerForm.username = ''
    registerForm.password = ''
    registerForm.confirmPassword = ''
    registerForm.email = ''
    registerForm.code = ''
    registerForm.avatar = null
    avatarPreview.value = ''
    codeTimer.value = 0
    if (timerInterval) clearInterval(timerInterval)
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '注册失败')
  }
}
</script>

<template>
  <div class="login-container">
    <div class="login-box">
      <div class="login-header">
        <div class="logo-icon">
          <el-icon><Reading /></el-icon>
        </div>
        <h2>真题转转</h2>
        <p>让每一份真题都发挥价值</p>
      </div>
      
      <el-card class="login-card" shadow="hover">
        <el-tabs v-model="activeTab" class="custom-tabs" stretch>
          <el-tab-pane label="登录" name="login">
            <el-form :model="loginForm" size="large" class="login-form">
              <el-form-item>
                <el-input v-model="loginForm.account" placeholder="账号" :prefix-icon="User" />
              </el-form-item>
              <el-form-item>
                <el-input v-model="loginForm.password" type="password" placeholder="密码" :prefix-icon="Lock" show-password @keyup.enter="handleLogin" />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" class="submit-btn" @click="handleLogin" :loading="userStore.loading">
                  立即登录
                </el-button>
              </el-form-item>
            </el-form>
          </el-tab-pane>
          
          <el-tab-pane label="注册" name="register">
            <el-form :model="registerForm" size="large" class="login-form">
              <div class="avatar-upload-container">
                <el-upload
                  class="avatar-uploader"
                  action="#"
                  :show-file-list="false"
                  :auto-upload="false"
                  :on-change="handleAvatarChange"
                >
                  <div v-if="avatarPreview" class="avatar-preview">
                    <img :src="avatarPreview" class="avatar-img" />
                    <div class="avatar-mask">
                      <el-icon><Camera /></el-icon>
                    </div>
                  </div>
                  <div v-else class="avatar-placeholder">
                    <el-icon class="avatar-uploader-icon"><Camera /></el-icon>
                    <span class="upload-text">上传头像</span>
                  </div>
                </el-upload>
              </div>

              <el-form-item>
                <el-input v-model="registerForm.account" placeholder="设置账号 (唯一登录凭证)" :prefix-icon="User" />
              </el-form-item>
              <el-form-item>
                <el-input v-model="registerForm.username" placeholder="设置昵称 (2-7个字符)" :prefix-icon="User" />
              </el-form-item>
              <el-form-item>
                <el-input v-model="registerForm.password" type="password" placeholder="设置密码 (至少6位，含字母数字)" :prefix-icon="Lock" show-password />
              </el-form-item>
              <el-form-item>
                <el-input v-model="registerForm.confirmPassword" type="password" placeholder="确认密码" :prefix-icon="Lock" show-password />
              </el-form-item>
              <el-form-item>
                <el-input v-model="registerForm.email" placeholder="邮箱地址" :prefix-icon="Message" />
              </el-form-item>
              <el-form-item>
                <div class="code-row">
                  <el-input v-model="registerForm.code" placeholder="验证码" :prefix-icon="Key" @keyup.enter="handleRegister" />
                  <el-button type="primary" :disabled="codeTimer > 0" :loading="codeLoading" @click="sendCode" class="code-btn">
                    {{ codeTimer > 0 ? `${codeTimer}s` : '获取验证码' }}
                  </el-button>
                </div>
              </el-form-item>
              <el-form-item>
                <el-button type="success" class="submit-btn" @click="handleRegister" :loading="userStore.loading">
                  立即注册
                </el-button>
              </el-form-item>
            </el-form>
          </el-tab-pane>
        </el-tabs>
      </el-card>
    </div>
  </div>
</template>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  padding: 20px;
}

.login-box {
  width: 100%;
  max-width: 420px;
}

.login-header {
  text-align: center;
  margin-bottom: 30px;
}

.logo-icon {
  width: 60px;
  height: 60px;
  background: linear-gradient(135deg, #409eff 0%, #8cc5ff 100%);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 15px;
  color: white;
  font-size: 32px;
  box-shadow: 0 10px 20px rgba(64, 158, 255, 0.3);
}

.login-header h2 {
  font-size: 28px;
  color: #303133;
  margin: 0 0 10px;
  font-weight: 800;
}

.login-header p {
  color: #909399;
  margin: 0;
  font-size: 16px;
}

.login-card {
  border-radius: 16px;
  border: none;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.08) !important;
  overflow: hidden;
}

.custom-tabs :deep(.el-tabs__nav-wrap::after) {
  height: 1px;
  background-color: #ebeef5;
}

.custom-tabs :deep(.el-tabs__item) {
  font-size: 16px;
  height: 50px;
  line-height: 50px;
}

.login-form {
  padding: 20px 10px 10px;
}

.avatar-upload-container {
  display: flex;
  justify-content: center;
  margin-bottom: 20px;
}

.avatar-uploader .el-upload {
  border: 1px dashed #d9d9d9;
  border-radius: 50%;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: var(--el-transition-duration-fast);
}

.avatar-uploader .el-upload:hover {
  border-color: var(--el-color-primary);
}

.avatar-placeholder {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background-color: #f5f7fa;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: #909399;
  border: 1px dashed #dcdfe6;
  transition: all 0.3s;
}

.avatar-placeholder:hover {
  border-color: #409eff;
  color: #409eff;
  background-color: #ecf5ff;
}

.avatar-uploader-icon {
  font-size: 24px;
  margin-bottom: 4px;
}

.upload-text {
  font-size: 12px;
}

.avatar-preview {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  position: relative;
  overflow: hidden;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-mask {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s;
  color: white;
  font-size: 24px;
}

.avatar-preview:hover .avatar-mask {
  opacity: 1;
}

.submit-btn {
  width: 100%;
  font-weight: bold;
  letter-spacing: 1px;
  height: 44px;
  border-radius: 8px;
  margin-top: 10px;
}

.code-row {
  display: flex;
  width: 100%;
  gap: 10px;
}

.code-btn {
  width: 110px;
  flex-shrink: 0;
}
</style>
