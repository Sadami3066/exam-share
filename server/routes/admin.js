const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

// 获取待审核真题数量
router.get('/papers/pending/count', auth, admin, async (req, res) => {
  try {
    const result = await db.query("SELECT COUNT(*) FROM papers WHERE status = 'pending'");
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '获取待审核数量失败' });
  }
});

// 获取待审核真题列表
router.get('/papers/pending', auth, admin, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT p.*, u.username as uploader_name 
      FROM papers p
      JOIN users u ON p.uploader_id = u.id
      WHERE p.status = 'pending'
      ORDER BY p.created_at ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '获取待审核列表失败' });
  }
});

// 审核真题 (通过/拒绝)
router.put('/papers/:id/audit', auth, admin, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // 'approved' or 'rejected'

  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: '无效的状态' });
  }

  try {
    // 1. 先查询原真题状态和上传者ID
    const currentPaperResult = await db.query('SELECT * FROM papers WHERE id = $1', [id]);
    if (currentPaperResult.rows.length === 0) {
      return res.status(404).json({ error: '真题不存在' });
    }
    const currentPaper = currentPaperResult.rows[0];

    // 2. 更新状态
    const result = await db.query(
      'UPDATE papers SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );

    // 3. 如果是审核通过，且之前不是 approved 状态，给上传者增加下载券
    if (status === 'approved' && currentPaper.status !== 'approved') {
        await db.query('UPDATE users SET download_tickets = download_tickets + 1 WHERE id = $1', [currentPaper.uploader_id]);
        
        // 实时通知：只通知特定的上传者 (进入专属房间)
        req.io.to(`user:${currentPaper.uploader_id}`).emit('ticket_update', { userId: currentPaper.uploader_id });
        
        // 实时通知：通知所有用户刷新真题列表 (静默刷新)
        req.io.emit('paper_approved', { 
            title: currentPaper.title,
            subject: currentPaper.subject
        });
    }
    
    res.json({ message: '审核完成', paper: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '审核操作失败' });
  }
});

module.exports = router;
