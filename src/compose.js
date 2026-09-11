/**
 * 前台组件拼装引擎
 *
 * 结构：当前菜单落地页(shell，默认头尾) → #pageComposeRoot → 仅挂载 menuAssembly.components
 * - 组件库全局共用；片段模板来自 unit.preview 所指 HTML
 * - 若当前落地页 DOM 已有同选择器节点则直接移入，否则从模板页拉取克隆
 */
import {
  createGalleryElement,
  ensureCustomComponents,
  getCustomComponent,
} from './custom-components.js'
import {
  getComposeSelector,
  getPageUnit,
  getSlotShell,
  isComposableUnit,
  isSlotComponentVisible,
  getSlotComponentCustom,
  listVisibleSlotComponents,
  setRegistryConfig,
} from './page-registry.js'

const pageDocCache = new Map()

/** 预览热更新时丢掉模板缓存，避免拿到过期 HTML 片段 */
export function clearComposeDocumentCache() {
  pageDocCache.clear()
}

function normalizePath(pathname) {
  let p = String(pathname || '/')
    .replace(/\\/g, '/')
    .split('?')[0]
    .split('#')[0]
  if (!p.startsWith('/')) p = `/${p}`
  // /about/ → /about，避免与落地页 href、资源相对路径打架
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1)
  let file = p.split('/').pop() || ''
  file = file.replace(/\.html?$/i, '')
  if (!file || file === 'index') return '/'
  return `/${file}`
}

export function resolveMenuSlot(config) {
  const slots = config?.global?.menuAssembly
  if (!Array.isArray(slots) || !slots.length) return null
  const here = normalizePath(location.pathname)
  const hash = location.hash || ''
  const params = new URLSearchParams(location.search)
  const menuParam = String(params.get('m') || params.get('menu') || '').trim()

  // 通用页：/page.html?m=<menuId>
  if (menuParam) {
    const byId = slots.find((s) => s && s.id === menuParam)
    if (byId) return byId
  }

  // 同一落地路径上的菜单（含 /#services 这类锚点）
  const pathMatches = slots.filter((s) => {
    const raw = String(s.href || '')
    if (/[?&]m=/.test(raw) || /[?&]menu=/.test(raw)) return false
    return normalizePath(raw.split('#')[0].split('?')[0]) === here
  })
  if (!pathMatches.length) return null

  // 单页站：锚点只负责滚动，拼装必须以「无 hash / home」整页为准。
  // 否则点导航进 /#services 会只挂一个组件，隐藏后再显示易整页空白。
  const barePathSlot =
    pathMatches.find((s) => !String(s.href || '').includes('#')) ||
    pathMatches.find((s) => s.id === 'home')
  if (barePathSlot) return barePathSlot

  // 无整页槽时：再按 hash / 首个路径命中回退
  const withHash = pathMatches.find((s) => {
    const [, h] = String(s.href || '').split('#')
    return h && `#${h}` === hash
  })
  return withHash || pathMatches[0] || null
}

function ensureComposeRoot() {
  let root = document.getElementById('pageComposeRoot')
  if (root) {
    // 占位节点若带 hidden，拼装后内容会一起被藏掉（MCN 曾因此闪一下变空白）
    root.hidden = false
    root.removeAttribute('hidden')
    root.classList.add('page-compose-root')
    return root
  }
  const main = document.querySelector('main')
  if (!main) return null
  root = document.createElement('div')
  root.id = 'pageComposeRoot'
  root.className = 'page-compose-root'
  main.insertBefore(root, main.firstChild)
  return root
}

async function loadPageDocument(preview) {
  const key = preview || 'index.html'
  if (pageDocCache.has(key)) return pageDocCache.get(key)
  const href = key.startsWith('/') ? key : `/${key.replace(/^\.\//, '')}`
  const res = await fetch(href, { cache: 'no-store' })
  if (!res.ok) throw new Error(`无法加载组件源页 ${href}`)
  const doc = new DOMParser().parseFromString(await res.text(), 'text/html')
  pageDocCache.set(key, doc)
  return doc
}

function parkNativeBlocks() {
  document.querySelectorAll('[data-home-block],[data-page-block],[data-compose-unit]').forEach((el) => {
    if (el.hasAttribute('data-custom-unit')) return
    el.dataset.composeNative = '1'
    el.hidden = true
    el.classList.add('is-compose-parked')
  })
  document.querySelectorAll('[data-gallery-template]').forEach((el) => {
    el.dataset.composeNative = '1'
    el.hidden = true
    el.classList.add('is-compose-parked')
  })
}

async function resolveGalleryTemplate() {
  let tpl = document.querySelector('[data-gallery-template]')
  if (tpl) return tpl
  try {
    const doc = await loadPageDocument('index.html')
    return doc.querySelector('[data-gallery-template]')
  } catch {
    return null
  }
}

/**
 * @returns {Promise<boolean>} 是否应用了菜单组件拼装
 */
