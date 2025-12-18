<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { Search, Download, Document, Upload, Plus, View, Picture, User, Calendar, Message, Star, InfoFilled, Check, Delete, Sort } from '@element-plus/icons-vue'
import request from '../utils/request'
import { ElMessage, ElMessageBox, ElNotification, type UploadInstance } from 'element-plus'
import { useUserStore } from '../stores/user'
import socket from '../utils/socket'

const userStore = useUserStore()
const searchQuery = ref('')
const activeSubject = ref('全部')
const activeTeacher = ref('全部')
const activeSort = ref('newest') // 排序状态
const loading = ref(false)

const subjects = ref(['全部'])
const teachers = ref(['全部'])

// 用户相关状态
const purchasedPapers = ref(new Set<number>())

// 计算属性
const isSponsor = computed(() => userStore.userInfo?.is_sponsor)
const isCheckedIn = computed(() => {
  return !!userStore.userInfo?.is_checked_in
})

const heroAds = [
  '你的真题，我来转转！',
  '找真题，上真题转转！',
  '通过签到、上传真题可获得下载次数',
  '特别鸣谢：975137922中山大学互助群的题库支持！'
]
const heroTypeConfig = {
  typeMs: 70,
  deleteMs: 40,
  pauseAfterTypeMs: 1200,
  pauseAfterDeleteMs: 250,
  startDelayMs: 200
}
const heroAdIndex = ref(0)
const heroTypedText = ref('')
const heroIsDeleting = ref(false)
let heroTypeTimer: number | undefined
const heroReduceMotion = ref(false)

