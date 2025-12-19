const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/mailer');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_change_it_in_production';

// 配置 multer 存储 (复用 user.js 的配置逻辑，也可以提取到单独的 middleware 文件)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/avatars';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB 限制
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传图片文件'));
    }
  }
});

// 发送验证码接口
router.post('/send-code', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: '请输入邮箱' });
  }

  // 简单的邮箱格式验证
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: '邮箱格式不正确' });
  }

  try {
    // 检查邮箱是否已被注册
    const emailCheck = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ error: '该邮箱已被注册' });
    }

    // 生成6位随机验证码
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5分钟后过期

    // 保存或更新验证码
    await db.query(
      `INSERT INTO email_verifications (email, code, expires_at) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (email) 
       DO UPDATE SET code = $2, expires_at = $3`,
      [email, code, expiresAt]
    );

    // 发送邮件
    await sendVerificationEmail(email, code);

    res.json({ message: '验证码已发送' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '发送验证码失败' });
  }
});

router.post('/send-reset-code', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: '请输入邮箱' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: '邮箱格式不正确' });
  }

  try {
    const emailCheck = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (emailCheck.rows.length === 0) {
      return res.json({ message: '验证码已发送' });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await db.query(
      `INSERT INTO email_verifications (email, code, expires_at) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (email) 
       DO UPDATE SET code = $2, expires_at = $3`,
      [email, code, expiresAt]
    );

    await sendPasswordResetEmail(email, code);
    res.json({ message: '验证码已发送' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '发送验证码失败' });
  }
});

router.post('/reset-password', async (req, res) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword) {
    return res.status(400).json({ error: '请填写完整信息' });
  }

  const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$/;
  if (!passwordRegex.test(newPassword)) {
    return res.status(400).json({ error: '密码需至少6位，且包含字母和数字' });
  }

  try {
    const verifyResult = await db.query('SELECT * FROM email_verifications WHERE email = $1', [email]);
    if (verifyResult.rows.length === 0) {
      return res.status(400).json({ error: '验证码错误或已过期' });
    }

    const verification = verifyResult.rows[0];
    if (verification.code !== code) {
      return res.status(400).json({ error: '验证码错误或已过期' });
    }
    if (new Date() > new Date(verification.expires_at)) {
      return res.status(400).json({ error: '验证码错误或已过期' });
    }

    const userResult = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: '验证码错误或已过期' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await db.query('UPDATE users SET password_hash = $1 WHERE email = $2', [passwordHash, email]);
    await db.query('DELETE FROM email_verifications WHERE email = $1', [email]);

    res.json({ message: '密码已重置' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 注册接口
router.post('/register', upload.single('avatar'), async (req, res) => {
  const { account, username, password, email, code } = req.body;

  if (!account || !username || !password || !email || !code) {
    return res.status(400).json({ error: '请填写完整信息' });
  }

  // 1. 账号格式验证：至少6位，仅支持数字+字母
  const accountRegex = /^[a-zA-Z0-9]{6,}$/;
  if (!accountRegex.test(account)) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: '账号需至少6位，且仅包含字母和数字' });
  }

  try {
    // 2. 验证码验证
    const verifyResult = await db.query(
      'SELECT * FROM email_verifications WHERE email = $1',
      [email]
    );

    if (verifyResult.rows.length === 0) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: '请先获取验证码' });
    }

    const verification = verifyResult.rows[0];
    if (verification.code !== code) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: '验证码错误' });
    }

    if (new Date() > new Date(verification.expires_at)) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: '验证码已过期，请重新获取' });
    }

    // 3. 检查账号是否已存在
    const userCheck = await db.query('SELECT * FROM users WHERE account = $1', [account]);
    if (userCheck.rows.length > 0) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: '账号已存在' });
    }
    
    // 4. 检查邮箱是否已存在 (双重检查)
    const emailCheck = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (emailCheck.rows.length > 0) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: '邮箱已被注册' });
    }

    // 密码加密
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    let avatarUrl = null;
    if (req.file) {
      avatarUrl = req.file.path.replace(/\\/g, '/');
    }

    // 插入新用户
    const newUser = await db.query(
      'INSERT INTO users (account, username, password_hash, avatar_url, email) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, role, download_tickets, avatar_url',
      [account, username, passwordHash, avatarUrl, email]
    );

    // 注册成功后删除验证码
    await db.query('DELETE FROM email_verifications WHERE email = $1', [email]);

    res.status(201).json({ message: '注册成功', user: newUser.rows[0] });
  } catch (err) {
    console.error(err);
    if (req.file) {
      try { fs.unlinkSync(req.file.path); } catch(e) {}
    }
    res.status(500).json({ error: '服务器错误' });
  }
});

// 登录接口
router.post('/login', async (req, res) => {
  const { account, password } = req.body;

  try {
    // 查找用户 (通过 account)
    const result = await db.query('SELECT * FROM users WHERE account = $1', [account]);
    if (result.rows.length === 0) {
      return res.status(400).json({ error: '账号或密码错误' });
    }

    const user = result.rows[0];

    // 验证密码
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: '账号或密码错误' });
    }

    // 生成 Token
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: '登录成功',
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        download_tickets: user.download_tickets
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
