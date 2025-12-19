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

## 部署指南 (Manual Deployment Guide)

本指南介绍如何在 Linux 服务器 (Ubuntu/CentOS) 上手动部署 Exam Share 项目。

### 1. 环境准备

确保服务器已安装以下软件：
- **Node.js** (v18+): `node -v`
- **PostgreSQL**: `psql --version`
- **Git**: `git --version`
- **PM2** (进程管理): `npm install -g pm2`
- **poppler-utils** (PDF 缩略图生成，提供 `pdftoppm`)
- **mupdf-tools** (可选：`pdftoppm` 不可用时的备用缩略图工具 `mutool`)

Ubuntu/Debian 安装示例：
```bash
sudo apt-get update
sudo apt-get install -y poppler-utils mupdf-tools
```

### 2. 获取代码

```bash
cd /home
git clone https://github.com/SadAmI3066/AExam.git exam-share
cd exam-share
```

### 3. 数据库配置

#### 3.1 创建数据库和用户
登录 PostgreSQL：
```bash
su - postgres
psql
```

执行 SQL 语句：
```sql
-- 创建数据库
CREATE DATABASE exam_share;

-- 修改 postgres 用户密码 (或者创建一个新用户)
ALTER USER postgres WITH PASSWORD '你的强密码';

-- 退出
\q
exit
```

#### 3.2 导入表结构
```bash
# 确保使用最新的 schema.sql
psql -U postgres -d exam_share -f /home/exam-share/server/schema.sql
```

### 4. 后端部署 (Server)

#### 4.1 配置环境变量
进入 server 目录并创建 `.env` 文件：
```bash
cd /home/exam-share/server
cp .env.example .env  # 如果没有 example，直接创建
nano .env
```

`.env` 内容示例：
```ini
PORT=3000
DB_USER=postgres
DB_PASSWORD=你的强密码
DB_HOST=localhost
DB_PORT=5432
DB_NAME=exam_share

# 邮件服务配置 (用于发送验证码)
SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_USER=你的邮箱@qq.com
SMTP_PASS=你的SMTP授权码
```

#### 4.2 安装依赖并启动
```bash
npm install

# 使用 PM2 启动服务
pm2 start app.js --name exam-share

# 保存 PM2 列表 (开机自启)
pm2 save
pm2 startup
```

#### 4.3 PDF 预览与缩略图说明

- PDF 在线预览通过接口 `GET /api/papers/:id/preview` 返回文件给浏览器渲染，不需要额外安装 PDF 预览插件。
- PDF 缩略图会在上传 PDF 时自动生成并写入数据库字段 `papers.thumbnail_path`，文件默认存放在 `server/uploads/thumbnails/` 下，命名形如 `paper-<id>.jpg`。
- 若历史 PDF 的 `thumbnail_path` 为空，可在管理员后台触发“重建缩略图”，或直接调用接口：
  - `POST /api/admin/papers/thumbnails/rebuild`（需要管理员 Token）

### 5. 前端部署 (Client)

前端是 Vue 项目，需要编译成静态文件后由后端托管。

```bash
cd /home/exam-share/client

# 安装依赖
npm install

# 编译打包
npm run build

# 将打包结果移动到后端的 public 目录
# 注意：后端代码已配置 app.use(express.static(...)) 指向 server/public
mkdir -p ../server/public
cp -r dist/* ../server/public/
```

### 6. 验证与维护

- **访问网站**: `http://服务器IP:3000`
- **查看日志**: `pm2 logs exam-share`
- **重启服务**: `pm2 restart exam-share`
- **更新代码**:
  ```bash
  git pull
  # 如果后端有变动
  pm2 restart exam-share
  # 如果前端有变动
  cd client && npm run build && cp -r dist/* ../server/public/
  ```

### 7. 常见问题排查

- **502 Bad Gateway / 无法访问**:
  - 检查防火墙是否放行 3000 端口 (阿里云/腾讯云安全组)。
  - 检查 PM2 是否运行: `pm2 list`。
- **数据库连接失败**:
  - 检查 `.env` 中的密码是否正确。
  - 检查 `server/db.js` 是否正确加载了 `.env` (推荐使用绝对路径或 `path.join(__dirname, '.env')`)。
- **页面空白**:
  - 检查浏览器控制台 (F12) 是否有 404 错误。
  - 确认 `server/public` 目录下是否有 `index.html` 和 `assets` 文件夹。

## 📄 License

[MIT](LICENSE)
