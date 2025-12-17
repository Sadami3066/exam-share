const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const path = require('path');
const auth = require('../middleware/auth');

// 配置 Multer 文件上传
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // 确保这个目录存在
  },
  filename: function (req, file, cb) {
    // 文件名：时间戳-随机数-原文件名 (防止重名)
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 限制 50MB
  fileFilter: (req, file, cb) => {
    // 简单过滤，只允许 pdf, doc, docx, jpg, png, zip
    const allowedTypes = /pdf|doc|docx|jpg|jpeg|png|zip|rar/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    if (extname) {
      return cb(null, true);
    }
    cb(new Error('不支持的文件格式'));
  }
});

// 获取真题列表 (支持分页和搜索)
router.get('/', async (req, res) => {
  const { page = 1, limit = 10, subject, teacher, search, sort } = req.query;
  const offset = (page - 1) * limit;

  try {
    // 构建基础查询条件 (不包含 SELECT 部分)
    let whereClause = "WHERE p.status = 'approved'";
    const queryParams = [];
    let paramIndex = 1;

    if (subject && subject !== '全部') {
      whereClause += ` AND p.subject = $${paramIndex}`;
      queryParams.push(subject);
      paramIndex++;
    }

    if (teacher && teacher !== '全部') {
      whereClause += ` AND p.teacher = $${paramIndex}`;
      queryParams.push(teacher);
      paramIndex++;
    }

    if (search) {
      whereClause += ` AND (p.title ILIKE $${paramIndex} OR p.subject ILIKE $${paramIndex} OR p.teacher ILIKE $${paramIndex})`;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    // 排序逻辑
    let orderByClause = 'ORDER BY p.created_at DESC'; // 默认按时间倒序
    if (sort === 'oldest') {
      orderByClause = 'ORDER BY p.created_at ASC';
    } else if (sort === 'popular') {
      orderByClause = 'ORDER BY p.download_count DESC';
    }

    // 1. 获取总数
    const countQuery = `
      SELECT COUNT(*) 
      FROM papers p
      JOIN users u ON p.uploader_id = u.id
      ${whereClause}
    `;
    const countResult = await db.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].count);

    // 2. 获取分页数据
    const dataQuery = `
      SELECT p.*, u.username as uploader_name, u.avatar_url as uploader_avatar
      FROM papers p
      JOIN users u ON p.uploader_id = u.id
      ${whereClause}
      ${orderByClause}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    // 添加分页参数
    const dataParams = [...queryParams, limit, offset];
    
    const result = await db.query(dataQuery, dataParams);

    res.json({
      papers: result.rows,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '获取真题列表失败' });
  }
});

// 获取筛选选项 (课程和老师)
router.get('/filters', async (req, res) => {
  try {
    // 获取所有不重复的课程 (subject)
    const subjectsResult = await db.query("SELECT DISTINCT subject FROM papers WHERE status = 'approved' AND subject IS NOT NULL ORDER BY subject");
    const subjects = subjectsResult.rows.map(row => row.subject);

    // 获取所有不重复的老师 (teacher)
    const teachersResult = await db.query("SELECT DISTINCT teacher FROM papers WHERE status = 'approved' AND teacher IS NOT NULL ORDER BY teacher");
    const teachers = teachersResult.rows.map(row => row.teacher);

    res.json({ subjects, teachers });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '获取筛选选项失败' });
  }
});

// 上传真题 (需要登录)
router.post('/upload', auth, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '请选择要上传的文件' });
  }

  const { title, subject, year, teacher } = req.body;
  const userId = req.user.id;
  const filePath = req.file.path; // 保存相对路径或绝对路径，这里是相对路径 'uploads/filename...'

  if (!title || !subject || !year) {
    return res.status(400).json({ error: '请填写完整的试卷信息' });
  }

  try {
    // 插入数据库
    // 默认 status 为 'pending' (待审核)
    const status = 'pending'; 

    const result = await db.query(
      'INSERT INTO papers (title, subject, year, teacher, file_path, uploader_id, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [title, subject, year, teacher || null, filePath, userId, status]
    );

    // 通知管理员有新待审核真题
    if (req.io) {
        req.io.emit('new_paper_pending'); 
    }

    // 上传成功后，给用户增加下载券 (奖励机制)
    // 修改为：审核通过后才发券，此处不再直接发券
    // await db.query('UPDATE users SET download_tickets = download_tickets + 1 WHERE id = $1', [userId]);

    res.status(201).json({ message: '上传成功，请等待管理员审核', paper: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '上传失败，数据库错误' });
  }
});

// 下架真题 (用户自己或管理员)
router.post('/:id/takedown', auth, async (req, res) => {
  const paperId = req.params.id;
  const userId = req.user.id;
  const userRole = req.user.role;

  try {
    // 1. 检查真题是否存在
    const paperResult = await db.query('SELECT * FROM papers WHERE id = $1', [paperId]);
    if (paperResult.rows.length === 0) {
      return res.status(404).json({ error: '真题不存在' });
    }
    const paper = paperResult.rows[0];

    // 2. 权限检查：必须是上传者本人或者管理员
    if (paper.uploader_id !== userId && userRole !== 'admin') {
      return res.status(403).json({ error: '无权操作' });
    }

    // 3. 更新状态为 taken_down
    const result = await db.query(
      "UPDATE papers SET status = 'taken_down' WHERE id = $1 RETURNING *",
      [paperId]
    );

    // 实时通知前端删除该真题
    if (req.io) {
      req.io.emit('paper_taken_down', { id: paperId });
    }

    res.json({ message: '已下架', paper: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '操作失败' });
  }
});

// 下载真题
router.get('/:id/download', auth, async (req, res) => {
  const paperId = req.params.id;
  const userId = req.user.id;

  try {
    // 1. 获取真题信息
    const paperResult = await db.query('SELECT * FROM papers WHERE id = $1', [paperId]);
    if (paperResult.rows.length === 0) {
      return res.status(404).json({ error: '真题不存在' });
    }
    const paper = paperResult.rows[0];

    // 2. 检查是否需要扣券
    // 规则：上传者本人免费 OR 赞助者免费 OR 已购买过免费
    let needDeduct = true;

    if (paper.uploader_id === userId) {
        needDeduct = false;
    } else {
        // 检查是否是赞助者
        const userResult = await db.query('SELECT download_tickets, is_sponsor FROM users WHERE id = $1', [userId]);
        const user = userResult.rows[0];
        
        if (user.is_sponsor) {
            needDeduct = false;
        } else {
            // 检查是否已购买
            const downloadRecord = await db.query('SELECT * FROM downloads WHERE user_id = $1 AND paper_id = $2', [userId, paperId]);
            if (downloadRecord.rows.length > 0) {
                needDeduct = false;
            } else {
                // 需要扣券，检查余额
                if (user.download_tickets < 1) {
                    return res.status(403).json({ error: '下载券不足，请上传真题或签到获取' });
                }
            }
        }
    }

    // 3. 扣除积分 (如果需要)
    if (needDeduct) {
        await db.query('UPDATE users SET download_tickets = download_tickets - 1 WHERE id = $1', [userId]);
        // 记录下载历史 (仅首次下载记录，或者每次都记录？通常为了"已购买"逻辑，只要有一条记录即可。这里每次都记录也无妨，或者只记录首次)
        // 为了简单起见，这里每次都记录，但"已购买"检查只要存在即可
        await db.query('INSERT INTO downloads (user_id, paper_id) VALUES ($1, $2)', [userId, paperId]);
    } else {
        // 即使不扣券，如果是首次下载（比如赞助者），也应该记录下载历史，方便以后查看"已下载"
        // 检查是否存在，不存在则插入
        const checkDownload = await db.query('SELECT 1 FROM downloads WHERE user_id = $1 AND paper_id = $2', [userId, paperId]);
        if (checkDownload.rows.length === 0) {
             await db.query('INSERT INTO downloads (user_id, paper_id) VALUES ($1, $2)', [userId, paperId]);
        }
    }

    // 4. 更新下载次数
    await db.query('UPDATE papers SET download_count = download_count + 1 WHERE id = $1', [paperId]);

    // 6. 发送文件 (跳过步骤5，因为已经在上面处理了)
    const absolutePath = path.resolve(paper.file_path);
    res.download(absolutePath, paper.title + path.extname(paper.file_path), (err) => {
        if (err) {
            console.error('文件下载失败', err);
            if (!res.headersSent) {
                res.status(500).json({ error: '文件下载失败' });
            }
        }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 预览真题 (在线查看，不扣券)
router.get('/:id/preview', async (req, res) => {
  const paperId = req.params.id;

  try {
    const paperResult = await db.query('SELECT * FROM papers WHERE id = $1', [paperId]);
    if (paperResult.rows.length === 0) {
      return res.status(404).json({ error: '真题不存在' });
    }
    const paper = paperResult.rows[0];
    
    const absolutePath = path.resolve(paper.file_path);
    
    // 设置 Content-Type，让浏览器尝试在线打开
    res.sendFile(absolutePath, {
        headers: {
            'Content-Type': getContentType(paper.file_path),
            'Content-Disposition': 'inline' // 在线预览关键
        }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 辅助函数：获取 MIME 类型
function getContentType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const map = {
        '.pdf': 'application/pdf',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    };
    return map[ext] || 'application/octet-stream';
}

module.exports = router;
