-- 创建数据库 (请在 psql 命令行或 pgAdmin 中执行)
-- CREATE DATABASE exam_share;

-- 切换到 exam_share 数据库后执行以下建表语句

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    account VARCHAR(50) UNIQUE NOT NULL, -- 登录账号（唯一且必填）
    username VARCHAR(50) NOT NULL,       -- 用户昵称
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(100) UNIQUE,           -- 绑定邮箱
    avatar_url VARCHAR(255),             -- 头像路径
    role VARCHAR(20) DEFAULT 'user',     -- 'user' or 'admin'
    download_tickets INTEGER DEFAULT 0,  -- 下载券数量
    last_check_in DATE,                  -- 最近签到日期
    is_sponsor BOOLEAN DEFAULT FALSE,    -- 是否为赞助者
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 邮箱验证码表
CREATE TABLE IF NOT EXISTS email_verifications (
    id SERIAL PRIMARY KEY,
    email VARCHAR(100) UNIQUE NOT NULL,
    code VARCHAR(10) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 真题表
CREATE TABLE IF NOT EXISTS papers (
    id SERIAL PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    subject VARCHAR(50),
    teacher VARCHAR(50),                 -- 授课老师
    year INTEGER,
    file_path VARCHAR(255) NOT NULL,
    uploader_id INTEGER REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    download_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 索引优化 (用于排序和查询)
CREATE INDEX IF NOT EXISTS idx_papers_created_at ON papers(created_at);
CREATE INDEX IF NOT EXISTS idx_papers_download_count ON papers(download_count);
CREATE INDEX IF NOT EXISTS idx_papers_status ON papers(status);

-- 下载记录表 (可选，用于防止重复扣费)
CREATE TABLE IF NOT EXISTS downloads (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    paper_id INTEGER REFERENCES papers(id),
    downloaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 下面的 ALTER 语句用于在已有旧表时补齐缺失字段，保持 schema.sql 可被重复使用（幂等）
-- 这样在一键部署时，如果目标数据库已经存在 users 表但缺少新字段，也会自动添加。

-- 确保 users 表包含 last_check_in 字段（用于签到逻辑）
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_check_in DATE;

-- 常用备用字段：如果需要也一并补齐 is_sponsor（赞助者标识）
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_sponsor BOOLEAN DEFAULT FALSE;

-- 确保 account 字段存在并为 NOT NULL（如果你使用 account 登录字段）
ALTER TABLE users ADD COLUMN IF NOT EXISTS account VARCHAR(50) UNIQUE;
-- 将已有 username 迁移到 account（仅在 account 为空时执行）
UPDATE users SET account = username WHERE account IS NULL;
-- 将 account 设置为 NOT NULL（如果你确认所有用户都有 account）
ALTER TABLE users ALTER COLUMN account SET NOT NULL;
