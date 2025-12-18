const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_change_it_in_production';
const db = require('../db');

module.exports = async function(req, res, next) {
  // 获取 token
  let token = null;
  
  // 1. 尝试从 Authorization header 获取
  const authHeader = req.header('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } 
  // 2. 尝试从 query parameter 获取 (用于 img src 等)
  else if (req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: '无访问权限，请先登录' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    const userResult = await db.query('SELECT id, username, role FROM users WHERE id = $1', [decoded.id]);
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: '用户不存在或已被删除' });
    }

    const dbUser = userResult.rows[0];
    req.user = {
      ...decoded,
      id: dbUser.id,
      username: dbUser.username,
      role: dbUser.role
    };
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token 无效或已过期' });
  }
};
