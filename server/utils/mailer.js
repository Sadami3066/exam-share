const nodemailer = require('nodemailer');

// 请在 .env 文件中配置以下环境变量
// SMTP_HOST=smtp.qq.com
// SMTP_PORT=465
// SMTP_USER=your_email@qq.com
// SMTP_PASS=your_auth_code

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.qq.com',
  port: process.env.SMTP_PORT || 465,
  secure: true, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER || '请配置邮箱',
    pass: process.env.SMTP_PASS || '请配置授权码'
  }
});

exports.sendVerificationEmail = async (to, code) => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('SMTP未配置，无法发送邮件。验证码为:', code);
    // 在开发环境下，如果没有配置邮箱，可以直接在控制台打印验证码方便测试
    return; 
  }

  await transporter.sendMail({
    from: `"真题转转" <${process.env.SMTP_USER}>`,
    to,
    subject: '【真题转转】注册验证码',
    text: `您的验证码是：${code}。有效期5分钟，请勿泄露给他人。`,
    html: `
      <div style="padding: 20px; background-color: #f5f7fa; font-family: sans-serif;">
        <div style="max-width: 500px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
          <h2 style="color: #409eff; margin-top: 0;">真题转转</h2>
          <p style="font-size: 16px; color: #606266;">亲爱的用户：</p>
          <p style="font-size: 16px; color: #606266;">您正在注册真题转转账号，您的验证码是：</p>
          <div style="background-color: #ecf5ff; color: #409eff; font-size: 24px; font-weight: bold; text-align: center; padding: 15px; border-radius: 6px; margin: 20px 0; letter-spacing: 4px;">
            ${code}
          </div>
          <p style="font-size: 14px; color: #909399;">该验证码 5 分钟内有效。如果不是您本人的操作，请忽略本邮件。</p>
        </div>
      </div>
    `
  });
};
