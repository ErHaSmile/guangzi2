/**
 * 工作台：页面目录 + 菜单组装（组件自由组合）
 */
import { HOME_BLOCKS, PAGE_BLOCKS } from '../config.js'
import {
  CUSTOM_GROUP,
  ensureCustomComponents,
} from '../custom-components.js'
import {
  MENU_SLOTS,
  SITE_PAGE_UNITS,
  LEGACY_COMPONENT_MAP,
  SHELL_OPTIONS,
  COMPONENT_KINDS,
  defaultComponentsForSlot,
  getComposeSelector,
  getPageUnit,
  getSlotShell,
  getUnitKind,
  hrefForShell,
  isGenericShell,
  isHomeMenu,
  isBuiltinMenu,
  isComposableUnit,
  isFixedPageUnit,
  isUnitNativeToSlot,
  listComposableUnits,
  listForeignUnitsForSlot,
  listLibraryUnits,
  listNativeUnitsForSlot,
  listUnitsByKind,
  normalizeComponentList,
  setRegistryConfig,
  ensureComponentSettings,
  isSlotComponentVisible,
  setSlotComponentVisible,
  getSlotComponentDataValue,
  setSlotComponentDataValue,
  getSlotComponentCustom,
  patchSlotComponentCustom,
  mergeConfigForMenuSlot,
  listVisibleSlotComponents,
  COMPONENT_SURFACE_PRESETS,
  getComponentSurfaceProfile,
  getComponentSurfaceId,
  setComponentSurfaceId,
  resolveSurfacePreset,
  applyComponentSurfaces,
  applySurfaceToElement,
} from '../page-registry.js'

export {
  MENU_SLOTS,
  SITE_PAGE_UNITS,
  LEGACY_COMPONENT_MAP,
  SHELL_OPTIONS,
  COMPONENT_KINDS,
  defaultComponentsForSlot,
  getComposeSelector,
  getPageUnit,
  getSlotShell,
  getUnitKind,
  hrefForShell,
  isGenericShell,
  isHomeMenu,
  isBuiltinMenu,
  isComposableUnit,
  isFixedPageUnit,
  isUnitNativeToSlot,
  listComposableUnits,
  listForeignUnitsForSlot,
  listLibraryUnits,
  listNativeUnitsForSlot,
  listUnitsByKind,
  normalizeComponentList,
  setRegistryConfig,
  CUSTOM_GROUP,
  ensureComponentSettings,
  isSlotComponentVisible,
  setSlotComponentVisible,
  getSlotComponentDataValue,
  setSlotComponentDataValue,
  getSlotComponentCustom,
  patchSlotComponentCustom,
  mergeConfigForMenuSlot,
  listVisibleSlotComponents,
  COMPONENT_SURFACE_PRESETS,
  getComponentSurfaceProfile,
  getComponentSurfaceId,
  setComponentSurfaceId,
  resolveSurfacePreset,
  applyComponentSurfaces,
  applySurfaceToElement,
}

export function modulesForPageKey(pageKey) {
  return (PAGE_BLOCKS[pageKey] || []).map((b) => ({ id: b.id, label: b.label }))
}

export function pageUnitsByGroup(config) {
  const map = new Map()
  // 个性组件分组始终存在（可为空，便于「添加」）
  map.set(CUSTOM_GROUP, [])
  listLibraryUnits(config).forEach((u) => {
    const group = getPageUnitGroup(config, u)
    if (!map.has(group)) map.set(group, [])
    map.get(group).push(u)
  })
  return map
}

/** 组件库可选的菜单类型（不含个性组件；个性组件固定分组） */
export function listAssignableCatalogGroups(config) {
  if (config) {
    ensureMenus(config)
    const fromMenus = config.global.menus.map((m) => m.label).filter(Boolean)
    if (fromMenus.length) return [...new Set(fromMenus)]
  }
  return [...new Set(MENU_SLOTS.filter((s) => s.id !== 'submit').map((s) => s.label))]
}

export function getPageUnitGroup(config, unit) {
  if (!unit) return ''
  if (unit.customType) return CUSTOM_GROUP
  const override = config?.global?.pageCatalog?.groups?.[unit.id]
  if (override != null && String(override).trim()) return String(override).trim()
  return unit.group || ''
}

