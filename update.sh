#!/bin/bash

# 颜色定义
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== 开始更新 Exam Share 服务器 ===${NC}"

# 1. 拉取最新代码
echo -e "${GREEN}[1/4] 拉取最新代码...${NC}"
cd /home/exam-share
git pull

# 2. 更新数据库 Schema
echo -e "${GREEN}[2/4] 更新数据库结构...${NC}"
# 注意：这里使用 psql 执行 schema.sql。
# 由于 schema.sql 中使用了 IF NOT EXISTS，所以重复执行是安全的。
# 如果有特定的迁移脚本，也可以在这里执行。
su - postgres -c "psql -d exam_share -f /home/exam-share/server/schema.sql"

# 3. 重启后端服务
echo -e "${GREEN}[3/4] 重启后端服务...${NC}"
pm2 restart exam-share

# 4. 重新构建前端
echo -e "${GREEN}[4/4] 重新构建前端...${NC}"
cd client
npm install
npm run build
mkdir -p ../server/public
cp -r dist/* ../server/public/

echo -e "${GREEN}=== 更新完成！ ===${NC}"
