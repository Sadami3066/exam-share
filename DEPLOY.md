# 部署指南 (Manual Deployment Guide)

本指南介绍如何在 Linux 服务器 (Ubuntu/CentOS) 上手动部署 Exam Share 项目。

## 1. 环境准备

确保服务器已安装以下软件：
- **Node.js** (v18+): `node -v`
- **PostgreSQL**: `psql --version`
- **Git**: `git --version`
- **PM2** (进程管理): `npm install -g pm2`

## 2. 获取代码

```bash
cd /home
git clone https://github.com/SadAmI3066/AExam.git exam-share
cd exam-share
```

## 3. 数据库配置

### 3.1 创建数据库和用户
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

### 3.2 导入表结构
```bash
# 确保使用最新的 schema.sql
psql -U postgres -d exam_share -f /home/exam-share/server/schema.sql
```

## 4. 后端部署 (Server)

### 4.1 配置环境变量
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

### 4.2 安装依赖并启动
```bash
npm install

# 使用 PM2 启动服务
pm2 start app.js --name exam-share

# 保存 PM2 列表 (开机自启)
pm2 save
pm2 startup
```

## 5. 前端部署 (Client)

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

## 6. 验证与维护

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

## 7. 常见问题排查

- **502 Bad Gateway / 无法访问**:
  - 检查防火墙是否放行 3000 端口 (阿里云/腾讯云安全组)。
  - 检查 PM2 是否运行: `pm2 list`。
- **数据库连接失败**:
  - 检查 `.env` 中的密码是否正确。
  - 检查 `server/db.js` 是否正确加载了 `.env` (推荐使用绝对路径或 `path.join(__dirname, '.env')`)。
- **页面空白**:
  - 检查浏览器控制台 (F12) 是否有 404 错误。
  - 确认 `server/public` 目录下是否有 `index.html` 和 `assets` 文件夹。