export function setPageUnitGroup(config, unitId, group) {
  ensurePageCatalog(config)
  const unit = getPageUnit(unitId, config)
  if (!unit || unit.customType) return false
  const next = String(group ?? '').trim()
  const allowed = new Set(listAssignableCatalogGroups(config))
  if (!next || !allowed.has(next)) return false

  if (!config.global.pageCatalog.groups || typeof config.global.pageCatalog.groups !== 'object') {
    config.global.pageCatalog.groups = {}
  }
  if (next === (unit.group || '')) delete config.global.pageCatalog.groups[unitId]
  else config.global.pageCatalog.groups[unitId] = next

  // 从各分组排序里摘掉，再由 ensurePageCatalog 归入新分组
  Object.keys(config.global.pageCatalog.order || {}).forEach((g) => {
    const list = config.global.pageCatalog.order[g]
    if (!Array.isArray(list)) return
    config.global.pageCatalog.order[g] = list.filter((id) => id !== unitId)
  })
  ensurePageCatalog(config)
  return true
}

export function ensurePageCatalog(config) {
  setRegistryConfig(config)
  ensureCustomComponents(config)
  if (!config.global || typeof config.global !== 'object') config.global = {}
  if (!config.global.pageCatalog || typeof config.global.pageCatalog !== 'object') {
    config.global.pageCatalog = { labels: {}, order: {}, groups: {} }
  }
  const cat = config.global.pageCatalog
  if (!cat.labels || typeof cat.labels !== 'object') cat.labels = {}
  if (!cat.order || typeof cat.order !== 'object') cat.order = {}
  if (!cat.groups || typeof cat.groups !== 'object') cat.groups = {}

  const allowed = new Set(listAssignableCatalogGroups(config))
  Object.keys(cat.groups).forEach((id) => {
    const g = String(cat.groups[id] || '').trim()
    const unit = getPageUnit(id, config)
    if (!unit || unit.customType || !g || !allowed.has(g) || g === (unit.group || '')) {
      delete cat.groups[id]
    }
  })

  const groups = pageUnitsByGroup(config)
  groups.forEach((units, group) => {
    const movable = units.map((u) => u.id)
    const known = new Set(movable)
    let order = Array.isArray(cat.order[group]) ? cat.order[group].filter((id) => known.has(id)) : []
    movable.forEach((id) => {
      if (!order.includes(id)) order.push(id)
    })
    cat.order[group] = order
  })
  return config
}

export function getPageUnitLabel(config, unit) {
  if (!unit) return ''
  ensurePageCatalog(config)
  const custom = config.global.pageCatalog.labels[unit.id]
  if (custom != null && String(custom).trim()) return String(custom).trim()
  return unit.label
}

/** 初始描述（代码写死，改显示名不覆盖） */
export function getPageUnitDescription(unit) {
  if (!unit) return ''
  const desc = String(unit.description || '').trim()
  if (desc) return desc
  return String(unit.label || '').trim()
}

export function setPageUnitLabel(config, unitId, label) {
  ensurePageCatalog(config)
  const text = String(label ?? '').trim()
  if (!text) delete config.global.pageCatalog.labels[unitId]
  else config.global.pageCatalog.labels[unitId] = text
}

export function getOrderedPageUnits(config, group) {
  ensurePageCatalog(config)
  const all = listLibraryUnits(config).filter((u) => getPageUnitGroup(config, u) === group)
  const byId = new Map(all.map((u) => [u.id, u]))
  const order = config.global.pageCatalog.order[group] || all.map((u) => u.id)
  const out = []
  order.forEach((id) => {
    const u = byId.get(id)
    if (u) out.push(u)
  })
  all.forEach((u) => {
    if (!out.includes(u)) out.push(u)
  })
  return out
}

export function setPageGroupOrder(config, group, orderedIds) {
  ensurePageCatalog(config)
  const all = listLibraryUnits(config).filter((u) => getPageUnitGroup(config, u) === group)
  const known = new Set(all.map((u) => u.id))
  const next = orderedIds.filter((id) => known.has(id))
  all.forEach((u) => {
    if (!next.includes(u.id)) next.push(u.id)
  })
  config.global.pageCatalog.order[group] = next
  return config
}

