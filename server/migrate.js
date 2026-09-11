import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import mysql from 'mysql2/promise'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
dotenv.config({ path: path.join(root, '.env') })

const SCHEMA = `
CREATE TABLE IF NOT EXISTS site_settings (
  id TINYINT NOT NULL PRIMARY KEY,
  asset_base VARCHAR(512) NOT NULL DEFAULT '',
  admin_token VARCHAR(255) NOT NULL DEFAULT '',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS site_config (
  id TINYINT NOT NULL PRIMARY KEY,
  payload JSON NOT NULL,
  version INT NOT NULL DEFAULT 1,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS contact_leads (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  tel VARCHAR(40) NOT NULL,
  company VARCHAR(120) NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  source VARCHAR(40) NOT NULL DEFAULT 'contact',
  user_agent VARCHAR(512) NOT NULL DEFAULT '',
  created_at DATETIME(3) NOT NULL,
  INDEX idx_leads_created (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD ?? '',
    multipleStatements: true,
    charset: 'utf8mb4',
  })

  const dbName = process.env.MYSQL_DATABASE || 'guangzi'
  await conn.query(
    `CREATE DATABASE IF NOT EXISTS \`${dbName}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  )
  await conn.query(`USE \`${dbName}\``)
  await conn.query(SCHEMA)

  const adminToken = process.env.ADMIN_TOKEN || ''
  const [settings] = await conn.query('SELECT id FROM site_settings WHERE id = 1')
  if (!settings.length) {
    await conn.query('INSERT INTO site_settings (id, asset_base, admin_token) VALUES (1, ?, ?)', [
      '',
      adminToken,
    ])
    console.log('[migrate] site_settings seeded')
  } else if (adminToken) {
    await conn.query('UPDATE site_settings SET admin_token = ? WHERE id = 1', [adminToken])
  }

  const [configs] = await conn.query('SELECT id FROM site_config WHERE id = 1')
  if (!configs.length) {
    const configPath = path.join(root, 'public/site-config.json')
    const payload = JSON.parse(fs.readFileSync(configPath, 'utf8'))
    await conn.query('INSERT INTO site_config (id, payload, version) VALUES (1, CAST(? AS JSON), 1)', [
      JSON.stringify(payload),
    ])
    console.log('[migrate] site_config seeded from public/site-config.json')
  } else {
    console.log('[migrate] site_config already exists, skip seed')
  }

  const leadsPath = path.join(root, 'data/contact-leads.json')
  if (fs.existsSync(leadsPath)) {
    const list = JSON.parse(fs.readFileSync(leadsPath, 'utf8') || '[]')
    if (Array.isArray(list) && list.length) {
      for (const item of list) {
        const created = item.createdAt ? new Date(item.createdAt) : new Date()
        const createdSql = Number.isNaN(created.getTime())
          ? new Date()
          : created
        await conn.query(
          `INSERT IGNORE INTO contact_leads
            (id, name, tel, company, content, source, user_agent, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            String(item.id || `lead-${Date.now()}`),
            String(item.name || '').slice(0, 80),
            String(item.tel || '').slice(0, 40),
            String(item.company || '').slice(0, 120),
            String(item.content || ''),
            String(item.source || 'contact').slice(0, 40),
            String(item.userAgent || '').slice(0, 512),
            createdSql,
          ]
        )
      }
      console.log(`[migrate] imported ${list.length} lead(s) from contact-leads.json`)
    }
  }

  await conn.end()
  console.log('[migrate] done')
}

main().catch((err) => {
  console.error('[migrate] failed', err)
  process.exit(1)
})
