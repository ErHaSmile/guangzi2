# 服务器多项目路径规范（guanzi_2）

完整部署见 [DEPLOY.md](./DEPLOY.md)。

推荐统一放在 `/opt/sites`：

```
/opt/sites/
  APPS.txt
  guanzi/                 # 项目 1 品牌官网  → APP_NAME=guanzi   端口 8787  库 guangzi
  guanzi_2/               # 项目 2 MCN 站    → APP_NAME=guanzi_2 端口 8788  库 guangzi_2
```

约定
----
- 目录名 = APP_NAME = PM2 进程名
- 每项目独立 `.env`（库名、端口、token 全部错开）
- 更新：`cd /opt/sites/guanzi_2 && ./update.sh`

Clone（项目 2）
--------------

```bash
git clone git@github.com-guanzi2:ErHaSmile/guangzi2.git /opt/sites/guanzi_2
cd /opt/sites/guanzi_2
cp .env.example .env && vi .env
chmod +x scripts/*.sh update.sh
./scripts/server-setup.sh
pm2 start ecosystem.config.cjs && pm2 save
```

GitHub：https://github.com/ErHaSmile/guangzi2  
Deploy Key 建议与项目 1 分开（`~/.ssh/guanzi2_deploy` + Host `github.com-guanzi2`）。