export async function applyMenuComposition(config) {
  setRegistryConfig(config)
  ensureCustomComponents(config)

  // MCN 单页：区块已内联在 index，只需滚动锚点 + blocks 显隐，禁止再 park/拼装
  if (document.body?.classList.contains('page-mcn')) return false

  const slot = resolveMenuSlot(config)
  if (!slot) return false

  let components = Array.isArray(slot.components) ? listVisibleSlotComponents(slot, config) : null
  // 未配置 components 时不强制拼装；空数组表示「仅头尾」
  if (!components) return false

  const root = ensureComposeRoot()
  if (!root) return false

  const shell = getSlotShell(slot)
  document.body.classList.add('is-page-composing')
  document.body.dataset.composeShell = shell

  // 热更新时必须清模板缓存，否则跨页片段可能来自旧 HTML（缺 data-compose-unit）
  clearComposeDocumentCache()

  const main = root.parentElement
  // 先把上次挂入的原生块放回 main，再删掉跨页克隆；禁止 .remove() 掉 native 导致二次拼装只能拉模板
  ;[...root.children].forEach((el) => {
    if (el.dataset?.composeNative === '1') {
      el.removeAttribute('data-compose-host')
      main?.appendChild(el)
      return
    }
    el.remove()
  })
  root.querySelectorAll('[data-custom-unit]').forEach((el) => el.remove())

  parkNativeBlocks()

  const seenSelectors = new Set()
  let count = 0
  let galleryTpl = null

  for (const unitId of components) {
    if (!isSlotComponentVisible(slot, unitId)) continue
    const unit = getPageUnit(unitId, config)
    if (!isComposableUnit(unit)) continue

    // 个性组件：按实例克隆模板（可叠加本菜单覆盖）
    if (unit.customType === 'gallery') {
      const inst = getCustomComponent(config, unit.id)
      if (!inst) continue
      const customOv = getSlotComponentCustom(slot, unit.id)
      const data = customOv ? { ...inst, ...customOv, id: inst.id, type: inst.type } : inst
      if (!galleryTpl) galleryTpl = await resolveGalleryTemplate()
      const el = createGalleryElement(data, galleryTpl)
      el.dataset.composeHost = unit.id
      root.appendChild(el)
      count += 1
      continue
    }

    const selector = getComposeSelector(unit)
    if (!selector || seenSelectors.has(selector)) continue
    seenSelectors.add(selector)

    // 1) 当前落地页 DOM 已有该片段 → 移入（只认已停靠的 native，避免误抓跨页克隆）
    const native = document.querySelector(`${selector}[data-compose-native="1"]`)
    if (native) {
      native.hidden = false
      native.classList.remove('is-compose-parked', 'is-home-block-off', 'is-page-block-off')
      native.removeAttribute('hidden')
      native.dataset.composeHost = unit.id
      root.appendChild(native)
      count += 1
      continue
    }

    // 2) 从组件模板页拉取片段
    try {
      const source = unit.preview || shell
      const doc = await loadPageDocument(source)
      const src = doc.querySelector(selector)
      if (!src) {
        console.warn('[compose] 模板页缺少组件', unitId, selector, source)
        continue
      }
      const host = document.createElement('div')
      host.className = 'compose-foreign'
      host.dataset.composeHost = unitId
      host.dataset.composeFrom = source
      const clone = src.cloneNode(true)
      clone.querySelectorAll('[id]').forEach((el) => {
        el.id = `compose-${unitId}-${el.id}`
      })
      clone.classList.remove('is-compose-parked', 'is-home-block-off', 'is-page-block-off')
      clone.hidden = false
      clone.removeAttribute('hidden')
      host.appendChild(clone)
      host.querySelectorAll('video').forEach((v) => {
        v.muted = true
        v.playsInline = true
        v.play?.()?.catch(() => {})
      })
      root.appendChild(host)
      count += 1
    } catch (err) {
      console.warn('[compose]', unitId, err)
    }
  }

  document.querySelectorAll('.is-compose-parked').forEach((el) => {
    if (root.contains(el)) {
      el.classList.remove('is-compose-parked')
      return
    }
    el.hidden = true
    el.querySelectorAll('video').forEach((v) => {
      try {
        v.pause()
      } catch {
        /* ignore */
      }
    })
  })

  document.body.dataset.composeCount = String(count)
  return true
}

/** 组件预览：单独挂载某个个性组件 */
export async function mountCustomUnitForPreview(config, unitId) {
  setRegistryConfig(config)
  ensureCustomComponents(config)
  const unit = getPageUnit(unitId, config)
  if (!unit?.customType) return null
  const root = ensureComposeRoot()
  if (!root) return null
  document.body.classList.add('is-page-composing')
  parkNativeBlocks()
  root.querySelectorAll('[data-compose-host],[data-custom-unit]').forEach((el) => el.remove())
  if (unit.customType === 'gallery') {
    const inst = getCustomComponent(config, unit.id)
    if (!inst) return null
    const tpl = await resolveGalleryTemplate()
    const el = createGalleryElement(inst, tpl)
    root.appendChild(el)
    return el
  }
  return null
}
