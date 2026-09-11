Guanzi Culture Site - Deploy Guide
==================================

1) Upload
   Upload this whole folder to your server.

2) Config
   - Copy .env.example to .env
   - Fill MySQL: MYSQL_HOST / PORT / USER / PASSWORD / DATABASE
   - Set ADMIN_TOKEN (must match the token used when packing, see VITE_ADMIN_TOKEN)
   - API_PORT default 8787, HOST default 0.0.0.0

3) Start
   Linux/macOS:
     chmod +x start.sh
     ./start.sh

   Windows:
     double-click start.bat
     or: powershell -ExecutionPolicy Bypass -File .\start.ps1

4) URLs
   Site:   http://SERVER_IP:PORT/
   Admin:  http://SERVER_IP:PORT/admin.html
   Health: http://SERVER_IP:PORT/health

5) Requirements
   - Node.js 18+
   - MySQL 8 (first start runs migrate and seeds config)

6) Optional Nginx
   location / {
     proxy_pass http://127.0.0.1:8787;
     proxy_set_header Host $host;
     proxy_set_header X-Real-IP $remote_addr;
   }

7) Keep running
   pm2 start server/index.js --name guanzi
   # or: nohup ./start.sh > guanzi.log 2>&1 &
