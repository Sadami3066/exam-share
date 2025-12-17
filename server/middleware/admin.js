module.exports = function(req, res, next) {
  // 必须先经过 auth 中间件，确保 req.user 存在
  if (!req.user) {
    return res.status(401).json({ error: '未授权' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '无权访问，需要管理员权限' });
  }

  next();
};
