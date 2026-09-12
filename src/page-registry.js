/**
 * 前台/后台共用：菜单落地页 + 全局组件注册表
 *
 * 组件 kind：
 * - required：页面必要（SEO 等），不进内容自由拼装
 * - nav / footer：全站 chrome
 * - content：按菜单组装到 #pageComposeRoot
 *
 * 菜单实体见 config.global.menus；内容组装仍在 menuAssembly[].components。
 */
import {
  ensureCustomComponents,
  listCustomUnits,
  unitFromCustomInstance,
  getCustomComponent,
} from './custom-components.js'
import { getComponentSurfaceProfile } from './component-surfaces.js'

export { COMPONENT_SURFACE_PROFILES, getComponentSurfaceProfile } from './component-surfaces.js'

/** 运行时配置引用（供 getPageUnit 解析个性组件） */
let registryConfig = null

export function setRegistryConfig(config) {
  registryConfig = config || null
  if (config) ensureCustomComponents(config)
}

/** 组件类型（工作台分组 / 组装分区） */
export const COMPONENT_KINDS = [
  { id: 'required', label: '页面必要' },
  { id: 'nav', label: '导航' },
  { id: 'footer', label: '页尾' },
  { id: 'content', label: '内容' },
]

export const COMPONENT_KIND_IDS = new Set(COMPONENT_KINDS.map((k) => k.id))

/** 可选落地页壳（MCN 站以首页单页为主） */
export const SHELL_OPTIONS = [
  { shell: 'page.html', href: '/page.html', label: '通用页', pageKey: null, generic: true },
  { shell: 'index.html', href: '/', label: '首页', pageKey: 'home' },
  { shell: 'contact.html', href: '/contact.html', label: '联系', pageKey: 'contact' },
]

/** 通用壳链接：同一 page.html 用 ?m=菜单ID 区分多套组装 */
export function hrefForShell(shell, menuId = '') {
  const meta = SHELL_OPTIONS.find((o) => o.shell === shell)
  if (meta?.generic && menuId) {
    return `/page.html?m=${encodeURIComponent(String(menuId))}`
  }
  return meta?.href || (shell ? `/${String(shell).replace(/^\//, '')}` : '/')
}

export function isGenericShell(shell) {
  return SHELL_OPTIONS.some((o) => o.shell === shell && o.generic)
}

/** 站点首页菜单（特殊：不可隐藏 / 不可换壳 / 固定入口） */
export function isHomeMenu(menuOrId) {
  const id = typeof menuOrId === 'string' ? menuOrId : menuOrId?.id
  return id === 'home'
}

/** 系统内置菜单（MENU_SLOTS）：不可改落地页壳与入口链接 */
export function isBuiltinMenu(menuOrId) {
  const id = typeof menuOrId === 'string' ? menuOrId : menuOrId?.id
  if (!id) return false
  if (isHomeMenu(id)) return true
  return MENU_SLOTS.some((s) => s.id === id)
}

/**
 * 默认菜单种子（MCN 单页：入口多为首页锚点）
 * - href / shell / pageKey
 */
