<script setup lang="ts">
import { ref, onMounted } from 'vue'
import request from '../utils/request'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Check, Close, Document } from '@element-plus/icons-vue'
import { useUserStore } from '../stores/user'

const userStore = useUserStore()
const pendingPapers = ref<any[]>([])
const loading = ref(false)

const fetchPendingPapers = async () => {
  loading.value = true
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
    loading.value = false
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
    const url = `http://localhost:3000/api/papers/${paper.id}/preview?token=${userStore.token}`
    window.open(url, '_blank')
}

onMounted(() => {
  fetchPendingPapers()
})
</script>

<template>
  <div class="admin-container">
    <div class="page-header">
      <h2>真题审核后台</h2>
      <el-button @click="fetchPendingPapers">刷新列表</el-button>
    </div>

    <el-card class="table-card">
      <el-table :data="pendingPapers" v-loading="loading" style="width: 100%">
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
      
      <div v-if="pendingPapers.length === 0 && !loading" class="empty-tip">
        暂无待审核真题
      </div>
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

.empty-tip {
  text-align: center;
  padding: 40px;
  color: #909399;
}
</style>
