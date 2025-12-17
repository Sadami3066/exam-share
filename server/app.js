const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // 允许所有来源，生产环境请限制为前端域名
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

const port = process.env.PORT || 3000;

// 将 io 挂载到 req 对象上，以便在路由中使用
app.use((req, res, next) => {
  req.io = io;
  next();
});

// 允许前端应用访问此API（解决跨域问题）
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 安全防护：Helmet
// 配置 crossOriginResourcePolicy 允许跨域加载图片 (因为前端在不同端口)
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// 接口限流配置
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 300, // 限制每个IP 300次请求
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '请求过于频繁，请稍后再试' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 20, // 限制每个IP 20次请求 (登录/注册/验证码)
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '尝试次数过多，请15分钟后再试' }
});

// 应用全局限流 (仅针对 /api 开头的路由)
app.use('/api', globalLimiter);

// 静态文件服务 (用于访问上传的文件)
// 为了安全起见，禁用直接静态访问，改为通过 API 访问
app.use('/uploads', express.static('uploads'));

// 部署：托管前端静态文件
app.use(express.static(path.join(__dirname, 'public')));

// 根路由
app.get('/', (req, res) => {
  // 如果 public/index.html 存在，express.static 会优先处理
  // 这里保留作为 API 服务器的提示，或者重定向到前端
  res.sendFile(path.join(__dirname, 'public', 'index.html'), (err) => {
    if (err) {
      res.send('真题转转 API Server is running! (Frontend not deployed)');
    }
  });
});

// Socket.io 连接事件
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // 监听用户加入专属房间事件
  socket.on('join_user_room', (userId) => {
    if (userId) {
      const roomName = `user:${userId}`;
      socket.join(roomName);
      console.log(`Socket ${socket.id} joined room ${roomName}`);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// 定义一个简单的测试API

// 定义一个简单的测试API
app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from Node.js backend!' });
});

// 数据库连接测试
const db = require('./db');
const authRoutes = require('./routes/auth');
const paperRoutes = require('./routes/papers');
const userRoutes = require('./routes/user');
const adminRoutes = require('./routes/admin');

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/papers', paperRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/db-test', async (req, res) => {
  try {
    const result = await db.query('SELECT NOW()');
    res.json({ message: 'Database connected successfully', time: result.rows[0].now });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database connection failed', details: err.message });
  }
});

// 处理 SPA 路由 (必须放在所有 API 路由之后)
// Express 5.x / path-to-regexp 0.1.7+ 语法变更：通配符需要使用 (.*)
app.get(/(.*)/, (req, res) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
    return res.status(404).json({ error: 'Not Found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 启动服务器
server.listen(port, () => {
  console.log(`后端服务运行在 http://localhost:${port}`);
});