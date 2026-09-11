# 光子文化官网 · 部署文档

北京光子文化传媒（GUANZI）品牌官网：Vite 多页静态站 + Express API + MySQL。  
生产环境由 **同一个 Node 进程** 同时提供 API 与前端静态资源。

---

## 1. 架构一览

```
浏览器
  ├─ 页面 / 静态资源  →  Express（dist/ + public/）
  └─ /api/* 、/health →  Express → MySQL
```

| 组件 | 说明 |
|------|------|
| 前端 | `vite build` → `dist/`（多页 HTML） |
| 运行时资源 | `public/`（上传图片/视频、种子 `site-config.json`） |
| 后端 | `server/index.js`（API + 生产静态托管） |
| 配置真相源 | MySQL `site_config`（后台保存写入 DB；JSON 仅作首次迁移种子） |
| 进程管理 | 推荐 PM2（`ecosystem.config.cjs`） |

默认端口：`8787`（由 `.env` 的 `API_PORT` 控制）。

---

## 2. 环境要求

- **Node.js** 18+
- **MySQL** 8.x（utf8mb4）
- **Git**（推荐 Git 部署路径）
- **PM2**（推荐，可选）：`npm i -g pm2`
- 开放防火墙：业务端口（如 `8787`）或仅开放 80/443（若前面挂 Nginx）

---

## 3. 环境变量（`.env`）

从仓库根目录复制：

```bash
cp .env.example .env
```

| 变量 | 必填 | 说明 |
|------|------|------|
| `MYSQL_HOST` | 是 | MySQL 主机 |
| `MYSQL_PORT` | 否 | 默认 `3306` |
| `MYSQL_USER` | 是 | 用户名 |
| `MYSQL_PASSWORD` | 是* | 密码（可空仅限本地无密） |
| `MYSQL_DATABASE` | 是 | 库名，默认 `guangzi` |
| `APP_NAME` | 否 | 应用名 / PM2 进程名，默认 `guanzi` |
| `HOST` | 否 | 监听地址，默认 `0.0.0.0` |
| `API_PORT` / `PORT` | 否 | 监听端口，默认 `8787` |
| `ADMIN_TOKEN` | 是 | 后台写接口鉴权（服务端） |
| `VITE_ADMIN_TOKEN` | 是 | **构建时**打进管理端，须与 `ADMIN_TOKEN` 一致 |

> `.env` 不进 Git。服务器上改 token 后，需要重新 `npm run build` 再重启，管理端才会带上新的 `VITE_ADMIN_TOKEN`。

---

## 4. 本地开发（对照）

```bash
npm install
cp .env.example .env   # 填本地 MySQL 与 token
npm run db:migrate     # 建库建表；空库时从 public/site-config.json 导入种子
npm run dev            # API + Vite（默认预览 5173，API 8787）
# 或
npm run admin          # 同上并打开 /admin.html
```

健康检查：`http://127.0.0.1:8787/health`

---

## 5. 生产方式 A：Git + PM2（推荐）

适用于 Linux 服务器，代码目录约定：`/opt/sites/guanzi/`。  
多项目规范详见 [SERVER.md](./SERVER.md)。

### 5.1 首次部署

**① 私有仓 Deploy Key（若尚未配置）**

```bash
mkdir -p ~/.ssh && chmod 700 ~/.ssh
ssh-keygen -t ed25519 -C "guanzi-deploy" -f ~/.ssh/guanzi_deploy -N ""
cat ~/.ssh/guanzi_deploy.pub
# → GitHub 仓库 Settings → Deploy keys → 添加（只读即可）

cat >> ~/.ssh/config <<'EOF'
Host github.com-guanzi
  HostName github.com
  User git
  IdentityFile ~/.ssh/guanzi_deploy
  IdentitiesOnly yes
  Port 22
EOF
chmod 600 ~/.ssh/config
ssh -T git@github.com-guanzi
```

若 22 端口超时，将 `HostName` 改为 `ssh.github.com`，`Port` 改为 `443`。

**② 克隆与安装**

```bash
mkdir -p /opt/sites
git clone git@github.com-guanzi:ErHaSmile/guanzi.git /opt/sites/guanzi
cd /opt/sites/guanzi

cp .env.example .env
vi .env   # 填写 MySQL、ADMIN_TOKEN、VITE_ADMIN_TOKEN（二者保持一致）

chmod +x scripts/*.sh update.sh
./scripts/server-setup.sh
# 等价于：npm install → db:migrate → build

pm2 start ecosystem.config.cjs
pm2 save
pm2 startup   # 按提示执行，开机自启
```

**③ 验收**

| 地址 | 用途 |
|------|------|
| `http://服务器IP:8787/` | 官网 |
| `http://服务器IP:8787/admin.html` | 内容工作台 |
| `http://服务器IP:8787/health` | 健康检查（含 DB） |

### 5.2 日常更新

本机推送代码后，在服务器执行：

```bash
cd /opt/sites/guanzi && ./update.sh
```

脚本会：`git pull` → `npm install` → `db:migrate` → `build` → `pm2 restart`。

