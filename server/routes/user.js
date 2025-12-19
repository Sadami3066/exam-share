const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 配置 multer 存储
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

// 上传头像接口
router.post('/avatar', auth, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请选择要上传的图片' });
    }

    const avatarUrl = req.file.path.replace(/\\/g, '/'); // 统一路径分隔符
    
    // 更新用户头像
    await db.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [avatarUrl, req.user.id]);
    
    res.json({ message: '头像上传成功', avatarUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '头像上传失败' });
  }
});

// 获取当前用户信息 (用于刷新积分显示)
router.get('/me', auth, async (req, res) => {
  try {
    // 直接在数据库层面判断是否已签到，避免 JS 时区问题
    const result = await db.query(`
      SELECT 
        id, username, role, download_tickets, last_check_in, is_sponsor, avatar_url,
        (last_check_in = CURRENT_DATE) as is_checked_in
      FROM users WHERE id = $1
    `, [req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 每日签到
router.post('/checkin', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // 检查是否已签到 (数据库层面检查)
    const checkResult = await db.query('SELECT (last_check_in = CURRENT_DATE) as is_checked_in FROM users WHERE id = $1', [userId]);
    
    if (checkResult.rows[0].is_checked_in) {
      return res.status(400).json({ error: '今日已签到' });
    }
    
    // 更新签到时间和积分 (+5)
    await db.query('UPDATE users SET last_check_in = CURRENT_DATE, download_tickets = download_tickets + 5 WHERE id = $1', [userId]);
    
    res.json({ message: '签到成功', addedTickets: 5 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '签到失败' });
  }
});

// 获取用户上传记录
router.get('/uploads', auth, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT * FROM papers 
      WHERE uploader_id = $1 
      ORDER BY created_at DESC
    `, [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '获取上传记录失败' });
  }
});

// 获取用户下载记录
router.get('/downloads', auth, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT p.*, d.downloaded_at 
      FROM downloads d
      JOIN papers p ON d.paper_id = p.id
      WHERE d.user_id = $1
      ORDER BY d.downloaded_at DESC
    `, [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '获取下载记录失败' });
  }
});

router.patch('/profile', auth, async (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ error: '请输入昵称' });
  }

  const trimmed = String(username).trim();
  if (trimmed.length < 2 || trimmed.length > 7) {
    return res.status(400).json({ error: '昵称长度需在2-7个字符之间' });
  }

  try {
    await db.query('UPDATE users SET username = $1 WHERE id = $2', [trimmed, req.user.id]);
    res.json({ message: '昵称已更新' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '更新昵称失败' });
  }
});

module.exports = router;
