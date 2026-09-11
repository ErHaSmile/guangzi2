import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '../..')
const brandsDir = path.join(root, 'public/images/brands')
const uploadsDir = path.join(root, 'public/images/uploads')
const videosDir = path.join(root, 'public/videos')
const videoUploadsDir = path.join(root, 'public/videos/uploads')

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|ico)$/i
const VIDEO_EXT = /\.(mp4|webm|ogg|mov|m4v)$/i

function ensureDirs() {
  ;[brandsDir, uploadsDir, videosDir, videoUploadsDir].forEach((d) => fs.mkdirSync(d, { recursive: true }))
}

function listDir(dir, urlPrefix, extRe) {
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((name) => extRe.test(name) && !name.startsWith('_') && !name.startsWith('.'))
    .map((name) => {
      const full = path.join(dir, name)
      const stat = fs.statSync(full)
      if (!stat.isFile()) return null
      return {
        name,
        path: `${urlPrefix}/${name}`.replace(/\\/g, '/'),
        size: stat.size,
        mtime: stat.mtimeMs,
        kind: VIDEO_EXT.test(name) ? 'video' : 'image',
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.mtime - a.mtime)
}

function listVideosRecursive() {
  const out = []
  if (!fs.existsSync(videosDir)) return out
  const walk = (dir, urlBase) => {
    fs.readdirSync(dir).forEach((name) => {
      if (name.startsWith('_') || name.startsWith('.')) return
      const full = path.join(dir, name)
      const stat = fs.statSync(full)
      if (stat.isDirectory()) {
        if (name === 'uploads') return
        walk(full, `${urlBase}/${name}`)
        return
      }
      if (!VIDEO_EXT.test(name)) return
      out.push({
        name,
        path: `${urlBase}/${name}`.replace(/\\/g, '/'),
        size: stat.size,
        mtime: stat.mtimeMs,
        kind: 'video',
      })
    })
  }
  walk(videosDir, '/videos')
  return out.sort((a, b) => b.mtime - a.mtime)
}

function sendJson(res, status, data) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(data))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function safeUploadName(name, fallbackExt = '.png') {
  const base = path.basename(name || `file${fallbackExt}`).replace(/[^\w.\u4e00-\u9fa5-]+/g, '_')
  const ext = path.extname(base) || fallbackExt
  const stem = path.basename(base, ext).slice(0, 40) || 'file'
  return `${Date.now()}-${stem}${ext.toLowerCase()}`
}

function isUploadPath(urlPath) {
  return (
    typeof urlPath === 'string' &&
    (urlPath.startsWith('/images/uploads/') || urlPath.startsWith('/videos/uploads/'))
  )
}

function parseMultipart(buf, boundary) {
  const parts = []
  const sep = Buffer.from(`--${boundary}`)
  let start = buf.indexOf(sep) + sep.length
  while (start < buf.length) {
    if (buf[start] === 45 && buf[start + 1] === 45) break // --
    if (buf[start] === 13 && buf[start + 1] === 10) start += 2
    const headerEnd = buf.indexOf('\r\n\r\n', start)
    if (headerEnd < 0) break
    const headers = buf.slice(start, headerEnd).toString('utf8')
    const next = buf.indexOf(sep, headerEnd + 4)
    const end = next < 0 ? buf.length : next - 2
    const content = buf.slice(headerEnd + 4, end)
    const nameMatch = headers.match(/name="([^"]+)"/)
    const fileMatch = headers.match(/filename="([^"]*)"/)
    const typeMatch = headers.match(/Content-Type:\s*(.+)/i)
    parts.push({
      name: nameMatch?.[1] || '',
      filename: fileMatch?.[1] || '',
      mime: typeMatch?.[1]?.trim() || '',
      data: content,
    })
    if (next < 0) break
    start = next + sep.length
  }
  return parts
}

