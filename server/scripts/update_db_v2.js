const db = require('../db');

async function updateSchema() {
  try {
    console.log('开始更新数据库 Schema...');

    // 1. 添加 last_check_in 字段
    await db.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS last_check_in DATE;
    `);
    console.log('Added last_check_in column to users table.');

    // 2. 添加 is_sponsor 字段
    await db.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS is_sponsor BOOLEAN DEFAULT FALSE;
    `);
    console.log('Added is_sponsor column to users table.');

    console.log('数据库 Schema 更新完成！');
    process.exit(0);
  } catch (err) {
    console.error('更新失败:', err);
    process.exit(1);
  }
}

updateSchema();