// 真题数据
const papers = ref<any[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(12)

// 预览相关
const previewVisible = ref(false)
const previewUrl = ref('')
const previewType = ref('')
const previewTitle = ref('')

// 辅助函数：判断是否为图片
const isImage = (path: string) => {
  if (!path) return false
  return /\.(jpg|jpeg|png|gif)$/i.test(path)
}

// 辅助函数：格式化日期
const formatDate = (dateStr: string) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// 辅助函数：获取文件格式
const getFileFormat = (path: string) => {
  if (!path) return 'UNK'
  const ext = path.split('.').pop()
  return ext ? ext.toUpperCase() : 'FILE'
}

// 获取图片预览链接
const getPreviewUrl = (paper: any) => {
  // 使用相对路径，生产环境自动适配
  let url = `/api/papers/${paper.id}/preview`
  if (userStore.token) {
    url += `?token=${userStore.token}`
  }
  return url
}

const hasCardPreview = (paper: any) => {
  return isImage(paper.file_path) || !!paper.thumbnail_path
}

const getCardPreviewSrc = (paper: any) => {
  if (isImage(paper.file_path)) return getPreviewUrl(paper)
  if (paper.thumbnail_path) return `/${paper.thumbnail_path}`
  return ''
}

const heroSubtitleText = computed(() => {
  return heroReduceMotion.value ? heroAds[heroAdIndex.value] : heroTypedText.value
})

const startHeroTypewriter = () => {
  if (heroTypeTimer) {
    window.clearTimeout(heroTypeTimer)
    heroTypeTimer = undefined
  }

  const tick = () => {
    const fullText = heroAds[heroAdIndex.value] || ''
    const current = heroTypedText.value

    if (!heroIsDeleting.value) {
      heroTypedText.value = fullText.slice(0, current.length + 1)
      if (heroTypedText.value === fullText) {
        heroIsDeleting.value = true
        heroTypeTimer = window.setTimeout(tick, heroTypeConfig.pauseAfterTypeMs)
        return
      }
      heroTypeTimer = window.setTimeout(tick, heroTypeConfig.typeMs)
      return
    }

    heroTypedText.value = fullText.slice(0, Math.max(0, current.length - 1))
    if (heroTypedText.value.length === 0) {
      heroIsDeleting.value = false
      heroAdIndex.value = (heroAdIndex.value + 1) % heroAds.length
      heroTypeTimer = window.setTimeout(tick, heroTypeConfig.pauseAfterDeleteMs)
      return
    }
    heroTypeTimer = window.setTimeout(tick, heroTypeConfig.deleteMs)
  }

  heroTypedText.value = ''
  heroIsDeleting.value = false
  heroTypeTimer = window.setTimeout(tick, heroTypeConfig.startDelayMs)
}

// 管理员下架真题
const handleTakeDown = async (paper: any) => {
  try {
    await ElMessageBox.confirm(`确定要下架 "${paper.title}" 吗？`, '管理员操作', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    
    await request.post(`/papers/${paper.id}/takedown`)
    ElMessage.success('下架成功')
    fetchPapers()
  } catch (error) {
    if (error !== 'cancel') {
      console.error(error)
      ElMessage.error('下架失败')
    }
  }
}

// 获取真题列表
const fetchPapers = async () => {
  loading.value = true
  try {
    const res: any = await request.get('/papers', {
      params: {
        page: currentPage.value,
        limit: pageSize.value,
        subject: activeSubject.value,
        teacher: activeTeacher.value,
        search: searchQuery.value,
        sort: activeSort.value
      }
    })
    papers.value = res.papers
    total.value = res.total
  } catch (error) {
    console.error('获取真题列表失败', error)
    ElMessage.error('获取真题列表失败')
  } finally {
    loading.value = false
  }
}

// 获取筛选选项
const fetchFilters = async () => {
  try {
    const res: any = await request.get('/papers/filters')
    if (res.subjects && res.subjects.length > 0) {
       // 合并后端返回的课程，去重
       const newSubjects = new Set([...subjects.value, ...res.subjects])
       subjects.value = Array.from(newSubjects)
    }
    if (res.teachers) {
        teachers.value = ['全部', ...res.teachers]
    }
  } catch (error) {
    console.error('获取筛选选项失败', error)
  }
}

// 获取已购买真题
const fetchPurchasedPapers = async () => {
  if (!userStore.token) return
  try {
    const res: any = await request.get('/user/downloads')
    // res 是数组，包含 paper_id
    const ids = res.map((item: any) => item.id)
    purchasedPapers.value = new Set(ids)
  } catch (error) {
    console.error('获取已购买真题失败', error)
  }
}

// 判断是否已购买
const isPurchased = (paperId: number) => {
  return purchasedPapers.value.has(paperId)
}

// 监听筛选条件变化
watch([activeSubject, activeTeacher, currentPage, activeSort], () => {
  fetchPapers()
})

const handleSearch = () => {
  currentPage.value = 1 // 搜索时重置页码
  fetchPapers()
}

onMounted(() => {
  fetchFilters()
  fetchPapers()
  if (userStore.token) {
    fetchPurchasedPapers()
    userStore.fetchUserInfo()
  }
  heroReduceMotion.value = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false
  if (!heroReduceMotion.value) {
    startHeroTypewriter()
  }
  // 移动端检测（把 handler 抽到外层以便后续移除）
  // 见文件顶部的 `handleResize` 定义
  handleResize()
  window.addEventListener('resize', handleResize)
  
  // 监听新真题发布事件
  socket.on('paper_approved', (data: any) => {
    // 仅自动刷新列表，不弹窗打扰
    fetchPapers()
  })

  // 监听真题下架事件
  socket.on('paper_taken_down', (data: any) => {
    // 实时移除已下架的真题
    papers.value = papers.value.filter(p => p.id != data.id)
  })
})

onUnmounted(() => {
  socket.off('paper_approved')
  socket.off('paper_taken_down')
  window.removeEventListener('resize', handleResize)
  if (heroTypeTimer) {
    window.clearTimeout(heroTypeTimer)
    heroTypeTimer = undefined
  }
})

// --- 预览相关逻辑 ---
const handlePreview = async (paper: any) => {
  // 判断文件类型
  const isImg = isImage(paper.file_path)
  const isPdf = /\.pdf$/i.test(paper.file_path)

  if (!isImg && !isPdf) {
    ElMessage.warning('该文件格式暂不支持在线预览，请下载后查看')
    return
  }

  try {
    // 使用直接链接进行预览，利用浏览器的原生 PDF/图片 渲染能力
    // 同时也避免了 Blob 大文件下载导致的内存问题
    let url = `/api/papers/${paper.id}/preview`
    if (userStore.token) {
      url += `?token=${userStore.token}`
    }
    
    previewUrl.value = url
    previewType.value = isPdf ? 'pdf' : 'image'
    previewTitle.value = paper.title
    previewVisible.value = true
  } catch (error) {
    ElMessage.error('预览加载失败')
  }
}

// --- 下载相关逻辑 ---
const handleDownload = async (paper: any) => {
  if (!userStore.token) {
    ElMessage.warning('请先登录')
    return
  }

  try {
    let confirmMsg = `下载将消耗 1 张下载券（当前剩余 ${userStore.userInfo.download_tickets || 0} 张）。`
    let isFree = false
    
    if (paper.uploader_id === userStore.userInfo.id) {
        confirmMsg = '这是您上传的真题，可免费下载。'
        isFree = true
    } else if (isSponsor.value) {
        confirmMsg = '尊贵的赞助者，您可以无限次免费下载。'
        isFree = true
    } else if (isPurchased(paper.id)) {
        confirmMsg = '您已购买过此真题，可免费重新下载。'
        isFree = true
    }

    await ElMessageBox.confirm(
      confirmMsg,
      '确认下载',
      {
        confirmButtonText: '确认下载',
        cancelButtonText: '取消',
        type: isFree ? 'success' : 'info',
      }
    )

    // 开始下载
    const res: any = await request.get(`/papers/${paper.id}/download`, {
      responseType: 'blob' // 重要：指定响应类型为 blob
    })

    // 创建下载链接
    const url = window.URL.createObjectURL(new Blob([res]))
    const link = document.createElement('a')
    link.href = url
    
    // 动态获取文件后缀
    // 假设 paper.file_path 格式如 "uploads/123456-test.png"
    let ext = 'pdf'; // 默认兜底
    if (paper.file_path) {
        const parts = paper.file_path.split('.');
        if (parts.length > 1) {
            ext = parts.pop();
        }
    }
    
    link.setAttribute('download', `${paper.title}.${ext}`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)

    ElMessage.success('开始下载')
    
    // 刷新用户信息（获取最新积分）
    userStore.fetchUserInfo()
    // 刷新已购买列表
    fetchPurchasedPapers()
    
    // 刷新列表以更新下载次数
    fetchPapers()

  } catch (error: any) {
    if (error !== 'cancel') {
      console.error(error)
      // 如果是 blob 错误，可能需要读取 FileReader 才能看到 JSON 错误信息
      if (error.response && error.response.data instanceof Blob) {
         const reader = new FileReader()
         reader.onload = () => {
             try {
                 const errorMsg = JSON.parse(reader.result as string)
                 ElMessage.error(errorMsg.error || '下载失败')
             } catch (e) {
                 ElMessage.error('下载失败')
             }
         }
         reader.readAsText(error.response.data)
      } else {
          ElMessage.error('下载失败')
      }
    }
  }
}

// --- 上传相关逻辑 ---
const uploadVisible = ref(false)
const drawerVisible = ref(false)
const uploadLoading = ref(false)
const uploadRefDialog = ref<UploadInstance | null>(null)
const uploadRefDrawer = ref<UploadInstance | null>(null)
const isMobile = ref(false)
const handleResize = () => {
  isMobile.value = window.innerWidth <= 480
}
const uploadForm = ref({
  title: '',
  subject: '',
  teacher: '',
  year: new Date().getFullYear(),
  file: null as File | null
})

const handleFileChange = (file: any) => {
  const isLt50M = file.size / 1024 / 1024 < 50
  if (!isLt50M) {
    ElMessage.error('上传文件大小不能超过 50MB!')
    uploadRefDialog.value?.clearFiles()
    uploadRefDrawer.value?.clearFiles()
    uploadForm.value.file = null
    return
  }
  uploadForm.value.file = file.raw
}

const submitUpload = async () => {
  if (!uploadForm.value.title || !uploadForm.value.subject || !uploadForm.value.file) {
    ElMessage.warning('请填写完整信息并选择文件')
    return
  }

  uploadLoading.value = true
  const formData = new FormData()
  formData.append('title', uploadForm.value.title)
  formData.append('subject', uploadForm.value.subject)
  formData.append('teacher', uploadForm.value.teacher)
  formData.append('year', uploadForm.value.year.toString())
  formData.append('file', uploadForm.value.file)

  try {
    // 需要手动添加 Authorization header，因为 request 拦截器可能还没配置好 token
    // 或者确保 request.ts 里已经正确处理了 token
    const token = userStore.token
    await request.post('/papers/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'Authorization': `Bearer ${token}`
      }
    })
    ElMessage.success('上传成功！审核通过后将显示在列表中')
    uploadVisible.value = false
    drawerVisible.value = false
    // 重置表单
    uploadForm.value = { title: '', subject: '', teacher: '', year: new Date().getFullYear(), file: null }
    uploadRefDialog.value?.clearFiles()
    uploadRefDrawer.value?.clearFiles()
    // 刷新列表
    fetchPapers()
    fetchFilters() // 刷新筛选选项
    // 刷新用户信息（获取最新积分）
    userStore.fetchUserInfo()
  } catch (error: any) {
    console.error(error)
    ElMessage.error(error.response?.data?.error || '上传失败')
  } finally {
    uploadLoading.value = false
  }
}