export const MENU_SLOTS = [
  {
    id: 'home',
    label: '首页',
    href: '/',
    shell: 'index.html',
    pageKey: 'home',
    showInNav: false,
    showInMenu: true,
    defaultMenuTitle: '首页',
    defaultMenuEn: 'HOME',
  },
  {
    id: 'services',
    label: '核心服务',
    href: '/#services',
    shell: 'index.html',
    pageKey: 'home',
    showInNav: true,
    showInMenu: true,
    defaultMenuTitle: '核心服务',
    defaultMenuEn: 'SERVICES',
  },
  {
    id: 'talents',
    label: '达人资源',
    href: '/#talents',
    shell: 'index.html',
    pageKey: 'home',
    showInNav: true,
    showInMenu: true,
    defaultMenuTitle: '达人资源',
    defaultMenuEn: 'TALENTS',
  },
  {
    id: 'live',
    label: '直播案例',
    href: '/#live',
    shell: 'index.html',
    pageKey: 'home',
    showInNav: true,
    showInMenu: true,
    defaultMenuTitle: '直播案例',
    defaultMenuEn: 'LIVE',
  },
  {
    id: 'cases',
    label: '成功案例',
    href: '/#cases',
    shell: 'index.html',
    pageKey: 'home',
    showInNav: true,
    showInMenu: true,
    defaultMenuTitle: '成功案例',
    defaultMenuEn: 'CASES',
  },
  {
    id: 'data',
    label: '数据看板',
    href: '/#data',
    shell: 'index.html',
    pageKey: 'home',
    showInNav: true,
    showInMenu: true,
    defaultMenuTitle: '数据看板',
    defaultMenuEn: 'DATA',
  },
  {
    id: 'about',
    label: '关于我们',
    href: '/#about',
    shell: 'index.html',
    pageKey: 'home',
    showInNav: true,
    showInMenu: true,
    defaultMenuTitle: '关于我们',
    defaultMenuEn: 'ABOUT',
  },
  {
    id: 'contact',
    label: '合作咨询',
    href: '/#contact',
    shell: 'index.html',
    pageKey: 'home',
    showInNav: true,
    showInMenu: true,
    defaultMenuTitle: '合作咨询',
    defaultMenuEn: 'CONTACT',
  },
  {
    id: 'submit',
    label: '提交需求',
    href: '/#contact',
    shell: 'index.html',
    pageKey: 'home',
    showInNav: false,
    showInMenu: true,
    defaultMenuTitle: '提交需求',
    defaultMenuEn: 'SUBMIT',
  },
]

