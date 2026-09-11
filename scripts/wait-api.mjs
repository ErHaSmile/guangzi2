/**
 * Wait until API health endpoint responds, then exit 0.
 * Usage: node scripts/wait-api.mjs && vite
 * Port: API_HEALTH > API_PORT/.env > 8787
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readEnvPort() {
  if (process.env.API_PORT) return String(process.env.API_PORT)
  try {
    const raw = fs.readFileSync(path.join(root, '.env'), 'utf8').replace(/^\uFEFF/, '')
    const line = raw.split(/\r?\n/).find((l) => /^\s*API_PORT\s*=/.test(l))
    if (line) return line.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '')
  } catch {
    /* no .env */
  }
  return '8787'
}

const target = process.env.API_HEALTH || `http://127.0.0.1:${readEnvPort()}/health`
const timeoutMs = Number(process.env.API_WAIT_TIMEOUT || 30000)
const started = Date.now()

function once() {
  return new Promise((resolve) => {
    const req = http.get(target, (res) => {
      res.resume()
      resolve(res.statusCode >= 200 && res.statusCode < 500)
    })
    req.on('error', () => resolve(false))
    req.setTimeout(1500, () => {
      req.destroy()
      resolve(false)
    })
  })
}

while (Date.now() - started < timeoutMs) {
  if (await once()) {
    process.exit(0)
  }
  await new Promise((r) => setTimeout(r, 250))
}

console.error(`[wait-api] timed out after ${timeoutMs}ms waiting for ${target}`)
process.exit(1)
