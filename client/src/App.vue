<script setup lang="ts">
import { useUserStore } from './stores/user'
import { useRouter } from 'vue-router'
import { Ticket, User, Calendar, Star, Message, InfoFilled, SwitchButton, Setting, CaretBottom } from '@element-plus/icons-vue'
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import socket from './utils/socket'
import { ElNotification, ElMessage } from 'element-plus'
import request from './utils/request'

const userStore = useUserStore()
const router = useRouter()
const pendingCount = ref(0)
const isScrolled = ref(false)

// 弹窗状态
const sponsorVisible = ref(false)
const contactVisible = ref(false)
const aboutVisible = ref(false)

const isCheckedIn = computed(() => {
  return !!userStore.userInfo?.is_checked_in
})

const handleScroll = () => {
  isScrolled.value = window.scrollY > 50
}

const handleLogout = () => {
  userStore.logout()
  router.push('/login')
}

const handleCheckIn = async () => {
  if (isCheckedIn.value) {
    ElMessage.info('今日已签到')
    return
  }
  try {
    const res: any = await userStore.checkIn()
    ElMessage.success(`签到成功！获得 ${res.addedTickets} 次下载机会`)
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '签到失败')
  }
}

const openLink = (url: string) => {
  window.open(url, '_blank')
}

const copyText = (text: string) => {
  navigator.clipboard.writeText(text).then(() => {
    ElMessage.success('复制成功')
  }).catch(() => {
    ElMessage.error('复制失败')
  })
}

const fetchPendingCount = async () => {
  if (userStore.userInfo.role === 'admin') {
    try {
      const res: any = await request.get('/admin/papers/pending/count')
      pendingCount.value = res.count
    } catch (error) {
      console.error('获取待审核数量失败', error)
    }
  }
}

// 监听用户信息变化，自动加入 Socket 房间
watch(() => userStore.userInfo.id, (newId) => {
  if (newId) {
    socket.emit('join_user_room', newId)
    fetchPendingCount()
  }
}, { immediate: true })

onMounted(() => {
  if (userStore.token) {
    userStore.fetchUserInfo()
  }

  // 监听积分更新事件
  socket.on('ticket_update', (data: any) => {
    userStore.fetchUserInfo()
    ElNotification({
      title: '奖励到账',
      message: '您的真题已通过审核，获得 1 张下载券！',
      type: 'success',
      duration: 4000
    })
  })

  // 监听新待审核真题事件
  socket.on('new_paper_pending', () => {
    if (userStore.userInfo.role === 'admin') {
      fetchPendingCount()
      ElNotification({
        title: '新真题待审核',
        message: '有新的真题上传，请及时审核',
        type: 'info'
      })
    }
  })

  window.addEventListener('scroll', handleScroll)
})

onUnmounted(() => {
  socket.off('ticket_update')
  socket.off('new_paper_pending')
  window.removeEventListener('scroll', handleScroll)
})
</script>

<template>
  <div class="app-layout">
    <el-container>
      <el-header class="header" :class="{ 'header-scrolled': isScrolled }">
        <div class="logo" @click="router.push('/')">
          <img src="/favicon.ico" class="logo-img" alt="logo" />
          <span class="logo-text">真题转转</span>
        </div>
        <div class="user-info">
          <template v-if="userStore.token">
            <el-dropdown trigger="click">
              <div class="user-dropdown-link">
                <el-avatar v-if="userStore.userInfo.avatar_url" :size="36" :src="`http://localhost:3000/${userStore.userInfo.avatar_url}`" class="header-avatar" />
                <el-avatar v-else :size="36" class="header-avatar">{{ userStore.userInfo.username?.charAt(0).toUpperCase() }}</el-avatar>
                <span class="header-username">{{ userStore.userInfo.username }}</span>
                <el-icon class="el-icon--right"><CaretBottom /></el-icon>
              </div>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item @click="router.push('/profile')">
                    <el-icon><User /></el-icon>个人详情
                  </el-dropdown-item>
                  <el-dropdown-item disabled>
                    <el-icon><Ticket /></el-icon>剩余票数: {{ userStore.userInfo.download_tickets || 0 }}
                  </el-dropdown-item>
                  <el-dropdown-item divided @click="handleCheckIn">
                    <el-icon><Calendar /></el-icon>每日签到
                  </el-dropdown-item>
                  <el-dropdown-item @click="sponsorVisible = true">
                    <el-icon><Star /></el-icon>赞助支持
                  </el-dropdown-item>
                  <el-dropdown-item @click="contactVisible = true">
                    <el-icon><Message /></el-icon>联系作者
                  </el-dropdown-item>
                  <el-dropdown-item @click="aboutVisible = true">
                    <el-icon><InfoFilled /></el-icon>关于我们
                  </el-dropdown-item>
                  <el-dropdown-item v-if="userStore.userInfo.role === 'admin'" divided @click="router.push('/admin')">
                    <el-badge :value="pendingCount" :hidden="pendingCount === 0" is-dot class="dropdown-badge">
                      <div style="display: flex; align-items: center;">
                        <el-icon><Setting /></el-icon>审核后台
                      </div>
                    </el-badge>
                  </el-dropdown-item>
                  <el-dropdown-item divided @click="handleLogout" style="color: #f56c6c;">
                    <el-icon><SwitchButton /></el-icon>退出登录
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
          <template v-else>
            <router-link to="/login">
              <el-button type="primary" round>登录 / 注册</el-button>
            </router-link>
          </template>
        </div>
      </el-header>
      
      <el-main class="main-container">
        <router-view></router-view>
      </el-main>
    </el-container>

    <!-- 赞助弹窗 -->
    <el-dialog v-model="sponsorVisible" title="赞助支持" width="400px" center append-to-body>
      <div class="sponsor-content">
        <p class="sponsor-desc">感谢您的支持！赞助 > 1 元即可获得 <span class="highlight">无限下载权限</span>。</p>
        <div class="sponsor-options">
          <div class="sponsor-item" @click="openLink('https://afdian.com/a/sadami3066')">
            <el-icon class="sponsor-icon" color="#946ce6"><Star /></el-icon>
            <span>爱发电</span>
          </div>
          <div class="sponsor-item" @click="copyText('sadami3066')">
            <el-icon class="sponsor-icon" color="#07c160"><Message /></el-icon>
            <span>微信赞助</span>
          </div>
        </div>
        <p class="sponsor-note">赞助后请联系管理员开通权限</p>
      </div>
    </el-dialog>

    <!-- 联系管理员弹窗 -->
    <el-dialog v-model="contactVisible" title="联系管理员" width="360px" center append-to-body>
      <div class="contact-content">
        <div class="contact-item">
          <span class="label">QQ：</span>
          <span class="value">3066584511</span>
          <el-button type="primary" link size="small" @click="copyText('3066584511')">复制</el-button>
        </div>
        <div class="contact-item">
          <span class="label">微信：</span>
          <span class="value">sadami3066</span>
          <el-button type="primary" link size="small" @click="copyText('sadami3066')">复制</el-button>
        </div>
      </div>
    </el-dialog>

    <!-- 关于我们弹窗 -->
    <el-dialog v-model="aboutVisible" title="关于我们" width="400px" center append-to-body>
      <div class="about-content">
        <p>真题转转是一个专注于大学期末真题分享的平台。</p>
        <p>我们致力于帮助同学们更高效地复习备考。</p>
        <p class="team-link">
          <el-link type="primary" href="https://whywood.cn" target="_blank">访问团队主页</el-link>
        </p>
        <p class="version">当前版本: v1.0.0</p>
      </div>
    </el-dialog>
  </div>
