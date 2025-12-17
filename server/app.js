const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

// 允许前端应用访问此API（解决跨域问题）
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务 (用于访问上传的文件)
app.use('/uploads', express.static('uploads'));

// 根路由
app.get('/', (req, res) => {
  res.send('真题转转 API Server is running!');
});

// 定义一个简单的测试API
app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from Node.js backend!' });
});

// 数据库连接测试
const db = require('./db');
app.get('/api/db-test', async (req, res) => {
  try {
    const result = await db.query('SELECT NOW()');
    res.json({ message: 'Database connected successfully', time: result.rows[0].now });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database connection failed', details: err.message });
  }
});

// 启动服务器
app.listen(port, () => {
  console.log(`后端服务运行在 http://localhost:${port}`);
});