export function assemblableUnitsForPageKey(pageKey, config) {
  if (!pageKey || !PAGE_BLOCKS[pageKey]) return []
  if (config) ensurePageCatalog(config)
  const seen = new Set()
  const out = []
  const units = config ? listLibraryUnits(config) : SITE_PAGE_UNITS
  units.forEach((u) => {
    if (u.pageKey !== pageKey || !u.blockId) return
    if (seen.has(u.blockId)) return
    seen.add(u.blockId)
    const meta = (PAGE_BLOCKS[pageKey] || []).find((b) => b.id === u.blockId)
    out.push({
      unitId: u.id,
      blockId: u.blockId,
      label: config ? getPageUnitLabel(config, u) : meta?.label || u.label,
      preview: u.preview,
      section: u.section,
      itemId: u.itemId,
    })
  })
  return out
}

function defaultModules(pageKey) {
  return (PAGE_BLOCKS[pageKey] || []).map((b) => b.id)
}

function migrateModulesToComponents(slot, modules) {
  if (!Array.isArray(modules) || !modules.length) return []
  const ids = []
  modules.forEach((blockId) => {
    const u = SITE_PAGE_UNITS.find((x) => x.pageKey === slot.pageKey && x.blockId === blockId)
    if (u && isComposableUnit(u)) ids.push(u.id)
  })
  return normalizeComponentList(ids)
}

function shellMeta(shellOrHref) {
  const s = String(shellOrHref || '')
  return (
    SHELL_OPTIONS.find((o) => o.shell === s || o.href === s) ||
    MENU_SLOTS.find((m) => m.shell === s || m.href === s) ||
    null
  )
}

function newMenuId(base = 'menu') {
  const safe = String(base || 'menu')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'menu'
  return `${safe}-${Date.now().toString(36).slice(-4)}`
}

/** 全站 chrome：导航 / 页尾组件绑定 */
export function ensureChrome(config) {
  if (!config.global || typeof config.global !== 'object') config.global = {}
  if (!config.global.chrome || typeof config.global.chrome !== 'object') config.global.chrome = {}
  const chrome = config.global.chrome
  if (!chrome.nav || typeof chrome.nav !== 'object') chrome.nav = { unitId: 'site-nav', props: {} }
  if (!chrome.nav.unitId) chrome.nav.unitId = 'site-nav'
  if (!chrome.nav.props || typeof chrome.nav.props !== 'object') chrome.nav.props = {}
  if (!chrome.footer || typeof chrome.footer !== 'object') chrome.footer = { unitId: 'site-footer', props: {} }
  if (!chrome.footer.unitId) chrome.footer.unitId = 'site-footer'
  if (!chrome.footer.props || typeof chrome.footer.props !== 'object') chrome.footer.props = {}
  return config
}

/**
 * 菜单实体列表（导航组件的数据源）
 * 从 MENU_SLOTS + 旧 menuAssembly / global.menu / global.nav 迁移
 */
