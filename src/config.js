export const CONFIG_STORAGE_KEY = 'guanzi-bj-media-config-v2'
export const CONFIG_UPDATED_EVENT = 'guanzi-config-updated'

/** @type {{ version: number|null, assetBase: string, updatedAt: string|null, fromApi: boolean }} */
export const configMeta = {
  version: null,
  assetBase: '',
  updatedAt: null,
  fromApi: false,
}

export function stripConfigMeta(config) {
  if (!config || typeof config !== 'object') return config
  const { assetBase, version, updatedAt, ...rest } = config
  return rest
}

export function setAssetBase(base) {
  configMeta.assetBase = String(base || '').replace(/\/$/, '')
}

export function getAssetBase() {
  return configMeta.assetBase || ''
}

/** 拼静态资源 URL；配置里仍存相对路径，assetBase 空则原样返回 */
export function resolveAsset(path) {
  if (path == null || path === '') return path
  const s = String(path)
  if (/^(https?:|data:|blob:|\/\/)/i.test(s)) return s
  const base = getAssetBase()
  if (!base) return s
  return `${base}${s.startsWith('/') ? s : `/${s}`}`
}

/** 首页可单独显隐的内容区块（MCN 单页落地，与后台「首页」配置项对应） */
export const HOME_BLOCKS = [
  { id: 'hero', label: '首屏 Hero' },
  { id: 'services', label: '核心服务' },
  { id: 'talents', label: '达人资源' },
  { id: 'live', label: '直播案例' },
  { id: 'cases', label: '成功案例' },
  { id: 'data', label: '数据看板' },
  { id: 'process', label: '服务流程' },
  { id: 'creativeHero', label: '影像首屏 Creative Media' },
  { id: 'clients', label: '合作客户' },
  { id: 'team', label: '核心团队' },
  { id: 'about', label: '关于我们' },
  { id: 'contact', label: '合作咨询' },
]

/** 各页面可显隐 + 排序的模块定义（MCN 单页） */
export const PAGE_BLOCKS = {
  home: HOME_BLOCKS,
}

/** 缺省全部显示，兼容旧库配置 */
export function ensureHomeBlocks(config) {
  return ensurePageBlocks(config, 'home')
}

/** 通用：为指定页面初始化 blocks（显隐）与 blockOrder（排序），兼容旧配置 */
export function ensurePageBlocks(config, pageKey) {
  if (!config || typeof config !== 'object') return config
  if (!config.pages || typeof config.pages !== 'object') config.pages = {}
  if (!config.pages[pageKey] || typeof config.pages[pageKey] !== 'object') {
    config.pages[pageKey] = {}
  }
  const page = config.pages[pageKey]
  if (!page.blocks || typeof page.blocks !== 'object') page.blocks = {}
  const blocks = page.blocks
  const defs = PAGE_BLOCKS[pageKey] || []

  // 首页旧版拆分过 clients，合并进 who
  if (pageKey === 'home') {
    if (typeof blocks.who !== 'boolean' && typeof blocks.clients === 'boolean') {
      blocks.who = blocks.clients
    } else if (typeof blocks.who === 'boolean' && typeof blocks.clients === 'boolean') {
      blocks.who = blocks.who && blocks.clients
    }
    delete blocks.clients
  }

  defs.forEach(({ id }) => {
    if (typeof blocks[id] !== 'boolean') blocks[id] = true
  })

  // 初始化 / 修复排序：缺失项按默认 defs 相对位置插入；残缺过重则整表重置
  const defIds = defs.map(({ id }) => id)
  if (!Array.isArray(page.blockOrder)) {
    page.blockOrder = defIds.slice()
  } else {
    const known = new Set(defIds)
    const saved = page.blockOrder.filter((id) => known.has(id))
    if (!saved.length || saved.length < Math.ceil(defIds.length * 0.5)) {
      page.blockOrder = defIds.slice()
    } else {
      const present = new Set(saved)
      const next = [...saved]
      defIds.forEach((id, defIdx) => {
        if (present.has(id)) return
        let insertAt = next.length
        for (let j = defIdx - 1; j >= 0; j -= 1) {
          const idx = next.indexOf(defIds[j])
          if (idx >= 0) {
            insertAt = idx + 1
            break
          }
        }
        next.splice(insertAt, 0, id)
      })
      page.blockOrder = next
    }
  }

  return config
}

const PAGE_KEYS = {
  'page-home': 'home',
  'page-service': 'service',
  'page-about': 'about',
  'page-news': 'news',
  'page-news-detail': 'news-detail',
  'page-case': 'case',
  'page-case-detail': 'case-detail',
  'page-contact': 'contact',
  'page-live-detail': 'live-detail',
  'page-mcn-case-detail': 'mcn-case-detail',
  'page-talent-detail': 'talent-detail',
}

const CASE_VISIT_ICON = `<svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true"><circle cx="24" cy="24" r="23" fill="#111"/><path d="M18 24h12M24 18l6 6-6 6" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
const CASE_CHAT_ICON = `<svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true"><circle cx="24" cy="24" r="23" fill="#111"/><path d="M16 20.5c0-3.6 3.6-6.5 8-6.5s8 2.9 8 6.5-3.6 6.5-8 6.5c-.7 0-1.4-.1-2-.2L16 30v-9.5z" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg>`

export function slugifyCaseId(title, index = 0) {
  const base = String(title || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u4e00-\u9fff-]+/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return base || `case-${index + 1}`
}

export function getCaseId(item, index = 0) {
  if (!item) return `case-${index + 1}`
  if (item.id) return String(item.id)
  return slugifyCaseId(item.title, index)
}

export function caseDetailHref(item, index = 0) {
  if (item?.href && /^https?:\/\//i.test(item.href)) return item.href
  return `./case-detail.html?id=${encodeURIComponent(getCaseId(item, index))}`
}

export function findCaseItem(config, id) {
  const items = config?.pages?.case?.items
  if (!Array.isArray(items) || !items.length) return null
  if (id == null || id === '') return items[0]
  const byId = items.find((item, i) => getCaseId(item, i) === String(id))
  if (byId) return byId
  const idx = Number(id)
  if (Number.isInteger(idx) && idx >= 0 && idx < items.length) return items[idx]
  return null
}

export function getNewsId(item, index = 0) {
  if (!item) return `news-${index + 1}`
  if (item.id) return String(item.id)
  return slugifyCaseId(item.title, index) || `news-${index + 1}`
}

export function newsDetailHref(item, index = 0) {
  if (item?.href && /^https?:\/\//i.test(item.href)) return item.href
  return `./news-detail.html?id=${encodeURIComponent(getNewsId(item, index))}`
}

export function findNewsItem(config, id) {
  const items = config?.pages?.news?.items
  if (!Array.isArray(items) || !items.length) return null
  if (id == null || id === '') return items[0]
  const byId = items.find((item, i) => getNewsId(item, i) === String(id))
  if (byId) return byId
  const idx = Number(id)
  if (Number.isInteger(idx) && idx >= 0 && idx < items.length) return items[idx]
  return null
}

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
}

export function deepMerge(base, override) {
  if (Array.isArray(override)) return override.slice()
  if (!isObject(base) || !isObject(override)) return override === undefined ? base : override
  const out = { ...base }
  Object.keys(override).forEach((key) => {
    const b = base[key]
    const o = override[key]
    if (Array.isArray(o)) out[key] = o.slice()
    else if (isObject(o) && isObject(b)) out[key] = deepMerge(b, o)
    else out[key] = o
  })
  return out
}

export function getByPath(obj, path) {
  if (!path) return undefined
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj)
}

export function setByPath(obj, path, value) {
  const keys = path.split('.')
  let cur = obj
  keys.forEach((key, i) => {
    if (i === keys.length - 1) {
      cur[key] = value
      return
    }
    if (!isObject(cur[key])) cur[key] = {}
    cur = cur[key]
  })
  return obj
}

export function detectPageKey(doc = document) {
  const body = doc.body
  if (!body) return null
  for (const cls of Object.keys(PAGE_KEYS)) {
    if (body.classList.contains(cls)) return PAGE_KEYS[cls]
  }
  return null
}

export function isPreviewMode() {
  return new URLSearchParams(location.search).get('preview') === '1'
}

export function readLocalConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/** @deprecated 配置已改存 MySQL，仅用于清理旧缓存 */
export function writeLocalConfig(config) {
  window.dispatchEvent(new CustomEvent(CONFIG_UPDATED_EVENT, { detail: config }))
}

