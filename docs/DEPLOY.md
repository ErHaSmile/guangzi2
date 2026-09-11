# guanzi_2 · MCN 站部署文档

达人合作 / MCN 官网：Vite 多页静态站 + Express API + MySQL。  
生产环境由 **同一个 Node 进程** 同时提供 API 与前端静态资源。

与品牌官网 **guanzi（项目 1）可同机并行**：目录、库名、端口、PM2 进程名全部隔离。

---

## 1. 与项目 1 对照

| 项 | 项目 1 `guanzi` | 项目 2 `guanzi_2` |
|------|------------------|-------------------|
| GitHub | `ErHaSmile/guanzi` | `ErHaSmile/guangzi2` |
| 线上目录 | `/opt/sites/guanzi` | `/opt/sites/guanzi_2` |
| PM2 / APP_NAME | `guanzi` | `guanzi_2` |
| API 端口 | `8787` | `8788` |
| MySQL 库 | `guangzi` | `guangzi_2` |
| 后台 | `:8787/admin.html` | `:8788/admin.html` |

> 两个站 **不要共用同一个 MySQL 库**，否则配置会互相覆盖。

---

## 2. 架构一览

```
浏览器
  ├─ 页面 / 静态资源  →  Express（dist/ + public/）
  └─ /api/* 、/health →  Express → MySQL（guangzi_2）
```

默认端口：`8788`（`.env` 的 `API_PORT`）。

---

## 3. 环境变量（`.env`）

```bash
cp .env.example .env
```

| 变量 | 必填 | 本项目建议值 |
|------|------|----------------|
| `MYSQL_DATABASE` | 是 | `guangzi_2` |
| `APP_NAME` | 是 | `guanzi_2` |
| `API_PORT` | 是 | `8788` |
| `ADMIN_TOKEN` / `VITE_ADMIN_TOKEN` | 是 | 与项目 1 **不同** 的强随机串，且二者一致 |

`.env` 不进 Git。改 token 后需重新 `npm run build` 再重启。

---

## 4. 首次部署（Git + PM2）

假设项目 1 已在 `/opt/sites/guanzi` 运行。下面只加项目 2。

### 4.1 Deploy Key（建议单独一把）

```bash
ssh-keygen -t ed25519 -C "guanzi2-deploy" -f ~/.ssh/guanzi2_deploy -N ""
cat ~/.ssh/guanzi2_deploy.pub
# → GitHub ErHaSmile/guangzi2 → Settings → Deploy keys（只读）

cat >> ~/.ssh/config <<'EOF'
Host github.com-guanzi2
  HostName github.com
  User git
  IdentityFile ~/.ssh/guanzi2_deploy
  IdentitiesOnly yes
  Port 22
EOF
chmod 600 ~/.ssh/config
ssh -T git@github.com-guanzi2
```

22 超时则改 `HostName ssh.github.com` + `Port 443`。

### 4.2 克隆与安装

```bash
# MySQL 先建库（若无）
# CREATE DATABASE guangzi_2 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

mkdir -p /opt/sites
git clone git@github.com-guanzi2:ErHaSmile/guangzi2.git /opt/sites/guanzi_2
cd /opt/sites/guanzi_2

cp .env.example .env
vi .env   # 确认库名 guangzi_2、端口 8788、APP_NAME=guanzi_2、token

chmod +x scripts/*.sh update.sh
./scripts/server-setup.sh
# npm install → db:migrate → build

pm2 start ecosystem.config.cjs   # 进程名 guanzi_2
pm2 save
# 若尚未做过：pm2 startup
```

### 4.3 验收（两站都应通）

| 地址 | 用途 |
|------|------|
| `http://服务器IP:8787/` | 项目 1 品牌官网 |
| `http://服务器IP:8787/admin.html` | 项目 1 后台 |
| `http://服务器IP:8787/health` | 项目 1 健康检查 |
| `http://服务器IP:8788/` | 项目 2 MCN 站 |
| `http://服务器IP:8788/admin.html` | 项目 2 后台 |
| `http://服务器IP:8788/health` | 项目 2 健康检查 |

```bash
pm2 status
curl -s http://127.0.0.1:8787/health
curl -s http://127.0.0.1:8788/health
```

防火墙 / 安全组放行 **8787 与 8788**（或只开 80/443 + Nginx）。

---

## 5. 日常更新

```bash
# 项目 1
cd /opt/sites/guanzi && ./update.sh

# 项目 2
cd /opt/sites/guanzi_2 && ./update.sh
```

`db:migrate` **不会覆盖**已有 `site_config`。

---

## 6. Nginx（双域名示例）

```nginx
# 项目 1
server {
  listen 80;
  server_name www.guanzi-brand.example;
  client_max_body_size 64m;
  location / {
    proxy_pass http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}

# 项目 2
server {
  listen 80;
  server_name www.guanzi-mcn.example;
  client_max_body_size 64m;
  location / {
    proxy_pass http://127.0.0.1:8788;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

同一域名用路径分流不推荐（两站都是站点根路径 `/`）。优先 **两个域名 / 两个子域名**。

---

## 7. 故障排查

| 现象 | 排查 |
|------|------|
| 8788 起不来 | 是否与 8787 冲突；`.env` 的 `API_PORT` |
| 后台保存串站 | 是否误用了同一 `MYSQL_DATABASE` |
| PM2 名字冲突 | `APP_NAME` 必须分别是 `guanzi` / `guanzi_2` |
| 其它 | 见项目 1 [DEPLOY.md](https://github.com/ErHaSmile/guanzi/blob/main/docs/DEPLOY.md) 同类项 |

---

## 相关文档

- [SERVER.md](./SERVER.md) — 多项目目录约定  
- 仓库根 [README.md](../README.md)  
- `.env.example` — 环境变量模板  
