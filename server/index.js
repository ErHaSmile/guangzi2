import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { dbConfig, getPool, query } from './db.js'
import { ensureMediaDirs, publicRoot, root } from './media-fs.js'
import { createApiRouter } from './routes.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env') })

const port = Number(process.env.API_PORT || process.env.PORT || 8787)
const host = process.env.HOST || '0.0.0.0'
const distRoot = path.join(root, 'dist')

async function resolveAdminToken() {
  const envToken = process.env.ADMIN_TOKEN || ''
  try {
    const rows = await query('SELECT admin_token FROM site_settings WHERE id = 1')
    if (rows[0]?.admin_token) return rows[0].admin_token
  } catch {
    /* table may not exist yet */
  }
  return envToken
}

async function main() {
  ensureMediaDirs()
  await getPool().query('SELECT 1')
  console.log(
    `[api] MySQL ok → ${dbConfig.user}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`
  )

  const adminToken = await resolveAdminToken()
  const app = express()
  app.use(cors())
  app.use('/api', createApiRouter({ adminToken }))

  app.get('/health', async (_req, res) => {
    try {
      await query('SELECT 1')
      res.json({ ok: true, db: dbConfig.database })
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message })
    }
  })

  const mediaStatic = {
    etag: true,
    setHeaders(res, filePath) {
      if (/\.(mp4|webm|ogg|mov|m4v|jpe?g|png|gif|webp|svg|ico)$/i.test(filePath)) {
        // 媒体可长期缓存；上传文件名带时间戳，覆盖极少
        res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400')
        res.setHeader('Accept-Ranges', 'bytes')
      }
    },
  }

  // 生产：静态站 + 运行时上传目录（public 覆盖同名资源）
  if (fs.existsSync(distRoot)) {
    app.use(
      express.static(distRoot, {
        index: ['index.html'],
        etag: true,
        setHeaders(res, filePath) {
          // HTML 必须每次校验，否则更新重启后仍吃到旧壳页/旧入口，菜单组装像「没生效」
          if (/\.html?$/i.test(filePath)) {
            res.setHeader('Cache-Control', 'no-cache')
            return
          }
          if (/\.(js|css|woff2?)$/i.test(filePath)) {
            res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400')
          }
          mediaStatic.setHeaders(res, filePath)
        },
      })
    )
  }
  app.use(express.static(publicRoot, { index: false, ...mediaStatic }))

  // 统一落地页 URL：/about、/about/ → /about.html（避免相对资源路径与拼装匹配失败）
  app.get(
    [
      '/about',
      '/about/',
      '/service',
      '/service/',
      '/news',
      '/news/',
      '/case',
      '/case/',
      '/contact',
      '/contact/',
      '/page',
      '/page/',
      '/admin',
      '/admin/',
      '/news-detail',
      '/news-detail/',
      '/case-detail',
      '/case-detail/',
    ],
    (req, res, next) => {
      const name = req.path.replace(/^\/+|\/+$/g, '')
      const file = `/${name}.html`
      const abs = path.join(distRoot, `${name}.html`)
      if (fs.existsSync(abs)) {
        res.setHeader('Cache-Control', 'no-cache')
        return res.redirect(301, file)
      }
      return next()
    }
  )

  // 多页 HTML 回退
  app.get('*', (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()
    if (req.path.startsWith('/api')) return next()
    if (!req.accepts('html')) return res.status(404).type('text').send('Not Found')
    const clean = req.path.replace(/\/$/, '') || '/index'
    const candidates = [
      path.join(distRoot, `${clean}.html`),
      path.join(distRoot, clean, 'index.html'),
      path.join(distRoot, 'index.html'),
    ]
    const hit = candidates.find((p) => fs.existsSync(p) && fs.statSync(p).isFile())
    if (hit) {
      res.setHeader('Cache-Control', 'no-cache')
      return res.sendFile(hit)
    }
    return res.status(404).type('text').send('Not Found')
  })

  app.use((err, _req, res, _next) => {
    console.error('[api]', err)
    res.status(500).json({ error: err.message || '服务器错误' })
  })

  app.listen(port, host, () => {
    console.log(`[site] http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${port}/`)
    console.log(`[admin] http://127.0.0.1:${port}/admin.html`)
    console.log(`[health] http://127.0.0.1:${port}/health`)
  })
}

main().catch((err) => {
  console.error('[api] failed to start', err)
  process.exit(1)
})
