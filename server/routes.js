import express from 'express'
import multer from 'multer'
import { query } from './db.js'
import {
  deleteUpload,
  deleteUploads,
  IMAGE_EXT,
  listMediaLibrary,
  publishLibraryPath,
  reclassifyUpload,
  safeUploadName,
  saveUploadBuffer,
  updateMediaAlias,
  VIDEO_EXT,
} from './media-fs.js'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 120 * 1024 * 1024 },
})

function cleanText(value, max = 2000) {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .trim()
    .slice(0, max)
}

function parsePayload(row) {
  if (!row) return null
  let payload = row.payload
  if (typeof payload === 'string') payload = JSON.parse(payload)
  return {
    ...payload,
    assetBase: row.asset_base ?? '',
    version: row.version,
    updatedAt: row.updated_at,
  }
}

export function createApiRouter({ adminToken }) {
  const router = express.Router()

  function requireAdmin(req, res, next) {
    if (!adminToken) return next()
    const header = req.get('x-admin-token') || ''
    const auth = req.get('authorization') || ''
    const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : ''
    if (header === adminToken || bearer === adminToken) return next()
    return res.status(401).json({ error: '未授权' })
  }

  router.get('/config', async (_req, res) => {
    const rows = await query(
      `SELECT c.payload, c.version, c.updated_at, s.asset_base
       FROM site_config c
       LEFT JOIN site_settings s ON s.id = 1
       WHERE c.id = 1`
    )
    if (!rows.length) return res.status(404).json({ error: '配置不存在' })
    res.json(parsePayload(rows[0]))
  })

  router.put('/config', requireAdmin, express.json({ limit: '8mb' }), async (req, res) => {
    const body = req.body || {}
    const { assetBase, version, updatedAt, ...payload } = body
    if (!payload.global || !payload.pages) {
      return res.status(400).json({ error: '配置缺少 global 或 pages' })
    }
    const expected = Number(body.version)
    const rows = await query('SELECT version FROM site_config WHERE id = 1')
    if (!rows.length) return res.status(404).json({ error: '配置不存在' })
    if (Number.isFinite(expected) && expected !== Number(rows[0].version)) {
      return res.status(409).json({ error: '配置已被他人更新，请刷新后重试', version: rows[0].version })
    }
    const nextVersion = Number(rows[0].version) + 1
    await query('UPDATE site_config SET payload = CAST(? AS JSON), version = ? WHERE id = 1', [
      JSON.stringify(payload),
      nextVersion,
    ])
    if (typeof assetBase === 'string') {
      await query('UPDATE site_settings SET asset_base = ? WHERE id = 1', [assetBase.trim()])
    }
    const fresh = await query(
      `SELECT c.payload, c.version, c.updated_at, s.asset_base
       FROM site_config c
       LEFT JOIN site_settings s ON s.id = 1
       WHERE c.id = 1`
    )
    res.json({ ok: true, config: parsePayload(fresh[0]) })
  })

  router.get('/settings', async (_req, res) => {
    const rows = await query('SELECT asset_base, updated_at FROM site_settings WHERE id = 1')
    if (!rows.length) return res.json({ assetBase: '', updatedAt: null })
    res.json({ assetBase: rows[0].asset_base || '', updatedAt: rows[0].updated_at })
  })

  router.patch('/settings', requireAdmin, express.json(), async (req, res) => {
    if (typeof req.body?.assetBase !== 'string') {
      return res.status(400).json({ error: '需要 assetBase 字符串' })
    }
    await query('UPDATE site_settings SET asset_base = ? WHERE id = 1', [req.body.assetBase.trim()])
    const rows = await query('SELECT asset_base, updated_at FROM site_settings WHERE id = 1')
    res.json({ ok: true, assetBase: rows[0].asset_base || '', updatedAt: rows[0].updated_at })
  })

  router.get('/leads', requireAdmin, async (_req, res) => {
    const rows = await query(
      `SELECT id, name, tel, company, content, source, user_agent AS userAgent, created_at AS createdAt
       FROM contact_leads
       ORDER BY created_at DESC`
    )
    const items = rows.map((r) => ({
      ...r,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
    }))
    res.json({ items, total: items.length })
  })

  router.post('/leads', express.json(), async (req, res) => {
    const name = cleanText(req.body?.name, 80)
    const tel = cleanText(req.body?.tel, 40)
    const company = cleanText(req.body?.company, 120)
    const content = cleanText(req.body?.content, 4000)
    if (!name || !tel || !content) {
      return res.status(400).json({ error: '请填写姓名、电话与需求描述' })
    }
    const item = {
      id: `lead-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      tel,
      company,
      content,
      createdAt: new Date().toISOString(),
      source: cleanText(req.body?.source || 'contact', 40) || 'contact',
      userAgent: cleanText(req.get('user-agent') || '', 512),
    }
    await query(
      `INSERT INTO contact_leads (id, name, tel, company, content, source, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [item.id, item.name, item.tel, item.company, item.content, item.source, item.userAgent, new Date(item.createdAt)]
    )
    res.json({ ok: true, item })
  })

  router.delete('/leads', requireAdmin, async (req, res) => {
    const id = String(req.query.id || '')
    if (!id) return res.status(400).json({ error: '缺少 id' })
    const result = await query('DELETE FROM contact_leads WHERE id = ?', [id])
    if (!result.affectedRows) return res.status(404).json({ error: '未找到该留言' })
    res.json({ ok: true })
  })

  router.get('/media', requireAdmin, (_req, res) => {
    try {
      res.json(listMediaLibrary())
    } catch (err) {
      console.error('[media]', err)
      res.status(500).json({ error: err.message || '素材库读取失败' })
    }
  })

  router.post(
    '/media/upload',
    requireAdmin,
    (req, res, next) => {
      const ctype = req.get('content-type') || ''
      if (ctype.includes('multipart/form-data')) return upload.single('file')(req, res, next)
      return express.json({ limit: '10mb' })(req, res, next)
    },
    async (req, res) => {
      try {
        if (req.file) {
          const mime = req.file.mimetype || ''
          const categoryRaw = String(req.body?.category || req.query?.category || '').toLowerCase()
          const isVideo =
            categoryRaw === 'video' || mime.startsWith('video/') || VIDEO_EXT.test(req.file.originalname)
          const isIcon = categoryRaw === 'icon'
          const isLogo = categoryRaw === 'logo'
          const isImage =
            !isVideo &&
            (isIcon ||
              isLogo ||
              categoryRaw === 'image' ||
              mime.startsWith('image/') ||
              IMAGE_EXT.test(req.file.originalname))
          if (!isVideo && !isImage) return res.status(400).json({ error: '仅支持图片或视频' })
          if (isLogo && isVideo) return res.status(400).json({ error: 'Logo 仅支持图片' })
          const max = isVideo ? 120 * 1024 * 1024 : 8 * 1024 * 1024
          if (req.file.size > max) {
            return res.status(400).json({ error: isVideo ? '视频不能超过 120MB' : '图片不能超过 8MB' })
          }
          const filename = safeUploadName(req.file.originalname, isVideo ? '.mp4' : '.png')
          const category = isVideo ? 'video' : isIcon ? 'icon' : isLogo ? 'logo' : 'image'
          return res.json(saveUploadBuffer(filename, req.file.buffer, category))
        }

        const body = req.body || {}
        const mime = body.mime || 'image/png'
        if (!String(mime).startsWith('image/')) {
          return res.status(400).json({ error: 'JSON 上传仅支持图片，视频请使用表单上传' })
        }
        const dataUrl = String(body.data || '')
        const m = dataUrl.match(/^data:image\/[\w+.-]+;base64,(.+)$/)
        const b64 = m ? m[1] : body.base64
        if (!b64) return res.status(400).json({ error: '缺少图片数据' })
        const buf = Buffer.from(b64, 'base64')
        if (buf.length > 8 * 1024 * 1024) return res.status(400).json({ error: '图片不能超过 8MB' })
        const filename = safeUploadName(body.filename)
        const category =
          String(body.category || '').toLowerCase() === 'logo'
            ? 'logo'
            : String(body.category || '').toLowerCase() === 'icon'
              ? 'icon'
              : 'image'
        return res.json(saveUploadBuffer(filename, buf, category))
      } catch (err) {
        console.error('[media/upload]', err)
        res.status(err.status || 500).json({ error: err.message || '上传失败' })
      }
    }
  )

  router.delete('/media', requireAdmin, (req, res) => {
    try {
      deleteUpload(String(req.query.path || ''))
      res.json({ ok: true })
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message || '删除失败' })
    }
  })

  /** 批量删除素材库文件（不影响官网 site-media） */
  router.post('/media/delete-batch', requireAdmin, express.json({ limit: '1mb' }), (req, res) => {
    try {
      const paths = Array.isArray(req.body?.paths) ? req.body.paths.map(String) : []
      if (!paths.length) return res.status(400).json({ error: '缺少 paths' })
      const results = deleteUploads(paths)
      res.json({
        ok: true,
        deleted: results.filter((r) => r.ok).length,
        failed: results.filter((r) => !r.ok),
        results,
      })
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message || '批量删除失败' })
    }
  })

  /** 选用素材时发布到官网区（哈希去重），返回可写入配置的路径 */
  router.post('/media/publish', requireAdmin, express.json({ limit: '32kb' }), (req, res) => {
    try {
      const filePath = String(req.body?.path || '')
      if (!filePath) return res.status(400).json({ error: '缺少文件路径' })
      const result = publishLibraryPath(filePath)
      res.json(result)
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message || '发布失败' })
    }
  })

  router.post('/media/reclassify', requireAdmin, express.json({ limit: '32kb' }), (req, res) => {
    try {
      const filePath = String(req.body?.path || '')
      const categoryRaw = String(req.body?.category || '').toLowerCase()
      const category = categoryRaw === 'video' ? 'video' : categoryRaw === 'logo' ? 'logo' : 'image'
      if (!filePath) return res.status(400).json({ error: '缺少文件路径' })
      const result = reclassifyUpload(filePath, category)
      res.json(result)
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message || '更改分类失败' })
    }
  })

  router.post('/media/alias', requireAdmin, express.json({ limit: '32kb' }), (req, res) => {
    try {
      const filePath = String(req.body?.path || '')
      if (!filePath) return res.status(400).json({ error: '缺少文件路径' })
      const result = updateMediaAlias(filePath, req.body?.alias)
      res.json(result)
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message || '更新别名失败' })
    }
  })

  return router
}