export function mediaUploadPlugin() {
  return {
    name: 'media-upload-api',
    configureServer(server) {
      ensureDirs()
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0]
        if (!url?.startsWith('/api/media')) return next()

        try {
          if (req.method === 'GET' && url === '/api/media') {
            return sendJson(res, 200, {
              brands: listDir(brandsDir, '/images/brands', IMAGE_EXT),
              uploads: listDir(uploadsDir, '/images/uploads', IMAGE_EXT),
              videos: [...listVideosRecursive(), ...listDir(videoUploadsDir, '/videos/uploads', VIDEO_EXT)],
            })
          }

          if (req.method === 'POST' && url === '/api/media/upload') {
            const ctype = req.headers['content-type'] || ''
            // multipart video/image upload
            if (ctype.includes('multipart/form-data')) {
              const boundary = ctype.split('boundary=')[1]
              if (!boundary) return sendJson(res, 400, { error: '无效 multipart' })
              const raw = await readBody(req)
              const parts = parseMultipart(raw, boundary)
              const filePart = parts.find((p) => p.filename)
              if (!filePart) return sendJson(res, 400, { error: '缺少文件' })
              const mime = filePart.mime || ''
              const isVideo = mime.startsWith('video/') || VIDEO_EXT.test(filePart.filename)
              const isImage = mime.startsWith('image/') || IMAGE_EXT.test(filePart.filename)
              if (!isVideo && !isImage) return sendJson(res, 400, { error: '仅支持图片或视频' })
              const max = isVideo ? 120 * 1024 * 1024 : 8 * 1024 * 1024
              if (filePart.data.length > max) {
                return sendJson(res, 400, { error: isVideo ? '视频不能超过 120MB' : '图片不能超过 8MB' })
              }
              const filename = safeUploadName(filePart.filename, isVideo ? '.mp4' : '.png')
              const dir = isVideo ? videoUploadsDir : uploadsDir
              const urlPrefix = isVideo ? '/videos/uploads' : '/images/uploads'
              fs.writeFileSync(path.join(dir, filename), filePart.data)
              return sendJson(res, 200, {
                path: `${urlPrefix}/${filename}`,
                name: filename,
                size: filePart.data.length,
                kind: isVideo ? 'video' : 'image',
              })
            }

            // legacy JSON base64 image upload
            const raw = await readBody(req)
            const body = JSON.parse(raw.toString('utf8') || '{}')
            const mime = body.mime || 'image/png'
            if (!String(mime).startsWith('image/')) {
              return sendJson(res, 400, { error: 'JSON 上传仅支持图片，视频请使用表单上传' })
            }
            const dataUrl = String(body.data || '')
            const m = dataUrl.match(/^data:image\/[\w+.-]+;base64,(.+)$/)
            const b64 = m ? m[1] : body.base64
            if (!b64) return sendJson(res, 400, { error: '缺少图片数据' })
            const buf = Buffer.from(b64, 'base64')
            if (buf.length > 8 * 1024 * 1024) {
              return sendJson(res, 400, { error: '图片不能超过 8MB' })
            }
            const filename = safeUploadName(body.filename)
            fs.writeFileSync(path.join(uploadsDir, filename), buf)
            return sendJson(res, 200, {
              path: `/images/uploads/${filename}`,
              name: filename,
              size: buf.length,
              kind: 'image',
            })
          }

          if (req.method === 'DELETE' && url === '/api/media') {
            const q = new URL(req.url, 'http://localhost')
            const filePath = q.searchParams.get('path') || ''
            if (!isUploadPath(filePath)) {
              return sendJson(res, 400, { error: '只能删除 uploads 目录中的文件' })
            }
            const abs = path.join(root, 'public', filePath.replace(/^\//, ''))
            const allowedRoots = [uploadsDir, videoUploadsDir]
            if (!allowedRoots.some((d) => abs.startsWith(d))) {
              return sendJson(res, 400, { error: '非法路径' })
            }
            if (fs.existsSync(abs)) fs.unlinkSync(abs)
            return sendJson(res, 200, { ok: true })
          }

          return sendJson(res, 404, { error: 'Not found' })
        } catch (err) {
          console.error('[media-api]', err)
          return sendJson(res, 500, { error: err.message || '服务器错误' })
        }
      })
    },
  }
}
