/**
 * Force-refresh MCN list demo data (talents / live / cases) into live API config.
 * node scripts/seed-mcn-lists.mjs
 * FORCE=1 node scripts/seed-mcn-lists.mjs   # overwrite even if already present
 */
import {
  DEFAULT_MCN_SERVICE_ITEMS,
  DEFAULT_MCN_TALENT_CATEGORIES,
  DEFAULT_MCN_TALENT_ITEMS,
  DEFAULT_MCN_LIVE_ITEMS,
  DEFAULT_MCN_CASE_ITEMS,
  DEFAULT_MCN_PROCESS_STEPS,
  ensureMcnHomeLists,
} from '../src/mcn/mcn-lists.js'

const token = process.env.ADMIN_TOKEN || 'guanzi-admin-local'
const base = process.env.API_BASE || 'http://127.0.0.1:8788'
const force = process.env.FORCE === '1' || process.argv.includes('--force')

const res = await fetch(`${base}/api/config`, { headers: { 'x-admin-token': token } })
if (!res.ok) throw new Error(`GET ${res.status}`)
const config = await res.json()
if (!config.pages) config.pages = {}
if (!config.pages.home) config.pages.home = {}
const home = config.pages.home

const cloneList = (seed) => seed.map((x) => structuredClone(x))

const fill = (key, seed, { always = false } = {}) => {
  if (always || !Array.isArray(home[key]) || !home[key].length) {
    home[key] = cloneList(seed)
    console.log(always ? 'overwrite' : 'seeded', key, home[key].length)
  } else {
    console.log('keep', key, home[key].length)
  }
}

fill('serviceItems', DEFAULT_MCN_SERVICE_ITEMS)
fill('talentCategories', DEFAULT_MCN_TALENT_CATEGORIES, { always: force })
fill('talentItems', DEFAULT_MCN_TALENT_ITEMS, { always: force })
fill('liveItems', DEFAULT_MCN_LIVE_ITEMS, { always: force })
fill('caseItems', DEFAULT_MCN_CASE_ITEMS, { always: force })
fill('processSteps', DEFAULT_MCN_PROCESS_STEPS)

if (!home.talentDefaultCategory || force) {
  home.talentDefaultCategory = home.talentCategories?.[0] || DEFAULT_MCN_TALENT_CATEGORIES[0]
}

ensureMcnHomeLists(config)

const put = await fetch(`${base}/api/config`, {
  method: 'PUT',
  headers: { 'x-admin-token': token, 'Content-Type': 'application/json' },
  body: JSON.stringify(config),
})
console.log('PUT', put.status)
console.log(
  'talents',
  home.talentItems.length,
  'cats',
  home.talentCategories,
  'sample',
  home.talentItems[0]?.summary?.slice(0, 24)
)
