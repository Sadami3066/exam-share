<script setup lang="ts">
import { ref, onMounted } from 'vue'
import request from '../utils/request'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Check, Close, Document, User, Ticket, Edit } from '@element-plus/icons-vue'
import { useUserStore } from '../stores/user'

const userStore = useUserStore()
const activeTab = ref('papers')

// --- 真题审核逻辑 ---
const pendingPapers = ref<any[]>([])
const papersLoading = ref(false)

const fetchPendingPapers = async () => {
  papersLoading.value = true
  try {
    const res: any = await request.get('/admin/papers/pending')
    pendingPapers.value = res
  } catch (error: any) {
    console.error(error)
    if (error.response && error.response.status === 403) {
      ElMessage.error('权限不足，请尝试重新登录')
    } else {
      ElMessage.error('获取待审核列表失败')
    }
  } finally {
    papersLoading.value = false
  }
}

const handleAudit = async (paper: any, status: 'approved' | 'rejected') => {
  try {
    await ElMessageBox.confirm(
      `确定要${status === 'approved' ? '通过' : '拒绝'}这份真题吗？`,
      '审核确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: status === 'approved' ? 'success' : 'warning'
      }
    )

    await request.put(`/admin/papers/${paper.id}/audit`, { status })
    ElMessage.success('操作成功')
    fetchPendingPapers() // 刷新列表
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('操作失败')
    }
  }
}

// 预览文件
const handlePreview = async (paper: any) => {
    if (!userStore.token) {
        ElMessage.warning('请先登录')
        return
    }
    // 使用 API 预览接口
    const url = `/api/papers/${paper.id}/preview?token=${userStore.token}`
    window.open(url, '_blank')
}

// --- 用户管理逻辑 ---
const users = ref<any[]>([])
const usersLoading = ref(false)

const fetchUsers = async () => {
  usersLoading.value = true
  try {
    const res: any = await request.get('/admin/users')
    users.value = res
  } catch (error: any) {
    ElMessage.error('获取用户列表失败')
  } finally {
    usersLoading.value = false
  }
}

const handleRoleChange = async (user: any) => {
  const newRole = user.role === 'admin' ? 'user' : 'admin'
  const actionText = newRole === 'admin' ? '设为管理员' : '取消管理员'
  
  try {
    await ElMessageBox.confirm(
      `确定要将用户 "${user.username}" ${actionText}吗？`,
      '权限变更',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    await request.put(`/admin/users/${user.id}/role`, { role: newRole })
    ElMessage.success('角色修改成功')
    fetchUsers()
  } catch (error) {
    if (error !== 'cancel') ElMessage.error('操作失败')
  }
}

const handleTicketChange = async (user: any) => {
  try {
    const { value } = await ElMessageBox.prompt('请输入新的下载券数量', '修改下载券', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputValue: user.download_tickets,
      inputPattern: /^\d+$/,
      inputErrorMessage: '请输入非负整数'
    })
    
    await request.put(`/admin/users/${user.id}/tickets`, { tickets: parseInt(value) })
    ElMessage.success('下载券修改成功')
    fetchUsers()
  } catch (error) {
    if (error !== 'cancel') ElMessage.error('操作失败')
  }
}

const handleTabChange = (tab: any) => {
  if (tab.paneName === 'papers') {
    fetchPendingPapers()
  } else if (tab.paneName === 'users') {
    fetchUsers()
  }
}

onMounted(() => {
  fetchPendingPapers()
})
</script>

<template>
  <div class="admin-container">
    <div class="page-header">
      <h2>后台管理系统</h2>
    </div>

    <el-card class="table-card">
      <el-tabs v-model="activeTab" @tab-click="handleTabChange">
        <el-tab-pane label="真题审核" name="papers">
          <div class="tab-header">
            <el-button @click="fetchPendingPapers" :icon="Document">刷新列表</el-button>
          </div>
          <div class="table-wrapper">
            <el-table :data="pendingPapers" v-loading="papersLoading" class="responsive-table">
              <el-table-column prop="id" label="ID" width="80" />
              <el-table-column prop="title" label="标题" min-width="200" />
              <el-table-column prop="subject" label="科目" width="120" />
              <el-table-column prop="year" label="年份" width="100" />
              <el-table-column prop="uploader_name" label="上传者" width="120" />
              <el-table-column prop="created_at" label="上传时间" width="180">
                <template #default="scope">
                  {{ new Date(scope.row.created_at).toLocaleString() }}
                </template>
              </el-table-column>
              <el-table-column label="操作" width="250" fixed="right">
                <template #default="scope">
                  <el-button size="small" @click="handlePreview(scope.row)">
                      <el-icon><Document /></el-icon> 查看
                  </el-button>
                  <el-button type="success" size="small" @click="handleAudit(scope.row, 'approved')">
                    <el-icon><Check /></el-icon> 通过
                  </el-button>
                  <el-button type="danger" size="small" @click="handleAudit(scope.row, 'rejected')">
                    <el-icon><Close /></el-icon> 拒绝
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
          <div v-if="pendingPapers.length === 0 && !papersLoading" class="empty-tip">
            暂无待审核真题
          </div>
        </el-tab-pane>

        <el-tab-pane label="用户管理" name="users">
          <div class="tab-header">
            <el-button @click="fetchUsers" :icon="User">刷新列表</el-button>
          </div>
          <div class="table-wrapper">
            <el-table :data="users" v-loading="usersLoading" class="responsive-table">
              <el-table-column prop="id" label="ID" width="80" />
              <el-table-column prop="username" label="用户名" width="150" />
              <el-table-column prop="email" label="邮箱" min-width="200" />
              <el-table-column prop="role" label="角色" width="120">
                <template #default="scope">
                  <el-tag :type="scope.row.role === 'admin' ? 'danger' : 'info'">
                    {{ scope.row.role === 'admin' ? '管理员' : '普通用户' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="download_tickets" label="下载券" width="120" />
              <el-table-column prop="created_at" label="注册时间" width="180">
                <template #default="scope">
                  {{ new Date(scope.row.created_at).toLocaleString() }}
                </template>
              </el-table-column>
              <el-table-column label="操作" width="250" fixed="right">
                <template #default="scope">
                  <el-button 
                    :type="scope.row.role === 'admin' ? 'warning' : 'primary'" 
                    size="small" 
                    @click="handleRoleChange(scope.row)"
                    :disabled="scope.row.id === userStore.userInfo?.id"
                  >
                    <el-icon><User /></el-icon> {{ scope.row.role === 'admin' ? '取消管理' : '设为管理' }}
                  </el-button>
                  <el-button type="success" size="small" @click="handleTicketChange(scope.row)">
                    <el-icon><Ticket /></el-icon> 券
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<style scoped>
.admin-container {
  max-width: 1200px;
  margin: 100px auto 30px;
  padding: 0 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.table-card {
  border-radius: 8px;
}

.table-wrapper {
  width: 100%;
  overflow-x: auto;
}

.responsive-table {
  min-width: 700px;
}

.empty-tip {
  text-align: center;
  padding: 40px;
  color: #909399;
}

.tab-header {
  margin-bottom: 15px;
}

@media (max-width: 768px) {
  .admin-container {
    margin: 80px auto 20px;
    padding: 0 12px;
  }

  .page-header h2 {
    font-size: 20px;
  }

  .table-card {
    border-radius: 12px;
  }

  .tab-header {
    display: flex;
    justify-content: flex-end;
  }

  .responsive-table {
    font-size: 12px;
  }
}
</style>