const openUploadModal = () => {
  if (!userStore.token) {
    ElMessage.warning('请先登录')
    return
  }
  if (isMobile.value) {
    drawerVisible.value = true
  } else {
    uploadVisible.value = true
  }
}
</script>

<template>
  <div class="home-container">
    <!-- Hero Section -->
    <section class="hero-section">
      <div class="hero-content">
        <h1 class="hero-title">转转真题</h1>
        <p class="hero-subtitle">
          <span class="typewriter-text">{{ heroSubtitleText }}</span><span class="typewriter-cursor" aria-hidden="true">|</span>
        </p>
        
        <div class="search-box">
          <el-input
            v-model="searchQuery"
            placeholder="搜索科目、试卷名称..."
            class="hero-search-input"
            size="large"
            @keyup.enter="handleSearch"
          >
            <template #prefix>
              <el-icon class="search-icon"><Search /></el-icon>
            </template>
            <template #append>
              <el-button @click="handleSearch">搜索</el-button>
            </template>
          </el-input>
        </div>

        <!-- 用户功能区 (Desktop) -->
        <!-- 已移动到顶部导航栏 -->

        <!-- 用户功能区 (Mobile) -->
        <!-- 已移动到顶部导航栏 -->
      </div>
      <!-- 装饰性背景元素 -->
      <div class="hero-shape shape-1"></div>
      <div class="hero-shape shape-2"></div>
    </section>

    <!-- Main Content -->
    <main class="main-content">
      <!-- 工具栏：分类 + 上传按钮 -->
      <div class="toolbar">
        <div class="toolbar-left">
          <div class="category-tabs">
            <el-scrollbar>
              <div class="tabs-wrapper">
                <button 
                  v-for="sub in subjects" 
                  :key="sub"
                  :class="['tab-item', { active: activeSubject === sub }]"
                  @click="activeSubject = sub"
                >
                  {{ sub }}
                </button>
              </div>
            </el-scrollbar>
          </div>
        </div>
        
        <div class="toolbar-right">
          <el-select 
            v-model="activeSort" 
            placeholder="排序方式" 
            size="large" 
            class="sort-select"
          >
            <template #prefix>
              <el-icon><Sort /></el-icon>
            </template>
            <el-option label="最新上传" value="newest" />
            <el-option label="最多下载" value="popular" />
          </el-select>

          <el-select 
            v-model="activeTeacher" 
            placeholder="筛选老师" 
            class="teacher-select" 
            size="large"
            filterable
          >
            <template #prefix>
              <el-icon><User /></el-icon>
            </template>
            <el-option v-for="tea in teachers" :key="tea" :label="tea === '全部' ? '全部老师' : tea" :value="tea" />
          </el-select>
          
          <el-button type="primary" size="large" class="upload-btn" @click="openUploadModal">
            <el-icon class="el-icon--left"><Upload /></el-icon>上传真题
          </el-button>
        </div>
      </div>

      <!-- 真题列表 -->
      <div class="paper-grid" v-loading="loading && papers.length > 0">
        <!-- 骨架屏 Loading -->
        <template v-if="loading && papers.length === 0">
          <el-card v-for="i in 8" :key="i" class="paper-card skeleton-card">
            <el-skeleton animated>
              <template #template>
                <div style="display: flex; flex-direction: column; align-items: center; padding: 20px;">
                  <el-skeleton-item variant="image" style="width: 60px; height: 60px; border-radius: 12px; margin-bottom: 15px;" />
                  <el-skeleton-item variant="h3" style="width: 80%; margin-bottom: 10px;" />
                  <el-skeleton-item variant="text" style="width: 60%; margin-bottom: 20px;" />
                  <div style="display: flex; justify-content: space-between; width: 100%; margin-top: 10px;">
                    <el-skeleton-item variant="text" style="width: 30%;" />
                    <el-skeleton-item variant="text" style="width: 20%;" />
                  </div>
                </div>
              </template>
            </el-skeleton>
          </el-card>
        </template>

        <!-- 空状态 -->
        <div v-else-if="!loading && papers.length === 0" class="empty-state">
          <el-empty description="暂无真题，快来上传第一份吧！" />
        </div>

        <!-- 真实数据 -->
        <template v-else>
        <div v-for="paper in papers" :key="paper.id" class="paper-card">
          <!-- 管理员下架按钮 -->
          <el-button 
            v-if="userStore.userInfo?.role === 'admin'" 
            type="danger" 
            circle 
            size="small" 
            :icon="Delete" 
            class="admin-takedown-btn"
            @click.stop="handleTakeDown(paper)" 
            title="下架" 
          />

          <!-- 情况1：是图片 -> 显示缩略图 -->
          <div
            class="card-preview"
            v-if="hasCardPreview(paper)"
            @click.stop="!isMobile && handlePreview(paper)"
            :style="{ cursor: isMobile ? 'default' : 'pointer' }"
          >
            <el-image 
              :src="getCardPreviewSrc(paper)" 
              fit="cover" 
              class="paper-thumbnail"
              loading="lazy"
            >
              <template #error>
                <div class="image-slot">
                  <el-icon><Picture /></el-icon>
                </div>
              </template>
            </el-image>
          </div>
          <!-- 情况3：非图片 -> 显示文档图标 -->
          <div class="card-icon" v-else>
            <el-icon><Document /></el-icon>
          </div>
          
          <!-- 已购买/赞助 标记 -->
          <div class="purchased-badge" v-if="isPurchased(paper.id) || isSponsor">
            <span class="purchased-text">{{ isSponsor ? '免费' : '已购' }}</span>
          </div>

          <div class="card-content">
            <h3 class="paper-title" :title="paper.title">{{ paper.title }}</h3>
            <div class="paper-meta">
              <span class="tag subject-tag">{{ paper.subject }}</span>
              <span class="tag teacher-tag" v-if="paper.teacher">{{ paper.teacher }}</span>
              <span class="tag year-tag">{{ paper.year }}年</span>
            </div>
            <div class="paper-info">
              <span class="info-item">{{ formatDate(paper.created_at) }}</span>
              <span class="info-item format-tag">{{ getFileFormat(paper.file_path) }}</span>
            </div>
            <div class="paper-footer">
              <div class="uploader-and-downloads">
                <div class="uploader-info">
                  <el-avatar v-if="paper.uploader_avatar" :size="24" :src="`/${paper.uploader_avatar}`" class="uploader-avatar" />
                  <el-avatar v-else :size="24" class="uploader-avatar">{{ paper.uploader_name?.charAt(0).toUpperCase() }}</el-avatar>
                  <span class="uploader-name">{{ paper.uploader_name }}</span>
                </div>
                <div class="downloads-info" title="下载次数">
                  <el-icon><Download /></el-icon>
                  <span>{{ paper.download_count }}</span>
                </div>
              </div>
              <div class="footer-right">
                <el-button 
                  class="mobile-download-btn" 
                  type="primary" 
                  size="small" 
                  round 
                  @click.stop="handleDownload(paper)"
                >
                  下载
                </el-button>
              </div>
            </div>
          </div>
          <div class="card-hover-overlay">
            <el-button type="success" round @click.stop="handleDownload(paper)">
              <el-icon><Download /></el-icon> 下载
            </el-button>
          </div>
        </div>
        </template>
      </div>
      
      <!-- 分页 -->
      <div class="pagination-container" v-if="total > 0">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="total"
          layout="prev, pager, next"
          background
        />
      </div>
    </main>

    <!-- 上传弹窗 -->
    <el-dialog
      v-model="uploadVisible"
      title="上传真题"
      width="460px"
      destroy-on-close
      center
      class="upload-dialog custom-dialog"
    >
      <el-form :model="uploadForm" label-position="top" class="upload-form">
        <el-form-item label="试卷标题" required>
          <el-input v-model="uploadForm.title" placeholder="例如：2024-2025第一学期高等数学A期末真题" prefix-icon="Document" />
        </el-form-item>
        
        <el-row :gutter="20">
          <el-col :xs="24" :sm="12">
            <el-form-item label="课程名称" required>
              <el-select v-model="uploadForm.subject" placeholder="选择或输入课程" filterable allow-create default-first-option style="width: 100%">
                <el-option v-for="sub in subjects.filter(s => s !== '全部')" :key="sub" :label="sub" :value="sub" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="授课老师">
              <el-input v-model="uploadForm.teacher" placeholder="例如：张三" />
            </el-form-item>
          </el-col>
        </el-row>
        
        <el-form-item label="年份" required>
           <el-input-number v-model="uploadForm.year" :min="2000" :max="2099" style="width: 100%" controls-position="right" />
        </el-form-item>

        <el-form-item label="文件上传 (PDF/图片/Word, Max 10MB)" required>
          <el-upload
            ref="uploadRefDialog"
            class="upload-demo"
            drag
            action="#"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            :auto-upload="false"
            :on-change="handleFileChange"
            :limit="1"
          >
            <el-icon class="el-icon--upload"><upload-filled /></el-icon>
            <div class="el-upload__text">
              拖拽文件到此处或 <em>点击上传</em>
            </div>
            <template #tip>
              <div class="el-upload__tip">
                支持 PDF/Word/图片 格式，文件大小不超过 10MB
              </div>
            </template>
          </el-upload>
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="uploadVisible = false">取消</el-button>
          <el-button type="primary" :loading="uploadLoading" @click="submitUpload" color="#626aef">
            确认上传
          </el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 移动端底部抽屉上传（仅在手机上触发） -->
    <el-drawer
      v-model="drawerVisible"
      title="上传真题"
      direction="btt"
      size="80vh"
      class="upload-drawer"
      destroy-on-close
    >
      <el-form :model="uploadForm" label-position="top" class="upload-form">
        <el-form-item label="试卷标题" required>
          <el-input v-model="uploadForm.title" placeholder="例如：2024-2025第一学期高等数学A期末真题" prefix-icon="Document" />
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="24">
            <el-form-item label="课程名称" required>
              <el-select v-model="uploadForm.subject" placeholder="选择或输入课程" filterable allow-create default-first-option style="width: 100%">
                <el-option v-for="sub in subjects.filter(s => s !== '全部')" :key="sub" :label="sub" :value="sub" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="授课老师">
              <el-input v-model="uploadForm.teacher" placeholder="例如：张三" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="年份" required>
           <el-input-number v-model="uploadForm.year" :min="2000" :max="2099" style="width: 100%" controls-position="right" />
        </el-form-item>

        <el-form-item label="文件上传 (PDF/图片/Word, Max 10MB)" required>
          <el-upload
            ref="uploadRefDrawer"
            class="upload-demo"
            drag
            action="#"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            :auto-upload="false"
            :on-change="handleFileChange"
            :limit="1"
          >
            <el-icon class="el-icon--upload"><upload-filled /></el-icon>
            <div class="el-upload__text">
              拖拽文件到此处或 <em>点击上传</em>
            </div>
            <template #tip>
              <div class="el-upload__tip">
                支持 PDF/Word/图片 格式，文件大小不超过 10MB
              </div>
            </template>
          </el-upload>
        </el-form-item>
      </el-form>
      <template #footer>
        <div style="display:flex;gap:8px;justify-content:flex-end;padding:8px 0;">
          <el-button @click="drawerVisible = false">取消</el-button>
          <el-button type="primary" :loading="uploadLoading" @click="submitUpload">确认上传</el-button>
        </div>
      </template>
    </el-drawer>

    <!-- 预览弹窗 -->
    <el-dialog
      v-model="previewVisible"
      :title="previewTitle"
      width="80%"
      top="5vh"
      destroy-on-close
      class="preview-dialog"
    >
      <div class="preview-content">
        <iframe v-if="previewType === 'pdf'" :src="previewUrl" style="width: 100%; height: 60vh;" frameborder="0"></iframe>
        <img v-else-if="previewType === 'image'" :src="previewUrl" alt="预览图片" style="max-width: 100%; max-height: 60vh; display: block; margin: 0 auto;">
        <div v-else class="preview-placeholder">暂不支持该格式预览</div>
      </div>
    </el-dialog>

  </div>
