const db = require('../db');

async function updateSchema() {
  try {
    console.log('开始更新数据库 Schema...');

    // 1. 添加 account 字段 (用于登录，唯一)
    await db.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS account VARCHAR(50) UNIQUE;
    `);
    console.log('Added account column to users table.');

    // 2. 将现有的 username 复制到 account (作为初始值)
    await db.query(`
      UPDATE users SET account = username WHERE account IS NULL;
    `);
    console.log('Migrated existing usernames to account.');

    // 3. 设置 account 为 NOT NULL
    await db.query(`
      ALTER TABLE users 
      ALTER COLUMN account SET NOT NULL;
    `);
    console.log('Set account column to NOT NULL.');

    console.log('数据库 Schema 更新完成！');
    process.exit(0);
  } catch (err) {
    console.error('更新失败:', err);
    process.exit(1);
  }
}

updateSchema();