export function clearLocalConfig() {
  try {
    localStorage.removeItem(CONFIG_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

/** 仅供 db:migrate 种子；运行时不要用 */
export async function fetchDefaultConfig() {
  const candidates = ['/site-config.json', './site-config.json']
  for (const href of candidates) {
    try {
      const res = await fetch(href, { cache: 'no-store' })
      if (res.ok) return await res.json()
    } catch {
      /* try next */
    }
  }
  throw new Error('无法加载 site-config.json')
}

export async function fetchApiConfig() {
  const res = await fetch('/api/config', { cache: 'no-store' })
  if (!res.ok) {
    const err = new Error(`配置接口失败 (${res.status})`)
    err.status = res.status
    throw err
  }
  return res.json()
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

/** 启动竞态时 API 可能尚未就绪：短暂重试 */
async function fetchApiConfigWithRetry(retries = 8, gapMs = 300) {
  let lastErr
  for (let i = 0; i < retries; i += 1) {
    try {
      return await fetchApiConfig()
    } catch (err) {
      lastErr = err
      if (i < retries - 1) await sleep(gapMs)
    }
  }
  throw lastErr
}

function rememberMeta(raw) {
  if (!raw) {
    configMeta.fromApi = false
    return
  }
  configMeta.fromApi = true
  configMeta.version = raw.version ?? null
  configMeta.updatedAt = raw.updatedAt ?? null
  setAssetBase(raw.assetBase || '')
}

export async function saveRemoteConfig(config) {
  const body = {
    ...stripConfigMeta(config),
    version: configMeta.version,
    assetBase: getAssetBase(),
  }
  const headers = { 'Content-Type': 'application/json' }
  const token = import.meta.env.VITE_ADMIN_TOKEN
  if (token) headers['X-Admin-Token'] = token
  const res = await fetch('/api/config', {
    method: 'PUT',
    headers,
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.error || `保存失败 (${res.status})`)
    err.status = res.status
    err.data = data
    throw err
  }
  if (data.config) rememberMeta(data.config)
  return data
}

/** 运行时只从 MySQL（/api/config）加载 */
export async function loadSiteConfig() {
  try {
    const api = await fetchApiConfigWithRetry()
    rememberMeta(api)
    return stripConfigMeta(api)
  } catch (err) {
    configMeta.fromApi = false
    const msg =
      err?.message?.includes('Failed to fetch') || err?.name === 'TypeError'
        ? '无法连接配置 API，请先执行 npm run dev（需同时启动 API）'
        : err.message || '加载配置失败'
    const e = new Error(msg)
    e.cause = err
    throw e
  }
}

/** 编辑态：把历史 <br> 转成真实换行，方便在文本域里直接回车 */
export function brToNewlines(str) {
  return String(str ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
}

/** 展示态：换行显示为换行；保留已有 HTML（如链接） */
export function htmlWithNewlines(str) {
  return brToNewlines(str).replace(/\n/g, '<br />')
}

function setTextOrHtml(el, value) {
  if (value == null) return
  const str = String(value)
  if (el.hasAttribute('data-bind-html') || /<[a-z][\s\S]*>/i.test(str)) {
    el.innerHTML = /<[a-z][\s\S]*>/i.test(str) ? str : htmlWithNewlines(str)
  } else {
    el.textContent = brToNewlines(str)
  }
}

function sameMediaPath(a, b) {
  if (a == null || b == null) return false
  try {
    const ua = new URL(String(a), typeof location !== 'undefined' ? location.href : 'http://local')
    const ub = new URL(String(b), typeof location !== 'undefined' ? location.href : 'http://local')
    return ua.pathname === ub.pathname
  } catch {
    return String(a).replace(/[?#].*$/, '') === String(b).replace(/[?#].*$/, '')
  }
}

/** 图片标签：首屏 eager，其余 lazy + 提前解码 */
function imgHtml(src, { alt = '', eager = false, priority = false, width, height, className } = {}) {
  const parts = [
    `src="${escapeAttr(resolveAsset(src))}"`,
    `alt="${escapeAttr(alt)}"`,
    `loading="${eager || priority ? 'eager' : 'lazy'}"`,
    `decoding="async"`,
  ]
  if (priority) parts.push('fetchpriority="high"')
  if (width != null) parts.push(`width="${width}"`)
  if (height != null) parts.push(`height="${height}"`)
  if (className) parts.push(`class="${escapeAttr(className)}"`)
  return `<img ${parts.join(' ')} />`
}

function applyBinds(root, config) {
  root.querySelectorAll('[data-bind]').forEach((el) => {
    const path = el.getAttribute('data-bind')
    const value = getByPath(config, path)
    // null/undefined：保留 DOM 占位；空字符串：按配置清空（避免继续显示 HTML 默认素材）
    if (value == null) return
    const attr = el.getAttribute('data-bind-attr')
    if (attr) {
      const resolved =
        /^(src|href|poster)$/i.test(attr) || attr.startsWith('data-')
          ? resolveAsset(value)
          : String(value)
      if (attr === 'style' && String(value).includes('url(')) {
        el.setAttribute(attr, String(value))
      } else if (/^(src|href|poster)$/i.test(attr)) {
        if (!sameMediaPath(el.getAttribute(attr), resolved)) el.setAttribute(attr, String(resolved ?? ''))
      } else {
        el.setAttribute(attr, String(value))
      }
      return
    }
    if (el.tagName === 'IMG' || el.tagName === 'SOURCE' || el.tagName === 'VIDEO') {
      const src = resolveAsset(value)
      const reloadVideo = (video) => {
        if (!video || typeof video.load !== 'function') return
        video.load()
        video.muted = true
        video.defaultMuted = true
        video.setAttribute('muted', '')
        const play = () => video.play?.()?.catch(() => {})
        if (video.readyState >= 2) play()
        else video.addEventListener('loadeddata', play, { once: true })
      }
      if (el.tagName === 'VIDEO') {
        const source = el.querySelector('source')
        const prev = source?.getAttribute('src') || el.getAttribute('src')
        if (sameMediaPath(prev, src)) return
        if (source) source.setAttribute('src', String(src ?? ''))
        else el.setAttribute('src', String(src ?? ''))
        reloadVideo(el)
      } else if (el.tagName === 'SOURCE') {
        if (sameMediaPath(el.getAttribute('src'), src)) return
        el.setAttribute('src', String(src ?? ''))
        reloadVideo(el.closest('video'))
      } else {
        if (!sameMediaPath(el.getAttribute('src'), src)) el.setAttribute('src', String(src ?? ''))
      }
      return
    }
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      el.setAttribute('placeholder', String(value))
      return
    }
    if (el.hasAttribute('data-bind-html')) {
      el.innerHTML = htmlWithNewlines(value)
      return
    }
    setTextOrHtml(el, value)
  })

  root.querySelectorAll('[data-bind-html]').forEach((el) => {
    if (el.hasAttribute('data-bind')) return
    const path = el.getAttribute('data-bind-html')
    const value = getByPath(config, path)
    if (value == null) return
    const str = String(value)
    el.innerHTML = /<[a-z][\s\S]*>/i.test(str) ? str : htmlWithNewlines(str)
  })
}

function renderFooterOffices(container, offices) {
  if (!container || !Array.isArray(offices)) return
  container.innerHTML = offices
    .map(
      (o) => `
      <div class="addr reveal is-visible">
        <h3>${escapeHtml(o.title || '')}</h3>
        <p>${(o.lines || []).map(escapeHtml).join('<br />')}</p>
        <a class="em" href="mailto:${escapeAttr(o.email || '')}">${escapeHtml(o.email || '')}</a>
        <a class="tel" href="tel:${escapeAttr(o.tel || '')}">${escapeHtml(o.tel || '')}</a>
      </div>`
    )
    .join('')
}

function renderServicePhases(container, phases) {
  if (!container || !Array.isArray(phases)) return
  const groups = [[], [], []]
  phases.forEach((p, i) => {
    if (i < 2) groups[0].push(p)
    else if (i < 4) groups[1].push(p)
    else groups[2].push(p)
  })
  let delayStep = 0
  container.innerHTML = groups
    .map((group, gi) => {
      if (!group.length) return ''
      const cls = gi === 0 ? 'phases' : 'phases phases-02'
      return `<div class="${cls}">${group
        .map((p) => {
          delayStep += 1
          const delay = (0.1 * delayStep).toFixed(2)
          return `
        <div class="phase reveal-up" data-reveal-delay="${delay}">
          <div class="phase-title">${escapeHtml(p.title || '')}</div>
          <div class="phase-desc">${escapeHtml(p.desc || '')}</div>
        </div>`
        })
        .join('')}</div>`
    })
    .join('')
}

function renderServices(container, services) {
  if (!container || !Array.isArray(services)) return
  container.innerHTML = services
    .map(
      (s) => `
    <article class="service-block scroll-reveal">
      <div class="service-block-inner">
        <h3 class="service-title">${escapeHtml(s.title || '')}</h3>
        <ul class="tags">${(s.tags || []).map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>
      </div>
    </article>`
    )
    .join('')
}

function renderAboutStats(container, stats) {
  if (!container || !Array.isArray(stats)) return
  container.innerHTML = stats
    .map(
      (s) => `
    <div class="stat-item reveal is-visible">
      <div class="stat-num"><span data-count="${Number(s.count) || 0}">0</span>${escapeHtml(s.suffix || '')}</div>
      <div class="stat-des">${escapeHtml(s.desc || '')}</div>
    </div>`
    )
    .join('')
}

function renderAboutPassages(container, passages) {
  if (!container || !Array.isArray(passages)) return
  container.innerHTML = passages
    .map(
      (p) => `
    <article class="passage-item reveal is-visible">
      <h2>${escapeHtml(p.title || '')}</h2>
      <div class="passage-des">${(p.paragraphs || []).map((t) => `<p>${escapeHtml(t)}</p>`).join('')}</div>
    </article>`
    )
    .join('')
}

function renderAboutCircles(container, circles) {
  if (!container || !Array.isArray(circles)) return
  container.innerHTML = circles
    .map(
      (c) => `
    <div class="circle-item reveal is-visible">
      <div class="circle-ring"></div>
      <h3>${htmlWithNewlines(c.title || '')}</h3>
      <p>${escapeHtml(c.desc || '')}</p>
    </div>`
    )
    .join('')
}

function reviewCardHtml(r) {
  return `<blockquote class="review-item">
      <p>${escapeHtml(r.text || '')}</p>
      <cite>${escapeHtml(r.cite || '')}</cite>
    </blockquote>`
}

function clampReviewsScrollDuration(raw) {
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return 24
  return Math.min(90, Math.max(8, Math.round(n)))
}

function renderAboutReviews(container, reviews, durationSec) {
  if (!container) return
  const list = Array.isArray(reviews) ? reviews.filter((r) => r && (r.text || r.cite)) : []
  const duration = clampReviewsScrollDuration(durationSec)
  container.style.setProperty('--reviews-duration', `${duration}s`)
  const slider = container.closest('.review-slider')
  if (slider) slider.style.setProperty('--reviews-duration', `${duration}s`)

  if (!list.length) {
    container.innerHTML = ''
    container.classList.remove('is-scrolling')
    return
  }

  const stack = list.map(reviewCardHtml).join('')
  // 双份堆叠，CSS 平移 -50% 实现无缝向上循环
  container.classList.toggle('is-scrolling', list.length >= 1)
  container.innerHTML = `<div class="review-rail">
      <div class="review-stack">${stack}</div>
      <div class="review-stack" aria-hidden="true">${stack}</div>
    </div>`
}

/** 客户评价可组装到任意落地页，统一刷新列表 */
export function applyAboutReviewsWherever(config) {
  const about = config?.pages?.about
  const reviews = Array.isArray(about?.reviews) ? about.reviews : []
  const duration = about?.reviewsScrollDuration
  document.querySelectorAll('[data-list="pages.about.reviews"]').forEach((node) => {
    renderAboutReviews(node, reviews, duration)
  })
}

function renderAboutClientLogos(container, logos) {
  if (!container || !Array.isArray(logos)) return
  container.innerHTML = logos
    .map(
      (src) =>
        `<div class="logo-cell">${imgHtml(src, { eager: true })}</div>`
    )
    .join('')
}

const DEFAULT_ABOUT_INTRO_LEAD =
  '光子文化传媒总部位于北京，员工<span class="about-accent">400+</span>人，在深圳、广州、上海、南昌等地设有分支，拥有独家红人<span class="about-accent">1870+</span>，合作红人<span class="about-accent">10000+</span>，服务客户数量<span class="about-accent">2200+</span>。业务以抖音为核心，辐射小红书、快手、B站、微博等当下主流短视频平台，用优质的内容和新兴的渠道，盘活红人，链接用户，赋能品牌，打造全链路营销新模式。'

const DEFAULT_ABOUT_CERTIFICATES = [
  '/images/about/certs/cert-1.png',
  '/images/about/certs/cert-2.png',
  '/images/about/certs/cert-3.png',
  '/images/about/certs/cert-4.png',
  '/images/about/certs/cert-5.png',
]

/** 关于页：图1风格主区块默认文案与证书图 */
export function ensureAboutIntro(config) {
  if (!config || typeof config !== 'object') return config
  if (!config.pages || typeof config.pages !== 'object') config.pages = {}
  if (!config.pages.about || typeof config.pages.about !== 'object') config.pages.about = {}
  const about = config.pages.about
  if (!about.introTitle) about.introTitle = '关于我们'
  if (!about.introTitleEn) about.introTitleEn = 'ABOUT US.'
  if (!about.introLead) about.introLead = DEFAULT_ABOUT_INTRO_LEAD
  if (!about.introCaption) {
    about.introCaption =
      '抖音生活服务双认证星级服务商-到店零售三星&到店服务二星 | 巨量本地推综合代理商 | 巨量千川服务商证书'
  }
  const certs = Array.isArray(about.certificates) ? about.certificates.filter(Boolean) : []
  if (!certs.length) {
    // 兼容旧版单张「证书长图」
    if (about.certsImage) about.certificates = [about.certsImage]
    else about.certificates = [...DEFAULT_ABOUT_CERTIFICATES]
  }
  // 仍是默认长图时，切换为拆分多图
  if (
    about.certificates.length === 1 &&
    String(about.certificates[0]).includes('/images/about/certs-row.png')
  ) {
    about.certificates = [...DEFAULT_ABOUT_CERTIFICATES]
  }
  if (!about.introBg) about.introBg = '#121416'
  if (!about.introBg2) about.introBg2 = '#101214'
  if (!about.introGlow) about.introGlow = '#40c3dc'
  ensurePageBlocks(config, 'about')
  return config
}

const DEFAULT_ABOUT_PROFILE_STATS = [
  { value: '2,200+', label: '为数千家客户定制项目' },
  { value: '10+', label: '10+年内容与传播经验' },
  { value: '99%', label: '客户满意度' },
  { value: '400+', label: '专业团队规模' },
]

const DEFAULT_ABOUT_PROFILE_CARDS = [
  { title: '短视频内容', desc: '以抖音为核心，覆盖小红书、快手、B站等主流平台' },
  { title: '达人营销', desc: '盘活红人资源，精准链接用户与品牌' },
  { title: '直播电商', desc: '全链路直播操盘，提升转化与复购' },
  { title: '品牌全案', desc: '从内容到投放，打造可复制的增长模型' },
  { title: '本地生活', desc: '到店零售与到店服务双认证星级服务商能力' },
]

const DEFAULT_ABOUT_PROFILE_ABOUT_BODY =
  '<p>北京光子文化传媒有限公司是一家专注影视策划制作、广告创意、品牌形象与数字内容传播的文化传媒企业。多年来，我们持续为品牌客户提供高品质内容与渠道运营服务，赢得信赖与长期合作。</p><p>团队具备丰富的平台运营与创意制作背景，无论是内容创意与视觉呈现，还是投放策略与数据运营，都力求专业、高效、可落地，为客户创造可衡量的传播价值。</p>'

const DEFAULT_ABOUT_PROFILE_BRAND_BODY =
  '<p>我们先后服务众多知名品牌与连锁门店，覆盖餐饮、零售、家电、本地生活等行业，提供达人营销、短视频内容、直播电商与全案运营等互联网传播服务。</p><p>客户的满意是我们最大的动力。我们坚守高质量、高效率的服务承诺，持续用优质内容与新兴渠道赋能品牌，共同开创数字传播的新可能。</p>'

/**
 * 关于我们3 系列（经天 about 还原，拆成可组装组件）：
 * 首屏 / 数据条 / 公司介绍 / 能力卡片；评价复用 about-reviews
 */
export function ensureAboutProfile(config) {
  if (!config || typeof config !== 'object') return config
  if (!config.pages || typeof config.pages !== 'object') config.pages = {}
  if (!config.pages.about || typeof config.pages.about !== 'object') config.pages.about = {}
  const about = config.pages.about
  if (!about.profileHeroBg) about.profileHeroBg = '/images/about/kt-hero.jpg'
  if (!about.profileHello) about.profileHello = 'Hello Guanzi'
  if (!about.profileSince) about.profileSince = 'SINCE 2016'
  if (!about.profileAboutLabel) about.profileAboutLabel = 'ABOUT US'
  if (!about.profileForward) about.profileForward = 'KEEP MOVING FORWARD'
  // 兼容旧版单行 tagline
  if (!about.profileSince && about.profileTagline) {
    about.profileSince = 'SINCE 2016'
  }
  if (!about.profileAboutTitle) about.profileAboutTitle = '关于光子'
  if (!about.profileAboutBody) about.profileAboutBody = DEFAULT_ABOUT_PROFILE_ABOUT_BODY
  if (!about.profileBrandTitle) about.profileBrandTitle = '大品牌的认可'
  if (!about.profileBrandBody) about.profileBrandBody = DEFAULT_ABOUT_PROFILE_BRAND_BODY
  if (!Array.isArray(about.profileStats) || !about.profileStats.length) {
    about.profileStats = DEFAULT_ABOUT_PROFILE_STATS.map((s) => ({ ...s }))
  }
  if (!Array.isArray(about.profileCards) || !about.profileCards.length) {
    about.profileCards = DEFAULT_ABOUT_PROFILE_CARDS.map((c) => ({ ...c }))
  }
  // 旧单块 profile → 新拆分 blocks
  if (typeof about.blocks?.profile === 'boolean') {
    const on = about.blocks.profile
    ;['ktHero', 'ktStats', 'ktStory', 'ktCards'].forEach((id) => {
      if (typeof about.blocks[id] !== 'boolean') about.blocks[id] = on
    })
    delete about.blocks.profile
  }
  ensurePageBlocks(config, 'about')
  return config
}

function resolveAboutAsset(path) {
  const p = String(path || '').trim()
  if (!p) return ''
  if (/^https?:\/\//i.test(p) || p.startsWith('data:')) return p
  return p.startsWith('/') ? p : `/${p}`
}

function renderAboutProfileStats(container, stats) {
  if (!container) return
  const list = Array.isArray(stats) ? stats : []
  container.innerHTML = list
    .map(
      (s) => `<div class="about-kt-stat reveal">
        <strong>${escapeHtml(s.value || '')}</strong>
        <span>${escapeHtml(s.label || '')}</span>
      </div>`
    )
    .join('')
}

function renderAboutProfileCards(container, cards) {
  if (!container) return
  const list = Array.isArray(cards) ? cards : []
  container.innerHTML = list
    .map(
      (c) => `<article class="about-kt-card reveal">
        <h4>${escapeHtml(c.title || '')}</h4>
        <p>${escapeHtml(c.desc || '')}</p>
      </article>`
    )
    .join('')
}

function wireAboutKtHeroScroll(root) {
  root.querySelectorAll('[data-about-kt-scroll]').forEach((btn) => {
    if (btn.dataset.bound === '1') return
    btn.dataset.bound = '1'
    btn.addEventListener('click', () => {
      const section = btn.closest('.about-kt-hero')
      const next = section?.nextElementSibling
      ;(next || section?.parentElement?.nextElementSibling)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  })
}

/** 组件可能被组装到任意落地页，统一刷新 */
export function applyAboutProfileWherever(config) {
  ensureAboutProfile(config)
  const about = config.pages?.about
  const bg = resolveAboutAsset(about?.profileHeroBg || '/images/about/kt-hero.jpg')
  document.querySelectorAll('.about-kt-hero').forEach((el) => {
    el.style.setProperty('--about-kt-hero-bg', bg ? `url("${bg}")` : 'none')
  })
  document.querySelectorAll('[data-list="pages.about.profileStats"]').forEach((node) => {
    renderAboutProfileStats(node, about?.profileStats)
  })
  document.querySelectorAll('[data-list="pages.about.profileCards"]').forEach((node) => {
    renderAboutProfileCards(node, about?.profileCards)
  })
  document.querySelectorAll('.about-kt-hero').forEach((root) => wireAboutKtHeroScroll(root))
}

const DEFAULT_ABOUT_TEAM_MEMBERS = [
  {
    name: '孙兆峰',
    role: '深圳未来达人传媒有限公司CEO',
    photo: '/images/about/team/sun-zhaofeng.png',
    bio: [
      '原字节跳动深圳区域SMB电商负责人',
      '原字节本地生活深莞综合KA负责人',
      '原字节初期商家运营整合营销休闲娱乐全国负责人',
      '原字节深圳餐饮CKA业务LD',
    ],
  },
  {
    name: '李丰屹',
    role: '未来达人联合创始人',
    photo: '/images/about/team/li-fengyi.png',
    bio: [
      '原黑马会长长沙分会负责人',
      '联合创始人',
      '拥有多年商业策划营销和公关传媒行业经验与资源',
      '在快手、抖音、腾讯等多个销售型直播平台均有实效成绩',
    ],
  },
  {
    name: '潘涌',
    role: '商务负责人',
    photo: '/images/about/team/pan-yong.png',
    bio: [
      '原字节跳动深圳区域SMB商业化LD',
      '原字节跳动商业化平台讲师',
      '2024至2025年度生活服务板块创收超8000W+',
      '带领团队深度合作客户涵盖：麦当劳、美的、方太、京东、屈臣氏、以纯、中国石化等',
    ],
  },
  {
    name: '梁浩东',
    role: '中后端运营负责人',
    photo: '/images/about/team/liang-haodong.png',
    bio: [
      '探鱼小顺指抖生活服务全域运营及职人生态体系构建',
      '23-24年度实现GMV超2亿+，奠定抖音汽车服务行业TOP1品牌',
      '屈臣氏全案代运营，团队单月认领门店超5K，综合提升整体门店后台运营指标',
      '博士眼镜全案代运营KOC播量',
      '名创优品KOC业务/门店管理代运营',
    ],
  },
  {
    name: '陈泽霖(Kevin)',
    role: '大客户服务运营负责人',
    photo: '/images/about/team/chen-zelin.png',
    bio: [
      '从事互联网行业7年',
      '抖音生活服务全案运营操盘手，拥有4年深度操盘经验',
      '原字节SKA品牌运营，从0-1推动平台业务发展',
      '抖音直播/短视频千万项目实战专家',
      '精通货盘策略定制及营销工具玩法',
    ],
  },
  {
    name: '冯敏婷(Mandy)',
    role: '内容运营负责人',
    photo: '/images/about/team/feng-minting.png',
    bio: [
      '深耕内容赛道，擅长品牌内容策略、内容营销创意、资源统筹及项目把控',
      '熟悉新媒体专业运作，公关全线传播，包括从策略、创意到落地全线传播路径',
      '具备多品牌及IP 0-1账号孵化运营经验',
      '服务客户包括康佳、腾讯商保、遇见小面、探鱼、麦当劳、屈臣氏等',
    ],
  },
  {
    name: '嵇振堃',
    role: '直播运营负责人',
    photo: '/images/about/team/ji-zhenkun.png',
    bio: [
      '多类本地直播平台操盘经验',
      '多行业直播运营操盘手',
      '本地生活明星联名品宣专场执行',
      '千万级直播间案例打造',
      '超头部达人本地直播单场百万级产出',
    ],
  },
  {
    name: '冯婉萍',
    role: '企业/职人培训负责人',
    photo: '/images/about/team/feng-wanping.png',
    bio: [
      '深耕本地生活赛道，为短视频与直播领域资深授权讲师',
      '拥有超1000场短视频直播培训实战经验，课程覆盖广泛',
      '承接京东养车、美的等知名企业本地生活职人孵化项目',
      '合作企业5000+，遍布全国，输出定制化人才培训体系',
      '单月营业额从“0-100W”助跑生活服务商家超100家',
    ],
  },
]

/** 关于页：核心团队架构 */
export function ensureAboutTeam(config) {
  if (!config || typeof config !== 'object') return config
  if (!config.pages || typeof config.pages !== 'object') config.pages = {}
  if (!config.pages.about || typeof config.pages.about !== 'object') config.pages.about = {}
  const about = config.pages.about
  if (!about.teamTitle) about.teamTitle = '核心团队架构'
  if (!about.teamTitleEn) about.teamTitleEn = 'CORE TEAM STRUCTURE.'
  if (!Array.isArray(about.teamMembers) || !about.teamMembers.length) {
    about.teamMembers = DEFAULT_ABOUT_TEAM_MEMBERS.map((m) => ({
      ...m,
      bio: [...m.bio],
    }))
  } else {
    about.teamMembers = about.teamMembers.map((m) => {
      const bio = Array.isArray(m?.bio)
        ? m.bio.map((line) => String(line || '').trim()).filter(Boolean)
        : String(m?.bio || '')
            .split(/\n|；|;/)
            .map((s) => s.trim())
            .filter(Boolean)
      return {
        name: m?.name || '',
        role: m?.role || '',
        photo: m?.photo || '',
        bio,
      }
    })
  }
  ensurePageBlocks(config, 'about')
  return config
}

function renderAboutTeamMembers(container, members) {
  if (!container) return
  const list = Array.isArray(members) ? members : []
  if (!list.length) {
    container.innerHTML = ''
    return
  }
  container.innerHTML = list
    .map((m) => {
      const name = escapeHtml(m.name || '')
      const role = escapeHtml(m.role || '')
      const photo = m.photo
        ? imgHtml(m.photo, { alt: m.name || '团队成员', eager: true })
        : `<span class="about-team-avatar-fallback">${escapeHtml((m.name || '?').slice(0, 1))}</span>`
      const bio = (Array.isArray(m.bio) ? m.bio : [])
        .map((line) => `<li>${escapeHtml(line)}</li>`)
        .join('')
      return `<article class="about-team-card">
        <figure class="about-team-avatar">${photo}</figure>
        <h3 class="about-team-name">${name}</h3>
        <p class="about-team-role">${role}</p>
        ${bio ? `<ul class="about-team-bio">${bio}</ul>` : ''}
      </article>`
    })
    .join('')
}

function applyAboutTeamWherever(config) {
  ensureAboutTeam(config)
  const about = config?.pages?.about
  document.querySelectorAll('[data-list="pages.about.teamMembers"]').forEach((node) => {
    renderAboutTeamMembers(node, about?.teamMembers)
  })
}

function applyAboutIntroTheme(about) {
  const section = document.querySelector('.about-story')
  if (!section || !about) return
  const bg = String(about.introBg || '#121416').trim()
  const bg2 = String(about.introBg2 || about.introBg || '#101214').trim()
  const glow = String(about.introGlow || '#40c3dc').trim()
  section.style.setProperty('--about-bg', bg)
  section.style.setProperty('--about-bg-2', bg2)
  section.style.setProperty('--about-glow', glow)
  section.style.setProperty('--about-accent', glow)
  const page = document.querySelector('.page-about')
  const warp = document.querySelector('.warp-about')
  if (page) page.style.background = bg2
  if (warp) warp.style.background = bg2
}

function renderAboutCertificates(container, images) {
  if (!container) return
  const list = (Array.isArray(images) ? images : []).filter(Boolean)
  if (!list.length) {
    container.innerHTML = ''
    return
  }
  container.innerHTML = list
    .map((src, i) => {
      const wide = list.length >= 4 ? i < 2 : false
      return `<figure class="about-story-cert${wide ? ' is-wide' : ''}">${imgHtml(src, {
        alt: `荣誉证书 ${i + 1}`,
        eager: true,
        className: 'about-story-cert-img',
      })}</figure>`
    })
    .join('')
}

/** 任意页面只要挂了证书列表容器就渲染（含菜单拼装） */
function applyAboutCertificatesWherever(config) {
  const about = config?.pages?.about
  const nodes = document.querySelectorAll('[data-list="pages.about.certificates"]')
  if (!nodes.length) return
  const list = Array.isArray(about?.certificates) ? about.certificates : []
  nodes.forEach((el) => renderAboutCertificates(el, list))
}

function renderNewsMenu(container, categories, defaultCategory) {
  if (!container || !Array.isArray(categories)) return
  const cats = [{ id: 'all', label: 'All' }, ...categories.map((c) => ({ id: c, label: c }))]
  container.innerHTML = cats
    .map((c) => {
      const active = c.id === defaultCategory
      return `<li class="${active ? 'is-active-item' : ''}">
        <button type="button" class="news-tab${active ? ' is-active' : ''}" data-cat="${escapeAttr(c.id)}" role="tab" aria-selected="${active}">
          <span class="news-tab-text">${escapeHtml(c.label)}</span>
        </button>
      </li>`
    })
    .join('')
}

function renderNewsGrid(container, items) {
  if (!container || !Array.isArray(items)) return
  container.innerHTML = items
    .map((item, index) => {
      const href = newsDetailHref(item, index)
      return `
    <article class="news-card reveal is-visible" data-cat="${escapeAttr(item.cat || '')}" data-news-id="${escapeAttr(getNewsId(item, index))}">
      <a href="${escapeAttr(href)}" class="news-card-link" target="_blank" rel="noopener noreferrer">
        <div class="news-card-img">
          <img src="${escapeAttr(resolveAsset(item.image || ''))}" alt="${escapeAttr(item.title || '')}" loading="${index < 6 ? 'eager' : 'lazy'}" decoding="async" />
        </div>
        <div class="news-card-meta">
          <time datetime="${escapeAttr((item.date || '').replace(/\./g, '-'))}">${escapeHtml(item.date || '')}</time>
          <span class="news-card-cat">${escapeHtml(item.cat || '')}</span>
        </div>
        <h2 class="news-card-title">${escapeHtml(item.title || '')}</h2>
      </a>
    </article>`
    })
    .join('')
}

function applyNewsDetail(config) {
  const params = new URLSearchParams(location.search)
  const id = params.get('id')
  const item = findNewsItem(config, id)
  const titleEl = document.getElementById('newsDetailTitle')
  if (!titleEl) return

  if (!item) {
    document.title = '新闻未找到-光子文化传媒 GUANZI'
    titleEl.textContent = '未找到该新闻'
    const post = document.getElementById('newsDetailPost')
    if (post) post.innerHTML = '<p>请返回新闻列表重新选择。</p>'
    return
  }

  const title = item.title || '新闻详情'
  const cat = item.cat || ''
  const date = item.date || ''
  const content =
    item.content ||
    item.summary ||
    `${title}。\n\n光子文化传媒持续关注品牌内容、影视制作与传播趋势，结合项目实践输出可落地的观点与经验。欢迎通过在线咨询与我们交流合作。`
  const cover = resolveAsset(item.cover || item.image || '')

  document.title = `${title}-${cat || '新闻资讯'}-光子文化传媒 GUANZI`
  const meta = document.querySelector('meta[name="description"]')
  if (meta) meta.setAttribute('content', String(content).replace(/\n/g, ' ').replace(/<[^>]+>/g, '').slice(0, 120))

  titleEl.textContent = title
  const setText = (elId, text) => {
    const el = document.getElementById(elId)
    if (el) el.textContent = text
  }
  setText('newsDetailDate', date)
  setText('newsDetailCat', cat)
  setText('newsDetailCrumbCat', cat || '新闻资讯')
  setText('newsDetailCrumbTitle', title)

  const coverEl = document.getElementById('newsDetailCover')
  if (coverEl) {
    if (cover) {
      coverEl.hidden = false
      coverEl.innerHTML = imgHtml(cover, { alt: title, eager: true, priority: true })
    } else {
      coverEl.hidden = true
      coverEl.innerHTML = ''
    }
  }

  const postEl = document.getElementById('newsDetailPost')
  if (postEl) {
    const html = String(content).includes('<') ? content : htmlWithNewlines(content)
    postEl.innerHTML = html.startsWith('<') ? html : `<p>${html}</p>`
  }

  const items = config?.pages?.news?.items || []
  const currentId = getNewsId(item, items.indexOf(item))
  const others = items.filter((n, i) => getNewsId(n, i) !== currentId).slice(0, 8)
  const othersSec = document.getElementById('newsDetailOthers')
  const othersGrid = document.getElementById('newsDetailOthersGrid')
  if (othersSec && othersGrid) {
    if (!others.length) {
      othersSec.hidden = true
      return
    }
    othersSec.hidden = false
    othersGrid.innerHTML = others
      .map((n, i) => {
        const href = newsDetailHref(n, items.indexOf(n) >= 0 ? items.indexOf(n) : i)
        return `<article class="news-detail-other-card">
          <a href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer">
            <div class="pic">${imgHtml(n.image || '', { alt: n.title || '', eager: i < 3 })}</div>
            <div class="meta"><span>${escapeHtml(n.date || '')}</span><span class="cat">${escapeHtml(n.cat || '')}</span></div>
            <h3>${escapeHtml(n.title || '')}</h3>
          </a>
        </article>`
      })
      .join('')
  }
}

function resolveCaseDefaultCategory(categories, _defaultCategory) {
  const cats = Array.isArray(categories) ? categories.map((c) => String(c || '').trim()).filter(Boolean) : []
  // 始终默认选中分类排序第一项
  return cats[0] || ''
}

function renderCaseTabs(container, categories, defaultCategory) {
  if (!container || !Array.isArray(categories)) return
  const activeCat = resolveCaseDefaultCategory(categories, defaultCategory)
  container.innerHTML = categories
    .map((c) => {
      const label = String(c || '').trim()
      if (!label) return ''
      const active = label === activeCat
      return `<button type="button" class="case-tab${active ? ' is-active' : ''}" data-cat="${escapeAttr(label)}" role="tab" aria-selected="${active}">${escapeHtml(label)}</button>`
    })
    .join('')
}

function renderCaseGrid(container, items) {
  if (!container || !Array.isArray(items)) return
  container.innerHTML = items
    .map((item, index) => {
      const href = caseDetailHref(item, index)
      return `
    <article class="case-card reveal is-visible" data-cat="${escapeAttr(item.cat || '')}" data-case-id="${escapeAttr(getCaseId(item, index))}">
      <div class="case-card-box">
        <a href="${escapeAttr(href)}" class="case-card-media" target="_blank" rel="noopener noreferrer">
          ${imgHtml(item.image || '', {
            alt: item.title || '',
            eager: index < 6,
            width: 570,
            height: 410,
          })}
          <div class="case-caption">
            <span class="case-caption-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="36" height="36"><rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="8.5" cy="10" r="1.4" fill="currentColor"/><path d="M5 17l4.5-4.5L13 16l2.5-2.5L19 17" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>
            </span>
            <ul class="case-caption-tag"><li>Case</li></ul>
            <p class="case-caption-title">${escapeHtml(item.title || '')}</p>
            <div class="case-caption-line"></div>
            <p class="case-caption-desc">${escapeHtml(item.tags || '')}</p>
            <span class="case-caption-plus" aria-hidden="true">+</span>
          </div>
        </a>
        <div class="case-card-meta">
          <h3><a href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title || '')}</a></h3>
          <p>${escapeHtml(item.tags || '')}</p>
        </div>
      </div>
    </article>`
    })
    .join('')
}

function caseActionButtons(item, { withLabels = false } = {}) {
  const siteUrl = item?.siteUrl || ''
  const title = item?.title || '案例'
  const visit = siteUrl
    ? `<a href="${escapeAttr(siteUrl)}" target="_blank" rel="noopener noreferrer" title="${escapeAttr(title)}">${CASE_VISIT_ICON}${withLabels ? '<span class="sp">浏览网站</span>' : ''}</a>`
    : ''
  const consult = `<a href="./contact.html#feedback" class="QQ" title="在线咨询">${CASE_CHAT_ICON}${withLabels ? '<span class="sp">项目咨询</span>' : ''}</a>`
  return `${visit}${consult}`
}

function applyCaseDetail(config) {
  const params = new URLSearchParams(location.search)
  const id = params.get('id')
  const item = findCaseItem(config, id)
  const empty = document.getElementById('caseDetailTitle')
  if (!empty) return

  if (!item) {
    document.title = '案例未找到-光子文化传媒 GUANZI'
    empty.textContent = '未找到该案例'
    const summary = document.getElementById('caseDetailSummary')
    if (summary) summary.textContent = '请返回案例列表重新选择。'
    return
  }

  const title = item.title || '案例详情'
  const tags = item.tags || item.cat || ''
  const bannerSrc = resolveAsset(item.banner || item.image || '')
  const summary = item.summary || item.desc || `${title}是光子文化传媒为客户打造的品牌与内容传播项目，覆盖策略、视觉与落地执行。`
  const gallery = (Array.isArray(item.gallery) && item.gallery.length ? item.gallery : item.image ? [item.image] : []).map(
    (src) => resolveAsset(src)
  )

  document.title = `${title}-项目案例-光子文化传媒 GUANZI`
  const meta = document.querySelector('meta[name="description"]')
  if (meta) meta.setAttribute('content', String(summary).replace(/\n/g, ' ').slice(0, 120))

  const banner = document.getElementById('caseDetailBanner')
  const bannerImg = document.getElementById('caseDetailBannerImg')
  if (bannerImg) {
    if (bannerSrc) {
      bannerImg.src = bannerSrc
      bannerImg.alt = title
      bannerImg.hidden = false
    } else {
      bannerImg.removeAttribute('src')
      bannerImg.alt = ''
      bannerImg.hidden = true
    }
  }
  // 兼容旧逻辑：无 img 时回退到背景图
  if (banner && bannerSrc && !bannerImg) banner.style.backgroundImage = `url('${bannerSrc}')`
  else if (banner) banner.style.removeProperty('background-image')

  const setText = (elId, text) => {
    const el = document.getElementById(elId)
    if (el) el.textContent = text
  }
  setText('caseDetailBannerTitle', title)
  setText('caseDetailBannerTags', tags)
  setText('caseDetailTitle', title)

  const summaryEl = document.getElementById('caseDetailSummary')
  if (summaryEl) {
    summaryEl.innerHTML = /<[a-z][\s\S]*>/i.test(String(summary))
      ? String(summary)
      : htmlWithNewlines(summary)
  }

  const galleryEl = document.getElementById('caseDetailGallery')
  if (galleryEl) {
    galleryEl.innerHTML = gallery
      .map((src, i) => `<p>${imgHtml(src, { alt: title, eager: i < 2 })}</p>`)
      .join('')
  }

  const topBtn = document.getElementById('caseDetailBtnTop')
  const bottomBtn = document.getElementById('caseDetailBtnBottom')
  if (topBtn) topBtn.innerHTML = caseActionButtons(item, { withLabels: false })
  if (bottomBtn) bottomBtn.innerHTML = caseActionButtons(item, { withLabels: true })
}

function renderContactOffices(container, offices) {
  if (!container || !Array.isArray(offices)) return
  const scroll = container.querySelector('.contact-scroll')
  const scrollHtml = scroll
    ? scroll.outerHTML
    : `<a class="contact-scroll" href="#feedback"><span>Scroll down</span></a>`
  container.innerHTML =
    `<div class="contact-offices">${offices
      .map(
        (o) => `
    <div class="contact-office reveal is-visible">
      <h2>${escapeHtml(o.city || '')}</h2>
      <a class="contact-tel" href="tel:${escapeAttr(o.tel || '')}">${escapeHtml(o.tel || '')}</a>
      <p class="contact-addr">${escapeHtml(o.addr || '')}</p>
      <a class="contact-email" href="mailto:${escapeAttr(o.email || '')}">${escapeHtml(o.email || '')}</a>
      <p class="contact-hours">${escapeHtml(o.hours || '')}</p>
    </div>`
      )
      .join('')}</div>${scrollHtml}`
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/'/g, '&#39;')
}

function renderGnavi(container, items) {
  if (!container || !Array.isArray(items)) return
  container.innerHTML = items
    .map((item) => {
      const title = item.title || ''
      const en = item.en || ''
      const href = item.href || '#'
      return `<li>
            <a href="${escapeAttr(href)}" class="gnavi-link">
              <span class="ja"><span class="ja1">${escapeHtml(title)}</span><span class="ja2">${escapeHtml(title)}</span></span>
              <span class="en">${escapeHtml(en)}</span>
            </a>
          </li>`
    })
    .join('')
}

function applyGlobal(config) {
  const g = config.global || {}
  document.querySelectorAll('.logo-en').forEach((el) => {
    if (g.brandName) el.textContent = g.brandName
  })
  document.querySelectorAll('.logo-zh').forEach((el) => {
    if (g.brandSub) el.textContent = g.brandSub
  })
  document.querySelectorAll('.logo a').forEach((a) => {
    if (g.brandName || g.brandSub) {
      a.setAttribute('aria-label', `${g.brandName || ''} ${g.brandSub || ''}`.trim())
    }
  })

  applyHeaderNav(g)

  const menuList = document.querySelector('.gnavi[data-list="global.menu"], [data-list="global.menu"].gnavi, ul.gnavi')
  if (menuList && Array.isArray(g.menu)) {
    menuList.setAttribute('data-list', 'global.menu')
    renderGnavi(menuList, g.menu)
  }

  document.querySelectorAll('[data-bind="global.footer.title"]').forEach((el) => {
    const span = el.querySelector('span') || el
    span.textContent = g.footer?.title || span.textContent
  })

  const footerOffices = document.querySelector('[data-list="global.footer.offices"]')
  if (footerOffices) renderFooterOffices(footerOffices, g.footer?.offices)

  const beian = document.querySelector('[data-bind="global.footer.beian"]')
  if (beian && g.footer?.beian) beian.textContent = g.footer.beian

  const brand = document.querySelector('[data-bind="global.footer.brand"]')
  if (brand && g.footer?.brand) brand.textContent = g.footer.brand

  const copy = document.querySelector('[data-bind="global.footer.copyright"]')
  if (copy && g.footer?.copyright) copy.textContent = g.footer.copyright

  const lead = document.querySelector('[data-bind-html="global.footer.lead"]')
  if (lead && g.footer?.lead) lead.innerHTML = htmlWithNewlines(g.footer.lead)
}

/** 顶栏链接：由 menus 中 visible + showInNav 驱动（左 .nav / 右 .top-right） */
function applyHeaderNav(g) {
  const navUl = document.querySelector('.header .nav ul, header.header .nav ul')
  const topRight = document.querySelector('.header .top-right, header.header .top-right')
  if (!navUl && !topRight) return

  const menus = Array.isArray(g.menus) ? g.menus : []
  const items = menus
    .filter((m) => m && m.visible !== false && m.showInNav)
    .slice()
    .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0) || String(a.id).localeCompare(String(b.id)))

  const left = items.filter((m) => !m.navAside)
  const right = items.filter((m) => m.navAside)

  const hrefOf = (m) => {
    const h = String(m.href || '#').trim() || '#'
    if (h.startsWith('http') || h.startsWith('tel:') || h.startsWith('mailto:') || h.startsWith('#')) return h
    return h.startsWith('/') ? h : `/${h}`
  }

  if (navUl) {
    navUl.innerHTML = left
      .map(
        (m) =>
          `<li><a href="${escapeAttr(hrefOf(m))}">${escapeHtml(m.label || m.id)}</a></li>`
      )
      .join('')
  }
  if (topRight) {
    topRight.innerHTML = right
      .map(
        (m) =>
          `<a href="${escapeAttr(hrefOf(m))}" class="link1">${escapeHtml(m.label || m.id)}</a>`
      )
      .join('')
  }
}

function renderMarquees(container, rows) {
  if (!container) return
  const list = Array.isArray(rows) ? rows.slice(0, 3) : []
  while (list.length < 3) {
    list.push({
      type: 'text',
      text: 'Film Production. Brand Content. Event Experience.',
      logos: [],
      direction: list.length === 1 ? 'right' : 'left',
      style: list.length === 1 ? 'hollow' : 'solid',
      scrolling: true,
      speed: list.length === 1 ? 56 : list.length === 2 ? 40 : 48,
      fontSize: 0,
    })
  }

  container.innerHTML = list
    .map((row, index) => {
      const dir = row.direction === 'right' ? 'right' : 'left'
      const hollow = row.style === 'hollow' ? ' is-hollow' : ''
      const type = row.type === 'logo' ? 'logo' : 'text'
      const scrolling = row.scrolling !== false
      const speedRaw = Number(row.speed)
      const speed = Number.isFinite(speedRaw) ? Math.min(120, Math.max(8, speedRaw)) : index === 1 ? 56 : index === 2 ? 40 : 48
      const fontRaw = Number(row.fontSize)
      const fontSize = Number.isFinite(fontRaw) && fontRaw > 0 ? Math.min(200, Math.max(24, Math.round(fontRaw))) : 0
      let segment = ''
      if (type === 'logo') {
        const logos = Array.isArray(row.logos) && row.logos.length ? row.logos : ['/images/brands/clients/logo1.jpg']
        segment = logos
          .map(
            (src) =>
              `<span class="marquee-logo-hex">${imgHtml(src, { className: 'marquee-logo', eager: true })}</span>`
          )
          .join('')
      } else {
        const text = row.text || 'Film Production.'
        segment = `<span class="marquee-text">${escapeHtml(text)}</span>`
      }
      // duplicate for seamless loop
      const copies = type === 'logo' ? 4 : 2
      const track = Array.from({ length: copies }, () => segment).join('')
      const styleParts = [`--marquee-duration:${speed}s`]
      if (type === 'text' && fontSize > 0) styleParts.push(`--marquee-font-size:${fontSize}px`)
      return `<div class="marquee-row row-${index + 1}${hollow}${scrolling ? '' : ' is-paused'}" data-dir="${dir}" data-type="${type}" data-scrolling="${scrolling ? 'on' : 'off'}" style="${styleParts.join(';')}">
        <div class="marquee-track">${track}</div>
      </div>`
    })
    .join('')
}

function renderHomeRoll(container, names) {
  if (!container || !Array.isArray(names) || !names.length) return
  const list = [...names, ...names]
  container.innerHTML = list.map((n) => `<p>${escapeHtml(n)}</p>`).join('')
}

/** 关于我们左侧：客户滚动 / 图片填充 */
export function applyHomeWhoLeftMode(config) {
  const mode = config?.pages?.home?.whoLeftMode === 'image' ? 'image' : 'rolls'
  document.querySelectorAll('.home-who-grid').forEach((grid) => {
    grid.classList.toggle('is-left-image', mode === 'image')
    grid.classList.toggle('is-left-rolls', mode !== 'image')
  })
}

/** 首页客户滚动列：滚动开关 / 速度 */
export function applyHomeClientRollMode(config) {
  const settings = ensureClientRollSettingsData(config?.pages?.home)
  ;['a', 'b'].forEach((key) => {
    document.querySelectorAll(`.home-roll[data-roll-col="${key}"]`).forEach((el) => {
      const opt = settings[key]
      const scrolling = opt.scrolling !== false
      const speedRaw = Number(opt.speed)
      const speed = Number.isFinite(speedRaw) ? Math.min(60, Math.max(6, speedRaw)) : 18
      el.classList.toggle('is-paused', !scrolling)
      el.setAttribute('data-scrolling', scrolling ? 'on' : 'off')
      el.style.setProperty('--home-roll-duration', `${speed}s`)
    })
  })
}

function ensureClientRollSettingsData(home) {
  if (!home || typeof home !== 'object') return { a: { scrolling: true, speed: 18 }, b: { scrolling: true, speed: 18 } }
  if (!home.clientRollSettings || typeof home.clientRollSettings !== 'object') {
    home.clientRollSettings = {}
  }
  ;['a', 'b'].forEach((key) => {
    const cur = home.clientRollSettings[key]
    if (!cur || typeof cur !== 'object') {
      home.clientRollSettings[key] = { scrolling: true, speed: 18 }
      return
    }
    if (typeof cur.scrolling !== 'boolean') cur.scrolling = true
    const speed = Number(cur.speed)
    cur.speed = Number.isFinite(speed) ? Math.min(60, Math.max(6, speed)) : 18
  })
  return home.clientRollSettings
}

export function ensureClientRollSettings(config) {
  if (!config || typeof config !== 'object') return { a: { scrolling: true, speed: 18 }, b: { scrolling: true, speed: 18 } }
  if (!config.pages || typeof config.pages !== 'object') config.pages = {}
  if (!config.pages.home || typeof config.pages.home !== 'object') config.pages.home = {}
  return ensureClientRollSettingsData(config.pages.home)
}

function renderHomeLogos(container, logos) {
  if (!container || !Array.isArray(logos)) return
  const figs = logos
    .map(
      (src) => `<figure class="c-image">${imgHtml(src, { width: 225, height: 76, eager: true })}</figure>`
    )
    .join('')
  container.innerHTML = `${figs}<a href="/case.html" class="home-logo-more">查看更多客户</a>`
}

function renderHomeWhatItems(container, items) {
  if (!container || !Array.isArray(items)) return
  container.innerHTML = items
    .map((item, i) => {
      const iconId = item.icon || DEFAULT_WHAT_ICON_IDS[i % DEFAULT_WHAT_ICON_IDS.length]
      const iconSvg = resolveWhatIconSvg(iconId, i)
      return `<article class="home-how-card" style="--stack-top:${30 + i * 2}%">
        <div class="home-how-card-icon">${iconSvg}</div>
        <h3>${escapeHtml(item.title || '')}</h3>
        <p>${escapeHtml(item.desc || '')}</p>
      </article>`
    })
    .join('')
}

/** 为缺少 icon 的能力卡片补默认图标（按序号对齐旧版硬编码） */
export function ensureHomeWhatItems(config) {
  if (!config?.pages?.home) return false
  const list = config.pages.home.whatItems
  if (!Array.isArray(list) || !list.length) return false
  let changed = false
  list.forEach((item, i) => {
    if (!item || typeof item !== 'object') return
    if (!item.icon) {
      item.icon = DEFAULT_WHAT_ICON_IDS[i % DEFAULT_WHAT_ICON_IDS.length]
      changed = true
    }
  })
  return changed
}

/** 能力卡片：动画叠卡 / 静态列表 / 收缩列表 */
export function applyHomeWhatCardsMode(config) {
  const animate = config?.pages?.home?.whatAnimate !== false
  const collapse = config?.pages?.home?.whatCollapse === true && !animate
  document.querySelectorAll('.home-how-stack').forEach((stack) => {
    stack.classList.toggle('is-no-animate', !animate)
    stack.classList.toggle('is-collapsed', collapse)
  })
  document.querySelectorAll('#sectionWhat, [data-home-block="what"], [data-compose-unit="home-what"]').forEach((section) => {
    section.classList.toggle('is-what-static', !animate)
  })
}

function renderHomeCases(container, items) {
  if (!container || !Array.isArray(items)) return
  container.innerHTML = items
    .map((item, i) => {
      const href = item.caseId
        ? `./case-detail.html?id=${encodeURIComponent(item.caseId)}`
        : item.href && String(item.href).includes('case-detail')
          ? item.href
          : item.href || './case.html'
      const blank = String(href).includes('case-detail')
      return `<article class="home-case-card${i === items.length - 1 ? ' is-final' : ''}">
        <a class="home-case-link" href="${escapeAttr(href)}"${blank ? ' target="_blank" rel="noopener noreferrer"' : ''}>
          <div class="home-case-media">
            ${imgHtml(item.image || '', { alt: item.title || '', eager: i < 4 })}
          </div>
          <div class="home-case-caption"><h3>${escapeHtml(item.title || '')}</h3></div>
        </a>
      </article>`
    })
    .join('')
}

function renderHomeOverseas(container, items) {
  if (!container || !Array.isArray(items)) return
  container.innerHTML = items
    .map(
      (item, i) => `<li>
        <a class="home-overseas-item" href="${escapeAttr(item.href || '/case.html')}">
          <div class="pic"><div class="imgBox">${imgHtml(item.image || '', { alt: item.title || '', eager: i < 3 })}</div></div>
          <div class="infoBox">
            <div class="title">
              <h3>${escapeHtml(item.title || '')}</h3>
              <span class="more" aria-hidden="true">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 20L20 12L12 4" stroke="white" stroke-width="2" stroke-linecap="square"/><line x1="1" y1="-1" x2="17" y2="-1" transform="matrix(-1 0 0 1 20 13)" stroke="white" stroke-width="2" stroke-linecap="square"/></svg>
              </span>
            </div>
            <p>${escapeHtml(item.desc || '')}</p>
          </div>
        </a>
      </li>`
    )
    .join('')
}

function renderHomeMobileTags(container, items) {
  if (!container || !Array.isArray(items)) return
  container.innerHTML = items
    .map(
      (item) => `<li><div class="item"><p>${escapeHtml(item.en || '')}</p><h5>${escapeHtml(item.zh || '')}</h5></div></li>`
    )
    .join('')
}

const DEFAULT_KOL_STATS = [
  { label: '独家签约达人', value: '1870+' },
  { label: '小红书素人', value: '30W+' },
]

const DEFAULT_KOL_CATEGORIES = [
  { name: '剧情搞笑', kolCount: '70+ KOL', fans: '一亿+粉丝', avatars: ['/images/home/wai1.jpg', '/images/home/wai2.jpg', '/images/home/wai3.jpg', '/images/home/wai4.jpg'] },
  { name: '颜值时尚', kolCount: '80+ KOL', fans: '七千万+粉丝', avatars: ['/images/home/wai2.jpg', '/images/home/wai3.jpg', '/images/home/wai4.jpg', '/images/home/wai1.jpg'] },
  { name: '才艺技能', kolCount: '80+ KOL', fans: '七千万+粉丝', avatars: ['/images/home/wai3.jpg', '/images/home/wai4.jpg', '/images/home/wai1.jpg', '/images/home/wai2.jpg'] },
  { name: '三农类', kolCount: '80+ KOL', fans: '七千万+粉丝', avatars: ['/images/home/wai4.jpg', '/images/home/wai1.jpg', '/images/home/wai2.jpg', '/images/home/wai3.jpg'] },
  { name: '萌宠生活', kolCount: '30+ KOL', fans: '七千万+粉丝', avatars: ['/images/home/wai1.jpg', '/images/home/wai3.jpg', '/images/home/wai2.jpg', '/images/home/wai4.jpg'] },
  { name: '美食分享', kolCount: '80+ KOL', fans: '七千万+粉丝', avatars: ['/images/home/wai2.jpg', '/images/home/wai4.jpg', '/images/home/wai1.jpg', '/images/home/wai3.jpg'] },
  { name: '家居家装', kolCount: '80+ KOL', fans: '七千万+粉丝', avatars: ['/images/home/wai3.jpg', '/images/home/wai1.jpg', '/images/home/wai4.jpg', '/images/home/wai2.jpg'] },
  { name: '母婴亲子', kolCount: '80+ KOL', fans: '七千万+粉丝', avatars: ['/images/home/wai4.jpg', '/images/home/wai2.jpg', '/images/home/wai3.jpg', '/images/home/wai1.jpg'] },
]

export function ensureHomeKol(config) {
  if (!config || typeof config !== 'object') return config
  if (!config.pages || typeof config.pages !== 'object') config.pages = {}
  if (!config.pages.home || typeof config.pages.home !== 'object') config.pages.home = {}
  const home = config.pages.home
  if (!home.kolTitle) home.kolTitle = '星图&小红书KOL达人资源'
  if (!home.kolLead) home.kolLead = '抖音&小红书全国达人资源超50万+'
  if (!Array.isArray(home.kolStats) || !home.kolStats.length) {
    home.kolStats = DEFAULT_KOL_STATS.map((x) => ({ ...x }))
  }
  if (!Array.isArray(home.kolCategories) || !home.kolCategories.length) {
    home.kolCategories = DEFAULT_KOL_CATEGORIES.map((x) => ({
      ...x,
      avatars: [...(x.avatars || [])],
    }))
  }
  return config
}

function renderHomeKolStats(container, items) {
  if (!container || !Array.isArray(items)) return
  container.innerHTML = items
    .map(
      (item) => `<div class="home-kol-stat">
        <strong>${escapeHtml(item.value || '')}</strong>
        <span>${escapeHtml(item.label || '')}</span>
      </div>`
    )
    .join('')
}

function renderHomeKolCategories(container, items) {
  if (!container || !Array.isArray(items)) return
  container.innerHTML = items
    .map((item) => {
      const avatars = (Array.isArray(item.avatars) ? item.avatars : [])
        .filter(Boolean)
        .slice(0, 8)
        .map(
          (src) =>
            `<li class="home-kol-avatar">${imgHtml(src, {
              alt: item.name || '达人',
              width: 96,
              height: 96,
              eager: true,
            })}</li>`
        )
        .join('')
      return `<article class="home-kol-col">
        <header class="home-kol-col-head">
          <h3>${escapeHtml(item.name || '')}</h3>
          <p><span>${escapeHtml(item.kolCount || '')}</span><span>${escapeHtml(item.fans || '')}</span></p>
        </header>
        <ul class="home-kol-avatars">${avatars}</ul>
      </article>`
    })
    .join('')
}

const DEFAULT_STREAMER_IMAGES = [
  '/images/home/wai1.jpg',
  '/images/home/wai2.jpg',
  '/images/home/wai3.jpg',
  '/images/home/wai4.jpg',
  '/images/home/wai1.jpg',
  '/images/home/wai2.jpg',
  '/images/home/wai3.jpg',
  '/images/home/wai4.jpg',
  '/images/home/wai2.jpg',
  '/images/home/wai1.jpg',
]

export function ensureHomeStreamer(config) {
  if (!config || typeof config !== 'object') return config
  if (!config.pages || typeof config.pages !== 'object') config.pages = {}
  if (!config.pages.home || typeof config.pages.home !== 'object') config.pages.home = {}
  const home = config.pages.home
  if (!home.streamerTitle) home.streamerTitle = '主播资源'
  if (!home.streamerDesc) {
    home.streamerDesc =
      '拥有40+头部主播核心引擎，涵盖主持、达人、创作者等多维类型。通过品牌DNA拆解与数据算法，精准匹配主播与品牌，实现内容效率与商业转化双提升。'
  }
  if (!Array.isArray(home.streamerImages) || !home.streamerImages.length) {
    home.streamerImages = [...DEFAULT_STREAMER_IMAGES]
  }
  if (!home.streamerBg) home.streamerBg = '#f7f8f9'
  return config
}

function applyHomeStreamerTheme(home) {
  if (!home) return
  const bg = String(home.streamerBg || '#f7f8f9').trim()
  document.querySelectorAll('.home-streamer-section').forEach((section) => {
    section.style.setProperty('--streamer-bg', bg)
  })
}

/** 4 列瀑布：只用当前配置的图片，不回填默认素材 */
function renderHomeStreamerImages(container, images) {
  if (!container) return
  const list = (Array.isArray(images) ? images : []).filter(Boolean)
  if (!list.length) {
    container.innerHTML = '<p class="home-media-empty">暂无主播图片，请在组件配置中上传</p>'
    return
  }
  // 尽量按 3/3/2/2 分列；数量不足时按实际张数均分到最多 4 列
  const colsCount = list.length >= 8 ? 4 : list.length >= 4 ? 3 : list.length >= 2 ? 2 : 1
  const cols = Array.from({ length: colsCount }, () => [])
  list.forEach((src, i) => cols[i % colsCount].push(src))
  container.innerHTML = cols
    .map(
      (col, ci) => `<div class="home-streamer-col${ci >= Math.ceil(colsCount / 2) ? ' is-wide' : ''}">${col
        .map(
          (src, i) =>
            `<figure class="home-streamer-shot">${imgHtml(src, {
              alt: `主播 ${ci + 1}-${i + 1}`,
              eager: true,
            })}</figure>`
        )
        .join('')}</div>`
    )
    .join('')
}

const DEFAULT_VENUE_IMAGES = [
  '/images/home/wai1.jpg',
  '/images/home/wai2.jpg',
  '/images/home/wai3.jpg',
  '/images/home/wai4.jpg',
  '/images/home/wai2.jpg',
]

export function ensureHomeVenue(config) {
  if (!config || typeof config !== 'object') return config
  if (!config.pages || typeof config.pages !== 'object') config.pages = {}
  if (!config.pages.home || typeof config.pages.home !== 'object') config.pages.home = {}
  const home = config.pages.home
  if (!home.venueTitle) home.venueTitle = '设备场地'
  if (!home.venueDesc) {
    home.venueDesc =
      '影视影棚签约合作，支持创意场景拍摄<br />影视设备搭配定制化高级感场景，做到场景与设备，内容与玩法MIX体验'
  }
  if (!Array.isArray(home.venueImages) || !home.venueImages.length) {
    home.venueImages = [...DEFAULT_VENUE_IMAGES]
  }
  return config
}

/** 左大图 + 右侧小图：只用当前配置，不回填默认素材 */
function renderHomeVenueImages(container, images) {
  if (!container) return
  const list = (Array.isArray(images) ? images : []).filter(Boolean)
  if (!list.length) {
    container.innerHTML = '<p class="home-media-empty">暂无场地图片，请在组件配置中上传</p>'
    return
  }
  const shot = (src, alt) =>
    `<figure class="home-venue-shot">${imgHtml(src, { alt, eager: true })}</figure>`
  if (list.length === 1) {
    container.innerHTML = `<div class="home-venue-col is-hero">${shot(list[0], '设备场地 1')}</div>`
    return
  }
  const [hero, ...rest] = list
  const mid = rest.slice(0, Math.ceil(rest.length / 2))
  const right = rest.slice(Math.ceil(rest.length / 2))
  container.innerHTML = `
    <div class="home-venue-col is-hero">${shot(hero, '设备场地 1')}</div>
    <div class="home-venue-col">${mid.map((src, i) => shot(src, `设备场地 ${i + 2}`)).join('')}</div>
    ${right.length ? `<div class="home-venue-col">${right.map((src, i) => shot(src, `设备场地 ${mid.length + i + 2}`)).join('')}</div>` : ''}
  `
}

const DEFAULT_LOCAL_THUMBS = [
  '/images/home/wai1.jpg',
  '/images/home/wai2.jpg',
  '/images/home/wai3.jpg',
  '/images/home/wai4.jpg',
  '/images/home/wai1.jpg',
  '/images/home/wai2.jpg',
  '/images/home/wai3.jpg',
  '/images/home/wai4.jpg',
  '/images/home/wai2.jpg',
]

const DEFAULT_LOCAL_GROUPS = [
  { name: '全国超头KOL', meta: '人数800+ 覆盖率85%', images: [...DEFAULT_LOCAL_THUMBS] },
  { name: '本地头部KOL', meta: '人数8500+ 覆盖率85%', images: [...DEFAULT_LOCAL_THUMBS].reverse() },
  { name: '本地KOC', meta: '人数35000+ 覆盖率95%', images: [...DEFAULT_LOCAL_THUMBS] },
]

export function ensureHomeLocal(config) {
  if (!config || typeof config !== 'object') return config
  if (!config.pages || typeof config.pages !== 'object') config.pages = {}
  if (!config.pages.home || typeof config.pages.home !== 'object') config.pages.home = {}
  const home = config.pages.home
  if (!home.localTitle) home.localTitle = '本地达人资源'
  if (!home.localClientPrefix) home.localClientPrefix = '2025年为'
  if (!home.localClientValue) home.localClientValue = '50+'
  if (!home.localClientSuffix) home.localClientSuffix = '客户'
  if (!home.localBrands) {
    home.localBrands = '（海底捞、Meland、美的、元气森林、完美日记等）'
  }
  if (!Array.isArray(home.localStatLines) || !home.localStatLines.length) {
    home.localStatLines = [
      {
        html: '至今输出视频<strong>3000W+</strong>，其中爆款视频达<strong>28000</strong>条，总曝光达<strong>80亿+</strong>',
      },
      {
        html: '达运团队<strong>30人+</strong>，视频团队<strong>20人+</strong>，日均产出视频<strong>650</strong>条',
      },
    ]
  }
  if (!Array.isArray(home.localGroups) || !home.localGroups.length) {
    home.localGroups = DEFAULT_LOCAL_GROUPS.map((g) => ({
      ...g,
      images: [...(g.images || [])],
    }))
  }
  return config
}

/** 首页：合作客户模块默认分组（设计稿裁切 + 机构品牌圆形素材） */
const CLIENTS_EXTRA_BRANDS = [
  'adai',
  'aihuo',
  'baoluo',
  'gesen',
  'haixiaodou',
  'hongxinxin',
  'hujing',
  'jinzita',
  'juhuo',
  'jujing',
  'jumeng',
  'kaiguan',
  'lanlan',
  'linian',
  'plb',
  'tiniao',
  'wanshun',
  'xiaodada',
  'xiaoqi',
  'xiaotianxia',
  'xiaoyubang',
  'xingxuan',
  'xingyun',
  'yangxuan',
  'yantuan',
  'youpinhui',
  'zhixuan',
  'zhubozhijia',
  'zunyu',
].map((name) => `/images/brands/clients/extra/${name}.png`)

const CLIENTS_BRAND_GROUPS = {
  catering: [
    ...Array.from({ length: 24 }, (_, i) => `/images/brands/clients/catering-${String(i + 1).padStart(2, '0')}.png`),
    ...CLIENTS_EXTRA_BRANDS.slice(0, 8),
  ],
  retail: [
    ...Array.from({ length: 28 }, (_, i) => `/images/brands/clients/retail-${String(i + 1).padStart(2, '0')}.png`),
    ...CLIENTS_EXTRA_BRANDS.slice(8, 16),
  ],
  general: [
    ...Array.from({ length: 13 }, (_, i) => `/images/brands/clients/general-${String(i + 1).padStart(2, '0')}.png`),
    ...CLIENTS_EXTRA_BRANDS.slice(16, 24),
  ],
  appliance: [
    ...Array.from({ length: 10 }, (_, i) => `/images/brands/clients/appliance-${String(i + 1).padStart(2, '0')}.png`),
    ...CLIENTS_EXTRA_BRANDS.slice(24),
  ],
}

function buildDefaultClientsGroups() {
  return [
    { label: '餐饮合作品牌', logos: [...CLIENTS_BRAND_GROUPS.catering] },
    { label: '零售合作品牌', logos: [...CLIENTS_BRAND_GROUPS.retail] },
    { label: '综合合作品牌', logos: [...CLIENTS_BRAND_GROUPS.general] },
    { label: '家电合作品牌', logos: [...CLIENTS_BRAND_GROUPS.appliance] },
  ]
}

const DEFAULT_CLIENTS_GROUPS = buildDefaultClientsGroups()

const CLIENTS_PLACEHOLDER_LOGO =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><circle cx="60" cy="60" r="58" fill="#e8eaed"/><text x="60" y="66" text-anchor="middle" font-size="14" font-family="system-ui,sans-serif" fill="#6b7280">LOGO</text></svg>'
  )

function clientsLogosNeedReseed(groups) {
  // 仅在完全没有 Logo 时装填默认素材；有配置则一律尊重用户数据
  if (!Array.isArray(groups) || !groups.length) return true
  const logos = groups.flatMap((g) => (Array.isArray(g.logos) ? g.logos : [])).filter(Boolean)
  return logos.length === 0
}

/** 装填合作客户测试数据（可强制覆盖）；返回是否写入了分组数据 */
export function seedHomeClientsDemo(config, { force = false } = {}) {
  if (!config || typeof config !== 'object') return false
  if (!config.pages || typeof config.pages !== 'object') config.pages = {}
  if (!config.pages.home || typeof config.pages.home !== 'object') config.pages.home = {}
  const home = config.pages.home
  if (!home.clientsTitle) home.clientsTitle = '合作客户'
  if (!home.clientsTitleEn) home.clientsTitleEn = 'COOPERATIVE CLIENTS.'
  if (!home.clientsBrandMark) home.clientsBrandMark = '品牌矩阵'
  if (!home.clientsRankNote) home.clientsRankNote = '排名不分先后'
  if (force || clientsLogosNeedReseed(home.clientsGroups)) {
    home.clientsGroups = buildDefaultClientsGroups()
    return true
  }
  return false
}

export function ensureHomeClients(config) {
  seedHomeClientsDemo(config, { force: false })
  const home = config?.pages?.home
  if (home && typeof home === 'object') {
    if (!home.videoHeroTitle) home.videoHeroTitle = 'Creative Media'
    if (!home.videoHeroSubtitle) home.videoHeroSubtitle = '以光为媒，让品牌故事被看见、被记住'
    if (!home.video) home.video = '/videos/home-hero.mp4'
  }
  return config
}

function renderHomeClientsGroups(container, groups) {
  if (!container) return
  const list = Array.isArray(groups) ? groups : DEFAULT_CLIENTS_GROUPS
  if (!list.length) {
    container.innerHTML = '<p class="home-media-empty">暂无合作客户 Logo，请在组件配置中添加</p>'
    return
  }
  container.innerHTML = list
    .map((g, index) => {
      const groupLabel = g.label || ''
      const logos = (Array.isArray(g.logos) ? g.logos : []).filter(Boolean)
      const idx = String(index + 1).padStart(2, '0')
      const fallback = escapeAttr(CLIENTS_PLACEHOLDER_LOGO)
      const logoHtmls = logos.length
        ? logos
            .map((src) => {
              const path = typeof src === 'string' ? src : src?.url || src?.path || ''
              if (!path) return ''
              const resolved = escapeAttr(resolveAsset(path))
              return `<figure class="home-clients-logo">
          <img src="${resolved}" alt="${escapeAttr(groupLabel || '合作客户 Logo')}" loading="eager" decoding="async" data-fallback="${fallback}" onerror="this.onerror=null;this.src=this.dataset.fallback||'';" />
        </figure>`
            })
            .filter(Boolean)
            .join('')
        : `<p class="home-clients-empty">本分组暂无 Logo</p>`
      return `<section class="home-clients-group">
        <header class="home-clients-group-label">
          <span class="home-clients-group-index">${idx}</span>
          <span class="home-clients-group-name">${escapeHtml(groupLabel)}</span>
        </header>
        <div class="home-clients-logos">${logoHtmls}</div>
      </section>`
    })
    .join('')
}

/** 合作客户可组装到任意落地页，需全页刷新列表节点 */
export function applyHomeClientsWherever(config) {
  ensureHomeClients(config)
  const groups = config.pages?.home?.clientsGroups
  document.querySelectorAll('[data-list="pages.home.clientsGroups"]').forEach((node) => {
    renderHomeClientsGroups(node, groups)
  })
}

function renderHomeLocalGroups(container, groups) {
  if (!container || !Array.isArray(groups)) return
  container.innerHTML = groups
    .map((g) => {
      const imgs = (Array.isArray(g.images) ? g.images : []).filter(Boolean)
      return `<article class="home-local-card">
        <header class="home-local-card-head">
          <h3>${escapeHtml(g.name || '')}</h3>
          <p>${escapeHtml(g.meta || '')}</p>
        </header>
        <div class="home-local-thumbs">${
          imgs.length
            ? imgs
                .map(
                  (src, i) =>
                    `<figure>${imgHtml(src, { alt: `${g.name || '达人'} ${i + 1}`, eager: true })}</figure>`
                )
                .join('')
            : '<p class="home-media-empty">暂无图片</p>'
        }</div>
      </article>`
    })
    .join('')
}

function renderHomeLocalStatLines(container, lines) {
  if (!container || !Array.isArray(lines)) return
  container.innerHTML = lines
    .map((item) => {
      const html = typeof item === 'string' ? item : item?.html || ''
      return `<p class="home-local-line">${html}</p>`
    })
    .join('')
}

/** @deprecated 已迁移到 customComponents；保留空操作兼容旧 import */
export function ensureHomeGallery(config) {
  return config
}

function renderHomeNewsCategories(container, categories) {
  if (!container) return
  const cats = Array.isArray(categories) && categories.length
    ? categories
    : ['资讯公告', '网站设计观点', '网站优化推广', '网站建设百科', '小程序开发']
  const items = [{ id: 'all', label: 'All' }, ...cats.map((c) => ({ id: c, label: c }))]
  container.innerHTML = items
    .map(
      (c, i) => `<li class="home-news-cat${i === 0 ? ' is-active' : ''}">
        <button type="button" class="home-news-cat-btn" data-cat="${escapeAttr(c.id)}" aria-pressed="${i === 0}">
          <span>${escapeHtml(c.label)}</span>
        </button>
      </li>`
    )
    .join('')
}

function renderHomeNews(container, items) {
  if (!container || !Array.isArray(items)) return
  container.innerHTML = items
    .slice(0, 4)
    .map((item, index) => {
      const href = item.newsId
        ? `./news-detail.html?id=${encodeURIComponent(item.newsId)}`
        : item.href && String(item.href).includes('news-detail')
          ? item.href
          : newsDetailHref(item, index)
      const blank = String(href).includes('news-detail')
      return `<article class="home-news-card" data-cat="${escapeAttr(item.cat || '')}">
        <a class="home-news-card-link" href="${escapeAttr(href)}"${blank ? ' target="_blank" rel="noopener noreferrer"' : ''}>
          <div class="pic">${imgHtml(item.image || '', { alt: item.title || '', eager: index < 4 })}</div>
          <div class="meta">
            <span class="date">${escapeHtml(item.date || '')}</span>
            <span class="cat">${escapeHtml(item.cat || '')}</span>
          </div>
          <h3>${escapeHtml(item.title || '')}</h3>
        </a>
      </article>`
    })
    .join('')
}

function applyServiceVideoVisible(config) {
  const on = config?.pages?.service?.videoVisible !== false
  document.querySelectorAll('[data-service-video]').forEach((el) => {
    el.classList.toggle('is-service-video-off', !on)
    el.toggleAttribute('hidden', !on)
    if (!on) {
      el.querySelectorAll('video').forEach((v) => {
        try {
          v.pause()
        } catch {
          /* ignore */
        }
      })
    }
  })
  document.body.classList.toggle('is-service-video-off', !on)
}

/** 服务首屏眉题/标题/描述：字号与下边距（0 = 用 CSS 默认） */
export function applyServiceHeroTextStyle(config) {
  const page = config?.pages?.service
  if (!page) return
  const roots = document.querySelectorAll(
    '[data-compose-unit="service-hero"] .solve-box, #service .solve-box, .hero .solve-box'
  )
  if (!roots.length) return

  const clampPx = (raw, min, max) => {
    const n = Number(raw)
    if (!Number.isFinite(n) || n <= 0) return null
    return Math.min(max, Math.max(min, Math.round(n)))
  }

  const eyebrowSize = clampPx(page.eyebrowFontSize, 10, 48)
  const titleSize = clampPx(page.titleFontSize, 14, 96)
  const descSize = clampPx(page.descFontSize, 12, 48)

  // marginBottom 允许显式 0；null = 未配置，用 CSS 默认
  const mbOrNull = (raw) => {
    if (raw === 0 || raw === '0') return 0
    return clampPx(raw, 0, 120)
  }
  const eyebrowMbVal = mbOrNull(page.eyebrowMarginBottom)
  const titleMbVal = mbOrNull(page.titleMarginBottom)
  const descMbVal = mbOrNull(page.descMarginBottom)

  roots.forEach((root) => {
    const setVar = (name, px) => {
      if (px == null) root.style.removeProperty(name)
      else root.style.setProperty(name, `${px}px`)
    }
    setVar('--service-eyebrow-size', eyebrowSize)
    setVar('--service-title-size', titleSize)
    setVar('--service-desc-size', descSize)
    setVar('--service-eyebrow-mb', eyebrowMbVal)
    setVar('--service-title-mb', titleMbVal)
    setVar('--service-desc-mb', descMbVal)
  })
}

function forEachList(selector, fn) {
  document.querySelectorAll(selector).forEach((el) => fn(el))
}

function hasMountedHomeLists() {
  return !!document.querySelector('[data-list^="pages.home."]')
}

function applyHomePageLists(config) {
  const page = config.pages?.home
  if (!page) return
  forEachList('[data-list="pages.home.clientRollA"]', (el) => renderHomeRoll(el, page.clientRollA))
  forEachList('[data-list="pages.home.clientRollB"]', (el) => renderHomeRoll(el, page.clientRollB))
  applyHomeClientRollMode(config)
  applyHomeWhoLeftMode(config)
  forEachList('[data-list="pages.home.clientLogos"]', (el) => renderHomeLogos(el, page.clientLogos))
  forEachList('[data-list="pages.home.whatItems"]', (el) => renderHomeWhatItems(el, page.whatItems))
  applyHomeWhatCardsMode(config)
  forEachList('[data-list="pages.home.cases"]', (el) => renderHomeCases(el, page.cases))
  forEachList('[data-list="pages.home.overseas"]', (el) => renderHomeOverseas(el, page.overseas))
  forEachList('[data-list="pages.home.mobileTags"]', (el) => renderHomeMobileTags(el, page.mobileTags))
  ensureHomeKol(config)
  forEachList('[data-list="pages.home.kolStats"]', (el) =>
    renderHomeKolStats(el, config.pages?.home?.kolStats)
  )
  forEachList('[data-list="pages.home.kolCategories"]', (el) =>
    renderHomeKolCategories(el, config.pages?.home?.kolCategories)
  )
  ensureHomeStreamer(config)
  applyHomeStreamerTheme(config.pages?.home)
  forEachList('[data-list="pages.home.streamerImages"]', (el) =>
    renderHomeStreamerImages(el, config.pages?.home?.streamerImages)
  )
  ensureHomeVenue(config)
  forEachList('[data-list="pages.home.venueImages"]', (el) =>
    renderHomeVenueImages(el, config.pages?.home?.venueImages)
  )
  ensureHomeLocal(config)
  forEachList('[data-list="pages.home.localGroups"]', (el) =>
    renderHomeLocalGroups(el, config.pages?.home?.localGroups)
  )
  forEachList('[data-list="pages.home.localStatLines"]', (el) =>
    renderHomeLocalStatLines(el, config.pages?.home?.localStatLines)
  )
  ensureHomeClients(config)
  applyHomeClientsWherever(config)
  forEachList('[data-list="pages.home.newsCategories"]', (el) =>
    renderHomeNewsCategories(el, page.newsCategories || config.pages?.news?.categories)
  )
  forEachList('[data-list="pages.home.news"]', (el) => renderHomeNews(el, page.news))
  applyMcnHomeLists(config)
}

function applyPageLists(config, pageKey) {
  if (pageKey === 'home' || hasMountedHomeLists()) {
    applyHomePageLists(config)
  }
  if (pageKey === 'service') {
    renderMarquees(document.querySelector('[data-list="pages.service.marquees"]'), config.pages?.service?.marquees)
    renderServicePhases(document.querySelector('[data-list="pages.service.phases"]'), config.pages?.service?.phases)
    renderServices(document.querySelector('[data-list="pages.service.services"]'), config.pages?.service?.services)
    applyServiceVideoVisible(config)
    applyServiceHeroTextStyle(config)
  }
  if (pageKey === 'about') {
    const about = ensureAboutIntro(config).pages?.about
    ensureAboutTeam(config)
    ensureAboutProfile(config)
    applyAboutIntroTheme(about)
    applyAboutTeamWherever(config)
    applyAboutProfileWherever(config)
    applyAboutReviewsWherever(config)
    const aboutLogos = Array.isArray(about?.clientLogos) && about.clientLogos.length
      ? about.clientLogos
      : config.pages?.home?.clientLogos
    document.querySelectorAll('[data-list="pages.about.clientLogos"]').forEach((node) => {
      renderAboutClientLogos(node, aboutLogos)
    })
  }
  if (pageKey === 'news') {
    const page = config.pages?.news
    renderNewsMenu(document.querySelector('[data-list="pages.news.categories"]'), page?.categories, page?.defaultCategory)
    renderNewsGrid(document.querySelector('[data-list="pages.news.items"]'), page?.items)
  }
  if (pageKey === 'news-detail') {
    applyNewsDetail(config)
  }
  if (pageKey === 'case') {
    const page = config.pages?.case
    renderCaseTabs(document.querySelector('[data-list="pages.case.categories"]'), page?.categories, page?.defaultCategory)
    renderCaseGrid(document.querySelector('[data-list="pages.case.items"]'), page?.items)
  }
  if (pageKey === 'case-detail') {
    applyCaseDetail(config)
  }
  if (pageKey === 'live-detail') {
    applyMcnLiveDetail(config)
  }
  if (pageKey === 'mcn-case-detail') {
    applyMcnCaseDetail(config)
  }
  if (pageKey === 'talent-detail') {
    applyMcnTalentDetail(config)
  }
  if (pageKey === 'contact') {
    renderContactOffices(document.querySelector('[data-list="pages.contact.offices"]'), config.pages?.contact?.offices)
  }
}

function applySeo(config, pageKey) {
  if (pageKey === 'case-detail' || pageKey === 'news-detail' || pageKey === 'live-detail' || pageKey === 'mcn-case-detail' || pageKey === 'talent-detail') return
  const seo = config.pages?.[pageKey]?.seo
  if (!seo) return
  if (seo.title) document.title = seo.title
  const meta = document.querySelector('meta[name="description"]')
  if (meta && seo.description) meta.setAttribute('content', seo.description)
}

import { applyMenuComposition, resolveMenuSlot } from './compose.js'
import { ensureCustomComponents, renderMountedCustomGalleries } from './custom-components.js'
import { applyComponentSurfaces, mergeConfigForMenuSlot, setRegistryConfig } from './page-registry.js'
import { DEFAULT_WHAT_ICON_IDS, resolveWhatIconSvg } from './what-icons.js'
import { applyMcnHomeLists, applyMcnLiveDetail, applyMcnCaseDetail, applyMcnTalentDetail, ensureMcnHomeLists } from './mcn/mcn-lists.js'

export async function applySiteConfig(existingConfig) {
  const config = existingConfig || (await loadSiteConfig())
  setRegistryConfig(config)
  ensureCustomComponents(config)
  // 兼容：有 menus 时用其派生全屏菜单（若尚未 sync）
  if (Array.isArray(config.global?.menus) && config.global.menus.length) {
    if (!Array.isArray(config.global.menu) || !config.global.menu.length) {
      config.global.menu = config.global.menus
        .filter((m) => m && m.visible !== false)
        .map((m) => ({
          title: m.title || m.label,
          en: m.en || '',
          href: m.href,
        }))
    }
  }
  const pageKey = detectPageKey()
  if (pageKey && PAGE_BLOCKS[pageKey]) ensurePageBlocks(config, pageKey)
  else ensureHomeBlocks(config)
  ensureHomeKol(config)
  ensureHomeStreamer(config)
  ensureHomeVenue(config)
  ensureHomeLocal(config)
  ensureHomeClients(config)
  ensureHomeWhatItems(config)
  ensureAboutIntro(config)
  ensureAboutTeam(config)
  ensureMcnHomeLists(config)
  applySeo(config, pageKey)
  applyGlobal(config)
  // 先按菜单组装组件（可跨页），再绑定文案/列表
  await applyMenuComposition(config)
  const slot = resolveMenuSlot(config)
  const bindConfig = mergeConfigForMenuSlot(config, slot)
  applyBinds(document, bindConfig)
  applyPageLists(bindConfig, pageKey)
  applyHomeClientsWherever(bindConfig)
  applyAboutCertificatesWherever(bindConfig)
  applyAboutTeamWherever(bindConfig)
  applyAboutProfileWherever(bindConfig)
  applyAboutReviewsWherever(bindConfig)
  applyServiceHeroTextStyle(bindConfig)
  applyComponentSurfaces(bindConfig, slot)
  renderMountedCustomGalleries(bindConfig, resolveAsset, slot)
  // 拼装模式下仍应用本页模块显隐，避免「已隐藏」却误以为图片丢失
  applyPageBlocks(config, pageKey)
  return config
}

export function applyHomeBlocks(config) {
  applyPageBlocks(config, 'home')
}

/** 通用：为当前页应用模块显隐与排序 */
export function applyPageBlocks(config, pageKey) {
  if (!pageKey || !PAGE_BLOCKS[pageKey]) return
  ensurePageBlocks(config, pageKey)
  const page = config.pages[pageKey]
  const blocks = page.blocks
  const order = page.blockOrder || PAGE_BLOCKS[pageKey].map(({ id }) => id)
  const composing = document.body.classList.contains('is-page-composing')

  // 显隐控制：兼容 data-home-block（旧）和 data-page-block（新）
  document.querySelectorAll('[data-page-block],[data-home-block]').forEach((el) => {
    const id = el.getAttribute('data-page-block') || el.getAttribute('data-home-block')
    if (!id) return
    // 拼装引擎已停靠的原生块不要再改 hidden，否则与 display:none 打架且开关无效
    if (el.classList.contains('is-compose-parked')) return
    // 菜单拼装已决定显隐与顺序：勿用「本页 blocks」把已组装（含跨页）组件再藏掉
    if (
      composing &&
      (el.dataset.composeHost ||
        el.closest('[data-compose-host]') ||
        el.closest('#pageComposeRoot'))
    ) {
      return
    }
    const on = blocks[id] !== false
    el.classList.toggle('is-home-block-off', !on)
    el.classList.toggle('is-page-block-off', !on)
    el.toggleAttribute('hidden', !on)
    if (!on) {
      el.querySelectorAll('video').forEach((v) => {
        try {
          v.pause()
        } catch {
          /* ignore */
        }
      })
    }
  })

  // 菜单拼装已决定 DOM 顺序；再按 blockOrder 重排会把跨页/个性组件挤乱，导致「排序无效」
  if (composing || document.getElementById('pageComposeRoot')) {
    return
  }

  // 按父容器分组重排：避免把 body 下单独的 Hero append 到页尾（footer 之后）
  const byParent = new Map()
  order.forEach((id) => {
    const el = document.querySelector(`[data-page-block="${id}"],[data-home-block="${id}"]`)
    if (!el?.parentElement) return
    const parent = el.parentElement
    if (!byParent.has(parent)) byParent.set(parent, [])
    byParent.get(parent).push(el)
  })

  byParent.forEach((group) => {
    if (group.length < 2) return
    const parent = group[0].parentElement
    if (!parent) return
    const earliest = group.reduce((a, el) => {
      const kids = parent.children
      return [...kids].indexOf(el) < [...kids].indexOf(a) ? el : a
    })
    const marker = document.createComment('page-block-order')
    parent.insertBefore(marker, earliest)
    group.forEach((el) => parent.insertBefore(el, marker))
    marker.remove()
  })
}

export function listenPreviewReload(callback) {
  window.addEventListener('message', (event) => {
    if (event.data?.type === 'guanzi-config-reload') {
      callback?.(event.data.config, event.data)
    }
  })
}