</template>

<style scoped>
.user-actions {
  display: flex;
  gap: 15px;
  margin-top: 20px;
  justify-content: center;
}

.user-actions.mobile-only {
  display: none;
}

.purchased-badge {
  position: absolute;
  top: 10px;
  left: -32px;
  z-index: 2;
  width: 100px;
  transform: rotate(-45deg);
  background: #67c23a;
  padding: 2px 0;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15);
  text-align: center;
}

.purchased-text {
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 1px;
  text-align: center;
  display: inline-block;
}

.sponsor-content {
  text-align: center;
}
.sponsor-desc {
  margin-bottom: 20px;
  color: #606266;
}
.highlight {
  color: #f56c6c;
  font-weight: bold;
}
.sponsor-options {
  display: flex;
  justify-content: space-around;
  margin-bottom: 20px;
}
.sponsor-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  padding: 15px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  transition: all 0.3s;
  width: 100px;
}
.sponsor-item:hover {
  border-color: #409eff;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}
.sponsor-icon {
  font-size: 32px;
  margin-bottom: 8px;
}
.sponsor-note {
  font-size: 12px;
  color: #909399;
}

.contact-content {
  padding: 10px;
}
.contact-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 15px;
  padding: 10px;
  background: #f5f7fa;
  border-radius: 4px;
}
.contact-item .label {
  font-weight: bold;
  color: #606266;
}
.contact-item .value {
  flex: 1;
  margin-left: 10px;
  color: #303133;
}