export function ensureMenus(config) {
  setRegistryConfig(config)
  if (!config.global || typeof config.global !== 'object') config.global = {}
  if (!config.global.nav || typeof config.global.nav !== 'object') config.global.nav = {}
  ensureChrome(config)

  const assemblyById = new Map(
    (Array.isArray(config.global.menuAssembly) ? config.global.menuAssembly : []).map((s) => [s.id, s])
  )

  let menus = Array.isArray(config.global.menus) ? config.global.menus.filter((m) => m && m.id) : []

  if (!menus.length) {
    // 首次：用 MENU_SLOTS + 已有组装迁移
    menus = MENU_SLOTS.map((def, order) => {
      const prev = assemblyById.get(def.id) || {}
      const visible = prev.enabled !== false && prev.showInMenu !== false
      const showInNav = prev.showInNav !== undefined ? !!prev.showInNav : !!def.showInNav
      return {
        id: def.id,
        label: prev.navLabel || (def.navKey && config.global.nav[def.navKey]) || def.label,
        title: prev.menuTitle || def.defaultMenuTitle || def.label,
        en: prev.menuEn || def.defaultMenuEn || '',
        href: prev.href || def.href,
        shell: prev.shell || def.shell || getSlotShell(def),
        pageKey: prev.pageKey !== undefined ? prev.pageKey : def.pageKey,
        visible,
        showInNav,
        order,
        locked: true,
      }
    })
  } else {
    // 补齐缺失的种子菜单（不覆盖用户已有项）
    const have = new Set(menus.map((m) => m.id))
    MENU_SLOTS.forEach((def) => {
      if (have.has(def.id)) return
      const prev = assemblyById.get(def.id) || {}
      menus.push({
        id: def.id,
        label: prev.navLabel || def.label,
        title: prev.menuTitle || def.defaultMenuTitle || def.label,
        en: prev.menuEn || def.defaultMenuEn || '',
        href: prev.href || def.href,
        shell: prev.shell || def.shell,
        pageKey: def.pageKey,
        visible: true,
        showInNav: !!def.showInNav,
        order: menus.length,
        locked: true,
      })
    })
  }

  // 丢掉旧多页站内置菜单（service/news/case 等），保留 MENU_SLOTS 与用户自定义项
  const slotIds = new Set(MENU_SLOTS.map((s) => s.id))
  const legacyDrop = new Set(['service', 'news', 'case'])
  menus = menus.filter((m) => {
    if (legacyDrop.has(m.id)) return false
    if (slotIds.has(m.id)) return true
    // 自定义菜单：若仍指向旧多页壳，一并移除
    const shell = String(m.shell || m.href || '')
    if (/(^|\/)(about|service|news|case)\.html/i.test(shell)) return false
    return true
  })

  // 规范化 + 按 order 排序
  menus = menus
    .map((raw, i) => {
      const def = MENU_SLOTS.find((s) => s.id === raw.id)
      const locked = raw.locked === true || Boolean(def)
      let shell = raw.shell || def?.shell || shellMeta(raw.href)?.shell || 'index.html'
      let href = raw.href || def?.href || shellMeta(shell)?.href || '/'
      let pageKey = raw.pageKey !== undefined ? raw.pageKey : def?.pageKey ?? shellMeta(shell)?.pageKey ?? null
      // 内置菜单：壳与入口链接以系统定义为准，避免被误改
      if (def && locked) {
        shell = def.shell
        href = def.href
        pageKey = def.pageKey ?? null
      }
      const defaultAside = raw.id === 'contact' || raw.id === 'submit'
      return {
        id: String(raw.id),
        label: String(raw.label || def?.label || raw.id).trim() || raw.id,
        title: String(raw.title || raw.menuTitle || def?.defaultMenuTitle || raw.label || raw.id).trim(),
        en: String(raw.en || raw.menuEn || def?.defaultMenuEn || '').trim(),
        href: String(href),
        shell: String(shell),
        pageKey,
        visible: raw.visible !== false,
        showInNav: raw.showInNav !== undefined ? !!raw.showInNav : !!def?.showInNav,
        navAside: raw.navAside !== undefined ? !!raw.navAside : defaultAside,
        order: Number.isFinite(Number(raw.order)) ? Number(raw.order) : i,
        locked,
      }
    })
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
    .map((m, i) => ({ ...m, order: i }))

  // 首页固定为站点入口：始终可见、锁定、固定壳与链接，并置顶
  const homeIdx = menus.findIndex((m) => isHomeMenu(m))
  if (homeIdx >= 0) {
    const home = {
      ...menus[homeIdx],
      visible: true,
      locked: true,
      shell: 'index.html',
      href: '/',
      pageKey: 'home',
    }
    menus.splice(homeIdx, 1)
    menus.unshift(home)
  }
  config.global.menus = menus.map((m, i) => ({ ...m, order: i }))
  return config
}

export function listMenus(config) {
  ensureMenus(config)
  return config.global.menus
}

export function getMenuById(config, id) {
  return listMenus(config).find((m) => m.id === id) || null
}

/** 导航组件可见菜单项（写入 global.menu / 顶栏） */
export function listNavMenuItems(config) {
  return listMenus(config)
    .filter((m) => m.visible)
    .map((m) => ({
      title: m.title || m.label,
      en: m.en || '',
      href: m.href,
      label: m.label,
      showInNav: m.showInNav,
      id: m.id,
    }))
}

