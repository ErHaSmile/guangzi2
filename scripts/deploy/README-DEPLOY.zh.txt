光子文化官网 - 服务器部署说明
============================

1. 上传
   将本目录（或 zip 解压后）整包上传到服务器。

2. 配置
   - 复制 .env.example 为 .env
   - 填写 MySQL：MYSQL_HOST / PORT / USER / PASSWORD / DATABASE
   - ADMIN_TOKEN 需与打包时一致（见本地 .env 的 VITE_ADMIN_TOKEN）
   - API_PORT 默认 8787，HOST 默认 0.0.0.0

3. 一键启动
   Linux:
     chmod +x start.sh
     ./start.sh

   Windows:
     双击 start.bat

4. 访问
   官网:     http://服务器IP:端口/
   工作台:   http://服务器IP:端口/admin.html
   健康检查: http://服务器IP:端口/health

5. 环境要求
   Node.js 18+、MySQL 8（首次启动自动建表并导入种子）

6. 常驻（可选）
   pm2 start server/index.js --name guanzi
