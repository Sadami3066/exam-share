const db = require('../db');

async function updateDatabase() {
  try {
    console.log('开始更新数据库结构...');

    // 1. 确保 users 表有 role 字段
    await db.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';
    `);
    console.log('已检查/添加 role 字段');

    // 2. 确保 papers 表有 status 字段
    await db.query(`
      ALTER TABLE papers 
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'approved';
    `);
    console.log('已检查/添加 status 字段');

    // 3. 将 ID 为 1 的用户设为管理员 (方便测试)
    // 或者将用户名为 'admin' 的用户设为管理员
    await db.query(`
      UPDATE users SET role = 'admin' WHERE id = 1;
    `);
    console.log('已将 ID=1 的用户设为管理员');

    console.log('数据库更新完成');
    process.exit(0);
  } catch (err) {
    console.error('数据库更新失败:', err);
    process.exit(1);
  }
}

updateDatabase();