> `db:migrate` **不会覆盖**已有 `site_config`。站点文案以数据库为准；改 `public/site-config.json` 不会自动同步到已部署库。

### 5.3 常用运维命令

```bash
pm2 status
pm2 logs guanzi
pm2 restart guanzi
curl -s http://127.0.0.1:8787/health
```

日志目录：`/opt/sites/guanzi/logs/`。

---

## 6. 生产方式 B：打包上传（无 Git）

适合不能拉仓库、只上传构建包的场景。

### 6.1 本机打包（Windows）

```powershell
# 在项目根目录；确保 .env 中 VITE_ADMIN_TOKEN 与线上 ADMIN_TOKEN 一致后再 build
.\scripts\pack-deploy.ps1
```

生成 `guanzi-deploy/` 与 `guanzi-deploy.zip`（含 `dist/`、`server/`、`public/` 关键、启动脚本等）。

### 6.2 服务器启动

1. 解压到目标目录（例如 `/opt/sites/guanzi/`）
2. 复制 `.env.example` → `.env` 并填写
3. Linux：

```bash
chmod +x start.sh
./start.sh
# 或：npm install --omit=dev && node server/migrate.js && node server/index.js
```

4. Windows：双击 `start.bat`，或执行 `start.ps1`
5. 常驻建议仍用 PM2：`pm2 start server/index.js --name guanzi`

---

## 7. Nginx 反代（可选）

对外只开放 80/443 时，把流量转到 Node：

```nginx
server {
  listen 80;
  server_name www.example.com;

  client_max_body_size 64m;   # 后台上传素材

  location / {
    proxy_pass http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

HTTPS 可用 certbot / 云厂商证书挂在 Nginx 上；Node 仍监听本机 `8787`。

若静态资源需 CDN，可把 `site_settings.asset_base`（或后台对应项）设为 CDN 前缀；配置里仍存相对路径。

---

## 8. 数据与目录说明

| 路径 / 表 | 说明 |
|-----------|------|
| `site_config` | 全站可编辑配置（JSON），**运行时权威来源** |
| `site_settings` | `admin_token`、`asset_base` 等 |
| `contact_leads` | 联系表单留言 |
| `public/images/uploads` | 后台上传图片 |
| `public/videos/uploads` | 后台上传视频 |
| `public/site-config.json` | **仅** `db:migrate` 在空库时导入；之后勿当线上真相源 |

### 备份建议

```bash
# 配置与留言
mysqldump -u用户 -p 库名 site_config site_settings contact_leads > guanzi-db-$(date +%F).sql

# 上传素材
tar -czf guanzi-public-$(date +%F).tgz -C /opt/sites/guanzi public/images/uploads public/videos/uploads
```

### 从种子重置配置（慎用）

会覆盖库中已有站点配置，仅用于空库或明确要回滚到 JSON：

1. 备份 `site_config`
2. 删除 `site_config` 中 `id=1` 行（或整表）
3. 确保 `public/site-config.json` 为目标内容
4. 执行 `npm run db:migrate`

---

## 9. 后台工作台

- 地址：`/admin.html`
- 写操作依赖请求头中的 token（构建期注入的 `VITE_ADMIN_TOKEN`）
- 保存后写入 MySQL；预览页通过 API 拉最新配置
- 修改 `ADMIN_TOKEN` / `VITE_ADMIN_TOKEN` 后必须：**改 `.env` → `npm run build` → 重启进程**

---

## 10. 故障排查

| 现象 | 排查 |
|------|------|
| `/health` 失败 | MySQL 连通性、库名、账号；看 `pm2 logs` |
| 页面空白 / 404 | 是否执行过 `npm run build`；`dist/` 是否存在 |
| 后台无法保存 | `ADMIN_TOKEN` 与构建时 `VITE_ADMIN_TOKEN` 是否一致；是否需重新 build |
| 改了 JSON 前台不变 | 正常：运行时读 DB；应在后台改并保存，或按上文「重置配置」 |
| 上传失败 | `public/**/uploads` 目录权限；Nginx `client_max_body_size` |
| `git pull` 超时 | Deploy Key / SSH 443；或使用打包上传方式 |
| 端口占用 | 改 `.env` 的 `API_PORT`，多应用勿冲突（见 SERVER.md） |

---

## 11. 检查清单（上线前）

- [ ] `.env` 已配置且不在公开仓库中
- [ ] `ADMIN_TOKEN` === `VITE_ADMIN_TOKEN`，且为强随机串
- [ ] `npm run db:migrate` 成功，`/health` 返回 `ok: true`
- [ ] `npm run build` 成功，`dist/` 存在
- [ ] PM2（或等价）常驻并已 `pm2 save`
- [ ] 防火墙 / 安全组放行端口或已配置 Nginx
- [ ] 打开官网与 `/admin.html` 做一次保存→刷新验证
- [ ] 已安排 DB + uploads 备份

---

## 相关文档

- [SERVER.md](./SERVER.md) — 多项目目录与 Deploy Key 细节  
- 仓库根 [README.md](../README.md) — 开发与快速入口  
- `.env.example` — 环境变量模板  
