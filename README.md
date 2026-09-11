# guanzi_2 · 光子文化 · 达人合作 / MCN

基于 `guanzi` 官网+工作台骨架，内容方向参考「达人合作展示平台」：
**达人 BD × 自有主播 · 双轮驱动 MCN**。

| 项 | 值 |
|----|----|
| 本地目录 | `D:\project\order\光子文化官网\guanzi_2` |
| 线上目录（建议） | `/opt/sites/guanzi_2` |
| APP / PM2 | `guanzi_2` |
| API 端口 | `8788` |
| Vite 端口 | `5174` |
| MySQL 库 | `guangzi_2` |

同目录姊妹项目：`../guanzi`（品牌官网，端口 8787 / 5173）。

## 开发

```bash
cd D:\project\order\光子文化官网\guanzi_2
npm install
cp .env.example .env
npm run db:migrate
npm run dev
```

- 官网：http://localhost:5174/
- API：http://127.0.0.1:8788/
- 工作台：http://127.0.0.1:8788/admin.html

设计参考原稿：`_ref/达人合作展示平台-网页/`
