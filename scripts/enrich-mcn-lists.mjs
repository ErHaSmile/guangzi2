/**
 * Directly enrich MCN list data in MySQL site_config (no API required).
 * node scripts/enrich-mcn-lists.mjs
 */
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  DEFAULT_MCN_TALENT_CATEGORIES,
  DEFAULT_MCN_TALENT_ITEMS,
  DEFAULT_MCN_LIVE_ITEMS,
  DEFAULT_MCN_CASE_ITEMS,
  ensureMcnHomeLists,
} from '../src/mcn/mcn-lists.js'
import { getPool, query } from '../server/db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env') })

const rows = await query('SELECT payload, version FROM site_config WHERE id = 1')
if (!rows.length) throw new Error('site_config missing')

const config = typeof rows[0].payload === 'string' ? JSON.parse(rows[0].payload) : rows[0].payload
if (!config.pages) config.pages = {}
if (!config.pages.home) config.pages.home = {}
const home = config.pages.home

home.talentCategories = [...DEFAULT_MCN_TALENT_CATEGORIES]
home.talentDefaultCategory = DEFAULT_MCN_TALENT_CATEGORIES[0]
home.talentItems = DEFAULT_MCN_TALENT_ITEMS.map((x) => structuredClone(x))
home.liveItems = DEFAULT_MCN_LIVE_ITEMS.map((x) => structuredClone(x))
home.caseItems = DEFAULT_MCN_CASE_ITEMS.map((x) => structuredClone(x))
ensureMcnHomeLists(config)

const version = Number(rows[0].version || 1) + 1
await query('UPDATE site_config SET payload = CAST(? AS JSON), version = ? WHERE id = 1', [
  JSON.stringify(config),
  version,
])

console.log('updated site_config version', version)
console.log('talentCategories', home.talentCategories)
console.log(
  'talentItems',
  home.talentItems.map((t) => ({
    id: t.id,
    cat: t.cat,
    summary: !!t.summary,
    body: !!t.body,
    gallery: t.gallery?.length,
  }))
)
console.log(
  'live empty gallery?',
  home.liveItems.some((x) => !x.gallery?.length)
)
console.log(
  'case empty gallery?',
  home.caseItems.some((x) => !x.gallery?.length)
)

await getPool().end()
