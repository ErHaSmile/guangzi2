/**
 * 一次性：备份当前素材 → 建立素材库 + 官网发布区（按内容哈希去重）
 * 用法：node server/scripts/backup-and-migrate-media.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  backupCurrentMedia,
  migrateToLibraryAndSite,
  ensureMediaDirs,
} from '../media-fs.js'
import { query } from '../db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '../..')

async function loadConfig() {
  try {
    const rows = await query('SELECT payload FROM site_config WHERE id = 1')
    if (!rows.length) return null
    let p = rows[0].payload
    if (typeof p === 'string') p = JSON.parse(p)
    return p
  } catch (err) {
    console.warn('[migrate] DB unavailable, use site-config.json only:', err.message)
    return null
  }
}

async function saveConfig(payload) {
  const rows = await query('SELECT version FROM site_config WHERE id = 1')
  if (!rows.length) return
  const ver = Number(rows[0].version) + 1
  await query('UPDATE site_config SET payload = CAST(? AS JSON), version = ? WHERE id = 1', [
    JSON.stringify(payload),
    ver,
  ])
  console.log('[migrate] DB config updated, version', ver)
}

async function main() {
  ensureMediaDirs()
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const backupDir = path.join(root, 'backups', `media-${stamp}`)
  console.log('[migrate] backup →', backupDir)
  const backup = backupCurrentMedia(backupDir)
  console.log('[migrate] backed up files:', backup.fileCount, 'bytes:', backup.bytes)

  const config = (await loadConfig()) || {}
  const jsonPath = path.join(root, 'public/site-config.json')
  let fileConfig = null
  if (fs.existsSync(jsonPath)) {
    fileConfig = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
  }

  console.log('[migrate] seed library + publish site-media…')
  const result = migrateToLibraryAndSite({
    configs: [config, fileConfig].filter(Boolean),
  })
  console.log('[migrate] library items:', result.libraryCount)
  console.log('[migrate] site-media items:', result.siteCount)
  console.log('[migrate] path rewrites:', result.rewriteCount)

  if (result.configOut) {
    await saveConfig(result.configOut)
    if (fileConfig) {
      fs.writeFileSync(jsonPath, JSON.stringify(result.fileConfigOut || result.configOut, null, 2), 'utf8')
      console.log('[migrate] site-config.json updated')
    }
  }

  console.log('[migrate] done. Library deletes will not touch site-media.')
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
