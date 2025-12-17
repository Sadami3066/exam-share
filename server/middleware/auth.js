const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_change_it_in_production';

module.exports = function(req, res, next) {
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
    req.user = decoded; // 将用户信息存入 req.user
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token 无效或已过期' });
  }
};