/* 变量定义 */
:root {
  --primary-color: #409eff;
  --text-main: #303133;
  --text-secondary: #909399;
  --bg-color: #f5f7fa;
  --card-bg: #ffffff;
}

.home-container {
  min-height: 100vh;
  background-color: var(--bg-color);
}

/* Hero Section */
.hero-section {
  position: relative;
  height: 400px;
  background-image: url('/imgaes/sea.png');
  background-size: cover;
  background-position: center;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  color: white;
  text-align: center;
  padding: 0 20px;
}

.hero-section::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3); /* 遮罩层，确保文字清晰 */
  z-index: 1;
}

.hero-content {
  position: relative;
  z-index: 2;
  max-width: 800px;
  width: 100%;
  animation: fadeInUp 0.8s ease-out;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.hero-title {
  font-size: clamp(1.8rem, 4vw, 3rem);
  font-weight: 800;
  margin-bottom: 1rem;
  letter-spacing: 2px;
  text-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.hero-subtitle {
  font-size: clamp(0.95rem, 2vw, 1.2rem);
  margin-bottom: 2.5rem;
  opacity: 0.9;
  font-weight: 300;
  min-height: 1.6em;
}

.typewriter-text {
  white-space: nowrap;
}

.typewriter-cursor {
  display: inline-block;
  width: 0.8ch;
  margin-left: 2px;
  animation: typewriterBlink 1s steps(2, start) infinite;
}

@keyframes typewriterBlink {
  0% { opacity: 1; }
  50% { opacity: 0; }
  100% { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .typewriter-cursor {
    animation: none;
  }
}

.search-box {
  max-width: 600px;
  margin: 0 auto;
}

.hero-search-input :deep(.el-input__wrapper) {
  border-radius: 30px 0 0 30px;
  box-shadow: 0 4px 15px rgba(0,0,0,0.1);
}

.hero-search-input :deep(.el-input-group__append) {
  border-radius: 0 30px 30px 0;
  background-color: #fff;
  border: none;
  box-shadow: 0 4px 15px rgba(0,0,0,0.1);
}

.hero-search-input :deep(.el-button) {
  color: #409eff;
  font-weight: bold;
}

/* 装饰背景 */
.hero-shape {
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  z-index: 1;
}
.shape-1 { width: 300px; height: 300px; top: -50px; left: -50px; }
.shape-2 { width: 200px; height: 200px; bottom: -30px; right: 10%; }

/* Main Content */
.main-content {
  max-width: 1200px;
  margin: -40px auto 0;
  padding: 0 20px 40px;
  position: relative;
  z-index: 3;
}

/* Toolbar */
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  gap: 20px;
  background: white;
  padding: 10px 20px;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.05);
}

.toolbar-left {
  flex: 1;
  min-width: 0; /* 防止 flex 子项溢出 */
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 15px;
  flex-shrink: 0;
  flex-wrap: wrap;
}

.category-tabs {
  overflow: hidden;
}

.tabs-wrapper {
  display: flex;
  gap: 10px;
  padding: 5px 0;
}

.tab-item {
  border: none;
  background: #f0f2f5;
  padding: 8px 20px;
  border-radius: 20px;
  color: #606266;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 0.95rem;
  white-space: nowrap;
}

.tab-item:hover {
  background: #e6e8eb;
}

.tab-item.active {
  background: #409eff;
  color: white;
  box-shadow: 0 4px 10px rgba(64, 158, 255, 0.3);
}

.teacher-select {
  width: 160px;
}

.sort-select {
  width: 140px;
}

.upload-btn {
  border-radius: 12px;
  box-shadow: 0 4px 15px rgba(64, 158, 255, 0.3);
  height: 40px;
}

/* Paper Grid */
.paper-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 25px;
  min-height: 200px;
}

