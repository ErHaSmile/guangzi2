import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '../..')
const dataDir = path.join(root, 'data')
const leadsFile = path.join(dataDir, 'contact-leads.json')

function ensureStore() {
  fs.mkdirSync(dataDir, { recursive: true })
  if (!fs.existsSync(leadsFile)) {
    fs.writeFileSync(leadsFile, '[]\n', 'utf8')
  }
}

function readLeads() {
  ensureStore()
  try {
    const raw = fs.readFileSync(leadsFile, 'utf8')
    const data = JSON.parse(raw || '[]')
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

function writeLeads(list) {
  ensureStore()
  fs.writeFileSync(leadsFile, `${JSON.stringify(list, null, 2)}\n`, 'utf8')
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

function cleanText(value, max = 2000) {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .trim()
    .slice(0, max)
}

export function leadsApiPlugin() {
  return {
    name: 'leads-api',
    configureServer(server) {
      ensureStore()
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0]
        if (!url?.startsWith('/api/leads')) return next()

        try {
          if (req.method === 'GET' && url === '/api/leads') {
            const list = readLeads().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
            return sendJson(res, 200, { items: list, total: list.length })
          }

          if (req.method === 'POST' && url === '/api/leads') {
            const raw = await readBody(req)
            let body = {}
            try {
              body = JSON.parse(raw.toString('utf8') || '{}')
            } catch {
              return sendJson(res, 400, { error: '无效 JSON' })
            }

            const name = cleanText(body.name, 80)
            const tel = cleanText(body.tel, 40)
            const company = cleanText(body.company, 120)
            const content = cleanText(body.content, 4000)

            if (!name || !tel || !content) {
              return sendJson(res, 400, { error: '请填写姓名、电话与需求描述' })
            }

            const item = {
              id: `lead-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              name,
              tel,
              company,
              content,
              createdAt: new Date().toISOString(),
              source: cleanText(body.source || 'contact', 40) || 'contact',
              userAgent: cleanText(req.headers['user-agent'] || '', 240),
            }

            const list = readLeads()
            list.push(item)
            writeLeads(list)
            return sendJson(res, 200, { ok: true, item })
          }

          if (req.method === 'DELETE' && url === '/api/leads') {
            const q = new URL(req.url, 'http://localhost')
            const id = q.searchParams.get('id') || ''
            if (!id) return sendJson(res, 400, { error: '缺少 id' })
            const list = readLeads()
            const nextList = list.filter((item) => item.id !== id)
            if (nextList.length === list.length) return sendJson(res, 404, { error: '未找到该留言' })
            writeLeads(nextList)
            return sendJson(res, 200, { ok: true })
          }

          return sendJson(res, 404, { error: 'Not found' })
        } catch (err) {
          console.error('[leads-api]', err)
          return sendJson(res, 500, { error: err.message || '服务器错误' })
        }
      })
    },
  }
}
