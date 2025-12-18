<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useUserStore } from '../stores/user'
import request from '../utils/request'
import { ElMessage, ElMessageBox, type UploadInstance } from 'element-plus'
import { Document, Download, Camera } from '@element-plus/icons-vue' 

const userStore = useUserStore()
const activeTab = ref('uploads')
const uploads = ref<any[]>([])
const downloads = ref<any[]>([])
const loading = ref(false)
const avatarUploadRef = ref<UploadInstance>()

const handleAvatarSuccess = (response: any) => {
  userStore.fetchUserInfo()
  ElMessage.success('头像上传成功')
}

const beforeAvatarUpload = (rawFile: any) => {
  if (rawFile.size / 1024 / 1024 > 5) {
    ElMessage.error('头像大小不能超过 5MB!')
    return false
  }
  return true
}

const customUpload = async (options: any) => {
  const formData = new FormData()
  formData.append('avatar', options.file)
  try {
    await request.post('/user/avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
    options.onSuccess()
  } catch (error) {
    options.onError()
    ElMessage.error('头像上传失败')
  }
}

const handleTakeDown = async (paper: any) => {
  try {
    await ElMessageBox.confirm('确定要下架这份真题吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    
    await request.post(`/papers/${paper.id}/takedown`)
    ElMessage.success('下架成功')
    fetchUploads()
  } catch (error) {
    if (error !== 'cancel') {
      console.error(error)
      ElMessage.error('下架失败')
    }
  }
}

const fetchUploads = async () => {
  loading.value = true
  try {
    const res: any = await request.get('/user/uploads')
    uploads.value = res
  } catch (error) {
    ElMessage.error('获取上传记录失败')
  } finally {
    loading.value = false
  }
}

const fetchDownloads = async () => {
  loading.value = true
  try {
    const res: any = await request.get('/user/downloads')
    downloads.value = res
  } catch (error) {
    ElMessage.error('获取下载记录失败')
  } finally {
    loading.value = false
  }
}

const handleTabChange = (tab: string) => {
  if (tab === 'uploads') {
    fetchUploads()
  } else {
    fetchDownloads()
  }
}

// 状态标签样式
const getStatusTag = (status: string) => {
  const map: any = {
    'approved': 'success',
    'pending': 'warning',
    'rejected': 'danger'
  }
  return map[status] || 'info'
}

const getStatusText = (status: string) => {
  const map: any = {
    'approved': '已通过',
    'pending': '审核中',
    'rejected': '已拒绝',
    'taken_down': '已下架'
  }
  return map[status] || '未知'
}

onMounted(() => {
  fetchUploads()
})
</script>

<template>
  <div class="profile-container">
    <!-- 个人信息卡片 -->
    <div class="profile-header">
      <div class="avatar-section">
        <el-upload
          class="avatar-uploader"
          action="#"
          :show-file-list="false"
          :http-request="customUpload"
          :before-upload="beforeAvatarUpload"
          :on-success="handleAvatarSuccess"
        >
          <div v-if="userStore.userInfo.avatar_url" class="avatar-wrapper">
             <img :src="`/${userStore.userInfo.avatar_url}`" class="avatar-img" />
             <div class="avatar-mask">
               <el-icon><Camera /></el-icon>
             </div>
          </div>
          <div v-else class="avatar default-avatar">
            {{ userStore.userInfo.username?.charAt(0).toUpperCase() }}
            <div class="avatar-mask">
               <el-icon><Camera /></el-icon>
             </div>
          </div>
        </el-upload>
        <div class="info">
          <h2>{{ userStore.userInfo.username }}</h2>
          <div class="role-badge">{{ userStore.userInfo.role === 'admin' ? '管理员' : '普通用户' }}</div>
        </div>
      </div>

    </div>

    <!-- 记录列表 -->
    <div class="records-section">
      <el-tabs v-model="activeTab" @tab-change="handleTabChange" class="custom-tabs">
        <el-tab-pane label="我的上传" name="uploads">
          <div v-loading="loading" class="list-container">
            <el-empty v-if="uploads.length === 0 && !loading" description="暂无上传记录" />
            <div v-for="item in uploads" :key="item.id" class="record-item">
              <div class="item-icon upload">
                <el-icon><Document /></el-icon>
              </div>
              <div class="item-content">
                <div class="item-title">{{ item.title }}</div>
                <div class="item-meta">
                  <span>{{ item.subject }}</span>
                  <span class="separator">•</span>
                  <span>{{ item.year }}年</span>
                  <span class="separator">•</span>
                  <span>{{ new Date(item.created_at).toLocaleDateString() }}</span>
                </div>
              </div>
              <div class="item-status">
                <el-tag :type="getStatusTag(item.status)" effect="light" round>
                  {{ getStatusText(item.status) }}
                </el-tag>
                <el-button 
                  v-if="['approved', 'pending'].includes(item.status)"
                  type="danger" 
                  link 
                  size="small" 
                  @click="handleTakeDown(item)"
                  style="margin-left: 8px;"
                >
                  下架
                </el-button>
              </div>
            </div>
          </div>
        </el-tab-pane>
        
        <el-tab-pane label="下载历史" name="downloads">
          <div v-loading="loading" class="list-container">
            <el-empty v-if="downloads.length === 0 && !loading" description="暂无下载记录" />
            <div v-for="item in downloads" :key="item.id" class="record-item">
              <div class="item-icon download">
                <el-icon><Download /></el-icon>
              </div>
              <div class="item-content">
                <div class="item-title">{{ item.title }}</div>
                <div class="item-meta">
                  <span>{{ item.subject }}</span>
                  <span class="separator">•</span>
                  <span>下载时间：{{ new Date(item.downloaded_at).toLocaleString() }}</span>
                </div>
              </div>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<style scoped>
.profile-container {
  max-width: 1000px;
  margin: 100px auto 30px;
  padding: 0 20px;
}

.profile-header {
  background: white;
  border-radius: 16px;
  padding: 30px;
  display: flex;
  justify-content: flex-start;
  align-items: center;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
  margin-bottom: 30px;
}

.avatar-section {
  display: flex;
  align-items: center;
  gap: 20px;
}

.avatar-uploader {
  cursor: pointer;
  position: relative;
}

.avatar-wrapper, .default-avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  overflow: hidden;
  position: relative;
  box-shadow: 0 4px 10px rgba(64, 158, 255, 0.3);
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.default-avatar {
  background: linear-gradient(135deg, #409eff 0%, #8cc5ff 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  color: white;
  font-weight: bold;
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

.avatar-wrapper:hover .avatar-mask,
.default-avatar:hover .avatar-mask {
  opacity: 1;
}

.info h2 {
  margin: 0 0 8px 0;
  font-size: 24px;
  color: #303133;
}

.role-badge {
  display: inline-block;
  background: #f0f2f5;
  color: #909399;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
}



.records-section {
  background: white;
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
}

.list-container {
  padding: 10px 0;
}

.record-item {
  display: flex;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #f5f7fa;
  transition: background 0.3s;
}

.record-item:hover {
  background: #f9fafc;
}

.record-item:last-child {
  border-bottom: none;
}

.item-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20px;
  font-size: 24px;
}

.item-icon.upload {
  background: #ecf5ff;
  color: #409eff;
}

.item-icon.download {
  background: #f0f9eb;
  color: #67c23a;
}

.item-content {
  flex: 1;
}

.item-title {
  font-size: 16px;
  font-weight: 500;
  color: #303133;
  margin-bottom: 6px;
}

.item-meta {
  font-size: 13px;
  color: #909399;
}

.separator {
  margin: 0 8px;
  color: #dcdfe6;
}

.item-status {
  margin-left: 20px;
}

@media (max-width: 768px) {
  .profile-container {
    margin: 80px auto 20px;
    padding: 0 12px;
  }

  .profile-header {
    padding: 20px;
  }

  .avatar-section {
    flex-direction: row;
    align-items: center;
  }

  .info h2 {
    font-size: 20px;
  }

  .records-section {
    padding: 16px;
  }

  .record-item {
    padding: 16px 10px;
  }

  .item-status {
    margin-left: 12px;
  }
}
</style>