export function addMenu(config, partial = {}) {
  ensureMenus(config)
  const shell = partial.shell || 'page.html'
  const meta = shellMeta(shell)
  const id = partial.id && !getMenuById(config, partial.id) ? String(partial.id) : newMenuId(partial.label || meta?.label || 'menu')
  const href =
    partial.href !== undefined && partial.href !== null && String(partial.href).trim() !== ''
      ? String(partial.href).trim()
      : hrefForShell(shell, id)
  const menu = {
    id,
    label: String(partial.label || meta?.label || '新菜单').trim(),
    title: String(partial.title || partial.label || meta?.label || '新菜单').trim(),
    en: String(partial.en || '').trim(),
    href,
    shell,
    pageKey: partial.pageKey !== undefined ? partial.pageKey : meta?.pageKey ?? null,
    visible: partial.visible !== false,
    showInNav: partial.showInNav !== false,
    navAside: partial.navAside === true,
    order: config.global.menus.length,
    locked: false,
  }
  config.global.menus.push(menu)
  ensureMenuAssembly(config)
  return menu
}

export function removeMenu(config, id) {
  ensureMenus(config)
  const menu = getMenuById(config, id)
  if (!menu) return false
  if (menu.locked || isHomeMenu(menu)) return false
  config.global.menus = config.global.menus.filter((m) => m.id !== id)
  if (Array.isArray(config.global.menuAssembly)) {
    config.global.menuAssembly = config.global.menuAssembly.filter((s) => s.id !== id)
  }
  ensureMenus(config)
  return true
}

export function reorderMenus(config, orderedIds) {
  ensureMenus(config)
  const byId = new Map(config.global.menus.map((m) => [m.id, m]))
  const next = []
  ;(orderedIds || []).forEach((id) => {
    if (isHomeMenu(id)) return
    const m = byId.get(id)
    if (m) {
      next.push(m)
      byId.delete(id)
    }
  })
  byId.forEach((m) => {
    if (!isHomeMenu(m)) next.push(m)
  })
  const home = config.global.menus.find((m) => isHomeMenu(m))
  config.global.menus = (home ? [home, ...next] : next).map((m, i) => ({ ...m, order: i }))
  return config
}

/** 初始化菜单组装：以 global.menus 为准，保留各菜单 components */
export function ensureMenuAssembly(config) {
  setRegistryConfig(config)
  ensureCustomComponents(config)
  ensureMenus(config)
  if (!Array.isArray(config.global.menuAssembly)) config.global.menuAssembly = []

  const byId = new Map(config.global.menuAssembly.map((s) => [s.id, s]))
  const menus = config.global.menus

  const next = menus.map((menu) => {
    const def = MENU_SLOTS.find((s) => s.id === menu.id) || {}
    const prev = byId.get(menu.id) || {}

    // 菜单实体字段优先；组装槽同步冗余字段供旧 UI / compose
    const navLabel = menu.label
    const menuTitle = menu.title
    const menuEn = menu.en

    let components
    if (Array.isArray(prev.components)) {
      components = normalizeComponentList(prev.components, config)
      if (!components.length && prev.components.length) {
        const stillUnknown = prev.components.every((id) => {
          const mapped = LEGACY_COMPONENT_MAP[String(id)] || String(id)
          return !isComposableUnit(getPageUnit(mapped, config))
        })
        if (stillUnknown) components = defaultComponentsForSlot(menu)
      }
      if (!components.length && !prev.components.length) {
        components = defaultComponentsForSlot(menu)
      }
    } else if (Array.isArray(prev.modules)) {
      components = migrateModulesToComponents({ pageKey: menu.pageKey }, prev.modules)
      if (!components.length) components = defaultComponentsForSlot(menu)
    } else {
      components = defaultComponentsForSlot(menu)
    }

    let modules = Array.isArray(prev.modules) ? prev.modules.filter(Boolean) : null
    if (menu.pageKey) {
      const allowed = new Set(defaultModules(menu.pageKey))
      if (!modules) {
        modules = components
          .map((id) => getPageUnit(id, config)?.blockId)
          .filter((id) => id && allowed.has(id))
        modules = [...new Set(modules)]
      } else modules = modules.filter((id) => allowed.has(id))
    } else {
      modules = []
    }

    return {
      id: menu.id,
      navLabel,
      menuTitle,
      menuEn,
      href: menu.href,
      shell: menu.shell || getSlotShell(menu),
      pageKey: menu.pageKey,
      components,
      modules,
      showInNav: menu.showInNav,
      showInMenu: menu.visible,
      enabled: menu.visible,
      componentSettings:
        prev.componentSettings && typeof prev.componentSettings === 'object'
          ? prev.componentSettings
          : {},
    }
  })

  config.global.menuAssembly = next
  return config
}

