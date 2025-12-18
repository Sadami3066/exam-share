const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const isPdf = (filePath) => /\.pdf$/i.test(filePath || '');

const runCommand = (command, args, options = {}, timeoutMs = 15000) => {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let finished = false;

    const child = spawn(command, args, { ...options, windowsHide: true });

    const timer = setTimeout(() => {
      if (!finished) {
        finished = true;
        try {
          child.kill('SIGKILL');
        } catch (_) {}
        resolve({ ok: false, code: null, stdout, stderr: `${stderr}\nTIMEOUT` });
      }
    }, timeoutMs);

    child.stdout?.on('data', (d) => {
      stdout += d.toString();
    });
    child.stderr?.on('data', (d) => {
      stderr += d.toString();
    });

    child.on('error', (err) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve({ ok: false, code: null, stdout, stderr: `${stderr}\n${err.message}` });
    });

    child.on('close', (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve({ ok: code === 0, code, stdout, stderr });
    });
  });
};

const fileExists = async (p) => {
  try {
    const st = await fs.promises.stat(p);
    return st.isFile() && st.size > 0;
  } catch (_) {
    return false;
  }
};

const generatePdfThumbnail = async (absolutePdfPath, absoluteJpgPath) => {
  if (!(await fileExists(absolutePdfPath))) {
    return { ok: false, reason: 'pdf_missing', detail: absolutePdfPath };
  }

  const outDir = path.dirname(absoluteJpgPath);
  await fs.promises.mkdir(outDir, { recursive: true });

  const baseWithoutExt = absoluteJpgPath.replace(/\.jpg$/i, '');
  const pdftoppmCommands = ['pdftoppm', '/usr/bin/pdftoppm'];
  for (const cmd of pdftoppmCommands) {
    const pdftoppmResult = await runCommand(
      cmd,
      ['-f', '1', '-l', '1', '-jpeg', '-scale-to', '600', '-singlefile', absolutePdfPath, baseWithoutExt],
      {},
      20000
    );
    if (pdftoppmResult.ok) {
      const candidates = [`${baseWithoutExt}.jpg`, `${baseWithoutExt}-1.jpg`, `${baseWithoutExt}-01.jpg`, `${baseWithoutExt}-001.jpg`];
      for (const produced of candidates) {
        if (await fileExists(produced)) {
          if (produced !== absoluteJpgPath) {
            try {
              await fs.promises.rename(produced, absoluteJpgPath);
            } catch (_) {
              await fs.promises.copyFile(produced, absoluteJpgPath);
            }
          }
          if (await fileExists(absoluteJpgPath)) return { ok: true, tool: 'pdftoppm' };
          break;
        }
      }
    }
  }

  const mutoolResult = await runCommand(
    'mutool',
    ['draw', '-o', absoluteJpgPath, '-r', '150', absolutePdfPath, '1'],
    {},
    20000
  );
  if (mutoolResult.ok && (await fileExists(absoluteJpgPath))) return { ok: true, tool: 'mutool' };

  const magickResult = await runCommand(
    'magick',
    ['-density', '150', `${absolutePdfPath}[0]`, '-quality', '80', absoluteJpgPath],
    {},
    20000
  );
  if (magickResult.ok && (await fileExists(absoluteJpgPath))) return { ok: true, tool: 'magick' };

  const detail = [mutoolResult.stderr, magickResult.stderr].filter(Boolean).join('\n');
  return { ok: false, reason: 'convert_failed', detail };
};

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

// 获取所有用户列表
router.get('/users', auth, admin, async (req, res) => {
  try {
    const result = await db.query('SELECT id, username, email, role, download_tickets, created_at FROM users ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '获取用户列表失败' });
  }
});

// 修改用户角色
router.put('/users/:id/role', auth, admin, async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  if (!['user', 'admin'].includes(role)) {
    return res.status(400).json({ error: '无效的角色' });
  }

  try {
    await db.query('UPDATE users SET role = $1 WHERE id = $2', [role, id]);
    res.json({ message: '角色修改成功' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '修改角色失败' });
  }
});

// 修改用户下载券
router.put('/users/:id/tickets', auth, admin, async (req, res) => {
  const { id } = req.params;
  const { tickets } = req.body;

  if (typeof tickets !== 'number' || tickets < 0) {
    return res.status(400).json({ error: '无效的下载券数量' });
  }

  try {
    await db.query('UPDATE users SET download_tickets = $1 WHERE id = $2', [tickets, id]);
    res.json({ message: '下载券修改成功' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '修改下载券失败' });
  }
});

router.post('/papers/thumbnails/rebuild', auth, admin, async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.body?.limit ?? '50', 10) || 50, 1), 500);
  const force = !!req.body?.force;

  try {
    const result = await db.query(
      `
      SELECT id, file_path, thumbnail_path
      FROM papers
      WHERE file_path ILIKE '%.pdf'
      ORDER BY id ASC
      LIMIT $1
      `,
      [limit]
    );

    const rows = result.rows || [];
    let processed = 0;
    let generated = 0;
    const failed = [];
    const skipped = [];

    for (const paper of rows) {
      processed++;

      const filePath = paper.file_path;
      if (!isPdf(filePath)) {
        skipped.push({ id: paper.id, reason: 'not_pdf' });
        continue;
      }

      const existingRel = paper.thumbnail_path;
      if (!force && existingRel) {
        const existingAbs = path.resolve(existingRel);
        if (await fileExists(existingAbs)) {
          skipped.push({ id: paper.id, reason: 'already_exists' });
          continue;
        }
      }

      const thumbnailRelPath = path
        .join('uploads', 'thumbnails', `paper-${paper.id}.jpg`)
        .replace(/\\/g, '/');
      const thumbnailAbsPath = path.resolve(thumbnailRelPath);
      const pdfAbsPath = path.resolve(filePath);

      const thumbnailResult = await generatePdfThumbnail(pdfAbsPath, thumbnailAbsPath);
      if (thumbnailResult.ok) {
        generated++;
        await db.query('UPDATE papers SET thumbnail_path = $1 WHERE id = $2', [
          thumbnailRelPath,
          paper.id
        ]);
      } else {
        failed.push({
          id: paper.id,
          reason: thumbnailResult.reason,
          file_path: filePath,
          detail: thumbnailResult.detail
        });
      }
    }

    res.json({ limit, force, processed, generated, skipped, failed });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '生成缩略图失败' });
  }
});

module.exports = router;
