<script setup lang="ts">
import { ref } from 'vue'
import request from './utils/request'
import { ElMessage } from 'element-plus'

const apiMessage = ref('')
const dbMessage = ref('')

const testApi = async () => {
  try {
    const res: any = await request.get('/hello')
    apiMessage.value = res.message
    ElMessage.success('API 连接成功')
  } catch (error) {
    ElMessage.error('API 连接失败')
  }
}

const testDb = async () => {
  try {
    const res: any = await request.get('/db-test')
    dbMessage.value = `${res.message} (Time: ${res.time})`
    ElMessage.success('数据库连接成功')
  } catch (error) {
    ElMessage.error('数据库连接失败')
  }
}
</script>

<template>
  <div class="app-container">
    <h1>真题转转 - 开发调试</h1>
    
    <el-card class="box-card">
      <template #header>
        <div class="card-header">
          <span>后端连通性测试</span>
        </div>
      </template>
      
      <div class="test-item">
        <el-button type="primary" @click="testApi">测试 API 接口</el-button>
        <p v-if="apiMessage" class="result">{{ apiMessage }}</p>
      </div>

      <div class="test-item">
        <el-button type="success" @click="testDb">测试数据库连接</el-button>
        <p v-if="dbMessage" class="result">{{ dbMessage }}</p>
      </div>
    </el-card>

    <router-view></router-view>
  </div>
</template>

<style scoped>
.app-container {
  max-width: 800px;
  margin: 50px auto;
  padding: 20px;
  text-align: center;
}
.box-card {
  margin-top: 20px;
  text-align: left;
}
.test-item {
  margin-bottom: 20px;
}
.result {
  margin-top: 10px;
  color: #666;
  background: #f5f7fa;
  padding: 10px;
  border-radius: 4px;
}
</style>