</template>

<style>
body {
  margin: 0;
  padding: 0;
}
</style>

<style scoped>
.app-layout {
  min-height: 100vh;
  background-color: #f5f7fa;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: transparent;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  box-shadow: none;
  border: 1px solid transparent;
  
  /* 悬浮居中样式 */
  width: 96%;
  max-width: 1600px;
  border-radius: 16px;
  
  padding: 0 30px;
  position: fixed;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  height: 64px;
  transition: all 0.3s ease;
}

.header.header-scrolled {
  background: rgba(255, 255, 255, 0.65);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 8px 32px rgba(31, 38, 135, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.18);
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  text-decoration: none;
}

.logo-img {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.logo-text {
  font-size: 24px;
  font-weight: 800;
  color: #303133;
  letter-spacing: 1px;
}

.user-info {
  display: flex;
  gap: 16px;
  align-items: center;
}

/* 下拉菜单样式 */
.user-dropdown-link {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 6px 12px;
  border-radius: 24px;
  transition: all 0.3s;
  background-color: rgba(255, 255, 255, 0.9);
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.user-dropdown-link:hover {
  background-color: #ffffff;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.header-avatar {
  background: linear-gradient(135deg, #409eff 0%, #8cc5ff 100%);
  color: white;
  font-weight: bold;
  font-size: 14px;
  border: 2px solid rgba(255, 255, 255, 0.8);
  box-shadow: 0 2px 6px rgba(0,0,0,0.1);
}

.header-username {
  font-size: 15px;
  color: #4b5563;
  font-weight: 500;
}

/* 弹窗内容样式 */
.sponsor-content, .contact-content, .about-content {
  text-align: center;
  padding: 10px 0;
}

.sponsor-desc {
  margin-bottom: 20px;
  color: #606266;
  line-height: 1.6;
}

.highlight {
  color: #f56c6c;
  font-weight: bold;
}

.sponsor-options {
  display: flex;
  justify-content: center;
  gap: 30px;
  margin-bottom: 20px;
}

.sponsor-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: transform 0.2s;
}

.sponsor-item:hover {
  transform: scale(1.1);
}

.sponsor-icon {
  font-size: 32px;
  background: #f5f7fa;
  padding: 12px;
  border-radius: 50%;
}

.sponsor-note {
  font-size: 12px;
  color: #909399;
}

.contact-item {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 15px;
  font-size: 16px;
}

.contact-item .label {
  color: #909399;
  width: 60px;
  text-align: right;
}

.contact-item .value {
  color: #303133;
  font-weight: 500;
  margin: 0 10px;
  font-family: monospace;
  font-size: 18px;
}

.about-content p {
  margin-bottom: 10px;
  color: #606266;
}

.about-content .version {
  margin-top: 20px;
  font-size: 12px;
  color: #909399;
}

.about-content .team-link {
  margin-top: 10px;
}

.main-container {
  padding: 0; /* 移除默认 padding，让 Hero Section 满宽 */
}

/* 移动端适配 */
@media (max-width: 768px) {
  .header {
    padding: 0 20px;
  }
  .header-username {
    display: none; /* 手机端隐藏用户名 */
  }
}
</style>
