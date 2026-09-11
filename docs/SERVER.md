# 服务器多项目路径规范
# ==================

完整部署流程（首次安装、更新、Nginx、备份）见 [DEPLOY.md](./DEPLOY.md)。

推荐统一放在 /opt/sites（可用环境变量 SITE_ROOT 覆盖）：

  /opt/sites/
    APPS.txt                 # 应用清单（bootstrap 自动维护）
    guanzi/                  # 本仓库 → APP_NAME=guanzi
      .env                   # 仅本机，不进 Git
      logs/                  # 运行日志 / pid
      ecosystem.config.cjs   # pm2 进程名 = guanzi
    other-project/           # 后续项目同样结构
      .env
      logs/
      ecosystem.config.cjs   # 进程名与目录名一致，端口不要冲突

约定
----
- 目录名 = APP_NAME = pm2 进程名（如 guanzi）
- 每个项目独立 .env（MySQL 库名、API_PORT 分开）
- 端口示例：guanzi=8787，下一项目=8788…
- 更新只进对应目录：cd /opt/sites/guanzi && ./update.sh

私有仓：SSH Deploy Key（推荐）
------------------------------
HTTPS 账号密码已不可用；镜像也不支持 Private。用 SSH。

1) 服务器生成密钥并打印公钥：

  # 若还没有仓库代码，可先本机 scp 一份 scripts/server-ssh-setup.sh 上去，或手动：
  mkdir -p ~/.ssh && chmod 700 ~/.ssh
  ssh-keygen -t ed25519 -C "guanzi-deploy" -f ~/.ssh/guanzi_deploy -N ""
  cat ~/.ssh/guanzi_deploy.pub

2) GitHub → 仓库 Settings → Deploy keys → Add deploy key
   - Title: ecs-guanzi
   - 粘贴公钥
   - 只读即可（不要勾写权限）

3) 配置 SSH（别名，避免和其它 key 冲突）：

  cat >> ~/.ssh/config <<'EOF'
Host github.com-guanzi
  HostName github.com
  User git
  IdentityFile ~/.ssh/guanzi_deploy
  IdentitiesOnly yes
  Port 22
EOF
  chmod 600 ~/.ssh/config

4) 测试：

  ssh -T git@github.com-guanzi
  # 成功会提示 Hi ErHaSmile/guanzi! ...

  # 若卡住 / Connection timed out（22 被墙），改成 443：
  # HostName ssh.github.com
  # Port 443

5) Clone 并安装：

  mkdir -p /opt/sites
  git clone git@github.com-guanzi:ErHaSmile/guanzi.git /opt/sites/guanzi
  cd /opt/sites/guanzi
  cp .env.example .env && vi .env
  chmod +x scripts/*.sh update.sh
  ./scripts/server-setup.sh
  pm2 start ecosystem.config.cjs && pm2 save

6) 日常更新：

  cd /opt/sites/guanzi && ./update.sh
  # origin 默认应为 git@github.com-guanzi:ErHaSmile/guanzi.git
  # 若还是 https，执行：
  git remote set-url origin git@github.com-guanzi:ErHaSmile/guanzi.git

也可用仓库内脚本（有代码后）：

  bash scripts/server-ssh-setup.sh

新项目上机
----------
  同样放到 /opt/sites/<slug>/，改 APP_NAME、API_PORT、MySQL 库名，
  并在 /opt/sites/APPS.txt 记一行，避免端口与目录冲突。
  每个私有仓建议单独一把 Deploy Key。
