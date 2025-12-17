-- 创建数据库 (请在 psql 命令行或 pgAdmin 中执行)
-- CREATE DATABASE exam_share;

-- 切换到 exam_share 数据库后执行以下建表语句

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    account VARCHAR(50) UNIQUE NOT NULL, -- 登录账号
    username VARCHAR(50) NOT NULL,       -- 用户昵称
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(100) UNIQUE,           -- 绑定邮箱
    avatar_url VARCHAR(255),             -- 头像路径
    role VARCHAR(20) DEFAULT 'user',     -- 'user' or 'admin'
    download_tickets INTEGER DEFAULT 0,  -- 下载券数量
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

-- 下载记录表 (可选，用于防止重复扣费)
CREATE TABLE IF NOT EXISTS downloads (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    paper_id INTEGER REFERENCES papers(id),
    downloaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