/**
 * 同步：menus → global.menu / nav；components → blocks
 */
export function syncMenuAssembly(config) {
  ensureMenuAssembly(config)
  ensureChrome(config)
  const menus = config.global.menus
  const slots = config.global.menuAssembly
  if (!config.global.nav) config.global.nav = {}

  // 顶栏：仅 showInNav 且可见的菜单
  const navKeyByHref = {
    service: 'service',
    about: 'about',
    case: 'case',
    news: 'news',
    contact: 'contact',
  }
  Object.values(navKeyByHref).forEach((k) => {
    delete config.global.nav[k]
  })
  menus.forEach((menu) => {
    if (!menu.visible || !menu.showInNav) return
    const path = String(menu.href || '').split('#')[0]
    const file = path.replace(/^\//, '').replace(/\.html?$/i, '') || 'index'
    const key = navKeyByHref[file]
    if (key) config.global.nav[key] = menu.label
  })

  slots.forEach((slot) => {
    if (slot.pageKey && PAGE_BLOCKS[slot.pageKey]) {
      if (!config.pages) config.pages = {}
      if (!config.pages[slot.pageKey]) config.pages[slot.pageKey] = {}
      const page = config.pages[slot.pageKey]
      if (!page.blocks || typeof page.blocks !== 'object') page.blocks = {}

      const comps = Array.isArray(slot.components) ? slot.components : []
      const nativeBlocks = []
      const seen = new Set()
      comps.forEach((unitId) => {
        if (!isSlotComponentVisible(slot, unitId)) return
        const u = getPageUnit(unitId, config)
        if (!u || u.pageKey !== slot.pageKey || !u.blockId) return
        if (seen.has(u.blockId)) return
        seen.add(u.blockId)
        nativeBlocks.push(u.blockId)
      })
      slot.modules = nativeBlocks

      // 仅「落地页主菜单」(id === pageKey) 可写回整页 blockOrder / blocks。
      // MCN 锚点菜单（services/talents/…）共用 pageKey=home，若也写回会互相覆盖，
      // 最终常变成只剩 contact，前台顺序错乱。
      const ownsPageBlocks = slot.id === slot.pageKey
      if (!ownsPageBlocks) return

      page.blockOrder = nativeBlocks.slice()
      const allowedIds = new Set((PAGE_BLOCKS[slot.pageKey] || []).map((b) => b.id))
      Object.keys(page.blocks).forEach((id) => {
        if (!allowedIds.has(id)) delete page.blocks[id]
      })
      ;(PAGE_BLOCKS[slot.pageKey] || []).forEach(({ id }) => {
        page.blocks[id] = nativeBlocks.includes(id)
      })
    }
  })

  const telItem = (config.global.menu || []).find(
    (m) => String(m?.href || '').startsWith('tel:') || String(m?.title || '').toUpperCase().startsWith('TEL')
  )
  const menu = listNavMenuItems(config).map((m) => ({
    title: m.title,
    en: m.en,
    href: m.href,
  }))
  if (telItem) {
    menu.push({ title: telItem.title, en: telItem.en || 'Call Us Now', href: telItem.href })
  } else if (config.global.tel) {
    menu.push({
      title: `TEL：${config.global.tel}`,
      en: 'Call Us Now',
      href: `tel:${String(config.global.tel).replace(/\s/g, '')}`,
    })
  }
  config.global.menu = menu

  // 导航组件 props.items = 全屏菜单数据
  if (config.global.chrome?.nav) {
    config.global.chrome.nav.props = {
      ...(config.global.chrome.nav.props || {}),
      items: menu.slice(),
    }
  }
  return config
}

export { HOME_BLOCKS }