.paper-card {
  background: white;
  border-radius: 16px;
  padding: 20px;
  position: relative;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid #ebeef5;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.paper-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 12px 30px rgba(0,0,0,0.08);
  border-color: transparent;
}

.admin-takedown-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 10;
  opacity: 0;
  transition: opacity 0.3s;
}

.paper-card:hover .admin-takedown-btn {
  opacity: 1;
}

@media (max-width: 768px) {
  .admin-takedown-btn {
    opacity: 1;
  }
}

.card-preview {
  width: 100%;
  height: 140px;
  margin-bottom: 15px;
  border-radius: 12px;
  overflow: hidden;
  background: #f5f7fa;
}

.paper-thumbnail {
  width: 100%;
  height: 100%;
  display: block;
  transition: transform 0.3s ease;
  object-fit: cover;
  object-position: top center; /* 显示顶部中间部分 */
}

.paper-card:hover .paper-thumbnail {
  transform: scale(1.05);
}

.image-slot {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
  background: #f5f7fa;
  color: #909399;
  font-size: 24px;
}

.card-icon {
  width: 100%;
  height: 140px;
  background: #ecf5ff;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 15px;
  color: #409eff;
  font-size: 48px;
}

.paper-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: #303133;
  margin: 0 0 12px;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  height: 3.3rem;
}