/** 主页面文件名（组件挂载壳） */
export function getSlotShell(slotOrId) {
  if (!slotOrId) return 'index.html'
  if (typeof slotOrId === 'object') {
    if (slotOrId.shell) return slotOrId.shell
    const def = MENU_SLOTS.find((s) => s.id === slotOrId.id)
    return def?.shell || String(slotOrId.href || '/').replace(/^\//, '') || 'index.html'
  }
  const def = MENU_SLOTS.find((s) => s.id === slotOrId)
  return def?.shell || 'index.html'
}

/** 组件片段是否恰好已在当前落地页 DOM 中（仅运行时优化，不表示「归属」） */
export function isUnitNativeToSlot(unit, slot) {
  if (!unit || !slot) return false
  if (unit.customType) return false
  const shell = getSlotShell(slot)
  const preview = String(unit.preview || '').replace(/^\.\//, '').replace(/^\//, '')
  return preview === shell || preview === shell.replace(/^\//, '')
}

/**
 * 页面组件单元
 * - kind: required | nav | footer | content
 * - section/itemId：工作台跳转编辑
 * - pageKey/blockId 或 composeSelector：可跨菜单拼装
 */
/**
 * 内置组件注册表（MCN 单页）
 * - id：唯一标识（代码写死，改显示名不改 id）
 * - label：默认显示名（可在组件库中改名，不覆盖 description）
 * - description：初始描述（固定说明用途，避免改名后混淆）
 * - preview：仅用于后台预览取片段，组件本身不归属某落地页
 */
export const SITE_PAGE_UNITS = [
  {
    id: 'site-nav',
    label: '全站导航',
    description: '顶栏 Logo 文案，以及顶部导航链接的显隐、左右分区与顺序',
    group: '全站',
    kind: 'nav',
    section: 'pages',
    itemId: 'site-nav',
    preview: 'index.html',
    composeSelector: 'header.header',
  },
  {
    id: 'site-footer',
    label: '全站页尾',
    description: '全站页脚导语、链接列、版权与关键词',
    group: '全站',
    kind: 'footer',
    section: 'pages',
    itemId: 'site-footer',
    preview: 'index.html',
    composeSelector: 'footer.footer',
  },
  { id: 'home-seo', label: '首页 SEO', description: '首页标题与 SEO 元信息', group: '首页', kind: 'required', section: 'home', itemId: 'seo', preview: 'index.html' },
  { id: 'home-hero', label: '首屏 Hero', description: '双轮驱动主视觉与数据条', group: '首页', kind: 'content', section: 'home', itemId: 'hero', preview: 'index.html', pageKey: 'home', blockId: 'hero' },
  { id: 'home-services', label: '核心服务', description: '六大核心服务能力', group: '首页', kind: 'content', section: 'home', itemId: 'services', preview: 'index.html', pageKey: 'home', blockId: 'services' },
  { id: 'home-talents', label: '达人资源', description: '双轮驱动达人资源', group: '首页', kind: 'content', section: 'home', itemId: 'talents', preview: 'index.html', pageKey: 'home', blockId: 'talents' },
  { id: 'home-live', label: '直播案例', description: '直播战绩案例', group: '首页', kind: 'content', section: 'home', itemId: 'live', preview: 'index.html', pageKey: 'home', blockId: 'live' },
  { id: 'home-cases', label: '成功案例', description: '品牌合作案例', group: '首页', kind: 'content', section: 'home', itemId: 'cases', preview: 'index.html', pageKey: 'home', blockId: 'cases' },
  { id: 'home-data', label: '数据看板', description: '销售数据图表', group: '首页', kind: 'content', section: 'home', itemId: 'data', preview: 'index.html', pageKey: 'home', blockId: 'data' },
  { id: 'home-process', label: '服务流程', description: '标准化服务流程', group: '首页', kind: 'content', section: 'home', itemId: 'process', preview: 'index.html', pageKey: 'home', blockId: 'process' },
  { id: 'creative-hero', label: '影像首屏 Creative Media', description: '宇航员视频 Hero（项目一迁入）', group: '传媒组件', kind: 'content', section: 'home', itemId: 'creativeHero', preview: 'index.html', pageKey: 'home', blockId: 'creativeHero' },
  { id: 'home-clients', label: '合作客户', description: '合作客户 / 品牌 Logo 矩阵（项目一迁入）', group: '传媒组件', kind: 'content', section: 'home', itemId: 'clients', preview: 'index.html', pageKey: 'home', blockId: 'clients' },
  { id: 'about-team', label: '核心团队架构', description: '核心团队成员与架构（项目一迁入）', group: '传媒组件', kind: 'content', section: 'home', itemId: 'team', preview: 'index.html', pageKey: 'home', blockId: 'team' },
  { id: 'home-about', label: '关于我们', description: '关于光子文化与客户证言', group: '首页', kind: 'content', section: 'home', itemId: 'about', preview: 'index.html', pageKey: 'home', blockId: 'about' },
  { id: 'home-contact', label: '合作咨询', description: '联系信息与咨询表单', group: '首页', kind: 'content', section: 'home', itemId: 'contact', preview: 'index.html', pageKey: 'home', blockId: 'contact' },
]

/** 旧组装 id → 新独立组件 id（兼容已保存配置） */
export const LEGACY_COMPONENT_MAP = {
  'home-who': 'home-about',
  'home-what': 'home-services',
  'home-overseas': 'home-talents',
  'home-mobile': 'home-live',
  'home-ad': 'home-data',
  'home-kol': 'home-talents',
  'home-streamer': 'home-talents',
  'home-venue': 'home-process',
  'home-local': 'home-live',
  'home-news': 'home-data',
  'home-video-hero': 'creative-hero',
  'agency-hero': 'creative-hero',
  'about-intro': 'home-about',
  'about-kt-hero': 'home-about',
  'about-kt-stats': 'home-about',
  'about-kt-story': 'home-about',
  'about-kt-cards': 'home-about',
  'about-reviews': 'home-about',
  'about-logos': 'home-about',
  'about-profile': 'home-about',
  'about-banner': 'home-about',
  'service-hero': 'home-services',
  'service-stack': 'home-services',
  'service-phases': 'home-services',
  'service-services': 'home-services',
  'service-marquee': 'home-services',
  'news-page': 'home-live',
  'news-title': 'home-live',
  'news-categories': 'home-live',
  'news-items': 'home-live',
  'case-page': 'home-cases',
  'case-title': 'home-cases',
  'case-categories': 'home-cases',
  'case-items': 'home-cases',
  'contact-hero': 'home-contact',
  'contact-form': 'home-contact',
  'contact-offices': 'home-contact',
}

export function getPageUnit(id, config = registryConfig) {
  const key = String(id || '')
  const staticUnit = SITE_PAGE_UNITS.find((u) => u.id === key)
  if (staticUnit) return staticUnit
  if (config) {
    ensureCustomComponents(config)
    const inst = getCustomComponent(config, key)
    if (inst) return unitFromCustomInstance(inst)
  }
  return null
}

export function isFixedPageUnit(unit) {
  if (!unit) return false
  return getUnitKind(unit) === 'required' || unit.itemId === 'seo' || String(unit.id || '').endsWith('-seo')
}

export function getUnitKind(unit) {
  if (!unit) return 'content'
  if (unit.kind && COMPONENT_KIND_IDS.has(unit.kind)) return unit.kind
  if (unit.customType) return 'content'
  if (unit.itemId === 'seo' || String(unit.id || '').endsWith('-seo')) return 'required'
  if (unit.id === 'site-nav') return 'nav'
  if (unit.id === 'site-footer') return 'footer'
  return 'content'
}

export function listUnitsByKind(kind, config = registryConfig) {
  const k = String(kind || '')
  const out = []
  SITE_PAGE_UNITS.forEach((u) => {
    if (getUnitKind(u) === k) out.push(u)
  })
  if (k === 'content' && config) {
    ensureCustomComponents(config)
    listCustomUnits(config).forEach((u) => out.push(u))
  }
  return out
}

export function getComposeSelector(unit) {
  if (!unit) return null
  if (unit.customType) return `[data-custom-unit="${unit.id}"]`
  if (unit.composeSelector) return unit.composeSelector
  if (isFixedPageUnit(unit)) return null
  // chrome 不进内容拼装根
  const kind = getUnitKind(unit)
  if (kind === 'nav' || kind === 'footer') return unit.composeSelector || null
  if (unit.id) return `[data-compose-unit="${unit.id}"]`
  return null
}

/** 可绑定到菜单内容区的组件（仅 content） */
export function isComposableUnit(unit) {
  if (!unit || isFixedPageUnit(unit)) return false
  if (getUnitKind(unit) !== 'content') return false
  if (unit.customType) return true
  return Boolean(getComposeSelector(unit))
}

/** 组件库展示：含 chrome + content（不含 required SEO）；个性组件算 content */
export function listLibraryUnits(config = registryConfig) {
  const staticUnits = SITE_PAGE_UNITS.filter((u) => {
    const k = getUnitKind(u)
    return k === 'content' || k === 'nav' || k === 'footer'
  })
  const custom = config ? listCustomUnits(config) : []
  return [...custom, ...staticUnits]
}

/** 可组装到菜单内容区的组件 */
export function listComposableUnits(config = registryConfig) {
  return listLibraryUnits(config).filter((u) => getUnitKind(u) === 'content')
}

/** 某落地页 DOM 上已存在的组件片段（运行时优化用） */
export function listNativeUnitsForSlot(slot, config = registryConfig) {
  return listComposableUnits(config).filter((u) => isUnitNativeToSlot(u, slot))
}

/** 需从其它模板文件拉取的组件 */
export function listForeignUnitsForSlot(slot, config = registryConfig) {
  return listComposableUnits(config).filter((u) => !u.customType && !isUnitNativeToSlot(u, slot))
}

export function normalizeComponentId(id) {
  const key = String(id || '')
  return LEGACY_COMPONENT_MAP[key] || key
}

export function normalizeComponentList(ids, config = registryConfig) {
  if (config) ensureCustomComponents(config)
  const out = []
  const seen = new Set()
  ;(Array.isArray(ids) ? ids : []).forEach((raw) => {
    let id = normalizeComponentId(raw)
    if (id === 'home-gallery' && config) {
      const first = listCustomUnits(config).find((u) => u.customType === 'gallery')
      if (first) id = first.id
      else return
    }
    if (!id || seen.has(id)) return
    if (!isComposableUnit(getPageUnit(id, config))) return
    seen.add(id)
    out.push(id)
  })
  return out
}

/**
 * 新菜单默认组件列表：空（落地页仅头尾）。
 * 历史配置里已有的 components 会原样保留，不会被清空。
 */
export function defaultComponentsForSlot(slot) {
  const id = typeof slot === 'string' ? slot : slot?.id
  const map = {
    home: [
      'home-hero',
      'home-services',
      'home-talents',
      'home-live',
      'home-cases',
      'home-data',
      'home-process',
      'creative-hero',
      'home-clients',
      'about-team',
      'home-about',
      'home-contact',
    ],
    services: ['home-services'],
    talents: ['home-talents'],
    live: ['home-live'],
    cases: ['home-cases'],
    data: ['home-data'],
    about: ['home-about'],
    contact: ['home-contact'],
    submit: ['home-contact'],
  }
  return map[id] || []
}

/** —— 菜单级组件设置（显隐 / 内容覆盖，不改组件库默认值） —— */

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
}

function getByPathLocal(obj, path) {
  if (!path || obj == null) return undefined
  return String(path)
    .split('.')
    .reduce((acc, key) => (acc == null ? undefined : acc[key]), obj)
}

function setByPathLocal(obj, path, value) {
  const keys = String(path).split('.')
  let cur = obj
  keys.forEach((key, i) => {
    if (i === keys.length - 1) {
      cur[key] = value
      return
    }
    if (!isPlainObject(cur[key])) cur[key] = {}
    cur = cur[key]
  })
  return obj
}

function deepMergeLocal(base, override) {
  if (Array.isArray(override)) return override.slice()
  if (!isPlainObject(base) || !isPlainObject(override)) return override === undefined ? base : override
  const out = { ...base }
  Object.keys(override).forEach((key) => {
    const b = base[key]
    const o = override[key]
    if (Array.isArray(o)) out[key] = o.slice()
    else if (isPlainObject(o) && isPlainObject(b)) out[key] = deepMergeLocal(b, o)
    else out[key] = o
  })
  return out
}

export function ensureComponentSettings(slot) {
  if (!slot || typeof slot !== 'object') return {}
  if (!slot.componentSettings || typeof slot.componentSettings !== 'object') {
    slot.componentSettings = {}
  }
  return slot.componentSettings
}

/**
 * 组件区块「风格」：背景色预设（贴合站点白/灰/墨色与青色点缀）
 * id 为空表示跟随组件原有样式
 */
export const COMPONENT_SURFACE_PRESETS = [
  { id: '', label: '默认', hint: '跟随组件原样', bg: '', tone: '', fg: '', muted: '' },
  {
    id: 'white',
    label: '纯白',
    hint: '#FFFFFF',
    bg: '#ffffff',
    tone: 'light',
    fg: '#0f0f0f',
    muted: '#666666',
  },
  {
    id: 'mist',
    label: '浅雾灰',
    hint: '#F7F7F7',
    bg: '#f7f7f7',
    tone: 'light',
    fg: '#0f0f0f',
    muted: '#666666',
  },
  {
    id: 'cloud',
    label: '冷灰白',
    hint: '#EEF1F4',
    bg: '#eef1f4',
    tone: 'light',
    fg: '#0f0f0f',
    muted: '#5c6570',
  },
  {
    id: 'accent-soft',
    label: '青韵浅底',
    hint: '淡青',
    bg: '#e8f7fa',
    tone: 'light',
    fg: '#0f0f0f',
    muted: '#4a6670',
  },
  {
    id: 'ink',
    label: '深墨',
    hint: '#0E1012',
    bg: '#0e1012',
    tone: 'dark',
    fg: '#f3f3f3',
    muted: 'rgba(255,255,255,0.68)',
  },
  {
    id: 'noir',
    label: '炭黑',
    hint: '#111111',
    bg: '#111111',
    tone: 'dark',
    fg: '#f5f5f5',
    muted: 'rgba(255,255,255,0.68)',
  },
  {
    id: 'slate',
    label: '岩灰',
    hint: '#151515',
    bg: '#151515',
    tone: 'dark',
    fg: '#f3f3f3',
    muted: 'rgba(255,255,255,0.7)',
  },
  {
    id: 'midnight',
    label: '午夜蓝黑',
    hint: '#0B1218',
    bg: '#0b1218',
    tone: 'dark',
    fg: '#eef3f7',
    muted: 'rgba(238,243,247,0.7)',
  },
]

export function resolveSurfacePreset(id) {
  const key = String(id || '')
  return COMPONENT_SURFACE_PRESETS.find((p) => p.id === key) || COMPONENT_SURFACE_PRESETS[0]
}

export function getComponentSurfaceId(config, unitId, slot = null) {
  if (!unitId) return ''
  const fromSlot = slot?.componentSettings?.[unitId]?.style?.bg
  if (typeof fromSlot === 'string') return fromSlot
  const fromLib = config?.global?.componentStyles?.[unitId]?.bg
  return typeof fromLib === 'string' ? fromLib : ''
}

export function setComponentSurfaceId(config, unitId, surfaceId, slot = null) {
  if (!config || !unitId) return
  const next = String(surfaceId || '')
  if (slot) {
    const map = ensureComponentSettings(slot)
    if (!map[unitId] || typeof map[unitId] !== 'object') map[unitId] = {}
    if (!map[unitId].style || typeof map[unitId].style !== 'object') map[unitId].style = {}
    if (!next) delete map[unitId].style.bg
    else map[unitId].style.bg = next
    return
  }
  if (!config.global || typeof config.global !== 'object') config.global = {}
  if (!config.global.componentStyles || typeof config.global.componentStyles !== 'object') {
    config.global.componentStyles = {}
  }
  if (!next) {
    delete config.global.componentStyles[unitId]
    return
  }
  config.global.componentStyles[unitId] = {
    ...(config.global.componentStyles[unitId] || {}),
    bg: next,
  }
}

/** 将单个节点套上组件风格（预览弹窗也可直接调用） */
export function applySurfaceToElement(el, unitId, config, slot = null) {
  if (!el || !unitId) return null
  const preset = resolveSurfacePreset(getComponentSurfaceId(config, unitId, slot))
  el.classList.remove('has-component-surface', 'is-surface-light', 'is-surface-dark')
  el.style.removeProperty('--component-surface-bg')
  el.style.removeProperty('--component-surface-fg')
  el.style.removeProperty('--component-surface-muted')
  el.style.removeProperty('color')
  if (!preset.id || !preset.bg) {
    el.style.removeProperty('background-color')
    el.removeAttribute('data-surface')
    el.removeAttribute('data-surface-tone')
    el.removeAttribute('data-surface-unit')
    el.removeAttribute('data-surface-native')
    return preset
  }
  el.classList.add('has-component-surface')
  if (preset.tone === 'dark') el.classList.add('is-surface-dark')
  if (preset.tone === 'light') el.classList.add('is-surface-light')
  el.dataset.surface = preset.id
  el.dataset.surfaceTone = preset.tone || ''
  el.dataset.surfaceUnit = unitId
  const profile = getComponentSurfaceProfile(unitId)
  if (profile?.nativeTone) el.dataset.surfaceNative = profile.nativeTone
  else el.removeAttribute('data-surface-native')
  el.style.setProperty('--component-surface-bg', preset.bg)
  if (preset.fg) {
    el.style.setProperty('--component-surface-fg', preset.fg)
    el.style.color = preset.fg
  }
  if (preset.muted) el.style.setProperty('--component-surface-muted', preset.muted)
  el.style.backgroundColor = preset.bg
  return preset
}

/** 将风格背景应用到 DOM（compose host / data-compose-unit） */
export function applyComponentSurfaces(config, slot = null) {
  const applyEl = (el, unitId) => applySurfaceToElement(el, unitId, config, slot)

  document.querySelectorAll('[data-compose-host]').forEach((host) => {
    const unitId = host.getAttribute('data-compose-host')
    applyEl(host, unitId)
    const inner = host.matches('[data-compose-unit]')
      ? host
      : host.querySelector(':scope > [data-compose-unit], :scope [data-compose-unit]')
    if (inner && inner !== host) applyEl(inner, unitId)
  })

  document.querySelectorAll('[data-compose-unit]').forEach((el) => {
    if (el.closest('[data-compose-host]') && !el.hasAttribute('data-compose-host')) {
      // 已由 host 处理
      const host = el.closest('[data-compose-host]')
      if (host?.getAttribute('data-compose-host') === el.getAttribute('data-compose-unit')) return
    }
    applyEl(el, el.getAttribute('data-compose-unit'))
  })

  document.querySelectorAll('[data-custom-unit]').forEach((el) => {
    applyEl(el, el.getAttribute('data-custom-unit'))
  })
}

export function isSlotComponentVisible(slot, unitId) {
  const s = slot?.componentSettings?.[unitId]
  return !s || s.visible !== false
}

export function setSlotComponentVisible(slot, unitId, visible) {
  if (!slot || !unitId) return
  const map = ensureComponentSettings(slot)
  if (!map[unitId] || typeof map[unitId] !== 'object') map[unitId] = {}
  map[unitId].visible = !!visible
}

export function getSlotComponentDataValue(slot, unitId, path) {
  const data = slot?.componentSettings?.[unitId]?.data
  if (!data || typeof data !== 'object') return undefined
  return getByPathLocal(data, path)
}

export function setSlotComponentDataValue(slot, unitId, path, value) {
  if (!slot || !unitId || !path) return
  const map = ensureComponentSettings(slot)
  if (!map[unitId] || typeof map[unitId] !== 'object') map[unitId] = {}
  if (!map[unitId].data || typeof map[unitId].data !== 'object') map[unitId].data = {}
  setByPathLocal(map[unitId].data, path, value)
}

export function getSlotComponentCustom(slot, unitId) {
  const custom = slot?.componentSettings?.[unitId]?.custom
  return custom && typeof custom === 'object' ? custom : null
}

export function patchSlotComponentCustom(slot, unitId, partial) {
  if (!slot || !unitId || !partial) return null
  const map = ensureComponentSettings(slot)
  if (!map[unitId] || typeof map[unitId] !== 'object') map[unitId] = {}
  map[unitId].custom = { ...(map[unitId].custom || {}), ...partial }
  return map[unitId].custom
}

/** 将当前菜单的内容覆盖合并进配置副本（供前台绑定） */
export function mergeConfigForMenuSlot(config, slot) {
  if (!config || !slot?.componentSettings) return config
  let merged = null
  Object.entries(slot.componentSettings).forEach(([, settings]) => {
    if (!settings?.data || typeof settings.data !== 'object') return
    if (!merged) {
      try {
        merged = structuredClone(config)
      } catch {
        merged = JSON.parse(JSON.stringify(config))
      }
    }
    merged = deepMergeLocal(merged, settings.data)
  })
  return merged || config
}

/** 可见的组装组件 id 列表（隐藏的仍保留在 components 中） */
export function listVisibleSlotComponents(slot, config = registryConfig) {
  const ids = normalizeComponentList(slot?.components, config)
  return ids.filter((id) => isSlotComponentVisible(slot, id))
}
