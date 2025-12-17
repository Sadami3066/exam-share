# 📚 Exam Share (真题转转)

**Exam Share** 是一个基于 Vue 3 和 Node.js 的校园真题分享平台。旨在帮助学生更方便地获取和分享历年考试真题，促进学习资源的流通。

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Vue](https://img.shields.io/badge/Vue.js-3.x-4FC08D.svg)
![Node](https://img.shields.io/badge/Node.js-18%2B-339933.svg)
![Postgres](https://img.shields.io/badge/PostgreSQL-14%2B-336791.svg)

## ✨ 功能特性

- **👥 用户系统**
  - 账号注册与登录（支持邮箱验证码）
  - 用户角色管理（普通用户/管理员）
  - 个人资料修改与头像上传
- **📄 真题管理**
  - 真题上传（支持 PDF, Word, 图片等格式）
  - 真题列表浏览、搜索与筛选（按科目、老师）
  - 真题下载（基于下载券机制）
- **🛡️ 管理后台**
  - 用户管理：查看用户列表，修改用户角色
  - 资源审核：审核用户上传的真题
- **🔒 安全防护**
  - 接口限流 (Rate Limiting)
  - 安全头设置 (Helmet)
  - 密码加密存储 (Bcrypt)

## 🛠️ 技术栈

### 前端 (Client)
- **框架**: Vue 3 + TypeScript
- **构建工具**: Vite
- **UI 组件库**: Element Plus
- **状态管理**: Pinia
- **路由**: Vue Router
- **网络请求**: Axios

### 后端 (Server)
- **运行环境**: Node.js
- **Web 框架**: Express
- **数据库**: PostgreSQL
- **ORM/驱动**: pg (node-postgres)
- **进程管理**: PM2

---

## 🚀 本地开发指南

### 1. 克隆项目
```bash
git clone https://github.com/SadAmI3066/AExam.git
cd AExam
```

### 2. 数据库设置
确保本地已安装 PostgreSQL，并创建一个名为 `exam_share` 的数据库。
```bash
# 导入表结构
psql -U postgres -d exam_share -f server/schema.sql
```

### 3. 后端启动
```bash
cd server
# 安装依赖
npm install
# 配置环境变量 (参考 .env.example)
cp .env.example .env
# 启动服务
npm run dev
```

### 4. 前端启动
```bash
cd client
# 安装依赖
npm install
# 启动开发服务器
npm run dev
```

---

## 📦 服务器部署指南 (Linux)

本指南以 Ubuntu/CentOS 为例，使用 PM2 进行进程管理。

### 1. 环境准备
确保服务器已安装：
- Node.js (v18+)
- PostgreSQL
- Git
- PM2 (`npm install -g pm2`)

### 2. 获取代码
```bash
cd /home
git clone https://github.com/SadAmI3066/AExam.git exam-share
cd exam-share
```

### 3. 数据库配置
```bash
# 登录 Postgres
su - postgres
psql

# SQL 操作
CREATE DATABASE exam_share;
ALTER USER postgres WITH PASSWORD '你的强密码';
\q
exit

# 导入表结构
psql -U postgres -d exam_share -f /home/exam-share/server/schema.sql
```

### 4. 后端部署
```bash
cd /home/exam-share/server

# 配置环境变量
nano .env
# 填入 DB_PASSWORD, SMTP_PASS 等信息

# 安装依赖并启动
npm install
pm2 start app.js --name exam-share
pm2 save
```

### 5. 前端部署
前端代码需要编译为静态文件，并由后端托管（或使用 Nginx）。本项目默认配置为后端托管。

```bash
cd /home/exam-share/client

# 安装依赖并构建
npm install
npm run build

# 将构建产物移动到后端 public 目录
mkdir -p ../server/public
cp -r dist/* ../server/public/
```

### 6. 常见问题
- **502/无法访问**: 检查云服务器防火墙是否放行 3000 端口。
- **数据库连接失败**: 检查 `.env` 密码及 `server/db.js` 配置。
- **HTTPS 报错**: 如果未配置 SSL 证书，请确保 `server/app.js` 中 Helmet 的 `upgrade-insecure-requests` 策略已禁用。

## 📄 License

[MIT](LICENSE)