.paper-meta {
  display: flex;
  flex-wrap: wrap;
  column-gap: 8px;
  row-gap: 4px;
  margin-bottom: 6px;
}

.paper-info {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 12px;
  color: #909399;
}

.info-item {
  display: flex;
  align-items: center;
}

.format-tag {
  background: #f0f2f5;
  padding: 2px 8px;
  border-radius: 999px;
  font-weight: 500;
  color: #606266;
}

.tag {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 999px;
  line-height: 1.2;
}

.subject-tag {
  background: #f0f9eb;
  color: #67c23a;
}

.teacher-tag {
  background: #e6f7ff;
  color: #1890ff;
}

.year-tag {
  background: #f4f4f5;
  color: #909399;
}

.paper-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid #f0f2f5;
}

.uploader-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.uploader-avatar {
  background: #ecf5ff;
  color: #409eff;
  font-size: 12px;
  font-weight: bold;
}

.uploader-name {
  font-size: 0.85rem;
  color: #606266;
  font-weight: 500;
}

.uploader-and-downloads {
  display: flex;
  align-items: center;
  gap: 12px;
}

.footer-right {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.downloads-info {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #909399;
  font-size: 0.85rem;
  background: #f5f7fa;
  padding: 4px 8px;
  border-radius: 12px;
}

.mobile-download-btn {
  display: none; /* PC端默认隐藏，使用悬停遮罩 */
}

.downloads {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* Hover Overlay */
.card-hover-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(255, 255, 255, 0.95);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  opacity: 0;
  transition: all 0.3s ease;
  backdrop-filter: blur(5px);
}

.paper-card:hover .card-hover-overlay {
  opacity: 1;
}

.empty-state {
  grid-column: 1 / -1;
  padding: 40px 0;
}

.pagination-container {
  margin-top: 40px;
  display: flex;
  justify-content: center;
}

/* 移动端适配 */
/* 骨架屏卡片 */
.skeleton-card {
  height: auto;
  min-height: 200px;
  justify-content: center;
}

/* 预览弹窗内容 */
.preview-content {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 300px;
  background-color: #f5f7fa;
  border-radius: 4px;
}

.preview-placeholder {
  color: #909399;
  font-size: 16px;
}

@media (max-width: 768px) {
  .user-actions.desktop-only {
    display: none;
  }

  .user-actions.mobile-only {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
  }

  .hero-section {
    height: auto;
    min-height: 320px;
    padding: 80px 20px 60px;
  }
  
  .hero-title {
    font-size: 1.8rem;
    margin-bottom: 0.5rem;
  }

  .hero-subtitle {
    font-size: 0.9rem;
    margin-bottom: 1.5rem;
  }

  .user-actions {
    gap: 10px;
    margin-top: 15px;
  }

  .user-actions .el-button.is-circle {
    width: 40px;
    height: 40px;
    font-size: 16px;
  }
  
  .main-content {
    margin-top: -30px;
  }
  
  .toolbar {
    flex-direction: column;
    align-items: stretch;
    gap: 15px;
    padding: 15px;
  }

  .toolbar-right {
    display: flex;
    flex-wrap: wrap;
    width: 100%;
    gap: 10px;
  }

  .sort-select,
  .teacher-select,
  .upload-btn {
    flex: 1 1 100%;
    width: 100%;
  }
  
  .upload-btn {
    height: 40px;
  }

  .paper-grid {
    grid-template-columns: 1fr; /* 手机端单列显示 */
  }
  
  .paper-card {
    flex-direction: row;
    align-items: center;
    padding: 12px;
    height: auto; /* 允许高度自适应 */
  }
  
  .card-preview, .card-icon {
    width: 80px;
    height: 80px;
    margin-bottom: 0;
    margin-right: 15px;
    flex-shrink: 0; /* 防止被压缩 */
    border-radius: 8px;
  }

  .card-icon {
    font-size: 32px; /* 调整图标大小 */
  }
  
  .card-content {
    flex: 1;
    min-width: 0; /* 防止文字溢出 */
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  
  .paper-title {
    font-size: 1rem;
    height: auto;
    margin-bottom: 6px;
    -webkit-line-clamp: 1;
    line-clamp: 1;
  }
  
  .paper-meta {
    margin-bottom: 4px;
  }

  .paper-info {
    margin-bottom: 0;
  }
  
  .paper-footer {
    display: flex;
    margin-top: 6px;
    padding-top: 0;
    border-top: none;
    justify-content: space-between;
    align-items: center;
  }

  .card-hover-overlay {
    display: none; /* 手机端禁用悬停遮罩 */
  }

  .uploader {
    display: none; /* 手机端隐藏上传者，节省空间 */
  }

  .footer-right {
    width: 100%;
    justify-content: space-between;
  }

  .downloads {
    font-size: 0.8rem;
  }
  
  .mobile-download-btn {
    display: inline-flex !important; /* 手机端强制显示 */
    padding: 4px 12px;
    height: 28px;
    font-size: 0.8rem;
  }
}
</style>

<style>
/* 上传弹窗（Dialog）响应式覆盖（全局，针对 Element Plus teleport 情况）*/
.custom-dialog .el-dialog {
  max-width: 480px !important; /* 桌面和较大屏幕限制为 480px */
  width: auto !important;
  margin: 0 auto !important;
}
.custom-dialog .el-dialog__body {
  padding: 16px !important;
}
.upload-form {
  max-width: 100%;
  box-sizing: border-box;
}
.upload-demo {
  width: 100%;
}
.el-upload--drag .el-upload__text em {
  font-style: normal;
  color: var(--primary-color);
}

@media (max-width: 480px) {
  /* 更紧凑的移动端对话框：更小宽度、更小内边距与更小字体 */
  .custom-dialog .el-dialog {
    max-width: 86vw !important;
    margin: 0 7vw !important;
  }
  .custom-dialog .el-dialog__header {
    padding: 8px 10px !important;
    font-size: 15px !important;
  }
  .custom-dialog .el-dialog__body {
    padding: 10px !important;
    font-size: 13px !important;
  }
  .upload-demo {
    padding: 8px;
    box-sizing: border-box;
  }
  .upload-form .el-form-item {
    margin-bottom: 10px;
  }
  .el-input, .el-select, .el-input-number {
    width: 100% !important;
  }

  .upload-drawer .el-drawer__body {
    padding: 10px !important;
  }
  .upload-drawer .el-drawer__footer {
    padding: 8px 10px !important;
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
  .upload-drawer .el-form-item {
    margin-bottom: 8px;
  }
}
</style>

<style>
/* 微调上传拖拽区，确保在小屏幕内不溢出并保持合理高度 */
.el-upload--drag .el-upload__inner {
  min-height: 110px;
  padding: 10px;
  box-sizing: border-box;
  width: 100%;
}
.el-upload--drag {
  width: 100%;
}

/* Footer 按钮更紧凑 */
.custom-dialog .el-dialog__footer {
  padding: 10px 12px !important;
}
.custom-dialog .el-dialog__footer .el-button {
  padding: 6px 12px !important;
  font-size: 13px !important;
}
</style>
