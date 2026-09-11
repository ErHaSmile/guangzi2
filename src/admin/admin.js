import {
  brToNewlines,
  clearLocalConfig,
  configMeta,
  ensureClientRollSettings as ensureClientRollSettingsInConfig,
  ensureHomeBlocks,
  ensureHomeKol,
  ensureHomeStreamer,
  ensureHomeVenue,
  ensureHomeLocal,
  ensureHomeClients,
  ensureHomeWhatItems,
  ensureAboutIntro,
  ensureAboutTeam,
  ensureAboutProfile,
  seedHomeClientsDemo,
  ensurePageBlocks,
  HOME_BLOCKS,
  PAGE_BLOCKS,
  loadSiteConfig,
  saveRemoteConfig,
} from '../config.js'
import { ensureMcnHomeLists } from '../mcn/mcn-lists.js'
import {
  createCustomComponent,
  CUSTOM_GROUP,
  ensureCustomComponents,
  getCustomComponent,
  removeCustomComponent,
  updateCustomComponent,
  createGalleryElement,
} from '../custom-components.js'
import { apiFetch } from './api.js'
import { createControl } from './fields.js'
import {
  createMultiImageField,
  createMediaLibraryManager,
  openConfirmModal,
  syncMediaUsageIndex,
} from './media.js'
import { listWhatIconOptions, getWhatIconById, DEFAULT_WHAT_ICON_IDS } from '../what-icons.js'
import {
  MENU_SLOTS,
  SITE_PAGE_UNITS,
  SHELL_OPTIONS,
  COMPONENT_KINDS,
  defaultComponentsForSlot,
  ensureMenuAssembly,
  ensureMenus,
  ensureChrome,
  ensurePageCatalog,
  getOrderedPageUnits,
  getComposeSelector,
  getPageUnit,
  getPageUnitGroup,
  getPageUnitLabel,
  getPageUnitDescription,
  getSlotShell,
  getUnitKind,
  listAssignableCatalogGroups,
  listComposableUnits,
  listUnitsByKind,
  pageUnitsByGroup,
  setPageUnitGroup,
  setPageUnitLabel,
  setRegistryConfig,
  syncMenuAssembly,
  isSlotComponentVisible,
  setSlotComponentVisible,
  getSlotComponentCustom,
  patchSlotComponentCustom,
  addMenu,
  removeMenu,
  reorderMenus,
  getMenuById,
  listMenus,
  hrefForShell,
  isGenericShell,
  isHomeMenu,
  isBuiltinMenu,
  COMPONENT_SURFACE_PRESETS,
  getComponentSurfaceProfile,
  getComponentSurfaceId,
  setComponentSurfaceId,
  resolveSurfacePreset,
  applySurfaceToElement,
} from './site-pages.js'

/** 系统侧栏项（非菜单维护数据） */
const SYSTEM_NAV = [
  { id: 'pages', label: '页面组件', preview: 'index.html' },
  { id: 'media', label: '素材库', preview: 'index.html' },
  { id: 'leads', label: '留言', preview: 'contact.html' },
]

/** 静态回退：无配置时的页面预览映射 */
const PAGES = [
  { id: 'pages', label: '页面组件', preview: 'index.html' },
  { id: 'home', label: '首页', preview: 'index.html' },
  { id: 'media', label: '素材库', preview: 'index.html' },
  { id: 'leads', label: '留言', preview: 'index.html' },
]

const pageNav = document.getElementById('pageNav')
const configBar = document.getElementById('configBar')
const configCatTabs = document.getElementById('configCatTabs')
const sectionTitle = document.getElementById('sectionTitle')
const statusText = document.getElementById('statusText')
const previewFrame = document.getElementById('previewFrame')
const previewPageLabel = document.getElementById('previewPageLabel')
const openPreview = document.getElementById('openPreview')
const adminWorkspace = document.getElementById('adminWorkspace')

let config = null
let currentSection = 'home'
let previewTimer = null
let dirty = false
let activeConfigId = null
/** 页面组件工作区当前展示项：catalog | menu-assembly */
let workspaceItemId = 'catalog'
let editorModal = null
/** @type {HTMLElement[]} 配置弹窗栈：支持组件库上叠层编辑 */
let editorModalStack = []
let configBarCategory = null

let toastHost = null
let statusFlashTimer = null

function ensureToastHost() {
  if (toastHost) return toastHost
  toastHost = document.createElement('div')
  toastHost.className = 'admin-toast-host'
  toastHost.setAttribute('aria-live', 'polite')
  toastHost.setAttribute('aria-relevant', 'additions')
  document.body.appendChild(toastHost)
  return toastHost
}

/** 顶部状态栏 + 右下角 Toast；typing 类频繁操作传 { toast: false } */
function setStatus(msg, ok = true, opts = {}) {
  const text = String(msg || '')
  const type = !ok ? 'err' : opts.type || 'ok'
  statusText.textContent = text
  statusText.style.color = type === 'err' ? 'var(--danger)' : type === 'info' ? 'var(--accent)' : 'var(--ok)'
  statusText.classList.remove('is-flash')
  void statusText.offsetWidth
  statusText.classList.add('is-flash')
  clearTimeout(statusFlashTimer)
  statusFlashTimer = setTimeout(() => statusText.classList.remove('is-flash'), 600)
  if (opts.toast === false) return
  showToast(text, type)
}

function showToast(msg, type = 'ok') {
  const text = String(msg || '').trim()
  if (!text) return
  const host = ensureToastHost()
  const el = document.createElement('div')
  el.className = `admin-toast is-${type}`
  el.textContent = text
  host.appendChild(el)
  requestAnimationFrame(() => el.classList.add('is-show'))
  const life = type === 'err' ? 4200 : 2600
  setTimeout(() => {
    el.classList.remove('is-show')
    setTimeout(() => el.remove(), 280)
  }, life)
}

/** 离散操作提示（带 Toast）；连续编辑用 markDirty() 即可 */
function notify(msg, type = 'ok') {
  setStatus(msg, type !== 'err', { toast: true, type })
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj))
}

/** 菜单组装内编辑时：读写走 slot.componentSettings，不覆盖组件库默认值 */
let contentEditContext = null // { slotId, unitId } | null

function resolveEditSlot() {
  if (!contentEditContext?.slotId || !config) return null
  ensureMenuAssembly(config)
  return config.global.menuAssembly.find((s) => s.id === contentEditContext.slotId) || null
}

function getPath(obj, path) {
  if (obj === config && contentEditContext?.unitId) {
    const slot = resolveEditSlot()
    if (slot) {
      const data = slot.componentSettings?.[contentEditContext.unitId]?.data
      if (data) {
        const ov = path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), data)
        if (ov !== undefined) return ov
      }
    }
  }
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj)
}

function setPath(obj, path, value) {
  if (obj === config && contentEditContext?.unitId) {
    const slot = resolveEditSlot()
    if (slot) {
      const map = slot.componentSettings || (slot.componentSettings = {})
      const unitId = contentEditContext.unitId
      if (!map[unitId] || typeof map[unitId] !== 'object') map[unitId] = {}
      if (!map[unitId].data || typeof map[unitId].data !== 'object') map[unitId].data = {}
      const keys = path.split('.')
      let cur = map[unitId].data
      keys.forEach((key, i) => {
        if (i === keys.length - 1) cur[key] = value
        else {
          if (!cur[key] || typeof cur[key] !== 'object') cur[key] = {}
          cur = cur[key]
        }
      })
      return
    }
  }
  const keys = path.split('.')
  let cur = obj
  keys.forEach((key, i) => {
    if (i === keys.length - 1) cur[key] = value
    else {
      if (!cur[key] || typeof cur[key] !== 'object') cur[key] = {}
      cur = cur[key]
    }
  })
}

function field(label, path, type = 'text', opts = {}) {
  return createControl({
    label,
    type,
    hint: opts.hint,
    rows: opts.rows,
    placeholder: opts.placeholder,
    value: getPath(config, path),
    onStatus: setStatus,
    onChange: (next) => {
      setPath(config, path, next)
      markDirty()
      schedulePreview()
    },
  })
}

function selectField(label, path, options, opts = {}) {
  const wrap = document.createElement('label')
  wrap.className = 'field'
  const lab = document.createElement('span')
  lab.className = 'field-label'
  lab.textContent = label
  const sel = document.createElement('select')
  sel.className = 'field-input'
  const cur = String(getPath(config, path) ?? '')
  ;(options || []).forEach(([value, text]) => {
    const opt = document.createElement('option')
    opt.value = value
    opt.textContent = text
    if (String(value) === cur) opt.selected = true
    sel.appendChild(opt)
  })
  sel.addEventListener('change', () => {
    const raw = sel.value
    const next = opts.asNumber ? Number(raw) : raw
    setPath(config, path, opts.asNumber && !Number.isFinite(next) ? opts.fallback ?? 0 : next)
    markDirty()
    schedulePreview()
    opts.onChange?.(next)
  })
  wrap.append(lab, sel)
  if (opts.hint) {
    const hint = document.createElement('span')
    hint.className = 'field-hint'
    hint.textContent = opts.hint
    wrap.appendChild(hint)
  }
  return wrap
}

function buildWhoLeftPanel() {
  if (!getPath(config, 'pages.home.whoLeftMode')) {
    setPath(config, 'pages.home.whoLeftMode', 'rolls')
  }
  const imageBox = document.createElement('div')
  imageBox.className = 'who-left-image-field'
  imageBox.append(
    sectionNote('图片将填充左侧整列区域，与客户滚动二选一。'),
    field('左侧图片', 'pages.home.whoLeftImage', 'image')
  )
  const syncImageField = () => {
    imageBox.hidden = getPath(config, 'pages.home.whoLeftMode') !== 'image'
  }
  syncImageField()
  return block('', [
    selectField(
      '显示方式',
      'pages.home.whoLeftMode',
      [
        ['rolls', '客户滚动文字'],
        ['image', '图片填充'],
      ],
      { hint: '切换左侧区域的展示形式', onChange: syncImageField }
    ),
    imageBox,
  ])
}

function numberField(label, path, opts = {}) {
  const min = opts.min ?? 0
  const max = opts.max ?? 999
  const raw = getPath(config, path)
  const display =
    raw == null || raw === ''
      ? opts.fallback !== undefined
        ? opts.fallback
        : opts.allowEmpty
          ? ''
          : min
      : raw
  return createControl({
    label,
    type: 'number',
    hint: opts.hint,
    placeholder: opts.placeholder,
    value: display,
    onStatus: setStatus,
    onChange: (next) => {
      if (opts.allowEmpty && (next === '' || next == null)) {
        setPath(config, path, null)
        markDirty()
        schedulePreview()
        return
      }
      let n = Number(next)
      if (!Number.isFinite(n)) n = opts.fallback ?? min
      n = Math.min(max, Math.max(min, Math.round(n)))
      setPath(config, path, n)
      markDirty()
      schedulePreview()
    },
  })
}

/** 文案 + 字号 + 下边距（服务首屏等） */
function styledCopyField(label, textPath, sizePath, mbPath, opts = {}) {
  const wrap = document.createElement('div')
  wrap.className = 'styled-copy-field'
  const textType = opts.type || 'text'
  wrap.appendChild(
    field(label, textPath, textType, {
      rows: opts.rows,
      hint: opts.hint,
    })
  )
  const styleRow = document.createElement('div')
  styleRow.className = 'styled-copy-style-row'
  styleRow.append(
    numberField('字体大小 (px)', sizePath, {
      min: 0,
      max: opts.sizeMax ?? 96,
      fallback: 0,
      hint: opts.sizeHint || '0 = 使用默认字号',
    }),
    numberField('下边距 (px)', mbPath, {
      min: 0,
      max: 120,
      allowEmpty: true,
      fallback: '',
      placeholder: opts.mbPlaceholder || '默认',
      hint: opts.mbHint || '留空 = 默认间距；可填 0',
    })
  )
  wrap.appendChild(styleRow)
  return wrap
}

function sectionNote(text) {
  const p = document.createElement('p')
  p.className = 'section-note'
  p.textContent = text
  return p
}

function pageBlockPath(pageKey, id) {
  return `pages.${pageKey}.blocks.${id}`
}

function pageBlockOrderPath(pageKey) {
  return `pages.${pageKey}.blockOrder`
}

function isHomeBlockOn(id) {
  return isPageBlockOn('home', id)
}

function isPageBlockOn(pageKey, id) {
  ensurePageBlocks(config, pageKey)
  return getPath(config, pageBlockPath(pageKey, id)) !== false
}

function setHomeBlockVisible(id, visible) {
  setPageBlockVisible('home', id, visible)
}

function setPageBlockVisible(pageKey, id, visible) {
  ensurePageBlocks(config, pageKey)
  setPath(config, pageBlockPath(pageKey, id), !!visible)
  // 显隐以「菜单维护」为准，不再反向增删 components
  const defs = PAGE_BLOCKS[pageKey] || HOME_BLOCKS
  const label = defs.find((b) => b.id === id)?.label || id
  markDirty()
  schedulePreview()
  renderConfigBar()
  notify(visible ? `已显示「${label}」，请保存` : `已隐藏「${label}」，请保存`, 'info')
}

/** 将页面模块显隐同步到菜单组装列表 */
function syncPageBlockInMenuAssembly(pageKey, blockId, visible) {
  ensureMenuAssembly(config)
  const unitId = (SITE_PAGE_UNITS || []).find((u) => u.pageKey === pageKey && u.blockId === blockId)?.id
  if (!unitId) return
  const slots = config.global?.menuAssembly
  if (!Array.isArray(slots)) return
  slots.forEach((slot) => {
    if (slot.pageKey !== pageKey) return
    let list = Array.isArray(slot.components) ? [...slot.components] : []
    const has = list.includes(unitId)
    if (visible && !has) {
      // 插到同页其它 about/home 组件前面或列表头
      const sib = list.findIndex((id) => String(id).startsWith(`${pageKey}-`))
      if (sib >= 0) list.splice(sib, 0, unitId)
      else list.unshift(unitId)
      slot.components = list
    } else if (!visible && has) {
      slot.components = list.filter((id) => id !== unitId)
    }
  })
  syncMenuAssembly(config)
}

function getPageBlockOrder(pageKey) {
  ensurePageBlocks(config, pageKey)
  const order = getPath(config, pageBlockOrderPath(pageKey))
  return Array.isArray(order) ? order : (PAGE_BLOCKS[pageKey] || []).map(({ id }) => id)
}

/** 将本页 blockOrder 同步进对应菜单的 components（保留跨页/个性组件相对位置） */
function syncBlockOrderToMenuAssembly(pageKey, newOrder) {
  ensureMenuAssembly(config)
  const slot = (config.global?.menuAssembly || []).find((s) => s.pageKey === pageKey)
  if (!slot || !Array.isArray(slot.components)) return

  const blockToUnit = new Map()
  ;(SITE_PAGE_UNITS || []).forEach((u) => {
    if (u.pageKey === pageKey && u.blockId) blockToUnit.set(u.blockId, u.id)
  })
  const nativeIds = new Set([...blockToUnit.values()])
  const pending = newOrder.map((bid) => blockToUnit.get(bid)).filter((id) => id && slot.components.includes(id))
  const used = new Set()
  let ni = 0
  const next = []
  slot.components.forEach((id) => {
    if (nativeIds.has(id)) {
      while (ni < pending.length && used.has(pending[ni])) ni += 1
      if (ni < pending.length) {
        next.push(pending[ni])
        used.add(pending[ni])
        ni += 1
      }
      return
    }
    next.push(id)
  })
  pending.forEach((id) => {
    if (!used.has(id)) next.push(id)
  })
  slot.components = next
}

function setPageBlockOrder(pageKey, newOrder) {
  ensurePageBlocks(config, pageKey)
  setPath(config, pageBlockOrderPath(pageKey), Array.isArray(newOrder) ? [...newOrder] : newOrder)
  syncBlockOrderToMenuAssembly(pageKey, getPageBlockOrder(pageKey))
  syncMenuAssembly(config)
  markDirty()
  schedulePreview()
  renderConfigBar()
}

/** 配置栏：拖拽已组装组件芯片，直接改菜单 components 顺序（同步本页 blockOrder） */
function syncMenuAssemblyToBlockOrder(slot) {
  if (!slot?.pageKey || !Array.isArray(slot.components)) return
  const pageKey = slot.pageKey
  if (!PAGE_BLOCKS[pageKey]) return
  // 锚点菜单共用 pageKey 时，不写回整页 blockOrder（避免把单组件菜单顶到最前）
  if (slot.id !== pageKey) return
  const order = []
  const seen = new Set()
  slot.components.forEach((id) => {
    const unit = getPageUnit(id, config)
    if (unit?.pageKey === pageKey && unit.blockId && !seen.has(unit.blockId)) {
      order.push(unit.blockId)
      seen.add(unit.blockId)
    }
  })
  ;(PAGE_BLOCKS[pageKey] || []).forEach(({ id }) => {
    if (!seen.has(id)) order.push(id)
  })
  ensurePageBlocks(config, pageKey)
  setPath(config, pageBlockOrderPath(pageKey), order)
}

function reorderAssemblyComponent(sectionId, fromUnitId, toUnitId) {
  if (!fromUnitId || !toUnitId || fromUnitId === toUnitId) return false
  const slot = resolveMenuSlotForSection(sectionId)
  if (!slot || !Array.isArray(slot.components)) return false
  const from = slot.components.indexOf(fromUnitId)
  const to = slot.components.indexOf(toUnitId)
  if (from < 0 || to < 0) return false
  const next = [...slot.components]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  slot.components = next
  syncMenuAssemblyToBlockOrder(slot)
  markAssemblyDirty()
  const unit = getPageUnit(moved, config)
  notify(`已调整「${getPageUnitLabel(config, unit) || moved}」顺序，请保存`, 'info')
  return true
}

function setAssemblyComponentVisible(sectionId, unitId, visible) {
  const slot = resolveMenuSlotForSection(sectionId)
  if (!slot || !unitId) return
  setSlotComponentVisible(slot, unitId, visible)
  const unit = getPageUnit(unitId, config)
  if (unit?.pageKey && unit.blockId && PAGE_BLOCKS[unit.pageKey]) {
    ensurePageBlocks(config, unit.pageKey)
    setPath(config, pageBlockPath(unit.pageKey, unit.blockId), !!visible)
  }
  const label = getPageUnitLabel(config, unit) || unitId
  markAssemblyDirty()
  notify(visible ? `已显示「${label}」，请保存` : `已隐藏「${label}」，请保存`, 'info')
}

function movePageBlock(pageKey, id, dir) {
  const order = getPageBlockOrder(pageKey)
  const idx = order.indexOf(id)
  if (idx < 0) return
  const target = idx + dir
  if (target < 0 || target >= order.length) return
  ;[order[idx], order[target]] = [order[target], order[idx]]
  setPageBlockOrder(pageKey, order)
  renderConfigBar()
}

function createVisibilitySwitch(id, opts = {}) {
  const pageKey = opts.pageKey || 'home'
  const on = isPageBlockOn(pageKey, id)
  const wrap = document.createElement('label')
  wrap.className = `vis-switch${on ? '' : ' is-off'}`
  if (opts.compact) wrap.classList.add('is-compact')

  const input = document.createElement('input')
  input.type = 'checkbox'
  input.checked = on
  input.addEventListener('click', (e) => e.stopPropagation())
  const apply = () => {
    setPageBlockVisible(pageKey, id, input.checked)
    wrap.classList.toggle('is-off', !input.checked)
    text.textContent = input.checked ? '显示中' : '已隐藏'
    wrap.title = input.checked ? '点击隐藏该区块' : '点击显示该区块'
    if (opts.onChange) opts.onChange(input.checked)
  }
  input.addEventListener('change', apply)

  const track = document.createElement('span')
  track.className = 'vis-switch-track'
  track.setAttribute('aria-hidden', 'true')

  const text = document.createElement('span')
  text.className = 'vis-switch-text'
  text.textContent = on ? '显示中' : '已隐藏'

  wrap.append(input, track, text)
  wrap.title = on ? '点击隐藏该区块' : '点击显示该区块'
  // 轨道可点（input 本身 pointer-events:none）
  track.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    input.checked = !input.checked
    apply()
  })
  return wrap
}

function homeBlockToggleNote(id) {
  return pageBlockToggleNote('home', id)
}

function pageBlockToggleNote(_pageKey, _id) {
  const row = document.createElement('p')
  row.className = 'section-note'
  row.textContent = contentEditContext
    ? '当前为菜单覆盖编辑：修改只作用于本菜单，不覆盖组件库默认值。显隐请在「菜单维护」列表中切换。'
    : '此处维护组件默认内容与预览。前台显隐、菜单专属文案请在「页面组件 → 菜单维护」中控制。'
  return row
}

/** 构建模块排序行（可复用，支持内嵌面板） */
function buildBlockOrderRow(pageKey, id, idx, opts = {}) {
  const defs = PAGE_BLOCKS[pageKey] || []
  const meta = defs.find((b) => b.id === id)
  const row = document.createElement('div')
  row.className = 'block-order-row'
  row.dataset.blockId = id

  const handle = document.createElement('span')
  handle.className = 'block-order-handle'
  handle.textContent = '⣿'
  handle.title = '拖拽排序'
  handle.draggable = true

  const label = document.createElement('span')
  label.className = 'block-order-label'
  label.textContent = meta?.label || id

  const actions = document.createElement('div')
  actions.className = 'block-order-actions'

  const upBtn = document.createElement('button')
  upBtn.type = 'button'
  upBtn.className = 'block-order-btn'
  upBtn.textContent = '↑'
  upBtn.title = '上移'
  upBtn.disabled = idx === 0
  upBtn.addEventListener('click', () => movePageBlock(pageKey, id, -1))

  const downBtn = document.createElement('button')
  downBtn.type = 'button'
  downBtn.className = 'block-order-btn'
  downBtn.textContent = '↓'
  downBtn.title = '下移'
  const lastIdx = opts.total ? opts.total - 1 : idx
  downBtn.disabled = idx === lastIdx
  downBtn.addEventListener('click', () => movePageBlock(pageKey, id, 1))

  actions.append(upBtn, downBtn)
  row.append(handle, label, actions)

  // 拖拽排序（仅 handle 触发拖拽，避免干扰子元素点击）
  row.addEventListener('dragover', (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    row.classList.add('is-drag-over')
  })
  row.addEventListener('dragleave', () => {
    row.classList.remove('is-drag-over')
  })
  row.addEventListener('drop', (e) => {
    e.preventDefault()
    row.classList.remove('is-drag-over')
    const dragId = e.dataTransfer.getData('text/plain')
    if (dragId && dragId !== id) {
      const cur = getPageBlockOrder(pageKey)
      const from = cur.indexOf(dragId)
      const to = cur.indexOf(id)
      if (from < 0 || to < 0) return
      cur.splice(from, 1)
      cur.splice(to, 0, dragId)
      setPageBlockOrder(pageKey, cur)
      if (opts.onChange) opts.onChange()
    }
  })

  handle.addEventListener('dragstart', (e) => {
    row.classList.add('is-dragging')
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  })
  handle.addEventListener('dragend', () => {
    row.classList.remove('is-dragging')
  })

  return row
}

/** 模块排序管理面板（内嵌） */
function buildBlockOrderPanel(pageKey, opts = {}) {
  const defs = PAGE_BLOCKS[pageKey]
  if (!defs || defs.length < 2) return null

  const wrap = document.createElement('div')
  wrap.className = 'block-order-panel'

  const render = () => {
    const order = getPageBlockOrder(pageKey)
    wrap.innerHTML = ''
    order.forEach((id, idx) => {
      wrap.appendChild(
        buildBlockOrderRow(pageKey, id, idx, {
          total: order.length,
          onChange: () => {
            render()
            if (opts.onChange) opts.onChange()
          },
        })
      )
    })
  }
  render()
  return wrap
}

/** 打开模块排序弹窗（复用 openEditorModal 的 UI 风格） */
function openBlockOrderModal(pageKey) {
  const defs = PAGE_BLOCKS[pageKey]
  if (!defs) return
  const pageLabel = findSidebarItem(pageKey)?.label || PAGES.find((p) => p.id === pageKey)?.label || pageKey

  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay config-editor-overlay'
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) removeEl()
  })

  const panel = document.createElement('div')
  panel.className = 'modal-panel config-editor-panel'
  panel.setAttribute('role', 'dialog')
  panel.setAttribute('aria-modal', 'true')

  const head = document.createElement('div')
  head.className = 'modal-head'
  head.innerHTML = `
    <div>
      <strong>${pageLabel} · 模块排序</strong>
      <span>拖拽或用 ↑↓ 调整顺序（会同步到菜单维护）；也可在配置栏直接拖拽组件芯片</span>
    </div>`
  const closeBtn = document.createElement('button')
  closeBtn.type = 'button'
  closeBtn.className = 'modal-close'
  closeBtn.setAttribute('aria-label', '关闭')
  closeBtn.textContent = '×'
  closeBtn.addEventListener('click', removeEl)
  head.appendChild(closeBtn)

  const body = document.createElement('div')
  body.className = 'modal-body config-editor-body'

  let contentHost = document.createElement('div')
  body.appendChild(contentHost)

  const rerender = () => {
    const panelEl = buildBlockOrderPanel(pageKey, { onChange: rerender })
    contentHost.replaceWith(panelEl || (contentHost = document.createElement('div')))
    contentHost = panelEl || contentHost
  }
  rerender()

  const foot = document.createElement('div')
  foot.className = 'modal-foot'
  const done = document.createElement('button')
  done.type = 'button'
  done.className = 'btn btn-primary'
  done.textContent = '完成'
  done.addEventListener('click', () => {
    removeEl()
    renderConfigBar()
    notify(dirty ? '排序已更新（尚有未保存修改）' : '模块排序已更新', dirty ? 'info' : 'ok')
  })
  foot.appendChild(done)

  panel.append(head, body, foot)
  overlay.appendChild(panel)
  document.body.appendChild(overlay)

  function removeEl() {
    overlay.remove()
    renderConfigBar()
  }

  const onKey = (e) => {
    if (e.key === 'Escape') {
      removeEl()
      document.removeEventListener('keydown', onKey)
    }
  }
  document.addEventListener('keydown', onKey)
}

/** 为指定页面构建「模块排序」配置项，category=基础，点按钮开弹窗 */
function blockOrderItem(pageKey, extraLabel = '') {
  const defs = PAGE_BLOCKS[pageKey]
  if (!defs || defs.length < 2) return null
  return {
    id: 'block-order',
    category: '基础',
    label: `模块排序${extraLabel ? ` · ${extraLabel}` : ''}`,
    hint: '调整模块显示顺序与显隐',
    build: () => {
      const wrap = document.createElement('div')
      wrap.className = 'block-order-entry'

      const headRow = document.createElement('div')
      headRow.className = 'home-blocks-row'
      const info = document.createElement('div')
      info.className = 'home-blocks-info'
      info.innerHTML = `<strong>模块顺序与显隐</strong><span>点击右侧按钮打开弹窗管理；下方仅展示当前状态概览</span>`
      const btnWrap = document.createElement('div')
      btnWrap.className = 'home-blocks-actions'
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'btn btn-primary'
      btn.textContent = '打开模块排序弹窗'
      btn.addEventListener('click', () => {
        openBlockOrderModal(pageKey)
        // 关闭后刷新预览文字
        setTimeout(refreshPreview, 0)
      })
      btnWrap.appendChild(btn)
      headRow.append(info, btnWrap)

      const list = document.createElement('div')
      list.className = 'block-order-preview'
      const refreshPreview = () => {
        const order = getPageBlockOrder(pageKey)
        list.innerHTML = `<span>当前顺序：</span><strong>${order
          .map((id) => {
            const m = defs.find((b) => b.id === id)
            const on = isPageBlockOn(pageKey, id)
            return `<em class="${on ? '' : 'is-off'}">${m?.label || id}</em>`
          })
          .join(' › ')}</strong>`
      }
      refreshPreview()

      wrap.append(headRow, list)

      // 暴露刷新方法，供外部调用（例如弹窗关闭时）
      wrap._refreshPreview = refreshPreview
      return wrap
    },
  }
}

function createBoolSwitch(path, { onText = '开', offText = '关', defaultValue = false, onChange } = {}) {
  const raw = getPath(config, path)
  const on = typeof raw === 'boolean' ? raw : !!defaultValue
  if (typeof raw !== 'boolean') setPath(config, path, on)

  const wrap = document.createElement('label')
  wrap.className = `vis-switch${on ? '' : ' is-off'}`

  const input = document.createElement('input')
  input.type = 'checkbox'
  input.checked = on
  input.addEventListener('click', (e) => e.stopPropagation())

  const track = document.createElement('span')
  track.className = 'vis-switch-track'
  track.setAttribute('aria-hidden', 'true')

  const text = document.createElement('span')
  text.className = 'vis-switch-text'
  text.textContent = on ? onText : offText

  const sync = (checked) => {
    setPath(config, path, checked)
    wrap.classList.toggle('is-off', !checked)
    text.textContent = checked ? onText : offText
    markDirty()
    schedulePreview()
    notify(checked ? `已开启「${onText}」，请保存` : `已设为「${offText}」，请保存`, 'info')
    onChange?.(checked)
  }

  input.addEventListener('change', () => sync(input.checked))
  wrap.append(input, track, text)
  wrap.title = on ? onText : offText
  return wrap
}

function optionToggleRow({ title, desc, path, onText, offText, defaultValue, onChange, hidden }) {
  const row = document.createElement('div')
  row.className = 'home-block-toggle-row option-toggle-row'
  if (hidden) row.hidden = true
  const label = document.createElement('div')
  label.className = 'home-block-toggle-label'
  label.innerHTML = `<strong>${title}</strong><span>${desc}</span>`
  row.append(
    label,
    createBoolSwitch(path, { onText, offText, defaultValue, onChange })
  )
  return row
}

function buildWhatCardsOptions() {
  if (typeof getPath(config, 'pages.home.whatAnimate') !== 'boolean') {
    setPath(config, 'pages.home.whatAnimate', true)
  }
  if (typeof getPath(config, 'pages.home.whatCollapse') !== 'boolean') {
    setPath(config, 'pages.home.whatCollapse', false)
  }

  const wrap = document.createElement('div')
  wrap.className = 'what-cards-options'

  const collapseRow = optionToggleRow({
    title: '收缩展示',
    desc: '关闭动画时生效：卡片收成紧凑列表（只突出标题）。开启动画后此项无效。',
    path: 'pages.home.whatCollapse',
    onText: '已收缩',
    offText: '展开列表',
    defaultValue: false,
  })

  const animateRow = optionToggleRow({
    title: '滚动叠卡动画',
    desc: '开启后能力卡片滚动时层层叠住；关闭后可另行选择是否收缩。',
    path: 'pages.home.whatAnimate',
    onText: '动画开',
    offText: '动画关',
    defaultValue: true,
    onChange: (on) => {
      collapseRow.hidden = on
    },
  })

  collapseRow.hidden = getPath(config, 'pages.home.whatAnimate') !== false
  wrap.append(animateRow, collapseRow)
  wrap.appendChild(
    sectionNote('提示：开启动画时忽略「收缩展示」；关闭动画后可配置是否收缩。')
  )
  return wrap
}

function ensureClientRollSettings() {
  return ensureClientRollSettingsInConfig(config)
}

function buildClientRollsEditor() {
  ensureClientRollSettings()
  const columns = [
    { key: 'a', title: '滚动 A 列', listPath: 'pages.home.clientRollA' },
    { key: 'b', title: '滚动 B 列', listPath: 'pages.home.clientRollB' },
  ]

  const wrap = document.createElement('div')
  wrap.className = 'edit-block client-rolls-editor'
  wrap.appendChild(
    sectionNote('表格展示两列客户滚动；点「编辑」在新弹窗中维护滚动开关、速度与名单。')
  )

  const listBox = document.createElement('div')
  listBox.className = 'list-editor-box client-rolls-list'
  wrap.appendChild(listBox)

  const mkBtn = (label, cls, fn, tip) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = `content-icon-btn ${cls || ''}`
    b.textContent = label
    if (tip) b.title = tip
    b.addEventListener('click', (e) => {
      e.stopPropagation()
      fn()
    })
    return b
  }

  const buildColumnForm = (col) => {
    ensureClientRollSettings()
    const optPath = `pages.home.clientRollSettings.${col.key}`
    const opt = getPath(config, optPath) || { scrolling: true, speed: 18 }
    const scrollingOn = opt.scrolling !== false

    const form = document.createElement('div')
    form.className = 'content-item-editor'

    const note = document.createElement('p')
    note.className = 'section-note'
    note.textContent = '关闭后返回列表；改完请保存。'
    form.appendChild(note)

    const scrollRow = document.createElement('div')
    scrollRow.className = 'home-block-toggle-row option-toggle-row'
    const scrollLabel = document.createElement('div')
    scrollLabel.className = 'home-block-toggle-label'
    scrollLabel.innerHTML = `<strong>滚动开关</strong><span>仅控制本列；关闭后静止展示</span>`
    const speedField = document.createElement('div')
    speedField.className = 'field'
    const speedLab = document.createElement('label')
    speedLab.textContent = '滚动速度（秒 / 循环）'
    const speedHint = document.createElement('p')
    speedHint.className = 'field-hint'
    speedHint.textContent = '建议 10–30；越小越快。关闭滚动时不生效。'
    const speedRow = document.createElement('div')
    speedRow.className = 'marquee-speed-row'
    const speedRange = document.createElement('input')
    speedRange.type = 'range'
    speedRange.min = '6'
    speedRange.max = '60'
    speedRange.step = '1'
    speedRange.value = String(opt.speed || 18)
    speedRange.disabled = !scrollingOn
    const speedNum = document.createElement('input')
    speedNum.type = 'number'
    speedNum.min = '6'
    speedNum.max = '60'
    speedNum.step = '1'
    speedNum.value = String(opt.speed || 18)
    speedNum.disabled = !scrollingOn
    const syncSpeed = (val) => {
      const next = Math.min(60, Math.max(6, Number(val) || 18))
      setPath(config, `${optPath}.speed`, next)
      speedRange.value = String(next)
      speedNum.value = String(next)
      markDirty()
      schedulePreview()
    }
    speedRange.addEventListener('input', () => syncSpeed(speedRange.value))
    speedNum.addEventListener('change', () => syncSpeed(speedNum.value))
    speedRow.append(speedRange, speedNum)
    speedField.append(speedLab, speedHint, speedRow)

    scrollRow.append(
      scrollLabel,
      createBoolSwitch(`${optPath}.scrolling`, {
        onText: '滚动中',
        offText: '已暂停',
        defaultValue: true,
        onChange: (on) => {
          speedRange.disabled = !on
          speedNum.disabled = !on
        },
      })
    )
    form.append(scrollRow, speedField)

    form.appendChild(renderStringArray('客户名单', col.listPath, { bulk: true, blank: '新客户' }))
    return form
  }

  const openColumnEditor = (col) => {
    openEditorModal(
      {
        id: `client-roll-${col.key}`,
        label: col.title,
        hint: '客户滚动列 · 返回后列表会刷新',
        wide: true,
        build: () => buildColumnForm(col),
      },
      {
        stack: true,
        onClose: () => render(),
      }
    )
  }

  const render = () => {
    ensureClientRollSettings()
    listBox.innerHTML = ''
    const table = document.createElement('table')
    table.className = 'content-table list-editor-table'
    table.innerHTML = `
      <thead>
        <tr>
          <th class="col-index">#</th>
          <th class="col-title">列</th>
          <th class="col-meta">状态</th>
          <th class="col-actions">操作</th>
        </tr>
      </thead>`
    const tbody = document.createElement('tbody')

    columns.forEach((col, index) => {
      const optPath = `pages.home.clientRollSettings.${col.key}`
      const opt = getPath(config, optPath) || { scrolling: true, speed: 18 }
      const scrollingOn = opt.scrolling !== false
      const names = getPath(config, col.listPath)
      const count = Array.isArray(names) ? names.length : 0

      const tr = document.createElement('tr')
      tr.className = 'content-table-row'

      const indexCell = document.createElement('td')
      indexCell.className = 'col-index'
      indexCell.textContent = String(index + 1)

      const titleCell = document.createElement('td')
      titleCell.className = 'col-title'
      const titleBtn = document.createElement('button')
      titleBtn.type = 'button'
      titleBtn.className = 'content-table-title'
      titleBtn.textContent = `${col.title}（${count} 个）`
      titleBtn.title = '打开编辑'
      titleBtn.addEventListener('click', () => openColumnEditor(col))
      titleCell.appendChild(titleBtn)

      const metaCell = document.createElement('td')
      metaCell.className = 'col-meta'
      metaCell.textContent = scrollingOn ? `滚动 ${opt.speed || 18}s` : '已暂停'

      const actionsCell = document.createElement('td')
      actionsCell.className = 'col-actions'
      const actions = document.createElement('div')
      actions.className = 'content-table-actions'
      actions.append(mkBtn('编辑', 'is-primary', () => openColumnEditor(col), '打开编辑弹窗'))
      actionsCell.appendChild(actions)

      tr.append(indexCell, titleCell, metaCell, actionsCell)
      tbody.appendChild(tr)
    })

    table.appendChild(tbody)
    listBox.appendChild(table)
  }

  render()
  return wrap
}

function block(title, children) {
  const el = document.createElement('div')
  el.className = 'edit-block'
  if (title) {
    const h = document.createElement('h3')
    h.textContent = title
    el.appendChild(h)
  }
  ;(Array.isArray(children) ? children : [children]).forEach((c) => {
    if (c) el.appendChild(c)
  })
  return el
}

function formGrid(children, opts = {}) {
  const grid = document.createElement('div')
  grid.className = `form-grid${opts.cols === 1 ? ' is-1' : ''}`
  ;(Array.isArray(children) ? children : [children]).forEach((c) => {
    if (!c) return
    if (opts.full?.has?.(c) || c.classList?.contains('field-full') || c.querySelector?.('textarea, .richtext-box, .media-box, .media-box-video, .media-multi')) {
      c.classList?.add('form-grid-full')
    }
    grid.appendChild(c)
  })
  return grid
}

function tabsPanel(tabs, opts = {}) {
  const wrap = document.createElement('div')
  wrap.className = 'tabs-panel'
  const nav = document.createElement('div')
  nav.className = 'tabs-nav'
  const body = document.createElement('div')
  body.className = 'tabs-body'
  let active = opts.initial || tabs[0]?.id

  const render = () => {
    nav.innerHTML = ''
    body.innerHTML = ''
    tabs.forEach((tab) => {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = `tabs-tab${tab.id === active ? ' is-active' : ''}`
      btn.textContent = tab.label
      btn.addEventListener('click', () => {
        if (active === tab.id) return
        active = tab.id
        render()
      })
      nav.appendChild(btn)
    })
    const cur = tabs.find((t) => t.id === active) || tabs[0]
    if (cur) body.appendChild(cur.build())
  }

  wrap.append(nav, body)
  render()
  return wrap
}

function listEditor({ title, path, blank, fields }) {
  const wrap = document.createElement('div')
  wrap.className = 'edit-block list-editor-compact'

  const toolbar = document.createElement('div')
  toolbar.className = 'list-toolbar'
  const titleWrap = document.createElement('div')
  titleWrap.className = 'content-list-title'
  const h = document.createElement('h3')
  h.textContent = title
  h.style.margin = '0'
  const count = document.createElement('span')
  count.className = 'content-list-count'
  titleWrap.append(h, count)

  const addBtn = document.createElement('button')
  addBtn.type = 'button'
  addBtn.className = 'btn btn-sm btn-primary'
  addBtn.textContent = '添加'
  toolbar.append(titleWrap, addBtn)
  wrap.appendChild(toolbar)

  const listBox = document.createElement('div')
  listBox.className = 'list-editor-box'
  wrap.appendChild(listBox)

  const primaryFields = fields.filter(
    (f) => !['image', 'video', 'textarea', 'richtext', 'paragraphs', 'lines', 'icon'].includes(f.type)
  )
  const summaryField = primaryFields[0] || fields.find((f) => f.type !== 'icon') || fields[0]
  const metaField = primaryFields[1] || fields.find((f) => f !== summaryField && f.type !== 'icon')
  const iconField = fields.find((f) => f.type === 'icon')

  /** 菜单覆盖编辑时，先把列表拷进 slot.componentSettings，避免改到组件库默认值 */
  const ensureEditableList = () => {
    const current = getPath(config, path)
    if (!Array.isArray(current)) {
      setPath(config, path, [])
      return getPath(config, path) || []
    }
    if (!contentEditContext?.unitId) return current
    const slot = resolveEditSlot()
    const data = slot?.componentSettings?.[contentEditContext.unitId]?.data
    const ov =
      data && typeof data === 'object'
        ? path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), data)
        : undefined
    if (ov === undefined) {
      setPath(config, path, clone(current))
      return getPath(config, path) || []
    }
    return current
  }

  const mkBtn = (label, cls, fn, tip) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = `content-icon-btn ${cls || ''}`
    b.textContent = label
    if (tip) b.title = tip
    b.addEventListener('click', (e) => {
      e.stopPropagation()
      fn()
    })
    return b
  }

  const moveItem = (from, to) => {
    const arr = ensureEditableList()
    if (!Array.isArray(arr) || to < 0 || to >= arr.length) return
    const [row] = arr.splice(from, 1)
    arr.splice(to, 0, row)
    markDirty()
    render({ keepScroll: true })
    schedulePreview()
    notify(to < from ? '已上移条目，请保存' : to === 0 ? '已置顶条目，请保存' : '已下移条目，请保存', 'info')
  }

  const buildFieldControl = (item, f, onUpdated) =>
    createControl({
      label: f.label,
      type: f.type || 'text',
      hint: f.hint,
      rows: f.rows,
      placeholder: f.placeholder,
      options: f.options,
      value: f.type === 'paragraphs' || f.type === 'lines' || f.asArray ? item[f.key] : item[f.key] ?? '',
      onStatus: setStatus,
      onChange: (next) => {
        if (f.asArray && f.type !== 'paragraphs' && f.type !== 'lines') {
          const sep = f.type === 'textarea' ? '||' : ','
          item[f.key] = String(next || '')
            .split(sep)
            .map((s) => s.trim())
            .filter(Boolean)
        } else {
          item[f.key] = next
        }
        markDirty()
        schedulePreview()
        onUpdated?.()
      },
    })

  const itemSummary = (item, index) => {
    const summaryVal = summaryField ? item[summaryField.key] : ''
    return String(summaryVal || `未命名 #${index + 1}`).replace(/\s+/g, ' ').slice(0, 48)
  }

  const openItemEditor = (item, index) => {
    const list = ensureEditableList()
    const row = list[index] || item
    openEditorModal(
      {
        id: `list-item-${path}-${index}`,
        label: itemSummary(row, index),
        hint: `${title} · 第 ${index + 1} 项 · 返回后列表会刷新`,
        wide: true,
        build: () => {
          const form = document.createElement('div')
          form.className = 'content-item-editor'
          const note = document.createElement('p')
          note.className = 'section-note'
          note.textContent = '在独立弹窗中维护条目内容，改完可保存或返回上一层。'
          form.appendChild(note)

          const grid = document.createElement('div')
          grid.className = 'content-item-editor-grid'
          fields.forEach((f) => {
            const el = buildFieldControl(row, f, () => render({ keepScroll: true }))
            const isFull =
              f.full ||
              ['textarea', 'richtext', 'image', 'video', 'images', 'paragraphs', 'lines', 'icon'].includes(
                f.type
              )
            if (isFull) el.classList.add('is-full')
            grid.appendChild(el)
          })
          form.appendChild(grid)
          return form
        },
      },
      { stack: true, onClose: () => render({ keepScroll: true }) }
    )
  }

  const render = ({ keepScroll } = {}) => {
    const scrollTop = keepScroll ? listBox.scrollTop : 0
    const list = getPath(config, path) || []
    count.textContent = String(list.length)
    listBox.innerHTML = ''

    if (!list.length) {
      const empty = document.createElement('div')
      empty.className = 'content-list-empty'
      empty.textContent = '暂无条目，点击上方添加'
      listBox.appendChild(empty)
      return
    }

    const table = document.createElement('table')
    table.className = 'content-table list-editor-table'
    table.innerHTML = `
      <thead>
        <tr>
          <th class="col-index">#</th>
          ${iconField ? '<th class="col-icon">图标</th>' : ''}
          <th class="col-title">${summaryField?.label || '内容'}</th>
          <th class="col-meta">${metaField?.label || '备注'}</th>
          <th class="col-actions">操作</th>
        </tr>
      </thead>`
    const tbody = document.createElement('tbody')

    list.forEach((item, index) => {
      const tr = document.createElement('tr')
      tr.className = 'content-table-row'

      const indexCell = document.createElement('td')
      indexCell.className = 'col-index'
      indexCell.textContent = String(index + 1)

      let iconCell = null
      if (iconField) {
        iconCell = document.createElement('td')
        iconCell.className = 'col-icon'
        const iconId =
          item[iconField.key] || DEFAULT_WHAT_ICON_IDS[index % DEFAULT_WHAT_ICON_IDS.length]
        const meta = getWhatIconById(iconId)
        const thumb = document.createElement('button')
        thumb.type = 'button'
        thumb.className = 'list-icon-thumb'
        thumb.title = meta?.label || iconId || '选择图标'
        thumb.innerHTML = meta?.svg || '<span>?</span>'
        thumb.addEventListener('click', () => openItemEditor(item, index))
        iconCell.appendChild(thumb)
      }

      const titleCell = document.createElement('td')
      titleCell.className = 'col-title'
      const titleBtn = document.createElement('button')
      titleBtn.type = 'button'
      titleBtn.className = 'content-table-title'
      titleBtn.textContent = itemSummary(item, index)
      titleBtn.title = '打开编辑'
      titleBtn.addEventListener('click', () => openItemEditor(item, index))
      titleCell.appendChild(titleBtn)

      const metaCell = document.createElement('td')
      metaCell.className = 'col-meta'
      if (metaField) {
        const raw = item[metaField.key]
        metaCell.textContent = Array.isArray(raw)
          ? raw.join(' / ') || '—'
          : String(raw || '—').replace(/\s+/g, ' ').slice(0, 36)
      } else {
        metaCell.textContent = '—'
      }

      const actionsCell = document.createElement('td')
      actionsCell.className = 'col-actions'
      const actions = document.createElement('div')
      actions.className = 'content-table-actions'
      actions.append(
        mkBtn('编辑', 'is-primary', () => openItemEditor(item, index), '打开编辑弹窗'),
        mkBtn('↑', '', () => moveItem(index, index - 1), '上移'),
        mkBtn('↓', '', () => moveItem(index, index + 1), '下移'),
        mkBtn('删', 'is-danger', async () => {
          const ok = await openConfirmModal({
            title: '删除条目',
            message: `确定删除「${itemSummary(item, index)}」？`,
            danger: true,
            confirmText: '删除',
          })
          if (!ok) {
            notify('已取消删除', 'info')
            return
          }
          const arr = ensureEditableList()
          arr.splice(index, 1)
          markDirty()
          render({ keepScroll: true })
          schedulePreview()
          notify(`已删除第 ${index + 1} 项，请保存`, 'ok')
        }, '删除')
      )
      actionsCell.appendChild(actions)

      if (iconCell) tr.append(indexCell, iconCell, titleCell, metaCell, actionsCell)
      else tr.append(indexCell, titleCell, metaCell, actionsCell)
      tbody.appendChild(tr)
    })

    table.appendChild(tbody)
    listBox.appendChild(table)
    if (keepScroll) listBox.scrollTop = scrollTop
  }

  addBtn.addEventListener('click', () => {
    const arr = ensureEditableList()
    const next = clone(blank)
    arr.push(next)
    const newIndex = arr.length - 1
    markDirty()
    render()
    schedulePreview()
    notify('已添加条目，请编辑后保存', 'ok')
    openItemEditor(next, newIndex)
  })

  render()
  return wrap
}

function contentListEditor({ title, path, blank, categoriesPath, kind = 'news', fields, defaultCategoryPath }) {
  const wrap = document.createElement('div')
  wrap.className = 'edit-block content-list-editor'

  const toolbar = document.createElement('div')
  toolbar.className = 'list-toolbar content-list-toolbar'
  const titleWrap = document.createElement('div')
  titleWrap.className = 'content-list-title'
  const h = document.createElement('h3')
  h.textContent = title
  h.style.margin = '0'
  const count = document.createElement('span')
  count.className = 'content-list-count'
  titleWrap.append(h, count)

  const addBtn = document.createElement('button')
  addBtn.type = 'button'
  addBtn.className = 'btn btn-sm btn-primary'
  addBtn.textContent = '添加条目'
  toolbar.append(titleWrap, addBtn)
  wrap.appendChild(toolbar)

  const filters = document.createElement('div')
  filters.className = 'content-list-filters'
  const search = document.createElement('input')
  search.type = 'search'
  search.className = 'content-list-search'
  search.placeholder = kind === 'talent' ? '搜索达人名称…' : '搜索标题…'
  const catFilter = document.createElement('select')
  catFilter.className = 'content-list-cat-filter'
  filters.append(search, catFilter)

  let manageCatBtn = null
  if (categoriesPath) {
    manageCatBtn = document.createElement('button')
    manageCatBtn.type = 'button'
    manageCatBtn.className = 'btn btn-sm content-list-cat-manage'
    manageCatBtn.textContent = '维护分类'
    manageCatBtn.title = '增删改前台筛选分类'
    filters.appendChild(manageCatBtn)
  }
  wrap.appendChild(filters)

  const listBox = document.createElement('div')
  listBox.className = 'content-list-box'
  wrap.appendChild(listBox)

  let filterCat = ''
  let filterQuery = ''
  let filterReady = false

  const categories = () => {
    const list = getPath(config, categoriesPath)
    if (!Array.isArray(list)) return []
    return list
      .map((c) => {
        if (typeof c === 'string') return c.trim()
        if (c && typeof c === 'object') return String(c.name || c.label || c.title || '').trim()
        return String(c || '').trim()
      })
      .filter(Boolean)
  }

  const resolveDefaultFilterCat = () => {
    const cats = categories()
    if (!cats.length) return 'all'
    return cats[0]
  }

  const syncCatFilterOptions = () => {
    if (!categoriesPath) return
    const cats = categories()
    catFilter.innerHTML =
      `<option value="all">全部分类</option>` + cats.map((c) => `<option value="${c}">${c}</option>`).join('')
    if (!filterReady) {
      filterCat = resolveDefaultFilterCat()
      filterReady = true
    } else if (filterCat !== 'all' && !cats.includes(filterCat)) {
      filterCat = resolveDefaultFilterCat()
    }
    if (!cats.length) filterCat = 'all'
    catFilter.value = filterCat
    filterCat = catFilter.value
  }

  const remapItemCats = (from, to) => {
    if (!from || from === to) return
    const items = getPath(config, path)
    if (!Array.isArray(items)) return
    items.forEach((row) => {
      if (row && row.cat === from) row.cat = to
    })
  }

  const buildCategoriesEditor = () => {
    const box = document.createElement('div')
    box.className = 'content-list-cat-panel'
    const head = document.createElement('div')
    head.className = 'content-list-cat-panel-head'
    head.innerHTML =
      '<strong>分类维护</strong><span>增删改后会同步到筛选下拉与条目「分类」选项；重命名会自动更新已有条目</span>'
    box.appendChild(head)

    if (defaultCategoryPath) {
      box.appendChild(
        createControl({
          label: '默认选中分类',
          type: 'text',
          hint: '前台进入页面时默认高亮的分类名（需与下方列表一致）',
          value: getPath(config, defaultCategoryPath) || '',
          onStatus: setStatus,
          onChange: (next) => {
            setPath(config, defaultCategoryPath, next)
            markDirty()
            schedulePreview()
          },
        })
      )
    }

    const catEditor = renderStringArray('分类列表', categoriesPath, {
      bulk: false,
      blank: '新分类',
      onRename: (from, to) => {
        remapItemCats(from, to)
        if (defaultCategoryPath && getPath(config, defaultCategoryPath) === from) {
          setPath(config, defaultCategoryPath, to)
        }
      },
      onChange: () => {
        syncCatFilterOptions()
        render({ keepScroll: true })
      },
    })
    catEditor.classList.add('is-embedded')
    box.appendChild(catEditor)
    return box
  }

  if (manageCatBtn) {
    manageCatBtn.addEventListener('click', () => {
      openEditorModal(
        {
          id: `${kind}-categories`,
          label: '维护分类',
          hint: '关闭后返回列表；改完请保存到数据库',
          wide: true,
          build: () => buildCategoriesEditor(),
        },
        { stack: true, onClose: () => render({ keepScroll: true }) }
      )
    })
  }

  const mkBtn = (label, cls, fn, titleText) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = `content-icon-btn ${cls || ''}`
    b.textContent = label
    if (titleText) b.title = titleText
    b.addEventListener('click', (e) => {
      e.stopPropagation()
      fn()
    })
    return b
  }

  const moveItem = (from, to) => {
    const arr = getPath(config, path)
    if (to < 0 || to >= arr.length) return
    const [row] = arr.splice(from, 1)
    arr.splice(to, 0, row)
    markDirty()
    render({ keepScroll: true })
    schedulePreview()
    notify(to === 0 && from !== 0 ? '已置顶条目，请保存' : to < from ? '已上移条目，请保存' : '已下移条目，请保存', 'info')
  }

  const buildField = (item, f, onUpdated) => {
    if (f.type === 'select') {
      const fieldWrap = document.createElement('div')
      fieldWrap.className = 'field'
      const lab = document.createElement('label')
      lab.className = 'field-label'
      lab.textContent = f.label
      const select = document.createElement('select')
      const opts = typeof f.options === 'function' ? f.options() : f.options || []
      select.innerHTML = opts.map((o) => `<option value="${o}">${o}</option>`).join('')
      if (item[f.key] && ![...select.options].some((o) => o.value === item[f.key])) {
        const extra = document.createElement('option')
        extra.value = item[f.key]
        extra.textContent = item[f.key]
        select.appendChild(extra)
      }
      select.value = item[f.key] || opts[0] || ''
      select.addEventListener('change', () => {
        item[f.key] = select.value
        if (kind === 'talent' && f.key === 'cat') {
          item.track = /外部|合作|bd/i.test(select.value) ? 'bd' : 'owned'
        }
        markDirty()
        schedulePreview()
        onUpdated?.()
      })
      fieldWrap.append(lab, select)
      return fieldWrap
    }

    return createControl({
      label: f.label,
      type: f.type || 'text',
      hint: f.hint,
      rows: f.rows,
      placeholder: f.placeholder,
      value: item[f.key],
      onStatus: setStatus,
      onChange: (next) => {
        if (f.asArray && f.type !== 'paragraphs' && f.type !== 'lines') {
          const sep = f.type === 'textarea' ? '||' : ','
          item[f.key] = String(next || '')
            .split(sep)
            .map((s) => s.trim())
            .filter(Boolean)
        } else {
          item[f.key] = next
        }
        markDirty()
        schedulePreview()
        onUpdated?.()
      },
    })
  }

  const detailHref = (item, index) => {
    const id = item.id || item.name || item.title || `item-${index + 1}`
    if (kind === 'case') return `./case-detail.html?id=${encodeURIComponent(id)}`
    if (kind === 'talent') return `./talent-detail.html?id=${encodeURIComponent(id)}`
    return `./news-detail.html?id=${encodeURIComponent(id)}`
  }

  const itemLabel = (item, index) => {
    if (kind === 'talent') return item.name || `达人 #${index + 1}`
    return item.title || `${kind === 'case' ? '案例' : '新闻'} #${index + 1}`
  }

  const openItemEditor = (item, index) => {
    openEditorModal(
      {
        id: `${kind}-item-${index}`,
        label: itemLabel(item, index),
        hint:
          kind === 'case'
            ? '列表封面与标签 · 详情 Banner / 简介 / 图集 · 详情 ID 留空则按标题生成'
            : kind === 'talent'
              ? '列表头像与分类 · 指标与详情简介 · 详情 ID 留空则按名称生成'
              : '列表封面与日期 · 详情正文 · 详情 ID 留空则按标题生成',
        wide: true,
        build: () => {
          const form = document.createElement('div')
          form.className = 'content-item-editor'
          const note = document.createElement('p')
          note.className = 'section-note'
          note.textContent =
            kind === 'talent'
              ? '在独立弹窗中维护达人卡片与详情内容，返回后列表会刷新显示。'
              : '在独立弹窗中维护条目内容，返回后列表会刷新显示。'
          form.appendChild(note)

          const grid = document.createElement('div')
          grid.className = 'content-item-editor-grid'
          const refreshTitle = () => {
            /* list re-renders on modal close via return */
          }
          fields.forEach((f) => {
            const el = buildField(item, f, () => {
              refreshTitle()
              render({ keepScroll: true })
            })
            const isFull =
              f.full ||
              ['image', 'video', 'textarea', 'richtext', 'paragraphs', 'lines', 'images'].includes(f.type)
            if (isFull) el.classList.add('is-full')
            grid.appendChild(el)
          })
          form.appendChild(grid)
          return form
        },
      },
      { stack: true, onClose: () => render({ keepScroll: true }) }
    )
  }

  const metaLabel = kind === 'case' ? '标签' : kind === 'talent' ? '平台' : '日期'
  const titleColLabel = kind === 'talent' ? '名称' : '标题'
  const thumbColLabel = kind === 'talent' ? '头像' : '封面'

  const render = ({ keepScroll } = {}) => {
    const scrollTop = keepScroll ? listBox.scrollTop : 0
    const list = getPath(config, path) || []
    syncCatFilterOptions()
    const q = filterQuery.trim().toLowerCase()
    const indices = list
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => {
        if (filterCat !== 'all' && item.cat !== filterCat) return false
        if (!q) return true
        const hay = `${item.name || ''} ${item.title || ''} ${item.platform || ''} ${item.tags || ''} ${item.id || ''}`.toLowerCase()
        return hay.includes(q)
      })

    count.textContent = `${indices.length}/${list.length}`
    listBox.innerHTML = ''

    if (!indices.length) {
      const empty = document.createElement('div')
      empty.className = 'content-list-empty'
      empty.textContent = list.length ? '没有匹配的条目' : '暂无条目，点击上方添加'
      listBox.appendChild(empty)
      return
    }

    const table = document.createElement('table')
    table.className = 'content-table'
    table.innerHTML = `
      <thead>
        <tr>
          <th class="col-index">#</th>
          <th class="col-thumb">${thumbColLabel}</th>
          <th class="col-title">${titleColLabel}</th>
          <th class="col-cat">分类</th>
          <th class="col-meta">${metaLabel}</th>
          <th class="col-actions">操作</th>
        </tr>
      </thead>`
    const tbody = document.createElement('tbody')

    indices.forEach(({ item, index }) => {
      const tr = document.createElement('tr')
      tr.className = 'content-table-row'

      const indexCell = document.createElement('td')
      indexCell.className = 'col-index'
      indexCell.textContent = String(index + 1)

      const thumbCell = document.createElement('td')
      thumbCell.className = 'col-thumb'
      const thumbSrc = item.avatar || item.image || ''
      const thumb = document.createElement('div')
      thumb.className = `content-table-thumb${thumbSrc ? '' : ' is-empty'}`
      if (thumbSrc) {
        const img = document.createElement('img')
        img.src = thumbSrc
        img.alt = ''
        thumb.appendChild(img)
      }
      thumbCell.appendChild(thumb)

      const titleCell = document.createElement('td')
      titleCell.className = 'col-title'
      const titleBtn = document.createElement('button')
      titleBtn.type = 'button'
      titleBtn.className = 'content-table-title'
      titleBtn.textContent = itemLabel(item, index)
      titleBtn.title = '打开编辑'
      titleBtn.addEventListener('click', () => openItemEditor(item, index))
      titleCell.appendChild(titleBtn)

      const catCell = document.createElement('td')
      catCell.className = 'col-cat'
      if (item.cat) {
        const badge = document.createElement('span')
        badge.className = 'content-card-badge'
        badge.textContent = item.cat
        catCell.appendChild(badge)
      } else {
        catCell.textContent = '—'
      }

      const metaCell = document.createElement('td')
      metaCell.className = 'col-meta'
      if (kind === 'case') {
        const tags = String(item.tags || '')
          .split(/[\/|,，、]/)
          .map((s) => s.trim())
          .filter(Boolean)
        if (tags.length) {
          const tagWrap = document.createElement('div')
          tagWrap.className = 'content-table-tags'
          tags.forEach((t) => {
            const chip = document.createElement('span')
            chip.className = 'content-table-tag'
            chip.textContent = t
            tagWrap.appendChild(chip)
          })
          metaCell.appendChild(tagWrap)
        } else {
          metaCell.textContent = '—'
        }
      } else if (kind === 'talent') {
        metaCell.textContent = item.platform || '—'
      } else {
        metaCell.textContent = item.date || '—'
      }

      const actionsCell = document.createElement('td')
      actionsCell.className = 'col-actions'
      const actions = document.createElement('div')
      actions.className = 'content-table-actions'
      const displayName = itemLabel(item, index)
      actions.append(
        mkBtn('编辑', 'is-primary', () => openItemEditor(item, index), '打开编辑弹窗'),
        mkBtn('预览', '', () => window.open(detailHref(item, index), '_blank', 'noopener,noreferrer'), '新窗口预览详情'),
        mkBtn('置顶', '', () => moveItem(index, 0), '移到最前'),
        mkBtn('↑', '', () => moveItem(index, index - 1), '上移'),
        mkBtn('↓', '', () => moveItem(index, index + 1), '下移'),
        mkBtn('删', 'is-danger', async () => {
          const ok = await openConfirmModal({
            title: '删除条目',
            message: `确定删除「${displayName}」？`,
            danger: true,
            confirmText: '删除',
          })
          if (!ok) {
            notify('已取消删除', 'info')
            return
          }
          const arr = getPath(config, path)
          arr.splice(index, 1)
          markDirty()
          render({ keepScroll: true })
          schedulePreview()
          notify(`已删除「${displayName}」，请保存`, 'ok')
        }, '删除')
      )
      actionsCell.appendChild(actions)

      tr.append(indexCell, thumbCell, titleCell, catCell, metaCell, actionsCell)
      tbody.appendChild(tr)
    })

    table.appendChild(tbody)
    listBox.appendChild(table)
    if (keepScroll) listBox.scrollTop = scrollTop
  }

  search.addEventListener('input', () => {
    filterQuery = search.value
    render({ keepScroll: true })
  })
  catFilter.addEventListener('change', () => {
    filterCat = catFilter.value
    render()
  })
  addBtn.addEventListener('click', () => {
    const arr = getPath(config, path)
    if (!Array.isArray(arr)) setPath(config, path, [])
    const next = clone(blank)
    const cats = categories()
    if (cats.length && !cats.includes(next.cat)) next.cat = cats[0]
    if (filterCat && filterCat !== 'all') next.cat = filterCat
    else if (cats.length) next.cat = cats[0]
    if (kind === 'talent' && next.cat) {
      next.track = /外部|合作|bd/i.test(next.cat) ? 'bd' : 'owned'
    }
    getPath(config, path).push(next)
    const newIndex = getPath(config, path).length - 1
    if (next.cat) filterCat = next.cat
    filterQuery = ''
    search.value = ''
    markDirty()
    render()
    schedulePreview()
    notify('已添加条目，请编辑后保存', 'ok')
    openItemEditor(next, newIndex)
  })

  render()
  return wrap
}

function renderStringArray(title, path, opts = {}) {
  const wrap = document.createElement('div')
  wrap.className = 'edit-block string-array-editor'

  const toolbar = document.createElement('div')
  toolbar.className = 'list-toolbar'
  const titleWrap = document.createElement('div')
  titleWrap.className = 'content-list-title'
  const h = document.createElement('h3')
  h.textContent = title
  h.style.margin = '0'
  const count = document.createElement('span')
  count.className = 'content-list-count'
  titleWrap.append(h, count)

  const modeBtn = document.createElement('button')
  modeBtn.type = 'button'
  modeBtn.className = 'btn btn-sm'
  const addBtn = document.createElement('button')
  addBtn.type = 'button'
  addBtn.className = 'btn btn-sm btn-primary'
  addBtn.textContent = '添加'
  toolbar.append(titleWrap, modeBtn, addBtn)
  wrap.appendChild(toolbar)

  const box = document.createElement('div')
  box.className = 'string-array-box'
  wrap.appendChild(box)

  let bulkMode = !!opts.bulk

  const emitChange = () => {
    if (typeof opts.onChange === 'function') opts.onChange()
  }

  const syncModeBtn = () => {
    modeBtn.textContent = bulkMode ? '逐行编辑' : '批量编辑'
    modeBtn.title = bulkMode ? '切换为逐行输入' : '切换为多行文本（一行一项）'
    addBtn.hidden = bulkMode
  }

  const render = () => {
    let arr = getPath(config, path)
    if (!Array.isArray(arr)) {
      arr = []
      setPath(config, path, arr)
    }
    count.textContent = String(arr.length)
    box.innerHTML = ''
    syncModeBtn()

    if (bulkMode) {
      const fieldWrap = document.createElement('div')
      fieldWrap.className = 'field'
      const hint = document.createElement('p')
      hint.className = 'field-hint'
      hint.textContent = '一行一项；失焦后按行拆分写入'
      const ta = document.createElement('textarea')
      ta.rows = Math.min(12, Math.max(4, arr.length + 1))
      ta.value = arr.join('\n')
      ta.placeholder = '例：\n分类A\n分类B'
      ta.addEventListener('change', () => {
        const next = ta.value
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean)
        setPath(config, path, next)
        markDirty()
        schedulePreview()
        count.textContent = String(next.length)
        emitChange()
        notify(`已更新列表（${next.length} 项），请保存`, 'ok')
      })
      fieldWrap.append(hint, ta)
      box.appendChild(fieldWrap)
      return
    }

    if (!arr.length) {
      const empty = document.createElement('div')
      empty.className = 'content-list-empty'
      empty.textContent = '暂无条目，点击「添加」或切换批量编辑'
      box.appendChild(empty)
      return
    }

    arr.forEach((val, index) => {
      const row = document.createElement('div')
      row.className = 'string-array-row'

      const idx = document.createElement('span')
      idx.className = 'string-array-index'
      idx.textContent = String(index + 1)

      const input = document.createElement('input')
      input.type = 'text'
      input.value = val
      input.placeholder = opts.blank || '名称'
      input.addEventListener('focus', () => {
        input.dataset.prev = String(input.value ?? '')
      })
      input.addEventListener('input', () => {
        arr[index] = input.value
        markDirty()
      })
      input.addEventListener('change', () => {
        const from = input.dataset.prev
        const to = String(input.value || '').trim()
        arr[index] = to
        input.value = to
        if (from != null && from !== to && typeof opts.onRename === 'function') {
          opts.onRename(from, to)
        }
        markDirty()
        schedulePreview()
        emitChange()
        if (from != null && from !== to) {
          notify(`已改名「${from}」→「${to || '（空）'}」，请保存`, 'info')
        }
      })

      const actions = document.createElement('div')
      actions.className = 'string-array-actions'
      const mk = (label, fn, cls = '') => {
        const b = document.createElement('button')
        b.type = 'button'
        b.className = `content-icon-btn ${cls}`
        b.textContent = label
        b.addEventListener('click', fn)
        return b
      }
      actions.append(
        mk('↑', () => {
          if (index === 0) {
            notify('已在最上方', 'info')
            return
          }
          ;[arr[index - 1], arr[index]] = [arr[index], arr[index - 1]]
          markDirty()
          render()
          schedulePreview()
          emitChange()
          notify('已上移，请保存', 'info')
        }),
        mk('↓', () => {
          if (index >= arr.length - 1) {
            notify('已在最下方', 'info')
            return
          }
          ;[arr[index + 1], arr[index]] = [arr[index], arr[index + 1]]
          markDirty()
          render()
          schedulePreview()
          emitChange()
          notify('已下移，请保存', 'info')
        }),
        mk(
          '×',
          async () => {
            const name = String(arr[index] || '').trim() || `第 ${index + 1} 项`
            const ok = await openConfirmModal({
              title: '删除',
              message: `确定删除「${name}」？`,
              danger: true,
              confirmText: '删除',
            })
            if (!ok) {
              notify('已取消删除', 'info')
              return
            }
            arr.splice(index, 1)
            markDirty()
            render()
            schedulePreview()
            emitChange()
            notify('已删除，请保存', 'ok')
          },
          'is-danger'
        )
      )

      row.append(idx, input, actions)
      box.appendChild(row)
    })
  }

  modeBtn.addEventListener('click', () => {
    if (bulkMode) {
      const ta = box.querySelector('textarea')
      if (ta) {
        const next = ta.value
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean)
        setPath(config, path, next)
        markDirty()
        schedulePreview()
        emitChange()
        notify(`已应用批量编辑（${next.length} 项），请保存`, 'ok')
      }
    }
    bulkMode = !bulkMode
    render()
    if (bulkMode) notify('已进入批量编辑模式', 'info')
  })

  addBtn.addEventListener('click', () => {
    let arr = getPath(config, path)
    if (!Array.isArray(arr)) {
      arr = []
      setPath(config, path, arr)
    }
    arr.push(opts.blank || '新项目')
    markDirty()
    render()
    schedulePreview()
    emitChange()
    notify('已添加一项，请保存', 'ok')
    requestAnimationFrame(() => {
      const inputs = box.querySelectorAll('input')
      const last = inputs[inputs.length - 1]
      last?.focus()
      last?.select()
    })
  })

  render()
  return wrap
}

function multiImageField(label, path) {
  return createMultiImageField({
    label,
    values: getPath(config, path) || [],
    onChange: (next) => {
      setPath(config, path, next)
      markDirty()
      schedulePreview()
    },
    onStatus: setStatus,
  })
}

function ensureMarquees() {
  let rows = getPath(config, 'pages.service.marquees')
  if (!Array.isArray(rows)) rows = []
  const defaultsRows = [
    {
      type: 'text',
      text: 'Film Production. Brand Content. Event Experience. Advertising Creative.',
      logos: [],
      direction: 'left',
      style: 'solid',
      scrolling: true,
      speed: 48,
      fontSize: 0,
    },
    {
      type: 'logo',
      text: '',
      logos: ['/images/brands/guanzi.png'],
      direction: 'right',
      style: 'hollow',
      scrolling: true,
      speed: 56,
      fontSize: 0,
    },
    {
      type: 'logo',
      text: '',
      logos: ['/images/brands/guanzi.png'],
      direction: 'left',
      style: 'solid',
      scrolling: true,
      speed: 40,
      fontSize: 0,
    },
  ]
  while (rows.length < 3) rows.push(clone(defaultsRows[rows.length]))
  if (rows.length > 3) rows.length = 3
  rows.forEach((row, i) => {
    if (!row || typeof row !== 'object') {
      rows[i] = clone(defaultsRows[i])
      return
    }
    if (typeof row.scrolling !== 'boolean') row.scrolling = true
    const speed = Number(row.speed)
    row.speed = Number.isFinite(speed) ? Math.min(120, Math.max(8, speed)) : defaultsRows[i].speed
    const fs = Number(row.fontSize)
    row.fontSize = Number.isFinite(fs) ? Math.min(200, Math.max(0, Math.round(fs))) : 0
  })
  setPath(config, 'pages.service.marquees', rows)
  return rows
}

function marqueeEditor() {
  const wrap = document.createElement('div')
  wrap.className = 'edit-block marquee-editor'
  const title = document.createElement('h3')
  title.textContent = '滚动区域（固定 3 行）'
  wrap.appendChild(title)
  wrap.appendChild(
    sectionNote(
      '表格展示 3 行滚动条；点「编辑」在新弹窗中维护类型、方向、速度与内容。关闭「滚动」后该行静止。'
    )
  )

  const box = document.createElement('div')
  box.className = 'list-editor-box marquee-editor-list'
  wrap.appendChild(box)

  const typeLabel = (row) => ((row.type || 'text') === 'logo' ? 'Logo 行' : '文字行')
  const dirLabel = (row) => (row.direction === 'right' ? '向右' : '向左')
  const rowSummary = (row, index) => {
    const preview =
      (row.type || 'text') === 'logo'
        ? `${(Array.isArray(row.logos) ? row.logos.length : 0) || 0} 个 Logo`
        : String(brToNewlines(row.text || '') || '（空文字）')
            .replace(/\s+/g, ' ')
            .slice(0, 36)
    return `第 ${index + 1} 行 · ${typeLabel(row)} · ${dirLabel(row)} · ${preview}`
  }

  const mkBtn = (label, cls, fn, tip) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = `content-icon-btn ${cls || ''}`
    b.textContent = label
    if (tip) b.title = tip
    b.addEventListener('click', (e) => {
      e.stopPropagation()
      fn()
    })
    return b
  }

  const moveRow = (from, to) => {
    if (from === to || from < 0 || to < 0) return
    const rows = ensureMarquees()
    if (to >= rows.length) return
    const [item] = rows.splice(from, 1)
    rows.splice(to, 0, item)
    markDirty()
    schedulePreview()
    render()
    notify(`已调整第 ${from + 1} 行顺序，请保存`, 'info')
  }

  const buildRowForm = (row, index, { remount } = {}) => {
    const scrollingOn = row.scrolling !== false
    const form = document.createElement('div')
    form.className = 'content-item-editor'

    const note = document.createElement('p')
    note.className = 'section-note'
    note.textContent = '在独立弹窗中维护本行内容，改完可保存或返回上一层。'
    form.appendChild(note)

    const scrollRow = document.createElement('div')
    scrollRow.className = 'home-block-toggle-row option-toggle-row'
    const scrollLabel = document.createElement('div')
    scrollLabel.className = 'home-block-toggle-label'
    scrollLabel.innerHTML = '<strong>滚动开关</strong><span>关闭后该行静止，不播放滚动动画</span>'
    const scrollSwitch = document.createElement('label')
    scrollSwitch.className = `vis-switch${scrollingOn ? '' : ' is-off'}`
    const scrollInput = document.createElement('input')
    scrollInput.type = 'checkbox'
    scrollInput.checked = scrollingOn
    const scrollTrack = document.createElement('span')
    scrollTrack.className = 'vis-switch-track'
    scrollTrack.setAttribute('aria-hidden', 'true')
    const scrollText = document.createElement('span')
    scrollText.className = 'vis-switch-text'
    scrollText.textContent = scrollingOn ? '滚动中' : '已暂停'

    const speedField = document.createElement('div')
    speedField.className = 'field'
    const speedLab = document.createElement('label')
    speedLab.textContent = '滚动速度（秒 / 循环）'
    const speedHint = document.createElement('p')
    speedHint.className = 'field-hint'
    speedHint.textContent = '建议 20–80；数值越小越快。关闭滚动时此项不生效。'
    const speedRowEl = document.createElement('div')
    speedRowEl.className = 'marquee-speed-row'
    const speedRange = document.createElement('input')
    speedRange.type = 'range'
    speedRange.min = '8'
    speedRange.max = '120'
    speedRange.step = '1'
    speedRange.value = String(row.speed || 48)
    speedRange.disabled = !scrollingOn
    const speedNum = document.createElement('input')
    speedNum.type = 'number'
    speedNum.min = '8'
    speedNum.max = '120'
    speedNum.step = '1'
    speedNum.value = String(row.speed || 48)
    speedNum.disabled = !scrollingOn
    const syncSpeed = (val) => {
      const next = Math.min(120, Math.max(8, Number(val) || 48))
      row.speed = next
      speedRange.value = String(next)
      speedNum.value = String(next)
      markDirty()
      schedulePreview()
    }
    speedRange.addEventListener('input', () => syncSpeed(speedRange.value))
    speedNum.addEventListener('change', () => syncSpeed(speedNum.value))
    speedRowEl.append(speedRange, speedNum)
    speedField.append(speedLab, speedHint, speedRowEl)

    scrollInput.addEventListener('change', () => {
      row.scrolling = scrollInput.checked
      scrollSwitch.classList.toggle('is-off', !scrollInput.checked)
      scrollText.textContent = scrollInput.checked ? '滚动中' : '已暂停'
      speedRange.disabled = !scrollInput.checked
      speedNum.disabled = !scrollInput.checked
      markDirty()
      schedulePreview()
      notify(
        scrollInput.checked
          ? `第 ${index + 1} 行已开启滚动，请保存`
          : `第 ${index + 1} 行已暂停滚动，请保存`,
        'info'
      )
    })
    scrollSwitch.append(scrollInput, scrollTrack, scrollText)
    scrollRow.append(scrollLabel, scrollSwitch)
    form.append(scrollRow, speedField)

    const grid = document.createElement('div')
    grid.className = 'form-grid'

    const typeField = document.createElement('div')
    typeField.className = 'field'
    typeField.innerHTML = '<label>类型</label>'
    const typeSel = document.createElement('select')
    ;[
      ['text', '文字行'],
      ['logo', 'Logo 行'],
    ].forEach(([v, label]) => {
      const opt = document.createElement('option')
      opt.value = v
      opt.textContent = label
      if ((row.type || 'text') === v) opt.selected = true
      typeSel.appendChild(opt)
    })
    typeSel.addEventListener('change', () => {
      row.type = typeSel.value
      markDirty()
      schedulePreview()
      notify(`第 ${index + 1} 行类型已改为「${typeLabel(row)}」，请保存`, 'info')
      remount?.()
    })
    typeField.appendChild(typeSel)

    const dirField = document.createElement('div')
    dirField.className = 'field'
    dirField.innerHTML = '<label>滚动方向</label>'
    const dirSel = document.createElement('select')
    ;[
      ['left', '向左'],
      ['right', '向右'],
    ].forEach(([v, label]) => {
      const opt = document.createElement('option')
      opt.value = v
      opt.textContent = label
      if ((row.direction || 'left') === v) opt.selected = true
      dirSel.appendChild(opt)
    })
    dirSel.addEventListener('change', () => {
      row.direction = dirSel.value
      markDirty()
      schedulePreview()
      notify(`第 ${index + 1} 行方向已改为「${dirLabel(row)}」，请保存`, 'info')
    })
    dirField.appendChild(dirSel)

    const styleField = document.createElement('div')
    styleField.className = 'field'
    styleField.innerHTML = '<label>文字样式</label>'
    const styleSel = document.createElement('select')
    ;[
      ['solid', '实心'],
      ['hollow', '描边空心'],
    ].forEach(([v, label]) => {
      const opt = document.createElement('option')
      opt.value = v
      opt.textContent = label
      if ((row.style || 'solid') === v) opt.selected = true
      styleSel.appendChild(opt)
    })
    styleSel.addEventListener('change', () => {
      row.style = styleSel.value
      markDirty()
      schedulePreview()
      notify(`第 ${index + 1} 行样式已更新，请保存`, 'info')
    })
    styleField.appendChild(styleSel)
    styleField.hidden = (row.type || 'text') === 'logo'

    grid.append(typeField, dirField, styleField)
    form.appendChild(grid)

    if ((row.type || 'text') === 'logo') {
      form.appendChild(
        createMultiImageField({
          label: 'Logo 列表',
          values: Array.isArray(row.logos) ? row.logos : [],
          onChange: (next) => {
            row.logos = next
            markDirty()
            schedulePreview()
          },
          onStatus: setStatus,
        })
      )
    } else {
      const textField = document.createElement('div')
      textField.className = 'field form-grid-full'
      textField.innerHTML = '<label>整行文字</label>'
      const input = document.createElement('textarea')
      input.rows = 3
      input.value = brToNewlines(row.text || '')
      input.addEventListener('input', () => {
        row.text = input.value
        markDirty()
        schedulePreview()
      })
      textField.appendChild(input)
      form.appendChild(textField)

      const fontField = document.createElement('div')
      fontField.className = 'field'
      const fontLab = document.createElement('label')
      fontLab.textContent = '文字字号（px）'
      const fontHint = document.createElement('p')
      fontHint.className = 'field-hint'
      fontHint.textContent = '0 = 自适应默认大小；建议 48–140。'
      const fontRow = document.createElement('div')
      fontRow.className = 'marquee-speed-row'
      const fontRange = document.createElement('input')
      fontRange.type = 'range'
      fontRange.min = '0'
      fontRange.max = '200'
      fontRange.step = '2'
      fontRange.value = String(row.fontSize || 0)
      const fontNum = document.createElement('input')
      fontNum.type = 'number'
      fontNum.min = '0'
      fontNum.max = '200'
      fontNum.step = '1'
      fontNum.value = String(row.fontSize || 0)
      const syncFont = (val) => {
        const next = Math.min(200, Math.max(0, Math.round(Number(val) || 0)))
        row.fontSize = next
        fontRange.value = String(next)
        fontNum.value = String(next)
        markDirty()
        schedulePreview()
      }
      fontRange.addEventListener('input', () => syncFont(fontRange.value))
      fontNum.addEventListener('change', () => syncFont(fontNum.value))
      fontRow.append(fontRange, fontNum)
      fontField.append(fontLab, fontHint, fontRow)
      form.appendChild(fontField)
    }

    return form
  }

  const openRowEditor = (row, index) => {
    openEditorModal(
      {
        id: `marquee-row-${index}`,
        label: `滚动第 ${index + 1} 行`,
        hint: `${typeLabel(row)} · 返回后列表会刷新`,
        wide: true,
        build: () => {
          const host = document.createElement('div')
          const remount = () => {
            host.replaceChildren(buildRowForm(row, index, { remount }))
          }
          remount()
          return host
        },
      },
      {
        stack: true,
        onClose: () => render(),
      }
    )
  }

  const render = () => {
    const rows = ensureMarquees()
    box.innerHTML = ''
    const table = document.createElement('table')
    table.className = 'content-table list-editor-table'
    table.innerHTML = `
      <thead>
        <tr>
          <th class="col-index">#</th>
          <th class="col-title">内容</th>
          <th class="col-meta">状态</th>
          <th class="col-actions">操作</th>
        </tr>
      </thead>`
    const tbody = document.createElement('tbody')

    rows.forEach((row, index) => {
      const scrollingOn = row.scrolling !== false
      const tr = document.createElement('tr')
      tr.className = 'content-table-row'

      const indexCell = document.createElement('td')
      indexCell.className = 'col-index'
      indexCell.textContent = String(index + 1)

      const titleCell = document.createElement('td')
      titleCell.className = 'col-title'
      const titleBtn = document.createElement('button')
      titleBtn.type = 'button'
      titleBtn.className = 'content-table-title'
      titleBtn.textContent = rowSummary(row, index)
      titleBtn.title = '打开编辑'
      titleBtn.addEventListener('click', () => openRowEditor(row, index))
      titleCell.appendChild(titleBtn)

      const metaCell = document.createElement('td')
      metaCell.className = 'col-meta'
      const fsHint =
        (row.type || 'text') === 'text' && Number(row.fontSize) > 0 ? ` · ${row.fontSize}px` : ''
      metaCell.textContent = scrollingOn ? `滚动 ${row.speed || 48}s${fsHint}` : `已暂停${fsHint}`

      const actionsCell = document.createElement('td')
      actionsCell.className = 'col-actions'
      const actions = document.createElement('div')
      actions.className = 'content-table-actions'
      actions.append(
        mkBtn('编辑', 'is-primary', () => openRowEditor(row, index), '打开编辑弹窗'),
        mkBtn('↑', '', () => moveRow(index, index - 1), '上移'),
        mkBtn('↓', '', () => moveRow(index, index + 1), '下移')
      )
      actionsCell.appendChild(actions)

      tr.append(indexCell, titleCell, metaCell, actionsCell)
      tbody.appendChild(tr)
    })

    table.appendChild(tbody)
    box.appendChild(table)
  }

  render()
  return wrap
}

function markAssemblyDirty(opts = {}) {
  // 文案输入不要每次都 sync/重建 menuAssembly，否则 IME 拼音中间态会写死进配置，且 slot 引用失效
  if (opts.sync !== false) {
    syncMenuAssembly(config)
    renderConfigBar()
  }
  renderNav()
  markDirty()
  schedulePreview()
}

/** 更新官网菜单字段（显隐 / 文案等） */
function patchSiteMenu(id, partial) {
  if (!config || !id || !partial) return null
  ensureMenus(config)
  const m = config.global.menus.find((x) => x.id === id)
  if (!m) return null
  const next = { ...partial }
  const builtin = isBuiltinMenu(m) || m.locked
  if (builtin) {
    // 内置菜单不可改落地壳 / 入口链接
    delete next.shell
    delete next.href
    delete next.pageKey
    delete next.locked
  }
  if (isHomeMenu(m)) {
    delete next.visible
  }
  Object.assign(m, next)
  if (builtin) {
    const def = MENU_SLOTS.find((s) => s.id === m.id)
    if (def) {
      m.shell = def.shell
      m.href = def.href
      m.pageKey = def.pageKey ?? null
      m.locked = true
    }
  }
  if (isHomeMenu(m)) {
    m.visible = true
    m.locked = true
    m.shell = 'index.html'
    m.href = '/'
    m.pageKey = 'home'
  }
  markAssemblyDirty()
  return m
}

/** 侧栏：系统工具 + 官网菜单（动态） */
function getSidebarItems() {
  const system = [
    { id: 'pages', label: '页面组件', preview: 'index.html', kind: 'system' },
    { id: 'media', label: '素材库', preview: 'index.html', kind: 'system' },
    { id: 'leads', label: '留言', preview: 'contact.html', kind: 'system' },
  ]
  const menus = []
  if (config) {
    ensureMenus(config)
    listMenus(config).forEach((m) => {
      menus.push({
        id: m.id,
        label: m.label || m.id,
        preview: m.href || m.shell || 'index.html',
        kind: 'menu',
        visible: isHomeMenu(m) ? true : m.visible !== false,
        isHome: isHomeMenu(m),
      })
    })
  } else {
    PAGES.forEach((p) => {
      if (SYSTEM_NAV.some((s) => s.id === p.id)) return
      menus.push({ ...p, kind: 'menu', visible: true })
    })
  }
  return [...system, ...menus]
}

function findSidebarItem(sectionId) {
  return getSidebarItems().find((i) => i.id === sectionId) || null
}

/** 菜单 id → pages.* 配置分区（SEO / 模块字段） */
function resolvePageConfigKey(sectionId) {
  if (!sectionId || sectionId === 'pages' || sectionId === 'media' || sectionId === 'leads') {
    return sectionId
  }
  if (!config) return sectionId
  const menu = getMenuById(config, sectionId)
  if (!menu) return sectionId
  if (menu.pageKey) return menu.pageKey
  const shellBase = String(menu.shell || '').replace(/\.html$/i, '')
  const mapped = shellBase === 'index' ? 'home' : shellBase
  if (['home', 'service', 'about', 'news', 'case', 'contact'].includes(mapped)) return mapped
  if (['home', 'service', 'about', 'news', 'case', 'contact'].includes(menu.id)) return menu.id
  return sectionId
}

/** 侧栏页面 → 对应菜单维护槽 */
function resolveMenuSlotForSection(sectionId) {
  if (!config) return null
  ensureMenuAssembly(config)
  ensureMenus(config)
  const fromMenu = (config.global.menus || []).find(
    (m) => m.id === sectionId || m.pageKey === sectionId
  )
  const def = MENU_SLOTS.find((s) => s.id === sectionId || s.pageKey === sectionId)
  const id = fromMenu?.id || def?.id
  if (!id) return null
  return config.global.menuAssembly.find((s) => s.id === id) || null
}

/**
 * 页面配置栏：只展示该菜单「菜单维护」里绑定的组件（+ SEO）
 * 无对应菜单的分区（页面组件/素材等）仍返回完整配置项
 */
function getSectionConfigBarItems(sectionId) {
  const slot = resolveMenuSlotForSection(sectionId)
  if (!slot) return getConfigItems(sectionId)

  const configKey = resolvePageConfigKey(sectionId)
  const all = getConfigItems(configKey)
  const seo = all.filter((i) => i.id === 'seo')
  const assembled = []
  const seen = new Set()
  const comps = Array.isArray(slot.components) ? slot.components : []

  comps.forEach((unitId) => {
    const unit = getPageUnit(unitId, config)
    if (!unit?.itemId) return
    const key = `${unit.section}:${unit.itemId}`
    if (seen.has(key)) return
    seen.add(key)
    const sourceItems = unit.section === configKey ? all : getConfigItems(unit.section)
    const item = sourceItems.find((i) => i.id === unit.itemId)
    if (!item) return
    assembled.push({
      ...item,
      id: `asm:${unit.id}`,
      label: getPageUnitLabel(config, unit) || item.label,
      hint: '菜单覆盖 · 不改组件库默认值',
      category: '已组装组件',
      toggleKey: undefined,
      editContext: { slotId: slot.id, unitId: unit.id },
      styleUnitId: unit.id,
    })
  })

  return [
    ...seo.map((i) => ({
      ...i,
      category: '已组装组件',
      pinned: true,
      hint: i.hint || 'SEO 固定在首位，不参与页面组件排序',
    })),
    ...assembled,
  ]
}

/** 组件弹窗预览：只渲染当前组件，隐藏整页其它内容 */
function openComponentPreviewModal(unitOrId, opts = {}) {
  const unit = typeof unitOrId === 'string' ? getPageUnit(unitOrId, config) : unitOrId
  if (!unit) {
    setStatus('未找到该组件', false)
    return
  }
  const label = getPageUnitLabel(config, unit)
  const selector = getComposeSelector(unit)
  const page = unit.preview || 'index.html'
  const src = `/${String(page).replace(/^\//, '')}?preview=1&t=${Date.now()}`
  const preferSlotId = opts.slotId || contentEditContext?.slotId || null
  const previewSlot =
    preferSlotId && Array.isArray(config?.global?.menuAssembly)
      ? config.global.menuAssembly.find((s) => s.id === preferSlotId) || null
      : null
  const surfacePreset = resolveSurfacePreset(getComponentSurfaceId(config, unit.id, previewSlot))
  const surfaceName = surfacePreset?.id ? surfacePreset.label : '默认'

  const resolvePreviewGalleryInst = (unitId) => {
    const base = getCustomComponent(config, unitId)
    if (!base) return null
    const merge = (slot) => {
      const custom = getSlotComponentCustom(slot, unitId)
      if (!custom) return null
      return { ...base, ...custom, id: base.id, type: base.type }
    }
    if (preferSlotId && config?.global?.menuAssembly) {
      const slot = config.global.menuAssembly.find((s) => s.id === preferSlotId)
      const merged = slot ? merge(slot) : null
      if (merged) return merged
    }
    // 组件库预览：优先有图的菜单覆盖，否则库默认
    const baseImages = Array.isArray(base.images) ? base.images.filter(Boolean) : []
    if (baseImages.length) return base
    for (const slot of config?.global?.menuAssembly || []) {
      const merged = merge(slot)
      const imgs = Array.isArray(merged?.images) ? merged.images.filter(Boolean) : []
      if (imgs.length) return merged
    }
    return base
  }

  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay component-preview-overlay'
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove()
  })

  const panel = document.createElement('div')
  panel.className = 'modal-panel component-preview-panel'
  panel.setAttribute('role', 'dialog')
  panel.setAttribute('aria-modal', 'true')

  const head = document.createElement('div')
  head.className = 'modal-head'
  head.innerHTML = `<div><strong>组件预览</strong><span>${label} · ID ${unit.id || '—'} · 风格 ${surfaceName}</span></div>`
  const closeBtn = document.createElement('button')
  closeBtn.type = 'button'
  closeBtn.className = 'modal-close'
  closeBtn.setAttribute('aria-label', '关闭')
  closeBtn.textContent = '×'
  closeBtn.addEventListener('click', () => overlay.remove())
  head.appendChild(closeBtn)

  const body = document.createElement('div')
  body.className = 'modal-body component-preview-body'
  const tip = document.createElement('p')
  tip.className = 'section-note'
  tip.textContent = preferSlotId
    ? `仅预览当前组件（含本菜单覆盖内容与风格：${surfaceName}）`
    : `仅预览当前组件与其风格（${surfaceName}）`
  const frame = document.createElement('iframe')
  frame.className = 'component-preview-frame'
  frame.title = `预览 ${label}`
  frame.src = src

  const forceRevealVisible = (root) => {
    if (!root) return
    const nodes = [root, ...root.querySelectorAll('.reveal, .reveal-up, .reveal-left, .reveal-right')]
    nodes.forEach((node) => {
      if (!node?.classList) return
      node.classList.add('is-visible')
      node.style.setProperty('opacity', '1', 'important')
      node.style.setProperty('transform', 'none', 'important')
      node.style.setProperty('visibility', 'visible', 'important')
    })
  }

  const isolateComponent = () => {
    try {
      const doc = frame.contentDocument
      const win = frame.contentWindow
      if (!doc?.body) return false

      let el = null
      if (unit.customType === 'gallery') {
        const inst = resolvePreviewGalleryInst(unit.id)
        if (!inst) return false
        const tpl = doc.querySelector('[data-gallery-template]')
        let root = doc.getElementById('pageComposeRoot')
        if (!root) {
          const main = doc.querySelector('main')
          if (!main) return false
          root = doc.createElement('div')
          root.id = 'pageComposeRoot'
          root.className = 'page-compose-root'
          main.insertBefore(root, main.firstChild)
        }
        doc.querySelectorAll('[data-home-block],[data-page-block],[data-compose-unit]').forEach((node) => {
          if (node.getAttribute('data-custom-unit') === unit.id) return
          node.hidden = true
        })
        // 始终用最新数据重建，避免命中空的库默认 DOM
        doc.querySelectorAll(`[data-custom-unit="${unit.id}"]`).forEach((n) => n.remove())
        el = createGalleryElement(inst, tpl)
        root.appendChild(el)
      } else {
        el = selector ? doc.querySelector(selector) : null
      }
      if (!el) return false

      // 从组件向上，隐藏每一层兄弟节点 → 只剩当前组件可见
      let cur = el
      while (cur && cur !== doc.documentElement) {
        const parent = cur.parentElement
        if (!parent) break
        Array.from(parent.children).forEach((sib) => {
          if (sib === cur) return
          sib.style.setProperty('display', 'none', 'important')
          sib.setAttribute('data-preview-hidden', '1')
        })
        cur = parent
      }

      el.removeAttribute('hidden')
      el.classList.remove('is-home-block-off', 'is-page-block-off', 'is-compose-parked')
      el.style.removeProperty('display')
      el.style.setProperty('display', 'block', 'important')
      el.style.setProperty('visibility', 'visible', 'important')
      el.style.setProperty('opacity', '1', 'important')
      el.style.setProperty('position', 'relative', 'important')
      el.style.setProperty('inset', 'auto', 'important')
      el.style.setProperty('width', '100%', 'important')
      el.style.setProperty('max-width', '100%', 'important')
      el.style.setProperty('transform', 'none', 'important')
      el.style.setProperty('z-index', '1', 'important')
      forceRevealVisible(el)

      el.querySelectorAll('video').forEach((v) => {
        v.muted = true
        v.playsInline = true
        v.setAttribute('playsinline', '')
        v.play?.()?.catch(() => {})
      })

      const applied = applySurfaceToElement(el, unit.id, config, previewSlot)
      const innerUnit = el.matches('[data-compose-unit], [data-custom-unit]')
        ? el
        : el.querySelector('[data-compose-unit], [data-custom-unit]')
      if (innerUnit && innerUnit !== el) applySurfaceToElement(innerUnit, unit.id, config, previewSlot)
      const previewBg = applied?.bg || (applied?.tone === 'light' ? '#f7f7f7' : '#0b0d12')

      let previewStyle = doc.getElementById('component-preview-style')
      if (!previewStyle) {
        previewStyle = doc.createElement('style')
        previewStyle.id = 'component-preview-style'
        doc.head.appendChild(previewStyle)
      }
      previewStyle.textContent = `
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          background: ${previewBg} !important;
          overflow: auto !important;
          min-height: 100% !important;
        }
        .site-cursor, .menu-cursor { display: none !important; }
        .reveal, .reveal-up, .reveal-left, .reveal-right,
        .reveal.is-visible, .reveal-up.is-visible, .reveal-left.is-visible, .reveal-right.is-visible {
          opacity: 1 !important;
          transform: none !important;
          visibility: visible !important;
        }
      `
      win?.scrollTo?.(0, 0)
      return true
    } catch (err) {
      console.warn('[component-preview]', err)
      return false
    }
  }

  frame.addEventListener('load', () => {
    try {
      // 预览仍推送完整配置；图片组件会在 isolate 时按菜单/库数据重建
      frame.contentWindow?.postMessage(
        { type: 'guanzi-config-reload', config, openMenu: false },
        '*'
      )
    } catch {
      /* ignore */
    }
    let left = 10
    const tick = () => {
      left -= 1
      const ok = isolateComponent()
      if (left <= 0) return
      setTimeout(tick, ok ? 400 : 200)
    }
    setTimeout(tick, 400)
  })
  body.append(tip, frame)

  const foot = document.createElement('div')
  foot.className = 'modal-foot'
  const done = document.createElement('button')
  done.type = 'button'
  done.className = 'btn btn-primary'
  done.textContent = '关闭'
  done.addEventListener('click', () => overlay.remove())
  foot.appendChild(done)

  panel.append(head, body, foot)
  overlay.appendChild(panel)
  document.body.appendChild(overlay)
}

function createComponentSurfaceField(unitId, slot = null) {
  const wrap = document.createElement('div')
  wrap.className = 'edit-block component-surface-field'
  const profile = getComponentSurfaceProfile(unitId)

  const title = document.createElement('div')
  title.className = 'component-surface-head'
  title.innerHTML = `<strong>风格</strong><span>${profile?.label || '组件'} · 背景与字色自动适配</span>`
  wrap.appendChild(title)

  const hint = document.createElement('p')
  hint.className = 'field-hint'
  const scopeHint = slot
    ? '仅作用于当前菜单中的该组件；选「默认」则恢复组件原有背景。'
    : '作为组件库默认风格；菜单覆盖可再单独设置。'
  hint.textContent = profile?.hint ? `${profile.hint} ${scopeHint}` : scopeHint
  wrap.appendChild(hint)

  if (profile?.nativeTone === 'dark') {
    const toneNote = document.createElement('p')
    toneNote.className = 'field-hint component-surface-tone-note'
    toneNote.textContent = '该组件默认为深色底，更推荐「默认 / 深墨 / 炭黑」等深色预设。'
    wrap.appendChild(toneNote)
  }

  const grid = document.createElement('div')
  grid.className = 'component-surface-grid'
  const current = getComponentSurfaceId(config, unitId, slot)
  const prefer = new Set(profile?.prefer || [])

  COMPONENT_SURFACE_PRESETS.forEach((preset) => {
    const btn = document.createElement('button')
    btn.type = 'button'
    const isPrefer = !prefer.size || prefer.has(preset.id)
    btn.className = `component-surface-swatch${current === preset.id ? ' is-active' : ''}${
      preset.tone === 'dark' ? ' is-dark' : ''
    }${isPrefer ? '' : ' is-alt'}`
    btn.dataset.surface = preset.id
    btn.title = preset.hint
      ? `${preset.label}（${preset.hint}）${isPrefer ? '' : ' · 非推荐'}`
      : `${preset.label}${isPrefer ? '' : ' · 非推荐'}`
    btn.setAttribute('aria-pressed', String(current === preset.id))

    const chip = document.createElement('span')
    chip.className = 'component-surface-chip'
    if (preset.bg) chip.style.background = preset.bg
    else {
      chip.classList.add('is-default')
      chip.textContent = '默'
    }

    const lab = document.createElement('span')
    lab.className = 'component-surface-label'
    lab.textContent = preset.label

    btn.append(chip, lab)
    btn.addEventListener('click', () => {
      setComponentSurfaceId(config, unitId, preset.id, slot)
      grid.querySelectorAll('.component-surface-swatch').forEach((el) => {
        el.classList.toggle('is-active', el.dataset.surface === preset.id)
        el.setAttribute('aria-pressed', String(el.dataset.surface === preset.id))
      })
      markDirty()
      schedulePreview()
      const name = resolveSurfacePreset(preset.id).label
      notify(`已设置风格为「${name}」`, 'info')
    })
    grid.appendChild(btn)
  })

  wrap.appendChild(grid)
  return wrap
}

function resolveEditorSurfaceContext(item) {
  if (item?.id === 'seo' || item?.noSurface) return null
  // 仅组件级弹窗显式传入 styleUnitId 时展示风格；列表项等嵌套弹窗不得继承父级
  const unitId = item?.styleUnitId || null
  if (!unitId) return null
  const ctx = item?.editContext || null
  let slot = null
  if (ctx?.slotId && config?.global?.menuAssembly) {
    slot = config.global.menuAssembly.find((s) => s.id === ctx.slotId) || null
  }
  return { unitId, slot }
}

function openPageUnitEditor(unit, opts = {}) {
  if (!unit) return
  const kind = getUnitKind(unit)
  if (kind === 'nav') {
    openEditorModal(
      {
        id: 'site-nav',
        label: getPageUnitLabel(config, unit) || '全站导航',
        hint: '顶栏 Logo 与导航链接显隐 / 左右分区',
        build: () => buildSiteNavEditor(),
        styleUnitId: unit.id,
        editContext: opts.slotId ? { slotId: opts.slotId, unitId: unit.id } : null,
      },
      { stack: true }
    )
    return
  }
  if (kind === 'footer') {
    openEditorModal(
      {
        id: 'site-footer',
        label: getPageUnitLabel(config, unit) || '全站页尾',
        hint: '页尾文案与办公地址',
        build: () => buildSiteFooterEditor(),
        styleUnitId: unit.id,
        editContext: opts.slotId ? { slotId: opts.slotId, unitId: unit.id } : null,
      },
      { stack: true }
    )
    return
  }
  const items = getConfigItems(unit.section)
  const item = items.find((i) => i.id === unit.itemId)
  if (!item) {
    setStatus(`未找到配置项：${getPageUnitLabel(config, unit) || unit.label}`, false)
    return
  }
  // 叠在当前弹窗上编辑，不切换侧栏菜单
  if (unit.preview) loadPreview(unit.preview)
  const menuScoped = Boolean(opts.slotId)
  openEditorModal(
    {
      ...item,
      label: getPageUnitLabel(config, unit) || item.label,
      hint: menuScoped
        ? `ID ${unit.id} · 菜单覆盖编辑：只作用于当前菜单，不覆盖组件库默认值`
        : `ID ${unit.id} · ${getPageUnitDescription(unit) || item.hint || '维护组件默认内容'}`,
      editContext: menuScoped ? { slotId: opts.slotId, unitId: unit.id } : null,
      styleUnitId: unit.id,
    },
    { stack: true }
  )
}

/** 组件库：卡片网格清点与命名（不含 SEO；可绑定任意菜单） */
function buildPageCatalog() {
  ensurePageCatalog(config)
  ensureCustomComponents(config)
  const wrap = document.createElement('div')
  wrap.className = 'page-catalog'

  const intro = document.createElement('p')
  intro.className = 'section-note'
  intro.textContent =
    '组件以固定 ID 标识（改显示名不影响）。初始描述为系统说明。组件不归属落地页，由「菜单维护」绑定后加载；此处只维护默认内容。'
  wrap.appendChild(intro)

  const render = () => {
    ensurePageCatalog(config)
    ensureCustomComponents(config)
    wrap.querySelectorAll('.page-catalog-group, .page-catalog-summary').forEach((el) => el.remove())

    const groups = pageUnitsByGroup(config)
    let total = 0
    groups.forEach((units) => {
      total += units.length
    })
    const summary = document.createElement('div')
    summary.className = 'page-catalog-summary'
    summary.textContent = `共 ${total} 个独立组件 · ${groups.size} 组`
    wrap.appendChild(summary)

    groups.forEach((_units, group) => {
      const units = getOrderedPageUnits(config, group)
      const section = document.createElement('section')
      section.className = 'page-catalog-group'
      if (group === CUSTOM_GROUP) section.classList.add('is-custom-group')

      const head = document.createElement('div')
      head.className = 'page-catalog-group-head'
      const h = document.createElement('h4')
      h.className = 'page-catalog-group-title'
      h.textContent = `${group}（${units.length}）`
      head.appendChild(h)

      if (group === CUSTOM_GROUP) {
        const addBtn = document.createElement('button')
        addBtn.type = 'button'
        addBtn.className = 'btn btn-sm btn-primary'
        addBtn.textContent = '+ 添加图片组件'
        addBtn.addEventListener('click', () => {
          const inst = createCustomComponent(config, 'gallery')
          const n = config.global.customComponents.filter((c) => c.type === 'gallery').length
          setPageUnitLabel(config, inst.id, n > 1 ? `图片组件 ${n}` : '图片组件')
          markDirty()
          schedulePreview()
          render()
          setStatus('已添加图片组件，可编辑后绑定到菜单')
        })
        head.appendChild(addBtn)
      }
      section.appendChild(head)

      if (group === CUSTOM_GROUP && !units.length) {
        const empty = document.createElement('p')
        empty.className = 'section-note page-catalog-empty'
        empty.textContent = '还没有个性组件。点击「添加图片组件」创建实例，再在菜单维护里绑定。'
        section.appendChild(empty)
        wrap.appendChild(section)
        return
      }

      const grid = document.createElement('div')
      grid.className = 'page-catalog-grid'

      units.forEach((unit) => {
        const card = document.createElement('article')
        card.className = 'page-catalog-card'
        card.dataset.unitId = unit.id
        if (unit.customType) card.classList.add('is-custom-unit')

        // 名称输入
        const nameInput = document.createElement('input')
        nameInput.type = 'text'
        nameInput.className = 'page-catalog-name'
        nameInput.value = getPageUnitLabel(config, unit)
        nameInput.placeholder = unit.label || '组件名称'
        nameInput.title = '组件显示名称'
        nameInput.addEventListener('change', () => {
          setPageUnitLabel(config, unit.id, nameInput.value)
          markDirty()
          notify(`组件名称已改为「${nameInput.value || unit.label || unit.id}」，请保存`, 'info')
        })
        nameInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            nameInput.blur()
          }
        })

        // 菜单类型（仅内容组件；chrome 不分到菜单类型）
        let groupSelect = null
        if (!unit.customType && getUnitKind(unit) === 'content') {
          groupSelect = document.createElement('select')
          groupSelect.className = 'page-catalog-group-select'
          groupSelect.title = '组件库中的菜单类型分组（与落地页文件无关）'
          const currentGroup = getPageUnitGroup(config, unit)
          listAssignableCatalogGroups(config).forEach((g) => {
            const opt = document.createElement('option')
            opt.value = g
            opt.textContent = g
            if (g === currentGroup) opt.selected = true
            groupSelect.appendChild(opt)
          })
          groupSelect.addEventListener('change', () => {
            const next = groupSelect.value
            const prev = getPageUnitGroup(config, unit)
            if (next === prev) return
            if (!setPageUnitGroup(config, unit.id, next)) {
              groupSelect.value = prev
              notify('无法修改菜单类型', 'err')
              return
            }
            markDirty()
            render()
            notify(`「${getPageUnitLabel(config, unit)}」已归入「${next}」，请保存`, 'ok')
          })
        }

        // 组件 ID（唯一标识）+ 初始描述；不展示落地页模板归属
        const idRow = document.createElement('p')
        idRow.className = 'page-catalog-card-id'
        idRow.innerHTML = `<span>组件 ID</span><code title="唯一标识，改显示名不影响">${unit.id}</code>`

        const desc = document.createElement('p')
        desc.className = 'page-catalog-card-desc'
        desc.textContent = getPageUnitDescription(unit) || '—'
        desc.title = '初始描述（系统内置，改名不覆盖）'

        // 底部操作栏
        const foot = document.createElement('div')
        foot.className = 'page-catalog-card-foot'

        const tag = document.createElement('span')
        tag.className = 'page-catalog-card-tag'
        const kindMeta = COMPONENT_KINDS.find((k) => k.id === getUnitKind(unit))
        tag.textContent = unit.customType
          ? '个性组件'
          : kindMeta
            ? kindMeta.label
            : '内容'

        const actions = document.createElement('div')
        actions.className = 'page-catalog-card-actions'

        // 编辑按钮
        const editBtn = document.createElement('button')
        editBtn.type = 'button'
        editBtn.className = 'btn btn-sm btn-primary'
        editBtn.textContent = '编辑'
        editBtn.title = '维护组件默认内容'
        editBtn.addEventListener('click', () => {
          const kind = getUnitKind(unit)
          if (kind === 'nav') {
            openEditorModal({
              id: 'site-nav',
              label: '全站导航',
              hint: '顶栏 Logo 与导航链接显隐 / 左右分区',
              build: () => buildSiteNavEditor(),
              styleUnitId: unit.id,
            })
          } else if (kind === 'footer') {
            openEditorModal({
              id: 'site-footer',
              label: '全站页尾',
              hint: '页尾默认文案与办公地址',
              build: () => buildSiteFooterEditor(),
              styleUnitId: unit.id,
            })
          } else {
            openPageUnitEditor(unit)
          }
          notify(`正在编辑「${getPageUnitLabel(config, unit)}」`, 'info')
        })

        // 预览按钮
        const previewBtn = document.createElement('button')
        previewBtn.type = 'button'
        previewBtn.className = 'btn btn-sm'
        previewBtn.textContent = '预览'
        previewBtn.addEventListener('click', () => {
          openComponentPreviewModal(unit)
          notify(`预览「${getPageUnitLabel(config, unit)}」`, 'info')
        })

        actions.append(editBtn, previewBtn)

        if (unit.customType) {
          // 个性组件：删除按钮
          const delBtn = document.createElement('button')
          delBtn.type = 'button'
          delBtn.className = 'btn btn-sm btn-danger'
          delBtn.textContent = '删除'
          delBtn.addEventListener('click', async () => {
            const ok = await openConfirmModal({
              title: '删除个性组件',
              message: `确定删除「${getPageUnitLabel(config, unit)}」？已绑定菜单中的该组件也会移除。`,
              confirmText: '删除',
              danger: true,
            })
            if (!ok) {
              notify('已取消删除', 'info')
              return
            }
            removeCustomComponent(config, unit.id)
            markDirty()
            schedulePreview()
            render()
            notify('已删除个性组件，请保存', 'ok')
          })
          actions.appendChild(delBtn)
        }

        foot.append(tag, actions)
        if (groupSelect) card.append(nameInput, groupSelect, idRow, desc, foot)
        else card.append(nameInput, idRow, desc, foot)
        grid.appendChild(card)
      })

      section.appendChild(grid)
      wrap.appendChild(section)
    })
  }

  render()
  return wrap
}

function galleryInstanceEditor(instId) {
  ensureCustomComponents(config)
  const inst = getCustomComponent(config, instId)
  if (!inst) {
    const p = document.createElement('p')
    p.className = 'section-note'
    p.textContent = '组件不存在或已删除'
    return p
  }

  const menuScoped =
    contentEditContext?.unitId === instId ? resolveEditSlot() : null
  const customOv = menuScoped ? getSlotComponentCustom(menuScoped, instId) : null
  const view = customOv ? { ...inst, ...customOv } : inst

  const patch = (partial) => {
    if (menuScoped) {
      patchSlotComponentCustom(menuScoped, instId, partial)
    } else {
      updateCustomComponent(config, instId, partial)
    }
    markDirty()
    schedulePreview()
  }

  const wrap = document.createElement('div')
  if (menuScoped) {
    const note = document.createElement('p')
    note.className = 'section-note'
    note.textContent = '当前为菜单覆盖：只改本菜单的图片组件表现，不覆盖组件库默认实例。'
    wrap.appendChild(note)
  }

  const titleField = createControl({
    label: '可选标题（可空）',
    type: 'text',
    value: view.title || '',
    onStatus: setStatus,
    onChange: (next) => patch({ title: next }),
  })

  const colsWrap = document.createElement('label')
  colsWrap.className = 'field'
  const colsLab = document.createElement('span')
  colsLab.className = 'field-label'
  colsLab.textContent = '栅格列数'
  const colsSel = document.createElement('select')
  colsSel.className = 'field-input'
  ;[
    ['1', '1 列'],
    ['2', '2 列'],
    ['3', '3 列'],
    ['4', '4 列'],
    ['5', '5 列'],
    ['6', '6 列'],
  ].forEach(([value, text]) => {
    const opt = document.createElement('option')
    opt.value = value
    opt.textContent = text
    if (Number(value) === Number(view.columns)) opt.selected = true
    colsSel.appendChild(opt)
  })
  colsSel.addEventListener('change', () => {
    patch({ columns: Number(colsSel.value) || 3 })
    notify(`栅格已改为 ${colsSel.value} 列，请保存`, 'info')
  })
  colsWrap.append(colsLab, colsSel)

  const gapField = createControl({
    label: '间距（px）',
    type: 'number',
    hint: '图片之间的空隙',
    value: view.gap,
    onStatus: setStatus,
    onChange: (next) => {
      let n = Number(next)
      if (!Number.isFinite(n)) n = 12
      patch({ gap: Math.min(48, Math.max(0, Math.round(n))) })
    },
  })

  const aspectWrap = document.createElement('label')
  aspectWrap.className = 'field'
  const aspectLab = document.createElement('span')
  aspectLab.className = 'field-label'
  aspectLab.textContent = '图片比例'
  const aspectSel = document.createElement('select')
  aspectSel.className = 'field-input'
  ;[
    ['auto', '原始比例'],
    ['1', '1:1 方形'],
    ['4/3', '4:3'],
    ['3/4', '3:4 竖图'],
    ['16/9', '16:9'],
    ['3/2', '3:2'],
  ].forEach(([value, text]) => {
    const opt = document.createElement('option')
    opt.value = value
    opt.textContent = text
    if (String(view.aspect) === value) opt.selected = true
    aspectSel.appendChild(opt)
  })
  aspectSel.addEventListener('change', () => patch({ aspect: aspectSel.value }))
  aspectWrap.append(aspectLab, aspectSel)

  const radiusField = createControl({
    label: '圆角（px）',
    type: 'number',
    value: view.radius,
    onStatus: setStatus,
    onChange: (next) => {
      let n = Number(next)
      if (!Number.isFinite(n)) n = 0
      patch({ radius: Math.min(40, Math.max(0, Math.round(n))) })
    },
  })

  const imagesField = createMultiImageField({
    label: '图片（支持多张）',
    values: view.images || [],
    onChange: (next) => patch({ images: next }),
    onStatus: setStatus,
  })

  const editor = block('', [
    sectionNote(
      menuScoped
        ? '本菜单专属图片与布局；未覆盖的项仍使用组件库默认实例。'
        : '上传多张图片，并用栅格参数控制列数、间距、比例与圆角。保存后到「菜单维护」绑定到任意菜单。'
    ),
    titleField,
    colsWrap,
    gapField,
    aspectWrap,
    radiusField,
    imagesField,
  ])
  wrap.appendChild(editor)
  return wrap
}

/** 从弹窗勾选，向当前菜单追加组件（组件全局平等，按菜单类型分组） */
function openComponentPickerModal({ slot, pool, selectedIds, onDone }) {
  const available = pool.filter((p) => !selectedIds.includes(p.id))
  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay component-picker-overlay'
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove()
  })

  const panel = document.createElement('div')
  panel.className = 'modal-panel component-picker-panel'
  panel.setAttribute('role', 'dialog')
  panel.setAttribute('aria-modal', 'true')

  const head = document.createElement('div')
  head.className = 'modal-head'
  head.innerHTML = `<div><strong>添加组件</strong><span>绑定到当前菜单后才会在落地页加载</span></div>`
  const closeBtn = document.createElement('button')
  closeBtn.type = 'button'
  closeBtn.className = 'modal-close'
  closeBtn.setAttribute('aria-label', '关闭')
  closeBtn.textContent = '×'
  closeBtn.addEventListener('click', () => overlay.remove())
  head.appendChild(closeBtn)

  const body = document.createElement('div')
  body.className = 'modal-body component-picker-body'
  const tip = document.createElement('p')
  tip.className = 'section-note'
  tip.textContent = available.length
    ? '所有组件全局共用，与落地页文件无归属关系。勾选后点「添加」即可。'
    : '当前没有可再添加的组件（均已加入本菜单）。'
  body.appendChild(tip)

  const enriched = available.map((meta) => {
    const unit = getPageUnit(meta.id, config)
    const typeLabel = unit?.customType
      ? CUSTOM_GROUP
      : getPageUnitGroup(config, unit) || meta.group || '其它'
    return { meta, unit, typeLabel }
  })

  const picked = new Set()

  const filters = document.createElement('div')
  filters.className = 'component-picker-filters'
  const nameInput = document.createElement('input')
  nameInput.type = 'search'
  nameInput.className = 'content-list-search'
  nameInput.placeholder = '按名称检索'
  nameInput.autocomplete = 'off'
  nameInput.disabled = !available.length

  const typeSelect = document.createElement('select')
  typeSelect.className = 'content-list-cat-filter'
  typeSelect.disabled = !available.length
  const typeOptAll = document.createElement('option')
  typeOptAll.value = ''
  typeOptAll.textContent = '全部类型'
  typeSelect.appendChild(typeOptAll)
  const typeOrder = [...listAssignableCatalogGroups(config), CUSTOM_GROUP]
  const typeSeen = new Set(enriched.map((e) => e.typeLabel))
  typeOrder.forEach((g) => {
    if (!typeSeen.has(g)) return
    const opt = document.createElement('option')
    opt.value = g
    opt.textContent = g
    typeSelect.appendChild(opt)
  })
  ;[...typeSeen].filter((g) => !typeOrder.includes(g)).forEach((g) => {
    const opt = document.createElement('option')
    opt.value = g
    opt.textContent = g
    typeSelect.appendChild(opt)
  })

  filters.append(nameInput, typeSelect)
  body.appendChild(filters)

  const listMeta = document.createElement('div')
  listMeta.className = 'component-picker-list-meta'
  body.appendChild(listMeta)

  const list = document.createElement('div')
  list.className = 'component-picker-list'
  body.appendChild(list)

  const foot = document.createElement('div')
  foot.className = 'modal-foot'
  const cancel = document.createElement('button')
  cancel.type = 'button'
  cancel.className = 'btn'
  cancel.textContent = '取消'
  cancel.addEventListener('click', () => {
    overlay.remove()
    notify('已取消添加组件', 'info')
  })
  const add = document.createElement('button')
  add.type = 'button'
  add.className = 'btn btn-primary'
  add.textContent = '添加'
  add.disabled = !available.length
  add.addEventListener('click', () => {
    if (!picked.size) {
      notify('请先勾选要添加的组件', 'info')
      return
    }
    onDone?.(Array.from(picked))
    overlay.remove()
  })
  foot.append(cancel, add)

  const syncAddBtn = () => {
    add.disabled = !available.length
    add.textContent = picked.size ? `添加（${picked.size}）` : '添加'
  }

  function paintList() {
    const q = nameInput.value.trim().toLowerCase()
    const type = typeSelect.value
    const rows = enriched.filter((item) => {
      if (type && item.typeLabel !== type) return false
      if (!q) return true
      const hay = `${item.meta.label || ''} ${item.meta.id || ''}`.toLowerCase()
      return hay.includes(q)
    })

    list.innerHTML = ''
    listMeta.textContent = available.length
      ? `显示 ${rows.length} / ${available.length} · 已选 ${picked.size}`
      : ''

    if (!rows.length) {
      list.innerHTML = `<div class="content-list-empty">${
        available.length ? '没有符合条件的组件' : '暂无可添加组件'
      }</div>`
      return
    }

    rows.forEach(({ meta, typeLabel }) => {
      const row = document.createElement('label')
      row.className = 'component-picker-row'
      if (picked.has(meta.id)) row.classList.add('is-picked')

      const check = document.createElement('input')
      check.type = 'checkbox'
      check.checked = picked.has(meta.id)
      check.addEventListener('change', () => {
        row.classList.toggle('is-picked', check.checked)
        if (check.checked) picked.add(meta.id)
        else picked.delete(meta.id)
        listMeta.textContent = `显示 ${rows.length} / ${available.length} · 已选 ${picked.size}`
        syncAddBtn()
      })

      const main = document.createElement('span')
      main.className = 'component-picker-row-main'
      const name = document.createElement('strong')
      name.textContent = meta.label
      const sub = document.createElement('small')
      sub.textContent = typeLabel
      main.append(name, sub)

      const preview = document.createElement('button')
      preview.type = 'button'
      preview.className = 'btn btn-sm'
      preview.textContent = '预览'
      preview.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        openComponentPreviewModal(meta.id)
      })

      row.append(check, main, preview)
      list.appendChild(row)
    })
  }

  nameInput.addEventListener('input', paintList)
  typeSelect.addEventListener('change', paintList)

  panel.append(head, body, foot)
  overlay.appendChild(panel)
  document.body.appendChild(overlay)
  paintList()
  if (available.length) nameInput.focus()
}

/** 全站导航：顶栏 Logo + 顶部导航链接 */
function buildSiteNavEditor() {
  ensureMenus(config)
  const wrap = document.createElement('div')
  wrap.className = 'edit-block site-nav-editor'

  wrap.appendChild(sectionNote('顶栏 Logo 文案（全站统一），以及 Logo 两侧导航链接的显隐与分区。'))
  wrap.appendChild(field('品牌名（英文主标题 / Logo）', 'global.brandName'))
  wrap.appendChild(field('副标题（中文 / Logo）', 'global.brandSub'))
  wrap.appendChild(
    sectionNote('下方维护顶部导航栏链接。菜单名称与链接请到「菜单维护」修改。')
  )

  const list = document.createElement('div')
  list.className = 'site-nav-list'

  const render = () => {
    ensureMenus(config)
    list.replaceChildren()
    const menus = listMenus(config)
    if (!menus.length) {
      const empty = document.createElement('p')
      empty.className = 'section-note'
      empty.textContent = '暂无菜单，请先在「菜单维护」中添加。'
      list.appendChild(empty)
      return
    }

    const head = document.createElement('div')
    head.className = 'site-nav-list-head'
    head.innerHTML = '<span>菜单</span><span>顶栏</span><span>位置</span><span>顺序</span>'
    list.appendChild(head)

    menus.forEach((menu, idx) => {
      const row = document.createElement('div')
      row.className = `site-nav-row${menu.visible === false ? ' is-page-off' : ''}${
        menu.showInNav ? '' : ' is-nav-off'
      }`

      const main = document.createElement('div')
      main.className = 'site-nav-row-main'
      const name = document.createElement('strong')
      name.textContent = menu.label || menu.id
      if (isHomeMenu(menu)) {
        const badge = document.createElement('em')
        badge.className = 'menu-home-badge'
        badge.textContent = '首页'
        name.appendChild(badge)
      }
      const sub = document.createElement('small')
      sub.textContent = isHomeMenu(menu)
        ? '站点入口 · 始终显示'
        : menu.visible === false
          ? '页面已隐藏'
          : menu.href || ''
      main.append(name, sub)

      const vis = document.createElement('label')
      const home = isHomeMenu(menu)
      vis.className = `vis-switch is-compact${menu.showInNav ? '' : ' is-off'}`
      vis.title = menu.showInNav ? '已在顶部导航显示' : '未在顶部导航显示'
      // 顶栏 showInNav 首页仍可配置（通常关闭）；页面显隐已锁定
      const visInput = document.createElement('input')
      visInput.type = 'checkbox'
      visInput.checked = !!menu.showInNav
      visInput.disabled = menu.visible === false && !home
      const visTrack = document.createElement('span')
      visTrack.className = 'vis-switch-track'
      visTrack.setAttribute('aria-hidden', 'true')
      const visText = document.createElement('span')
      visText.className = 'vis-switch-text'
      visText.textContent = menu.showInNav ? '显' : '隐'
      const applyVis = () => {
        patchSiteMenu(menu.id, { showInNav: visInput.checked })
        notify(
          visInput.checked ? `「${menu.label}」已加入顶栏` : `「${menu.label}」已从顶栏移除`,
          'info'
        )
        render()
      }
      visInput.addEventListener('change', applyVis)
      visTrack.addEventListener('click', (e) => {
        e.preventDefault()
        if (visInput.disabled) return
        visInput.checked = !visInput.checked
        applyVis()
      })
      vis.append(visInput, visTrack, visText)

      const side = document.createElement('select')
      side.className = 'field-input site-nav-side'
      side.disabled = !menu.showInNav || (menu.visible === false && !home)
      ;[
        [false, '左侧'],
        [true, '右侧'],
      ].forEach(([aside, text]) => {
        const opt = document.createElement('option')
        opt.value = aside ? 'aside' : 'main'
        opt.textContent = text
        if (!!menu.navAside === aside) opt.selected = true
        side.appendChild(opt)
      })
      side.addEventListener('change', () => {
        patchSiteMenu(menu.id, { navAside: side.value === 'aside' })
        notify(`「${menu.label}」已放到顶栏${side.value === 'aside' ? '右侧' : '左侧'}`, 'info')
        render()
      })

      const orderBtns = document.createElement('div')
      orderBtns.className = 'site-nav-order'
      const up = document.createElement('button')
      up.type = 'button'
      up.className = 'btn btn-sm'
      up.textContent = '↑'
      up.title = home ? '首页固定首位' : idx === 1 ? '不可越过首页' : '上移（影响顶栏与侧栏顺序）'
      up.disabled = home || idx === 0 || idx === 1
      up.addEventListener('click', () => {
        if (home || idx <= 1) return
        const ids = listMenus(config).map((m) => m.id)
        ;[ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]]
        reorderMenus(config, ids)
        markAssemblyDirty()
        notify('已调整顺序，请保存', 'info')
        render()
      })
      const down = document.createElement('button')
      down.type = 'button'
      down.className = 'btn btn-sm'
      down.textContent = '↓'
      down.title = home ? '首页固定首位' : '下移（影响顶栏与侧栏顺序）'
      down.disabled = home || idx >= menus.length - 1
      down.addEventListener('click', () => {
        if (home) return
        const ids = listMenus(config).map((m) => m.id)
        if (idx >= ids.length - 1) return
        ;[ids[idx + 1], ids[idx]] = [ids[idx], ids[idx + 1]]
        reorderMenus(config, ids)
        markAssemblyDirty()
        notify('已调整顺序，请保存', 'info')
        render()
      })
      orderBtns.append(up, down)

      row.className = `site-nav-row${menu.visible === false && !home ? ' is-page-off' : ''}${
        menu.showInNav ? '' : ' is-nav-off'
      }${home ? ' is-home' : ''}`
      row.append(main, vis, side, orderBtns)
      list.appendChild(row)
    })
  }

  render()
  wrap.appendChild(list)
  wrap.appendChild(
    sectionNote('全屏汉堡菜单仍显示全部「页面可见」的菜单；顶栏只显示上方开关打开的项。')
  )
  return wrap
}

/** 全站页尾默认内容（仅页尾自身：文案 + 办公地址） */
function buildSiteFooterEditor() {
  return block('', [
    sectionNote('仅维护页尾组件自身文案与办公地址。顶栏 Logo 在「全站导航」；各办公室电话在下方地址列表中维护。'),
    field('页尾标题', 'global.footer.title'),
    field('页尾导语', 'global.footer.lead', 'textarea', { rows: 3, hint: '支持换行，前台按行展示' }),
    field('页尾品牌字', 'global.footer.brand'),
    field('版权', 'global.footer.copyright'),
    field('备案号', 'global.footer.beian'),
    listEditor({
      title: '办公地址',
      path: 'global.footer.offices',
      blank: { title: '新地址', lines: ['地址行1'], email: '', tel: '' },
      fields: [
        { key: 'title', label: '标题' },
        { key: 'lines', label: '地址行', type: 'lines' },
        { key: 'email', label: '邮箱' },
        { key: 'tel', label: '电话' },
      ],
    }),
  ])
}

/** 菜单组装：菜单实体 CRUD + 内容组件；全站 chrome */
function buildMenuAssemblyEditor() {
  ensureMenus(config)
  ensureMenuAssembly(config)
  ensureChrome(config)

  const wrap = document.createElement('div')
  wrap.className = 'menu-assembly'

  const intro = document.createElement('p')
  intro.className = 'section-note'
  intro.textContent =
    '左侧维护菜单（显隐/排序/文案）→ 作为导航组件的数据。右侧为该菜单绑定的内容组件。全站导航/页尾在下方「全站壳」区维护。'
  wrap.appendChild(intro)

  // —— 全站 chrome ——
  const chromeBox = document.createElement('div')
  chromeBox.className = 'menu-assembly-chrome'
  const chromeTitle = document.createElement('div')
  chromeTitle.className = 'menu-assembly-chrome-title'
  chromeTitle.innerHTML = '<strong>全站壳</strong><span>导航 / 页尾组件（全站共用）</span>'
  chromeBox.appendChild(chromeTitle)
  const chromeRow = document.createElement('div')
  chromeRow.className = 'menu-assembly-chrome-row'

  const makeChromeCard = (kind, key, label) => {
    const card = document.createElement('div')
    card.className = 'menu-assembly-chrome-card'
    const unitId = config.global.chrome?.[key]?.unitId || (kind === 'nav' ? 'site-nav' : 'site-footer')
    const unit = getPageUnit(unitId, config)
    card.innerHTML = `<strong>${label}</strong><span>${getPageUnitLabel(config, unit) || unitId}</span>`
    const actions = document.createElement('div')
    actions.className = 'menu-assembly-chrome-actions'
    const editBtn = document.createElement('button')
    editBtn.type = 'button'
    editBtn.className = 'btn btn-sm btn-primary'
    editBtn.textContent = '编辑'
    editBtn.addEventListener('click', () => {
      if (kind === 'footer') {
        openEditorModal({
          id: 'footer',
          label: '页尾文案',
          hint: '全站页尾组件默认内容',
          category: '页脚',
          build: () => buildSiteFooterEditor(),
          styleUnitId: unit?.id || unitId,
        })
      } else {
        openEditorModal({
          id: 'site-nav',
          label: '全站导航',
          hint: '顶栏 Logo 与导航链接显隐 / 左右分区',
          category: '导航',
          build: () => buildSiteNavEditor(),
          styleUnitId: unit?.id || unitId,
        })
      }
    })
    const previewBtn = document.createElement('button')
    previewBtn.type = 'button'
    previewBtn.className = 'btn btn-sm'
    previewBtn.textContent = '预览'
    previewBtn.addEventListener('click', () => {
      openComponentPreviewModal(unitId)
    })
    actions.append(editBtn, previewBtn)
    card.appendChild(actions)
    return card
  }
  chromeRow.append(makeChromeCard('nav', 'nav', '导航 · nav'), makeChromeCard('footer', 'footer', '页尾 · footer'))
  chromeBox.appendChild(chromeRow)
  wrap.appendChild(chromeBox)

  const layout = document.createElement('div')
  layout.className = 'menu-assembly-layout'
  const menuCol = document.createElement('div')
  menuCol.className = 'menu-assembly-menu-col'
  const menuToolbar = document.createElement('div')
  menuToolbar.className = 'menu-assembly-menu-toolbar'
  const menuToolbarLab = document.createElement('span')
  menuToolbarLab.textContent = '菜单维护'
  const addMenuBtn = document.createElement('button')
  addMenuBtn.type = 'button'
  addMenuBtn.className = 'btn btn-sm btn-primary'
  addMenuBtn.textContent = '+ 菜单'
  addMenuBtn.title = '新增菜单（默认使用通用页 page.html）'
  menuToolbar.append(menuToolbarLab, addMenuBtn)
  const menuList = document.createElement('div')
  menuList.className = 'menu-assembly-menu-list'
  menuList.setAttribute('role', 'tablist')
  menuCol.append(menuToolbar, menuList)
  const detail = document.createElement('div')
  detail.className = 'menu-assembly-detail'
  layout.append(menuCol, detail)
  wrap.appendChild(layout)

  let activeId = config.global.menus?.[0]?.id || MENU_SLOTS[0]?.id || ''

  const patchMenu = (id, partial) => patchSiteMenu(id, partial)

  addMenuBtn.addEventListener('click', async () => {
    const shell = 'page.html'
    const menu = addMenu(config, {
      label: '新菜单',
      title: '新菜单',
      en: 'NEW',
      shell,
      showInNav: true,
      visible: true,
    })
    activeId = menu.id
    markAssemblyDirty()
    renderMenus()
    renderDetail()
    notify(`已添加菜单「${menu.label}」（通用页 ${menu.href}），请改文案并组装组件后保存`, 'ok')
  })

  const renderDetail = () => {
    ensureMenus(config)
    ensureMenuAssembly(config)
    detail.replaceChildren()
    const menu = getMenuById(config, activeId)
    const slot = config.global.menuAssembly.find((s) => s.id === activeId)
    if (!menu || !slot) {
      detail.innerHTML = '<p class="section-note">请选择左侧菜单</p>'
      return
    }
    if (!Array.isArray(slot.components)) slot.components = defaultComponentsForSlot(slot)

    const title = document.createElement('div')
    title.className = 'menu-assembly-detail-title'
    const homeTag = isHomeMenu(menu) ? '<em class="menu-home-badge">站点首页</em>' : ''
    title.innerHTML = `<strong>${menu.label}${homeTag}</strong><span>壳 ${menu.shell} · ${menu.href}</span>`
    detail.appendChild(title)

    if (isHomeMenu(menu)) {
      detail.appendChild(
        sectionNote('首页为站点固定入口：始终显示、固定首位，不可更换落地页壳与链接，不可删除。')
      )
    } else if (isBuiltinMenu(menu) || menu.locked) {
      detail.appendChild(
        sectionNote('内置菜单：落地页壳与入口链接已锁定，仅可改显示名称、全屏菜单文案与顶栏显隐。')
      )
    }

    const fields = document.createElement('div')
    fields.className = 'menu-assembly-fields'

    fields.appendChild(
      createControl({
        label: '顶栏短名 / 列表名',
        type: 'text',
        value: menu.label || '',
        onStatus: setStatus,
        onChange: (next) => {
          patchMenu(activeId, { label: String(next ?? '') })
          renderMenus()
        },
      })
    )
    fields.appendChild(
      createControl({
        label: '全屏菜单主标题',
        type: 'text',
        value: menu.title || '',
        onStatus: setStatus,
        onChange: (next) => {
          patchMenu(activeId, { title: String(next ?? '') })
        },
      })
    )
    fields.appendChild(
      createControl({
        label: '全屏菜单英文',
        type: 'text',
        value: menu.en || '',
        onStatus: setStatus,
        onChange: (next) => {
          patchMenu(activeId, { en: String(next ?? '') })
        },
      })
    )

    const shellLocked = isBuiltinMenu(menu) || menu.locked
    const shellField = document.createElement('label')
    shellField.className = 'field'
    shellField.innerHTML = '<span class="field-label">落地页壳</span>'
    const shellSel = document.createElement('select')
    shellSel.className = 'field-input'
    shellSel.disabled = shellLocked
    SHELL_OPTIONS.forEach((o) => {
      const opt = document.createElement('option')
      opt.value = o.shell
      opt.textContent = o.generic
        ? `${o.label}（${o.shell} · 新菜单推荐）`
        : `${o.label}（${o.shell}）`
      if (o.shell === menu.shell) opt.selected = true
      shellSel.appendChild(opt)
    })
    shellSel.addEventListener('change', () => {
      if (shellLocked) return
      const meta = SHELL_OPTIONS.find((o) => o.shell === shellSel.value)
      const nextShell = shellSel.value
      patchMenu(activeId, {
        shell: nextShell,
        href: hrefForShell(nextShell, activeId),
        pageKey: meta?.pageKey ?? null,
      })
      renderDetail()
      notify(
        isGenericShell(nextShell)
          ? '已切换为通用页，链接已设为带 ?m=菜单ID，可多菜单共用'
          : '已更换落地页壳，请保存',
        'info'
      )
    })
    shellField.appendChild(shellSel)
    const shellHint = document.createElement('p')
    shellHint.className = 'field-hint'
    shellHint.textContent = shellLocked
      ? isHomeMenu(menu)
        ? '首页固定使用 index.html，不可更换。'
        : '内置菜单的落地页壳已锁定，不可更换。'
      : isGenericShell(menu.shell)
        ? '通用页是空壳，内容完全由下方组件组装；多个新菜单共用 page.html，靠链接里的 ?m= 区分。'
        : '专用壳带有该页固有结构；新菜单更建议选「通用页」。'
    shellField.appendChild(shellHint)
    fields.appendChild(shellField)

    const hrefField = createControl({
      label: '链接 href',
      type: 'text',
      value: menu.href || '',
      hint: shellLocked
        ? isHomeMenu(menu)
          ? '首页入口固定为 /'
          : '内置菜单的入口链接已锁定，不可修改。'
        : isGenericShell(menu.shell)
          ? '通用页请保留 ?m=菜单ID，例如 /page.html?m=xxx'
          : '可带 hash，如 /contact.html#feedback',
      onStatus: setStatus,
      onChange: (next) => {
        if (shellLocked) return
        patchMenu(activeId, { href: String(next ?? '') })
      },
    })
    if (shellLocked) {
      const input = hrefField.querySelector('input')
      if (input) {
        input.disabled = true
        input.readOnly = true
      }
    }
    fields.appendChild(hrefField)

    const navToggle = document.createElement('label')
    navToggle.className = 'field menu-assembly-check'
    const navCb = document.createElement('input')
    navCb.type = 'checkbox'
    navCb.checked = !!menu.showInNav
    navCb.addEventListener('change', () => {
      patchMenu(activeId, { showInNav: navCb.checked })
      notify(navCb.checked ? '已显示在顶部导航栏' : '已从顶部导航栏隐藏（全屏菜单仍可显示）', 'info')
      renderDetail()
    })
    navToggle.append(navCb, document.createTextNode(' 显示在顶部导航栏'))
    fields.appendChild(navToggle)

    const asideToggle = document.createElement('label')
    asideToggle.className = 'field menu-assembly-check'
    const asideCb = document.createElement('input')
    asideCb.type = 'checkbox'
    asideCb.checked = !!menu.navAside
    asideCb.disabled = !menu.showInNav
    asideCb.addEventListener('change', () => {
      patchMenu(activeId, { navAside: asideCb.checked })
      notify(asideCb.checked ? '顶栏位置：右侧' : '顶栏位置：左侧', 'info')
    })
    asideToggle.append(asideCb, document.createTextNode(' 顶栏放在右侧（Logo 右侧）'))
    fields.appendChild(asideToggle)

    if (!menu.locked && !isHomeMenu(menu)) {
      const delBtn = document.createElement('button')
      delBtn.type = 'button'
      delBtn.className = 'btn btn-sm btn-danger'
      delBtn.textContent = '删除此菜单'
      delBtn.addEventListener('click', async () => {
        const ok = await openConfirmModal({
          title: '删除菜单',
          message: `确定删除「${menu.label}」？其内容组装也会移除。`,
          confirmText: '删除',
          danger: true,
        })
        if (!ok) return
        removeMenu(config, activeId)
        if (currentSection === activeId) currentSection = 'pages'
        activeId = config.global.menus[0]?.id || ''
        markAssemblyDirty()
        renderMenus()
        renderDetail()
        notify('已删除菜单，请保存', 'ok')
      })
      fields.appendChild(delBtn)
    } else if (isHomeMenu(menu)) {
      const tip = document.createElement('p')
      tip.className = 'field-hint'
      tip.textContent = '首页不可删除。'
      fields.appendChild(tip)
    }

    detail.appendChild(fields)

    const box = document.createElement('div')
    box.className = 'menu-assembly-modules'
    const labRow = document.createElement('div')
    labRow.className = 'menu-assembly-modules-toolbar'
    const lab = document.createElement('div')
    lab.className = 'menu-assembly-modules-label'
    lab.textContent = '内容组件（kind: content）'
    const addBtn = document.createElement('button')
    addBtn.type = 'button'
    addBtn.className = 'btn btn-sm btn-primary'
    addBtn.textContent = '添加组件'
    labRow.append(lab, addBtn)
    box.appendChild(labRow)

    const pool = listComposableUnits(config).map((u) => ({
      id: u.id,
      label: getPageUnitLabel(config, u),
      group: getPageUnitGroup(config, u),
    }))
    const selected = (Array.isArray(slot.components) ? slot.components : []).filter((id) =>
      pool.some((p) => p.id === id)
    )

    addBtn.addEventListener('click', () => {
      openComponentPickerModal({
        slot,
        pool,
        selectedIds: selected,
        onDone: (ids) => {
          const added = []
          ids.forEach((id) => {
            if (!slot.components.includes(id)) {
              slot.components.push(id)
              added.push(getPageUnitLabel(config, getPageUnit(id, config)) || id)
            }
          })
          markAssemblyDirty()
          renderMenus()
          renderDetail()
          if (added.length) notify(`已添加 ${added.length} 个组件：${added.join('、')}，请保存`, 'ok')
          else notify('所选组件均已在列表中', 'info')
        },
      })
    })

    if (!selected.length) {
      const empty = document.createElement('p')
      empty.className = 'section-note'
      empty.textContent = '当前仅头尾。添加内容组件后才会加载中间区块。'
      box.appendChild(empty)
    }

    selected.forEach((unitId, idx) => {
      const meta = pool.find((p) => p.id === unitId) || { id: unitId, label: unitId, group: '' }
      const unit = getPageUnit(unitId, config)
      const visible = isSlotComponentVisible(slot, unitId)
      const row = document.createElement('div')
      row.className = `menu-assembly-mod-row${visible ? '' : ' is-off'}`
      const name = document.createElement('span')
      const source = unit?.customType
        ? '个性组件'
        : getPageUnitGroup(config, unit) || meta.group || '内容'
      name.innerHTML = `<strong>${meta.label}</strong><small>${source}</small>`
      const up = document.createElement('button')
      up.type = 'button'
      up.className = 'btn btn-sm'
      up.textContent = '↑'
      up.disabled = idx === 0
      up.addEventListener('click', () => {
        const slotNow = config.global.menuAssembly.find((s) => s.id === activeId)
        if (!slotNow || !Array.isArray(slotNow.components)) return
        const from = slotNow.components.indexOf(unitId)
        if (from <= 0) return
        ;[slotNow.components[from - 1], slotNow.components[from]] = [
          slotNow.components[from],
          slotNow.components[from - 1],
        ]
        markAssemblyDirty()
        renderDetail()
        notify(`已上移「${meta.label}」，请保存`, 'info')
      })
      const down = document.createElement('button')
      down.type = 'button'
      down.className = 'btn btn-sm'
      down.textContent = '↓'
      down.disabled = idx === selected.length - 1
      down.addEventListener('click', () => {
        const slotNow = config.global.menuAssembly.find((s) => s.id === activeId)
        if (!slotNow || !Array.isArray(slotNow.components)) return
        const from = slotNow.components.indexOf(unitId)
        if (from < 0 || from >= slotNow.components.length - 1) return
        ;[slotNow.components[from + 1], slotNow.components[from]] = [
          slotNow.components[from],
          slotNow.components[from + 1],
        ]
        markAssemblyDirty()
        renderDetail()
        notify(`已下移「${meta.label}」，请保存`, 'info')
      })
      const edit = document.createElement('button')
      edit.type = 'button'
      edit.className = 'btn btn-sm btn-primary'
      edit.textContent = '编辑'
      edit.title = '编辑本菜单覆盖内容（不改组件库默认值）'
      edit.addEventListener('click', () => {
        const u = getPageUnit(unitId, config)
        if (u) {
          openPageUnitEditor(u, { slotId: activeId })
          notify(`正在编辑「${meta.label}」（仅本菜单）`, 'info')
        } else notify('未找到该组件', 'err')
      })
      const preview = document.createElement('button')
      preview.type = 'button'
      preview.className = 'btn btn-sm'
      preview.textContent = '预览'
      preview.addEventListener('click', () => {
        openComponentPreviewModal(unitId, { slotId: activeId })
        notify(`预览「${meta.label}」`, 'info')
      })
      const vis = document.createElement('label')
      vis.className = `vis-switch is-compact${visible ? '' : ' is-off'}`
      vis.title = visible ? '本菜单显示该组件' : '本菜单已隐藏该组件'
      const visInput = document.createElement('input')
      visInput.type = 'checkbox'
      visInput.checked = visible
      const visTrack = document.createElement('span')
      visTrack.className = 'vis-switch-track'
      visTrack.setAttribute('aria-hidden', 'true')
      const visText = document.createElement('span')
      visText.className = 'vis-switch-text'
      visText.textContent = visible ? '显示' : '隐藏'
      const applyCompVis = () => {
        const slotNow = config.global.menuAssembly.find((s) => s.id === activeId)
        if (!slotNow) return
        setSlotComponentVisible(slotNow, unitId, visInput.checked)
        vis.classList.toggle('is-off', !visInput.checked)
        visText.textContent = visInput.checked ? '显示' : '隐藏'
        row.classList.toggle('is-off', !visInput.checked)
        markAssemblyDirty()
        notify(visInput.checked ? `本菜单已显示「${meta.label}」` : `本菜单已隐藏「${meta.label}」`, 'ok')
      }
      visInput.addEventListener('click', (e) => e.stopPropagation())
      visInput.addEventListener('change', applyCompVis)
      visTrack.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        visInput.checked = !visInput.checked
        applyCompVis()
      })
      vis.append(visInput, visTrack, visText)
      const remove = document.createElement('button')
      remove.type = 'button'
      remove.className = 'btn btn-sm'
      remove.textContent = '移除'
      remove.addEventListener('click', async () => {
        const ok = await openConfirmModal({
          title: '移除组件',
          message: `确定从本菜单移除「${meta.label}」？`,
          confirmText: '移除',
          danger: true,
        })
        if (!ok) return
        const slotNow = config.global.menuAssembly.find((s) => s.id === activeId)
        if (!slotNow) return
        slotNow.components = (slotNow.components || []).filter((id) => id !== unitId)
        if (slotNow.componentSettings) delete slotNow.componentSettings[unitId]
        markAssemblyDirty()
        renderMenus()
        renderDetail()
        notify(`已移除「${meta.label}」，请保存`, 'ok')
      })
      row.append(name, vis, up, down, edit, preview, remove)
      box.appendChild(row)
    })

    detail.appendChild(box)
  }

  const renderMenus = () => {
    ensureMenus(config)
    ensureMenuAssembly(config)
    menuList.replaceChildren()
    config.global.menus.forEach((menu, idx) => {
      const slot = config.global.menuAssembly.find((s) => s.id === menu.id)
      const count = Array.isArray(slot?.components) ? slot.components.length : 0
      const visible = menu.visible !== false
      const home = isHomeMenu(menu)

      const row = document.createElement('div')
      row.className = `menu-assembly-menu-row${menu.id === activeId ? ' is-active' : ''}${
        visible ? '' : ' is-off'
      }${home ? ' is-home' : ''}`

      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'menu-assembly-menu-item'
      btn.setAttribute('role', 'tab')
      btn.setAttribute('aria-selected', String(menu.id === activeId))
      const label = document.createElement('strong')
      label.textContent = menu.label
      if (home) {
        const badge = document.createElement('em')
        badge.className = 'menu-home-badge'
        badge.textContent = '首页'
        label.appendChild(badge)
      }
      const sub = document.createElement('span')
      sub.textContent = home ? '站点入口 · 始终显示' : `${count} 个内容组件`
      btn.append(label, sub)
      btn.addEventListener('click', () => {
        if (activeId === menu.id) return
        activeId = menu.id
        renderMenus()
        renderDetail()
        notify(`正在编辑菜单「${menu.label}」`, 'info')
      })

      const orderBtns = document.createElement('div')
      orderBtns.className = 'menu-assembly-menu-order'
      const up = document.createElement('button')
      up.type = 'button'
      up.className = 'btn btn-sm'
      up.textContent = '↑'
      up.disabled = home || idx === 0 || idx === 1
      up.title = home ? '首页固定首位' : idx === 1 ? '首页下方第一项，不可再上移' : '上移'
      up.addEventListener('click', (e) => {
        e.stopPropagation()
        if (home || idx <= 1) return
        const ids = config.global.menus.map((m) => m.id)
        ;[ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]]
        reorderMenus(config, ids)
        markAssemblyDirty()
        renderMenus()
        notify('已调整菜单顺序，请保存', 'info')
      })
      const down = document.createElement('button')
      down.type = 'button'
      down.className = 'btn btn-sm'
      down.textContent = '↓'
      down.disabled = home || idx >= config.global.menus.length - 1
      down.title = home ? '首页固定首位' : '下移'
      down.addEventListener('click', (e) => {
        e.stopPropagation()
        if (home) return
        const ids = config.global.menus.map((m) => m.id)
        if (idx >= ids.length - 1) return
        ;[ids[idx + 1], ids[idx]] = [ids[idx], ids[idx + 1]]
        reorderMenus(config, ids)
        markAssemblyDirty()
        renderMenus()
        notify('已调整菜单顺序，请保存', 'info')
      })
      orderBtns.append(up, down)

      const vis = document.createElement('label')
      vis.className = `vis-switch is-compact${visible ? '' : ' is-off'}${home ? ' is-locked' : ''}`
      vis.title = home ? '站点首页始终显示，不可隐藏' : visible ? '前台显示该菜单' : '前台已隐藏该菜单'
      const input = document.createElement('input')
      input.type = 'checkbox'
      input.checked = visible
      input.disabled = home
      const track = document.createElement('span')
      track.className = 'vis-switch-track'
      track.setAttribute('aria-hidden', 'true')
      const text = document.createElement('span')
      text.className = 'vis-switch-text'
      text.textContent = home ? '固定' : visible ? '显示' : '隐藏'
      const applyVis = () => {
        if (home) return
        patchMenu(menu.id, { visible: input.checked })
        vis.classList.toggle('is-off', !input.checked)
        text.textContent = input.checked ? '显示' : '隐藏'
        row.classList.toggle('is-off', !input.checked)
        renderDetail()
        notify(input.checked ? `已显示菜单「${menu.label}」` : `已隐藏菜单「${menu.label}」`, 'ok')
      }
      input.addEventListener('click', (e) => e.stopPropagation())
      input.addEventListener('change', applyVis)
      track.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        if (home) {
          notify('站点首页始终显示，不可隐藏', 'info')
          return
        }
        input.checked = !input.checked
        applyVis()
      })
      vis.append(input, track, text)
      vis.addEventListener('click', (e) => e.stopPropagation())

      row.append(btn, orderBtns, vis)
      menuList.appendChild(row)
    })
  }

  renderMenus()
  renderDetail()
  return wrap
}


function getConfigItems(sectionId) {
  if (sectionId === 'custom') {
    ensureCustomComponents(config)
    return (config.global.customComponents || []).map((inst) => {
      const unit = getPageUnit(inst.id, config)
      return {
        id: inst.id,
        category: CUSTOM_GROUP,
        label: getPageUnitLabel(config, unit) || '图片组件',
        hint: '多图上传 + 栅格布局',
        wide: true,
        build: () => galleryInstanceEditor(inst.id),
      }
    })
  }

  if (sectionId === 'pages') {
    return [
      {
        id: 'catalog',
        category: '页面',
        label: '组件库',
        hint: '独立组件：命名 + 维护内容；可绑定任意菜单',
        wide: true,
        build: () => buildPageCatalog(),
      },
      {
        id: 'menu-assembly',
        category: '页面',
        label: '菜单维护',
        hint: '菜单 CRUD + 内容维护 + 全站导航/页尾',
        wide: true,
        build: () => buildMenuAssemblyEditor(),
      },
    ]
  }

  if (sectionId === 'home') {
    const result = [
      {
        id: 'seo',
        category: '基础',
        label: 'SEO',
        hint: '搜索引擎标题与描述',
        build: () =>
          block('', [
            sectionNote('MCN 单页落地：影响浏览器标签页与收录展示。'),
            field('页面标题', 'pages.home.seo.title'),
            field('描述', 'pages.home.seo.description', 'textarea', { rows: 3 }),
          ]),
      },
    ]
    const bo = blockOrderItem('home')
    if (bo) result.push(bo)
    return result.concat([
      {
        id: 'hero',
        category: '首屏',
        label: '首屏 Hero',
        hint: '主视觉文案与头图',
        toggleKey: 'hero',
        build: () =>
          block('', [
            homeBlockToggleNote('hero'),
            field('眉题', 'pages.home.heroEyebrow'),
            field('主标题 HTML', 'pages.home.heroTitleHtml', 'textarea', {
              rows: 4,
              hint: '可用 <br/> 与 <span class="accent">…</span>',
            }),
            field('描述', 'pages.home.heroDesc', 'textarea', { rows: 3 }),
            field('头图', 'pages.home.heroImage', 'image'),
            field('Logo 字标', 'pages.home.logoMark'),
            field('浮卡数字', 'pages.home.heroFloatNum'),
            field('浮卡文案', 'pages.home.heroFloatLabel'),
          ]),
      },
      {
        id: 'services',
        category: '服务',
        label: '核心服务',
        hint: '六大核心服务能力',
        toggleKey: 'services',
        wide: true,
        build: () =>
          block('', [
            homeBlockToggleNote('services'),
            field('眉题', 'pages.home.servicesEyebrow'),
            field('标题', 'pages.home.servicesTitle'),
            field('描述', 'pages.home.servicesDesc', 'textarea', { rows: 3 }),
            listEditor({
              title: '服务卡片',
              path: 'pages.home.serviceItems',
              blank: {
                id: '',
                title: '新服务',
                summary: '',
                icon: 'users',
                advantages: ['优势一', '优势二'],
              },
              fields: [
                { key: 'id', label: 'ID（可空）' },
                { key: 'title', label: '标题' },
                { key: 'icon', label: '图标 key（users/star/monitor/video/bag/chart）' },
                { key: 'summary', label: '简介', type: 'textarea', full: true },
                { key: 'advantages', label: '优势（每行一条）', type: 'lines', full: true },
              ],
            }),
          ]),
      },
      {
        id: 'talents',
        category: '达人',
        label: '达人资源',
        hint: '分类筛选 · 卡片列表 · 详情页',
        toggleKey: 'talents',
        wide: true,
        build: () =>
          block('', [
            homeBlockToggleNote('talents'),
            field('眉题', 'pages.home.talentsEyebrow'),
            field('标题', 'pages.home.talentsTitle'),
            field('描述', 'pages.home.talentsDesc', 'textarea', { rows: 3 }),
            contentListEditor({
              title: '达人卡片',
              path: 'pages.home.talentItems',
              categoriesPath: 'pages.home.talentCategories',
              defaultCategoryPath: 'pages.home.talentDefaultCategory',
              kind: 'talent',
              blank: {
                id: '',
                name: '新达人',
                cat: '自有签约主播',
                badge: '自有主播',
                track: 'owned',
                platform: '',
                avatar: '',
                metricsLines: ['0|粉丝数', '0%|转化率', '0|场均GMV'],
                summary: '',
                body: '',
                gallery: [],
              },
              fields: [
                { key: 'name', label: '名称' },
                {
                  key: 'cat',
                  label: '分类',
                  type: 'select',
                  options: () => {
                    const list = getPath(config, 'pages.home.talentCategories') || []
                    return (Array.isArray(list) ? list : [])
                      .map((c) => (typeof c === 'string' ? c.trim() : String(c?.name || c?.label || '').trim()))
                      .filter(Boolean)
                  },
                },
                { key: 'badge', label: '角标' },
                { key: 'platform', label: '平台/垂类' },
                { key: 'id', label: '详情 ID（可空）', placeholder: '留空则按名称生成' },
                { key: 'avatar', label: '头像', type: 'image', full: true },
                {
                  key: 'metricsLines',
                  label: '指标（每行：数值|标签）',
                  type: 'lines',
                  full: true,
                },
                { key: 'summary', label: '简介（详情）', type: 'textarea', full: true },
                { key: 'body', label: '合作亮点（详情）', type: 'textarea', full: true },
                { key: 'gallery', label: '详情图集', type: 'images', full: true },
              ],
            }),
          ]),
      },
      {
        id: 'live',
        category: '案例',
        label: '直播案例',
        hint: '直播战绩与详情',
        toggleKey: 'live',
        wide: true,
        build: () =>
          block('', [
            homeBlockToggleNote('live'),
            field('眉题', 'pages.home.liveEyebrow'),
            field('标题', 'pages.home.liveTitle'),
            field('描述', 'pages.home.liveDesc', 'textarea', { rows: 3 }),
            listEditor({
              title: '直播列表',
              path: 'pages.home.liveItems',
              blank: {
                id: '',
                title: '新直播案例',
                category: '',
                talent: '',
                cover: '',
                viewers: '',
                metricsLines: ['0|GMV', '0%|转化率', '0|订单数'],
                summary: '',
                body: '',
                gallery: [],
              },
              fields: [
                { key: 'id', label: '详情 ID（可空）' },
                { key: 'title', label: '标题' },
                { key: 'category', label: '品类' },
                { key: 'talent', label: '主播/平台' },
                { key: 'viewers', label: '观看文案' },
                { key: 'cover', label: '封面', type: 'image', full: true },
                { key: 'metricsLines', label: '指标（每行：数值|标签）', type: 'lines', full: true },
                { key: 'summary', label: '详情摘要', type: 'textarea', full: true },
                { key: 'body', label: '详情正文', type: 'textarea', full: true },
                { key: 'gallery', label: '详情图集', type: 'images', full: true },
              ],
            }),
          ]),
      },
      {
        id: 'cases',
        category: '案例',
        label: '成功案例',
        hint: '品牌合作案例与详情',
        toggleKey: 'cases',
        wide: true,
        build: () =>
          block('', [
            homeBlockToggleNote('cases'),
            field('眉题', 'pages.home.casesEyebrow'),
            field('标题', 'pages.home.casesTitle'),
            field('描述', 'pages.home.casesDesc', 'textarea', { rows: 3 }),
            listEditor({
              title: '成功案例列表',
              path: 'pages.home.caseItems',
              blank: {
                id: '',
                title: '新案例',
                brand: '',
                cover: '',
                summary: '',
                metricsLines: ['0|总GMV', '0%|转化率', '0|曝光量'],
                body: '',
                gallery: [],
              },
              fields: [
                { key: 'id', label: '详情 ID（可空）' },
                { key: 'title', label: '标题' },
                { key: 'brand', label: '品牌角标' },
                { key: 'cover', label: '封面', type: 'image', full: true },
                { key: 'metricsLines', label: '指标（每行：数值|标签）', type: 'lines', full: true },
                { key: 'summary', label: '列表/详情摘要', type: 'textarea', full: true },
                { key: 'body', label: '详情正文', type: 'textarea', full: true },
                { key: 'gallery', label: '详情图集', type: 'images', full: true },
              ],
            }),
          ]),
      },
      {
        id: 'data',
        category: '数据',
        label: '数据看板',
        hint: '销售数据看板文案',
        toggleKey: 'data',
        build: () =>
          block('', [
            homeBlockToggleNote('data'),
            field('眉题', 'pages.home.dataEyebrow'),
            field('标题', 'pages.home.dataTitle'),
            field('描述', 'pages.home.dataDesc', 'textarea', { rows: 3 }),
            sectionNote('图表数值本版暂保持脚本默认；后续可再做成可配置序列。'),
          ]),
      },
      {
        id: 'process',
        category: '流程',
        label: '服务流程',
        hint: '标准化服务流程',
        toggleKey: 'process',
        wide: true,
        build: () =>
          block('', [
            homeBlockToggleNote('process'),
            field('眉题', 'pages.home.processEyebrow'),
            field('标题', 'pages.home.processTitle'),
            field('描述', 'pages.home.processDesc', 'textarea', { rows: 3 }),
            listEditor({
              title: '流程步骤',
              path: 'pages.home.processSteps',
              blank: { id: '', step: '06', title: '新步骤', desc: '' },
              fields: [
                { key: 'id', label: 'ID（可空）' },
                { key: 'step', label: '序号（如 01）' },
                { key: 'title', label: '标题' },
                { key: 'desc', label: '说明', type: 'textarea', full: true },
              ],
            }),
          ]),
      },
      {
        id: 'creativeHero',
        category: '传媒组件',
        label: '影像首屏 Creative Media',
        hint: '项目一迁入的视频 Hero',
        toggleKey: 'creativeHero',
        build: () =>
          block('', [
            homeBlockToggleNote('creativeHero'),
            field('主标题', 'pages.home.videoHeroTitle'),
            field('副标题', 'pages.home.videoHeroSubtitle', 'textarea', { rows: 2 }),
            field('背景视频', 'pages.home.video', 'video'),
          ]),
      },
      {
        id: 'clients',
        category: '传媒组件',
        label: '合作客户',
        hint: '项目一迁入的品牌 Logo 矩阵',
        toggleKey: 'clients',
        wide: true,
        build: () =>
          block('', [
            homeBlockToggleNote('clients'),
            field('主标题', 'pages.home.clientsTitle'),
            field('英文副标题', 'pages.home.clientsTitleEn'),
            field('品牌角标', 'pages.home.clientsBrandMark'),
            field('备注', 'pages.home.clientsRankNote'),
            sectionNote('分组 Logo 可在下方列表维护；也可一键灌入演示数据。'),
            listEditor({
              title: '客户分组',
              path: 'pages.home.clientsGroups',
              blank: { label: '新分组', logos: [] },
              fields: [
                { key: 'label', label: '分组名' },
                { key: 'logos', label: 'Logo 图集', type: 'images', full: true },
              ],
            }),
          ]),
      },
      {
        id: 'team',
        category: '传媒组件',
        label: '核心团队',
        hint: '项目一迁入的核心团队架构',
        toggleKey: 'team',
        wide: true,
        build: () =>
          block('', [
            homeBlockToggleNote('team'),
            field('标题', 'pages.about.teamTitle'),
            field('英文标题', 'pages.about.teamTitleEn'),
            listEditor({
              title: '团队成员',
              path: 'pages.about.teamMembers',
              blank: { name: '新成员', role: '职位', photo: '', bio: [] },
              fields: [
                { key: 'name', label: '姓名' },
                { key: 'role', label: '职位' },
                { key: 'photo', label: '头像', type: 'image', full: true },
                { key: 'bio', label: '履历（每行一条）', type: 'lines', full: true },
              ],
            }),
          ]),
      },
      {
        id: 'about',
        category: '关于',
        label: '关于我们',
        hint: '关于区与证言',
        toggleKey: 'about',
        build: () =>
          block('', [
            homeBlockToggleNote('about'),
            field('眉题', 'pages.home.aboutEyebrow'),
            field('标题', 'pages.home.aboutTitle'),
            field('正文', 'pages.home.aboutText', 'textarea', { rows: 5 }),
            field('证言', 'pages.home.testimonialText', 'textarea', { rows: 4 }),
            field('证言姓名', 'pages.home.testimonialName'),
            field('证言职位', 'pages.home.testimonialRole'),
          ]),
      },
      {
        id: 'contact',
        category: '咨询',
        label: '合作咨询',
        hint: '联系信息与表单提示',
        toggleKey: 'contact',
        build: () =>
          block('', [
            homeBlockToggleNote('contact'),
            field('眉题', 'pages.home.contactEyebrow'),
            field('标题 HTML', 'pages.home.contactTitleHtml', 'textarea', { rows: 2 }),
            field('描述', 'pages.home.contactDesc', 'textarea', { rows: 3 }),
            field('热线', 'pages.home.contactTel'),
            field('邮箱', 'pages.home.contactEmail'),
            field('地址', 'pages.home.contactAddress', 'textarea', { rows: 2 }),
            field('提交成功提示', 'pages.home.contactSuccessText'),
          ]),
      },
    ])
  }

  if (sectionId === 'service') {
    return [
      seoItem,
      {
        id: 'hero',
        category: '首屏',
        label: '服务页文案 / 视频',
        hint: '标题、媒体视频与底部滚动区',
        toggleKey: 'hero',
        wide: true,
        build: () => {
          const frag = document.createDocumentFragment()
          frag.append(
            pageBlockToggleNote('service', 'hero'),
            tabsPanel([
              {
                id: 'copy',
                label: '文案 / 视频',
                build: () =>
                  block('', [
                    styledCopyField('眉题', 'pages.service.eyebrow', 'pages.service.eyebrowFontSize', 'pages.service.eyebrowMarginBottom', {
                      sizeMax: 48,
                      sizeHint: '0 = 默认 14px',
                      mbPlaceholder: '默认 18',
                      mbHint: '留空 = 默认 18px；可填 0',
                    }),
                    styledCopyField('主标题', 'pages.service.title', 'pages.service.titleFontSize', 'pages.service.titleMarginBottom', {
                      sizeMax: 96,
                      sizeHint: '0 = 默认自适应（约 22–32px）',
                      mbPlaceholder: '默认 30',
                      mbHint: '留空 = 默认 30px；可填 0',
                    }),
                    styledCopyField('描述', 'pages.service.desc', 'pages.service.descFontSize', 'pages.service.descMarginBottom', {
                      type: 'textarea',
                      rows: 5,
                      hint: '多行纯文本',
                      sizeMax: 48,
                      sizeHint: '0 = 默认 16px',
                      mbPlaceholder: '默认 0',
                      mbHint: '留空 = 默认无下边距；可填数值',
                    }),
                    optionToggleRow({
                      title: '媒体视频',
                      desc: '关闭后服务页背景视频不显示，文案与内容仍保留。',
                      path: 'pages.service.videoVisible',
                      onText: '显示中',
                      offText: '已隐藏',
                      defaultValue: true,
                    }),
                    field('媒体视频文件', 'pages.service.video', 'video'),
                  ]),
              },
              {
                id: 'marquee',
                label: '滚动区域',
                build: () => marqueeEditor(),
              },
            ])
          )
          return frag
        },
      },
      {
        id: 'phases',
        category: '内容',
        label: 'Design 阶段',
        hint: 'Design 标题与流程阶段',
        toggleKey: 'stack',
        build: () =>
          block('', [
            pageBlockToggleNote('service', 'stack'),
            field('Design 标题', 'pages.service.designHeading'),
            listEditor({
              title: 'Design 阶段',
              path: 'pages.service.phases',
              blank: { title: '新阶段', desc: '' },
              fields: [
                { key: 'title', label: '标题' },
                { key: 'desc', label: '描述', type: 'textarea', rows: 3 },
              ],
            }),
          ]),
      },
      {
        id: 'services',
        category: '内容',
        label: '服务分类',
        hint: '服务与标签',
        build: () =>
          listEditor({
            title: '服务分类',
            path: 'pages.service.services',
            blank: { title: '新服务', tags: [] },
            fields: [
              { key: 'title', label: '标题' },
              { key: 'tags', label: '标签（逗号分隔）', asArray: true },
            ],
          }),
      },
    ].filter(Boolean).concat([blockOrderItem('service')].filter(Boolean))
  }

  if (sectionId === 'about') {
    ensureAboutIntro(config)
    ensureAboutTeam(config)
    ensureAboutProfile(config)
    return [
      seoItem,
      {
        id: 'intro',
        category: '内容',
        label: '关于我们',
        hint: '标题、简介、多张证书图与底部说明',
        toggleKey: 'intro',
        wide: true,
        build: () =>
          block('', [
            pageBlockToggleNote('about', 'intro'),
            sectionNote(
              '此处改的是组件默认内容。前台是否显示、以及某菜单的专属文案，请到「页面组件 → 菜单维护」控制。'
            ),
            field('中文标题', 'pages.about.introTitle'),
            field('英文标题', 'pages.about.introTitleEn'),
            field('简介文案', 'pages.about.introLead', 'richtext'),
            multiImageField('证书图片（可多张）', 'pages.about.certificates'),
            field('底部说明', 'pages.about.introCaption', 'textarea'),
            sectionNote('背景颜色组（主色 / 渐变底色 / 光晕强调色）'),
            field('背景主色', 'pages.about.introBg', 'color'),
            field('背景辅色', 'pages.about.introBg2', 'color'),
            field('光晕 / 强调色', 'pages.about.introGlow', 'color'),
            sectionNote('简介中可用 <span class="about-accent">400+</span> 标记高亮数字。'),
          ]),
      },
      {
        id: 'ktHero',
        category: '关于',
        label: '关于首屏',
        hint: '全屏背景图 + Hello + 标语',
        toggleKey: 'ktHero',
        wide: true,
        build: () => {
          ensureAboutProfile(config)
          return block('', [
            pageBlockToggleNote('about', 'ktHero'),
            sectionNote(
              '还原经天关于页首屏。组装顺序建议：首屏 → 数据条 → 公司介绍 → 能力卡片 → 客户评价。'
            ),
            field('大标题', 'pages.about.profileHello'),
            field('左侧标语（如 SINCE 2016）', 'pages.about.profileSince'),
            field('中间标语（如 ABOUT US）', 'pages.about.profileAboutLabel'),
            field('右侧标语（如 KEEP MOVING FORWARD）', 'pages.about.profileForward'),
            field('背景图', 'pages.about.profileHeroBg', 'image'),
          ])
        },
      },
      {
        id: 'ktStats',
        category: '关于',
        label: '关于数据条',
        hint: '白底四列数据指标',
        toggleKey: 'ktStats',
        wide: true,
        build: () => {
          ensureAboutProfile(config)
          return block('', [
            pageBlockToggleNote('about', 'ktStats'),
            listEditor({
              title: '数据指标',
              path: 'pages.about.profileStats',
              blank: { value: '0+', label: '说明' },
              fields: [
                { key: 'value', label: '数值（如 3,000+）' },
                { key: 'label', label: '说明文案' },
              ],
            }),
          ])
        },
      },
      {
        id: 'ktStory',
        category: '关于',
        label: '关于公司介绍',
        hint: '浅色介绍区：关于光子 / 大品牌的认可',
        toggleKey: 'ktStory',
        wide: true,
        build: () => {
          ensureAboutProfile(config)
          return block('', [
            pageBlockToggleNote('about', 'ktStory'),
            field('介绍标题', 'pages.about.profileAboutTitle'),
            field('介绍正文', 'pages.about.profileAboutBody', 'richtext'),
            field('品牌认可标题', 'pages.about.profileBrandTitle'),
            field('品牌认可正文', 'pages.about.profileBrandBody', 'richtext'),
          ])
        },
      },
      {
        id: 'ktCards',
        category: '关于',
        label: '关于能力卡片',
        hint: '横向能力卡片（悬停反色）',
        toggleKey: 'ktCards',
        wide: true,
        build: () => {
          ensureAboutProfile(config)
          return block('', [
            pageBlockToggleNote('about', 'ktCards'),
            listEditor({
              title: '能力卡片',
              path: 'pages.about.profileCards',
              blank: { title: '新能力', desc: '一句话说明' },
              fields: [
                { key: 'title', label: '标题' },
                { key: 'desc', label: '说明', type: 'textarea', rows: 2 },
              ],
            }),
          ])
        },
      },
      {
        id: 'team',
        category: '内容',
        label: '核心团队架构',
        hint: '团队成员头像、职位与履历',
        toggleKey: 'team',
        wide: true,
        build: () =>
          block('', [
            pageBlockToggleNote('about', 'team'),
            sectionNote('可在「页面组件 → 菜单维护」把本组件挂到任意菜单页。'),
            field('中文标题', 'pages.about.teamTitle'),
            field('英文标题', 'pages.about.teamTitleEn'),
            listEditor({
              title: '团队成员',
              path: 'pages.about.teamMembers',
              blank: { name: '新成员', role: '职位', photo: '', bio: [] },
              fields: [
                { key: 'name', label: '姓名' },
                { key: 'role', label: '职位' },
                { key: 'photo', label: '头像', type: 'image' },
                { key: 'bio', label: '履历（每行一条）', type: 'lines' },
              ],
            }),
          ]),
      },
      {
        id: 'reviews',
        category: '内容',
        label: '客户评价',
        toggleKey: 'reviews',
        build: () =>
          block('', [
            pageBlockToggleNote('about', 'reviews'),
            field('评价区标题', 'pages.about.reviewsTitle'),
            createControl({
              label: '滚动时长（秒/循环）',
              type: 'number',
              hint: '评价列表向上无缝滚动一整圈的时间，建议 12–60，数值越大越慢；悬停可暂停',
              value: (() => {
                const n = Number(getPath(config, 'pages.about.reviewsScrollDuration'))
                if (!Number.isFinite(n) || n <= 0) return 24
                return Math.min(90, Math.max(8, Math.round(n)))
              })(),
              onStatus: setStatus,
              onChange: (next) => {
                const n = Number(next)
                const clamped =
                  !Number.isFinite(n) || n <= 0 ? 24 : Math.min(90, Math.max(8, Math.round(n)))
                setPath(config, 'pages.about.reviewsScrollDuration', clamped)
                markDirty()
                schedulePreview()
              },
            }),
            listEditor({
              title: '客户评价',
              path: 'pages.about.reviews',
              blank: { text: '', cite: '' },
              fields: [
                { key: 'text', label: '评价', type: 'textarea', rows: 4 },
                { key: 'cite', label: '署名' },
              ],
            }),
          ]),
      },
      {
        id: 'logos',
        category: '内容',
        label: '客户 Logo',
        hint: '关于页底部 Logo 墙',
        toggleKey: 'logos',
        build: () =>
          block('', [
            pageBlockToggleNote('about', 'logos'),
            sectionNote('为空时前台会回退使用首页 Logo 墙。'),
            multiImageField('客户 Logo', 'pages.about.clientLogos'),
          ]),
      },
    ].filter(Boolean).concat([blockOrderItem('about')].filter(Boolean))
  }

  if (sectionId === 'news') {
    return [
      seoItem,
      {
        id: 'title',
        category: '首屏',
        label: '页面标题',
        hint: '标题、默认分类与分页',
        build: () =>
          block('', [
            field('英文标题', 'pages.news.titleEn'),
            field('中文标题', 'pages.news.titleZh'),
            field('默认分类', 'pages.news.defaultCategory'),
            field('每页条数', 'pages.news.pageSize', 'number'),
          ]),
      },
      {
        id: 'categories',
        category: '内容',
        label: '分类',
        hint: '左侧分类菜单',
        build: () => renderStringArray('分类', 'pages.news.categories', { bulk: true, blank: '新分类' }),
      },
      {
        id: 'items',
        category: '内容',
        label: '新闻列表',
        hint: '列表浏览 · 点击编辑打开独立弹窗 · 可维护分类',
        wide: true,
        build: () =>
          contentListEditor({
            title: '新闻列表',
            path: 'pages.news.items',
            categoriesPath: 'pages.news.categories',
            defaultCategoryPath: 'pages.news.defaultCategory',
            kind: 'news',
            blank: {
              id: '',
              cat: '资讯公告',
              title: '新标题',
              image: '/images/news/n1.jpg',
              date: '2024.01.01',
              content: '',
            },
            fields: [
              { key: 'title', label: '标题' },
              {
                key: 'cat',
                label: '分类',
                type: 'select',
                options: () => getPath(config, 'pages.news.categories') || [],
              },
              { key: 'date', label: '日期', placeholder: '2025.01.01' },
              { key: 'id', label: '详情 ID（可空）', placeholder: '留空则按标题生成' },
              { key: 'image', label: '封面图', type: 'image', full: true },
              { key: 'content', label: '详情正文', type: 'richtext', full: true },
            ],
          }),
      },
    ]
  }

  if (sectionId === 'case') {
    return [
      seoItem,
      {
        id: 'title',
        category: '首屏',
        label: '页面标题',
        hint: '标题与默认分类',
        build: () =>
          block('', [
            field('英文标题', 'pages.case.titleEn'),
            field('中文标题', 'pages.case.titleZh'),
            sectionNote('默认选中「分类」列表中的第一项；调整分类顺序即可改变默认 Tab。'),
          ]),
      },
      {
        id: 'categories',
        category: '内容',
        label: '分类',
        hint: '案例筛选分类',
        build: () => renderStringArray('分类', 'pages.case.categories', { bulk: true, blank: '新分类' }),
      },
      {
        id: 'items',
        category: '内容',
        label: '案例列表',
        hint: '列表浏览 · 点击编辑打开独立弹窗 · 可维护分类',
        wide: true,
        build: () =>
          contentListEditor({
            title: '案例列表',
            path: 'pages.case.items',
            categoriesPath: 'pages.case.categories',
            defaultCategoryPath: 'pages.case.defaultCategory',
            kind: 'case',
            blank: {
              id: '',
              cat: '品牌形象策划',
              title: '新案例',
              tags: '标签 / 标签',
              image: '/images/cases/c1.jpg',
              banner: '',
              summary: '',
              gallery: [],
              siteUrl: '',
            },
            fields: [
              { key: 'title', label: '标题' },
              {
                key: 'cat',
                label: '分类',
                type: 'select',
                options: () => getPath(config, 'pages.case.categories') || [],
              },
              { key: 'tags', label: '标签文案', placeholder: '文旅 / 品牌叙事 / 形象片' },
              { key: 'id', label: '详情 ID（可空）', placeholder: '留空则按标题生成' },
              { key: 'siteUrl', label: '浏览网站外链（可空）', placeholder: 'https://' },
              { key: 'image', label: '列表封面图', type: 'image', full: true },
              { key: 'banner', label: '详情 Banner（可空，默认封面）', type: 'image', full: true },
              { key: 'summary', label: '详情简介', type: 'richtext', full: true },
              { key: 'gallery', label: '详情图集', type: 'images', full: true },
            ],
          }),
      },
    ]
  }

  if (sectionId === 'contact') {
    return [
      seoItem,
      {
        id: 'media',
        category: '媒体',
        label: '联系首屏',
        hint: '办公信息、视频与角标',
        toggleKey: 'hero',
        wide: true,
        build: () => {
          const frag = document.createDocumentFragment()
          frag.append(
            pageBlockToggleNote('contact', 'hero'),
            tabsPanel([
              {
                id: 'offices',
                label: '办公信息',
                build: () =>
                  listEditor({
                    title: '办公信息',
                    path: 'pages.contact.offices',
                    blank: { city: '', tel: '', addr: '', email: '', hours: '' },
                    fields: [
                      { key: 'city', label: '标题 / 城市' },
                      { key: 'tel', label: '电话' },
                      { key: 'addr', label: '地址 / 说明', type: 'textarea', rows: 2, full: true },
                      { key: 'email', label: '邮箱' },
                      { key: 'hours', label: '营业时间' },
                    ],
                  }),
              },
              {
                id: 'media',
                label: '视频',
                build: () =>
                  block('', [
                    field('联系页视频', 'pages.contact.video', 'video'),
                    field('页面角标', 'pages.contact.videoLabel'),
                  ]),
              },
            ])
          )
          return frag
        },
      },
      {
        id: 'form',
        category: '表单',
        label: '留言表单',
        hint: '表单标题与字段标签',
        toggleKey: 'feedback',
        build: () =>
          block('', [
            pageBlockToggleNote('contact', 'feedback'),
            field('表单眉题', 'pages.contact.formEyebrow'),
            field('表单标题', 'pages.contact.formTitle'),
            field('表单说明', 'pages.contact.formDesc', 'textarea', { rows: 3 }),
            field('提交按钮', 'pages.contact.submitText'),
            field('成功提示', 'pages.contact.successText'),
            field('姓名标签', 'pages.contact.labels.name'),
            field('电话标签', 'pages.contact.labels.tel'),
            field('公司标签', 'pages.contact.labels.company'),
            field('需求标签', 'pages.contact.labels.content'),
          ]),
      },
    ].filter(Boolean).concat([blockOrderItem('contact')].filter(Boolean))
  }

  if (sectionId === 'media') {
    return [
      {
        id: 'library',
        category: '素材',
        label: '素材库管理',
        hint: '上传、预览、清理未引用；保存配置时写入引用索引',
        wide: true,
        build: () =>
          createMediaLibraryManager({
            onStatus: (msg, ok) => setStatus(msg, ok !== false),
            getConfig: () => config,
            onConfigChange: () => {
              markDirty()
              schedulePreview()
            },
          }),
      },
    ]
  }

  if (sectionId === 'leads') {
    return [
      {
        id: 'inbox',
        category: '留言',
        label: '咨询留言',
        hint: '联系页表单提交的数据会保存在这里',
        wide: true,
        build: () => leadsInboxEditor(),
      },
    ]
  }

  return [seoItem]
}

function formatLeadTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function leadsInboxEditor() {
  const wrap = document.createElement('div')
  wrap.className = 'edit-block leads-inbox'

  const toolbar = document.createElement('div')
  toolbar.className = 'list-toolbar'
  const title = document.createElement('h3')
  title.textContent = '咨询留言'
  title.style.margin = '0'
  const count = document.createElement('span')
  count.className = 'content-list-count'
  count.textContent = '…'
  const titleWrap = document.createElement('div')
  titleWrap.className = 'content-list-title'
  titleWrap.append(title, count)

  const refreshBtn = document.createElement('button')
  refreshBtn.type = 'button'
  refreshBtn.className = 'btn btn-sm'
  refreshBtn.textContent = '刷新'
  toolbar.append(titleWrap, refreshBtn)
  wrap.appendChild(toolbar)

  const note = document.createElement('p')
  note.className = 'section-note'
  note.textContent = '数据保存在 MySQL（contact_leads）。开发时请先 npm run api / npm run dev。'
  wrap.appendChild(note)

  const box = document.createElement('div')
  box.className = 'leads-box'
  wrap.appendChild(box)

  const render = async () => {
    box.innerHTML = '<div class="content-list-empty">加载中…</div>'
    try {
      const res = await apiFetch('/api/leads', { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || '加载失败')
      const items = Array.isArray(data.items) ? data.items : []
      count.textContent = String(items.length)

      if (!items.length) {
        box.innerHTML = '<div class="content-list-empty">暂无留言。用户在联系页提交后会出现在这里。</div>'
        return
      }

      const table = document.createElement('table')
      table.className = 'content-table leads-table'
      table.innerHTML = `
        <thead>
          <tr>
            <th class="col-time">时间</th>
            <th class="col-name">姓名</th>
            <th class="col-tel">电话</th>
            <th class="col-company">公司</th>
            <th class="col-content">需求</th>
            <th class="col-actions">操作</th>
          </tr>
        </thead>`
      const tbody = document.createElement('tbody')
      items.forEach((item) => {
        const tr = document.createElement('tr')
        tr.className = 'content-table-row'
        tr.innerHTML = `
          <td class="col-time">${formatLeadTime(item.createdAt)}</td>
          <td class="col-name"></td>
          <td class="col-tel"></td>
          <td class="col-company"></td>
          <td class="col-content"></td>
          <td class="col-actions"></td>`
        tr.querySelector('.col-name').textContent = item.name || '—'
        tr.querySelector('.col-tel').textContent = item.tel || '—'
        tr.querySelector('.col-company').textContent = item.company || '—'
        const contentCell = tr.querySelector('.col-content')
        contentCell.textContent = item.content || '—'
        contentCell.title = item.content || ''

        const actions = document.createElement('div')
        actions.className = 'content-table-actions'
        const viewBtn = document.createElement('button')
        viewBtn.type = 'button'
        viewBtn.className = 'content-icon-btn'
        viewBtn.textContent = '详情'
        viewBtn.addEventListener('click', async () => {
          await openConfirmModal({
            title: `${item.name || '留言'} · ${item.tel || ''}`,
            message: `公司：${item.company || '—'}\n时间：${formatLeadTime(item.createdAt)}\n\n${item.content || ''}`,
            confirmText: '关闭',
            danger: false,
          })
        })
        const delBtn = document.createElement('button')
        delBtn.type = 'button'
        delBtn.className = 'content-icon-btn is-danger'
        delBtn.textContent = '删'
        delBtn.addEventListener('click', async () => {
          const ok = await openConfirmModal({
            title: '删除留言',
            message: `确定删除「${item.name || item.id}」的留言？`,
            danger: true,
            confirmText: '删除',
          })
          if (!ok) {
            notify('已取消删除', 'info')
            return
          }
          const delRes = await apiFetch(`/api/leads?id=${encodeURIComponent(item.id)}`, { method: 'DELETE' })
          const delData = await delRes.json().catch(() => ({}))
          if (!delRes.ok) {
            notify(delData.error || '删除失败', 'err')
            return
          }
          notify('已删除留言', 'ok')
          render()
        })
        actions.append(viewBtn, delBtn)
        tr.querySelector('.col-actions').appendChild(actions)
        tbody.appendChild(tr)
      })
      table.appendChild(tbody)
      box.innerHTML = ''
      box.appendChild(table)
    } catch (err) {
      count.textContent = '0'
      box.innerHTML = `<div class="content-list-empty">${err.message || '加载失败（请确认开发服务已启动）'}</div>`
      setStatus(err.message || '留言加载失败', false)
    }
  }

  refreshBtn.addEventListener('click', () => render())
  render()
  return wrap
}

function closeEditorModal() {
  const overlay = editorModalStack.pop()
  if (overlay) {
    if (overlay._onKey) document.removeEventListener('keydown', overlay._onKey)
    if (overlay._contentEditContext) {
      contentEditContext = overlay._contentEditContext.prev
    }
    const onClose = overlay._onClose
    overlay.remove()
    try {
      onClose?.()
    } catch (_) {
      /* ignore */
    }
  }
  editorModal = editorModalStack[editorModalStack.length - 1] || null
  if (!editorModalStack.length) {
    activeConfigId = null
    contentEditContext = null
    highlightConfigChip()
  }
}

function openEditorModal(item, { stack = false, onClose } = {}) {
  if (!stack) {
    while (editorModalStack.length) closeEditorModal()
  }
  activeConfigId = item.id
  highlightConfigChip()

  const overlay = document.createElement('div')
  overlay.className = `modal-overlay config-editor-overlay${stack ? ' config-editor-overlay-nested' : ''}`
  if (typeof onClose === 'function') overlay._onClose = onClose
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay && editorModalStack[editorModalStack.length - 1] === overlay) {
      closeEditorModal()
    }
  })

  const panel = document.createElement('div')
  panel.className = `modal-panel config-editor-panel${item.wide ? ' config-editor-panel-wide' : ''}`
  panel.setAttribute('role', 'dialog')
  panel.setAttribute('aria-modal', 'true')

  const head = document.createElement('div')
  head.className = 'modal-head'
  head.innerHTML = `
    <div>
      <strong>${item.label}</strong>
      <span>${item.hint || item.category || '编辑后预览自动更新'}</span>
    </div>`
  const closeBtn = document.createElement('button')
  closeBtn.type = 'button'
  closeBtn.className = 'modal-close'
  closeBtn.setAttribute('aria-label', '关闭')
  closeBtn.textContent = '×'
  closeBtn.addEventListener('click', () => {
    if (editorModalStack[editorModalStack.length - 1] === overlay) closeEditorModal()
  })
  head.appendChild(closeBtn)

  const body = document.createElement('div')
  body.className = 'modal-body config-editor-body'
  // 先切换编辑上下文，再 build，使字段读写走默认值或菜单覆盖
  const prevCtx = contentEditContext
  if (Object.prototype.hasOwnProperty.call(item, 'editContext')) {
    contentEditContext = item.editContext
  }
  overlay._contentEditContext = { prev: prevCtx, current: contentEditContext }
  const surfaceCtx = resolveEditorSurfaceContext(item)
  if (surfaceCtx?.unitId) {
    body.appendChild(createComponentSurfaceField(surfaceCtx.unitId, surfaceCtx.slot))
  }
  body.appendChild(item.build())

  const foot = document.createElement('div')
  foot.className = 'modal-foot'
  const saveBtn = document.createElement('button')
  saveBtn.type = 'button'
  saveBtn.className = 'btn btn-primary'
  saveBtn.textContent = '保存'
  saveBtn.title = '将当前配置写入数据库'
  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true
    const prev = saveBtn.textContent
    saveBtn.textContent = '保存中…'
    try {
      await saveConfigToDb()
    } finally {
      saveBtn.disabled = false
      saveBtn.textContent = prev
    }
  })
  const done = document.createElement('button')
  done.type = 'button'
  done.className = 'btn'
  done.textContent = stack ? '返回' : '完成'
  done.addEventListener('click', () => {
    if (editorModalStack[editorModalStack.length - 1] === overlay) closeEditorModal()
    notify(stack ? '已返回上一层' : dirty ? '编辑完成（尚有未保存修改）' : '编辑完成', dirty ? 'info' : 'ok')
  })
  foot.append(saveBtn, done)

  panel.append(head, body, foot)
  overlay.appendChild(panel)
  document.body.appendChild(overlay)
  editorModalStack.push(overlay)
  editorModal = overlay

  const onKey = (e) => {
    if (e.key !== 'Escape') return
    if (document.querySelector('.media-picker-overlay')) return
    if (document.querySelector('.component-preview-overlay')) return
    if (editorModalStack[editorModalStack.length - 1] !== overlay) return
    closeEditorModal()
  }
  overlay._onKey = onKey
  document.addEventListener('keydown', onKey)
}

function highlightConfigChip() {
  configBar.querySelectorAll('.config-chip').forEach((el) => {
    el.classList.toggle('is-active', el.dataset.id === activeConfigId)
  })
}

function isWorkspaceSection(sectionId = currentSection) {
  return sectionId === 'pages' || sectionId === 'media' || sectionId === 'leads'
}

function syncMainPane({ force = false } = {}) {
  const preview = document.getElementById('adminPreview')
  if (!adminWorkspace || !preview) return

  if (isWorkspaceSection()) {
    document.body.classList.add('is-workspace-mode')
    preview.hidden = true
    adminWorkspace.hidden = false

    const items = getConfigItems(currentSection)
    const item = items.find((i) => i.id === workspaceItemId) || items[0]
    if (!item) {
      adminWorkspace.replaceChildren()
      adminWorkspace.removeAttribute('data-item-id')
      return
    }
    workspaceItemId = item.id
    activeConfigId = item.id

    const paneKey = `${currentSection}:${item.id}`
    const already =
      !force &&
      adminWorkspace.dataset.paneKey === paneKey &&
      adminWorkspace.querySelector('.admin-workspace-body')
    if (already) {
      highlightConfigChip()
      return
    }

    adminWorkspace.dataset.paneKey = paneKey
    adminWorkspace.dataset.itemId = item.id
    adminWorkspace.replaceChildren()
    const head = document.createElement('div')
    head.className = 'admin-workspace-head'
    head.innerHTML = `<strong>${item.label}</strong><span>${item.hint || ''}</span>`
    const body = document.createElement('div')
    body.className = 'admin-workspace-body'
    if (currentSection === 'media' || currentSection === 'leads') {
      body.classList.add('is-system-pane')
    }
    body.appendChild(item.build())
    adminWorkspace.append(head, body)
    highlightConfigChip()
    return
  }

  document.body.classList.remove('is-workspace-mode')
  preview.hidden = false
  adminWorkspace.hidden = true
  adminWorkspace.replaceChildren()
  adminWorkspace.removeAttribute('data-item-id')
  adminWorkspace.removeAttribute('data-pane-key')
}

function openConfigItem(item) {
  if (isWorkspaceSection()) {
    workspaceItemId = item.id
    syncMainPane({ force: true })
    return
  }
  openEditorModal(item)
}

function renderConfigBar() {
  const navItem = findSidebarItem(currentSection)
  sectionTitle.textContent = navItem?.label || currentSection
  configBar.innerHTML = ''

  const pageKey = resolvePageConfigKey(currentSection)
  if (config && PAGE_BLOCKS[pageKey]) {
    ensurePageBlocks(config, pageKey)
  }

  const items = getSectionConfigBarItems(currentSection)
  const categories = []
  items.forEach((item) => {
    if (!categories.includes(item.category)) categories.push(item.category)
  })

  if (!categories.includes(configBarCategory)) {
    configBarCategory = categories[0] || null
  }

  if (configCatTabs) {
    configCatTabs.innerHTML = ''
    configCatTabs.setAttribute('role', 'tablist')
    configCatTabs.setAttribute('aria-label', '配置分组')
    // 菜单组装驱动的页面：单组展示，隐藏分类 Tab
    const assemblyDriven = Boolean(resolveMenuSlotForSection(currentSection))
    if (!assemblyDriven && categories.length > 1) {
      configCatTabs.hidden = false
      categories.forEach((cat) => {
        const btn = document.createElement('button')
        btn.type = 'button'
        btn.className = `config-cat-tab${cat === configBarCategory ? ' is-active' : ''}`
        btn.setAttribute('role', 'tab')
        btn.setAttribute('aria-selected', String(cat === configBarCategory))
        btn.textContent = cat
        btn.addEventListener('click', () => {
          configBarCategory = cat
          renderConfigBar()
        })
        configCatTabs.appendChild(btn)
      })
    } else {
      configCatTabs.hidden = true
      if (assemblyDriven) configBarCategory = categories[0] || null
    }
  }

  const row = document.createElement('div')
  row.className = 'config-group-items config-group-items-flat'

  const visibleItems = resolveMenuSlotForSection(currentSection)
    ? items
    : items.filter((i) => !configBarCategory || i.category === configBarCategory)

  if (resolveMenuSlotForSection(currentSection) && !visibleItems.length) {
    const empty = document.createElement('p')
    empty.className = 'section-note'
    empty.style.margin = '0'
    empty.textContent = '该菜单尚未组装组件。请到「页面组件 → 菜单维护」添加。'
    row.appendChild(empty)
  } else if (resolveMenuSlotForSection(currentSection) && visibleItems.length) {
    const tip = document.createElement('p')
    tip.className = 'config-bar-hint'
    tip.textContent = 'SEO 固定首位 · 拖拽组件调整页面顺序 · 右侧开关控制前台显隐'
    row.appendChild(tip)
  }

  let orderIndex = 0
  visibleItems.forEach((item) => {
      const assemblyUnitId = String(item.id || '').startsWith('asm:') ? String(item.id).slice(4) : ''
      const assemblyDriven = Boolean(resolveMenuSlotForSection(currentSection))
      const slot = assemblyDriven ? resolveMenuSlotForSection(currentSection) : null
      const isSeo = item.id === 'seo' || item.pinned
      const canDrag = assemblyDriven && !!assemblyUnitId && !isSeo
      const canToggleAssembly = assemblyDriven && !!assemblyUnitId && !isSeo
      const canToggleBlock = !!(item.toggleKey && PAGE_BLOCKS[pageKey] && !assemblyUnitId)
      const seq = isSeo ? 0 : ++orderIndex
      const chipLabel = seq ? `${seq}. ${item.label}` : item.label

      const wireChipDrag = (el) => {
        if (!canDrag) return
        el.draggable = true
        el.title = `${item.hint || item.label}（拖拽排序，影响页面显示顺序）`
        el.addEventListener('dragstart', (e) => {
          e.dataTransfer.effectAllowed = 'move'
          e.dataTransfer.setData('text/plain', assemblyUnitId)
          el.classList.add('is-dragging')
        })
        el.addEventListener('dragend', () => {
          el.classList.remove('is-dragging')
          row.querySelectorAll('.is-drag-over').forEach((n) => n.classList.remove('is-drag-over'))
        })
        el.addEventListener('dragover', (e) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          el.classList.add('is-drag-over')
        })
        el.addEventListener('dragleave', () => el.classList.remove('is-drag-over'))
        el.addEventListener('drop', (e) => {
          e.preventDefault()
          el.classList.remove('is-drag-over')
          const fromId = e.dataTransfer.getData('text/plain')
          reorderAssemblyComponent(currentSection, fromId, assemblyUnitId)
        })
      }

      const appendChipWithEye = (visible, onToggle) => {
        const wrap = document.createElement('div')
        wrap.className = `config-chip-wrap${visible ? '' : ' is-hidden-block'}`
        if (seq) wrap.dataset.order = String(seq)

        const chip = document.createElement('button')
        chip.type = 'button'
        chip.className = 'config-chip'
        chip.dataset.id = item.id
        chip.textContent = chipLabel
        chip.title = item.hint || item.label
        chip.addEventListener('click', () => openConfigItem(item))
        wireChipDrag(chip)

        const eye = document.createElement('button')
        eye.type = 'button'
        eye.className = `config-chip-eye${visible ? '' : ' is-off'}`
        eye.title = visible ? '前台显示中，点击隐藏' : '前台已隐藏，点击显示'
        eye.setAttribute('aria-label', eye.title)
        eye.textContent = visible ? '显' : '隐'
        eye.addEventListener('click', (e) => {
          e.stopPropagation()
          onToggle(!visible)
        })

        wrap.append(chip, eye)
        row.appendChild(wrap)
      }

      if (isSeo) {
        const chip = document.createElement('button')
        chip.type = 'button'
        chip.className = 'config-chip is-pinned'
        chip.dataset.id = item.id
        chip.textContent = item.label
        chip.title = item.hint || 'SEO 固定在首位'
        chip.addEventListener('click', () => openConfigItem(item))
        row.appendChild(chip)
        return
      }

      if (canToggleAssembly && slot) {
        const on = isSlotComponentVisible(slot, assemblyUnitId)
        appendChipWithEye(on, (next) => setAssemblyComponentVisible(currentSection, assemblyUnitId, next))
        return
      }

      if (canToggleBlock) {
        const on = isPageBlockOn(pageKey, item.toggleKey)
        appendChipWithEye(on, (next) => setPageBlockVisible(pageKey, item.toggleKey, next))
        return
      }

      const chip = document.createElement('button')
      chip.type = 'button'
      chip.className = 'config-chip'
      chip.dataset.id = item.id
      chip.textContent = chipLabel
      chip.title = item.hint || item.label
      if (item.id === 'block-order' && PAGE_BLOCKS[pageKey]) {
        chip.addEventListener('click', () => openBlockOrderModal(pageKey))
      } else {
        chip.addEventListener('click', () => openConfigItem(item))
        wireChipDrag(chip)
      }
      row.appendChild(chip)
    })

  configBar.appendChild(row)

  if (isWorkspaceSection()) {
    if (!workspaceItemId || !items.some((i) => i.id === workspaceItemId)) {
      workspaceItemId = items[0]?.id || 'catalog'
    }
    activeConfigId = workspaceItemId
  }

  highlightConfigChip()
  syncMainPane()
}

function markDirty() {
  dirty = true
  setStatus('未保存（预览已更新）', true, { toast: false })
}

function currentPreviewFile() {
  const item = findSidebarItem(currentSection)
  if (item?.preview) return item.preview
  const page = PAGES.find((p) => p.id === currentSection) || PAGES[1]
  return page.preview
}

/** 解析菜单 href / 壳文件为预览地址（保留 ?m= 等参数） */
function buildPreviewNavigation(previewSpec) {
  const raw = String(previewSpec || 'index.html').trim() || 'index.html'
  let path = 'index.html'
  let searchParams = new URLSearchParams()
  let hash = ''
  try {
    const u = new URL(raw.includes('://') ? raw : raw.startsWith('/') ? raw : `/${raw}`, 'http://local.preview/')
    let pathname = u.pathname || '/'
    if (pathname === '/' || pathname === '') path = 'index.html'
    else {
      path = pathname.replace(/^\//, '')
      if (!/\.html?$/i.test(path)) path = `${path}.html`
    }
    searchParams = new URLSearchParams(u.search)
    hash = u.hash || ''
  } catch {
    path = raw.split('?')[0].split('#')[0].replace(/^\//, '') || 'index.html'
    if (!/\.html?$/i.test(path)) path = `${path}.html`
  }
  searchParams.set('preview', '1')
  searchParams.set('t', String(Date.now()))
  const qs = searchParams.toString()
  const src = `/${path}?${qs}${hash}`
  const open = `/${path}?${new URLSearchParams(
    [...searchParams].filter(([k]) => k !== 't')
  ).toString()}${hash}`
  const labelBits = [path]
  const mid = searchParams.get('m') || searchParams.get('menu')
  if (mid) labelBits.push(`m=${mid}`)
  return { src, open, label: labelBits.join(' · ') }
}

function loadPreview(forceFile) {
  if (isWorkspaceSection()) {
    syncMainPane()
    return
  }
  const pageFile = forceFile || currentPreviewFile()
  const nav = buildPreviewNavigation(pageFile)
  previewFrame.onload = () => {
    pushConfigToPreview({ resetScroll: true })
  }
  previewFrame.src = nav.src
  openPreview.href = nav.open
  if (previewPageLabel) previewPageLabel.textContent = nav.label
}

function pushConfigToPreview({ resetScroll = false } = {}) {
  const win = previewFrame.contentWindow
  if (!win) return
  try {
    win.postMessage(
      { type: 'guanzi-config-reload', config, openMenu: false, resetScroll: !!resetScroll },
      '*'
    )
  } catch {
    /* ignore */
  }
}

function schedulePreview() {
  clearTimeout(previewTimer)
  previewTimer = setTimeout(() => {
    pushConfigToPreview()
  }, 350)
}

function renderNav() {
  pageNav.innerHTML = ''
  const items = getSidebarItems()
  if (!items.some((i) => i.id === currentSection)) {
    currentSection = 'pages'
  }

  const systemItems = items.filter((p) => p.kind === 'system')
  const menuItems = items.filter((p) => p.kind === 'menu')

  const makeGroup = (title, hint = '') => {
    const group = document.createElement('div')
    group.className = 'nav-group'
    const head = document.createElement('div')
    head.className = 'nav-group-head'
    const label = document.createElement('span')
    label.className = 'nav-group-title'
    label.textContent = title
    head.appendChild(label)
    if (hint) {
      const tip = document.createElement('span')
      tip.className = 'nav-group-hint'
      tip.textContent = hint
      head.appendChild(tip)
    }
    const list = document.createElement('div')
    list.className = 'nav-group-list'
    group.append(head, list)
    return { group, list }
  }

  const activateItem = (p) => {
    if (p.id === currentSection) {
      if (isWorkspaceSection(p.id)) {
        if (p.id === 'media') workspaceItemId = 'library'
        else if (p.id === 'leads') workspaceItemId = 'inbox'
        else if (p.id === 'pages' && !workspaceItemId) workspaceItemId = 'catalog'
        syncMainPane({ force: true })
      }
      return
    }
    closeEditorModal()
    currentSection = p.id
    configBarCategory = null
    if (p.id === 'pages') {
      if (workspaceItemId !== 'catalog' && workspaceItemId !== 'menu-assembly') workspaceItemId = 'catalog'
    }
    if (p.id === 'media') workspaceItemId = 'library'
    if (p.id === 'leads') workspaceItemId = 'inbox'
    renderNav()
    renderConfigBar()
    loadPreview(p.preview)
    notify(`已切换到「${p.label}」`, 'info')
  }

  const makeNavBtn = (p, { draggable = false, index = 0 } = {}) => {
    const btn = document.createElement('button')
    btn.type = 'button'
    const isHome = Boolean(p.isHome || isHomeMenu(p.id))
    const off = p.kind === 'menu' && p.visible === false && !isHome
    btn.className = `nav-item${p.id === currentSection ? ' is-active' : ''}${off ? ' is-off' : ''}${
      draggable ? ' is-sortable' : ''
    }${isHome ? ' is-home' : ''}`
    btn.dataset.navId = p.id
    btn.dataset.navKind = p.kind || ''

    if (draggable) {
      const grip = document.createElement('span')
      grip.className = 'nav-item-grip'
      grip.textContent = isHome ? '★' : '⠿'
      grip.title = isHome ? '站点首页（固定首位）' : '拖动排序'
      grip.setAttribute('aria-hidden', 'true')

      const idx = document.createElement('span')
      idx.className = 'nav-item-index'
      idx.textContent = `${index}.`

      const text = document.createElement('span')
      text.className = 'nav-item-label'
      text.textContent = p.label
      if (isHome) {
        const badge = document.createElement('em')
        badge.className = 'nav-item-home-badge'
        badge.textContent = '首页'
        text.appendChild(badge)
      }

      const vis = document.createElement('label')
      vis.className = `vis-switch is-compact nav-item-vis${off ? ' is-off' : ''}${
        isHome ? ' is-locked' : ''
      }`
      vis.title = isHome
        ? '站点首页始终显示，不可隐藏'
        : off
          ? '前台已隐藏，点击显示'
          : '前台显示中，点击隐藏'
      const input = document.createElement('input')
      input.type = 'checkbox'
      input.checked = !off
      input.disabled = isHome
      input.setAttribute('aria-label', `显示「${p.label}」`)
      const track = document.createElement('span')
      track.className = 'vis-switch-track'
      track.setAttribute('aria-hidden', 'true')
      const visText = document.createElement('span')
      visText.className = 'vis-switch-text'
      visText.textContent = isHome ? '固' : off ? '隐' : '显'
      const applyVis = () => {
        if (isHome) return
        patchSiteMenu(p.id, { visible: input.checked })
        notify(
          input.checked ? `已显示菜单「${p.label}」，请保存` : `已隐藏菜单「${p.label}」，请保存`,
          'info'
        )
      }
      input.addEventListener('click', (e) => e.stopPropagation())
      input.addEventListener('change', applyVis)
      track.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        if (isHome) {
          notify('站点首页始终显示，不可隐藏', 'info')
          return
        }
        input.checked = !input.checked
        applyVis()
      })
      vis.append(input, track, visText)
      vis.addEventListener('click', (e) => e.stopPropagation())
      vis.addEventListener('mousedown', (e) => e.stopPropagation())
      vis.addEventListener('dragstart', (e) => e.preventDefault())

      btn.append(grip, idx, text, vis)
      if (isHome) {
        btn.title = '站点首页 · 固定首位 · 始终显示'
        btn.draggable = false
      } else {
        btn.title = off ? '前台已隐藏 · 可拖动调整顺序' : '拖动可调整官网菜单顺序'
        btn.draggable = true
      }
    } else {
      btn.textContent = p.label
      if (off) btn.title = '前台已隐藏（菜单维护中关闭）'
    }

    btn.addEventListener('click', () => activateItem(p))
    return btn
  }

  const sys = makeGroup('系统', '工作台工具')
  systemItems.forEach((p) => sys.list.appendChild(makeNavBtn(p)))
  pageNav.appendChild(sys.group)

  const site = makeGroup('官网菜单', '序号 · 显隐 · 拖动')
  site.group.classList.add('is-site-menus')
  const menuList = site.list
  menuList.classList.add('nav-menu-list')

  let dragId = null
  menuItems.forEach((p, i) => {
    const btn = makeNavBtn(p, { draggable: true, index: i + 1 })
    if (p.isHome || isHomeMenu(p.id)) {
      menuList.appendChild(btn)
      return
    }
    btn.addEventListener('dragstart', (e) => {
      dragId = p.id
      btn.classList.add('is-dragging')
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', p.id)
      try {
        e.dataTransfer.setData('application/x-nav-menu', p.id)
      } catch {
        /* ignore */
      }
    })
    btn.addEventListener('dragend', () => {
      dragId = null
      menuList.querySelectorAll('.nav-item').forEach((el) => {
        el.classList.remove('is-dragging', 'is-drag-over')
      })
    })
    btn.addEventListener('dragover', (e) => {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      if (dragId && dragId !== p.id) btn.classList.add('is-drag-over')
    })
    btn.addEventListener('dragleave', () => {
      btn.classList.remove('is-drag-over')
    })
    btn.addEventListener('drop', (e) => {
      e.preventDefault()
      btn.classList.remove('is-drag-over')
      const fromId = e.dataTransfer.getData('application/x-nav-menu') || e.dataTransfer.getData('text/plain') || dragId
      const toId = p.id
      if (!fromId || !toId || fromId === toId || !config) return
      if (isHomeMenu(fromId) || isHomeMenu(toId)) {
        notify('站点首页固定在第一位，不能与其它菜单对调', 'info')
        return
      }
      const ids = listMenus(config).map((m) => m.id)
      const from = ids.indexOf(fromId)
      const to = ids.indexOf(toId)
      if (from < 0 || to < 0) return
      ids.splice(from, 1)
      ids.splice(to, 0, fromId)
      reorderMenus(config, ids)
      syncMenuAssembly(config)
      markDirty()
      schedulePreview()
      renderNav()
      renderConfigBar()
      notify('已调整官网菜单顺序，请保存', 'info')
    })
    menuList.appendChild(btn)
  })

  if (!menuItems.length) {
    const empty = document.createElement('p')
    empty.className = 'nav-group-empty'
    empty.textContent = '暂无菜单，请在「页面组件 → 菜单维护」中添加'
    menuList.appendChild(empty)
  }

  pageNav.appendChild(site.group)
}

async function boot() {
  clearLocalConfig()
  try {
    config = await loadSiteConfig()
    setRegistryConfig(config)
    ensureCustomComponents(config)
    Object.keys(PAGE_BLOCKS).forEach((pk) => ensurePageBlocks(config, pk))
    ensureHomeKol(config)
    ensureHomeStreamer(config)
    ensureHomeVenue(config)
    ensureHomeLocal(config)
    const clientsSeeded = seedHomeClientsDemo(config, { force: false })
    const whatIconsSeeded = ensureHomeWhatItems(config)
    ensureAboutIntro(config)
    ensureAboutTeam(config)
    ensureAboutProfile(config)
    ensureMcnHomeLists(config)
    ensureMenuAssembly(config)
    ensurePageCatalog(config)
    syncMenuAssembly(config)
    renderNav()
    renderConfigBar()
    loadPreview()
    if (clientsSeeded || whatIconsSeeded) {
      dirty = true
      const bits = []
      if (clientsSeeded) bits.push('合作客户 Logo 已自动装填')
      if (whatIconsSeeded) bits.push('服务能力图标已补默认值')
      setStatus(`已加载数据库配置（v${configMeta.version ?? '?'}）；${bits.join('；')}，请保存`)
    } else {
      setStatus(`已加载数据库配置（v${configMeta.version ?? '?'}）`)
    }
  } catch (err) {
    config = { global: {}, pages: {} }
    setRegistryConfig(config)
    ensureCustomComponents(config)
    ensureMenuAssembly(config)
    ensurePageCatalog(config)
    syncMenuAssembly(config)
    renderNav()
    renderConfigBar()
    setStatus(err.message || '无法连接数据库 API', false)
  }
}

async function saveConfigToDb() {
  if (!configMeta.fromApi) {
    notify('数据库未连接，无法保存。请先 npm run dev', 'err')
    return false
  }
  try {
    setStatus('正在写入数据库…', true, { toast: false })
    Object.keys(PAGE_BLOCKS).forEach((pk) => ensurePageBlocks(config, pk))
    // 先把组装槽位的顶栏名写回 global.nav，再 normalize，避免保存时被旧 nav 覆盖
    ensureMenus(config)
    ensureMenuAssembly(config)
    syncMenuAssembly(config)
    syncMediaUsageIndex(config)
    await saveRemoteConfig(config)
    dirty = false
    pushConfigToPreview()
    notify(`已保存到 MySQL（v${configMeta.version ?? '?'}）`, 'ok')
    return true
  } catch (err) {
    dirty = true
    notify(err.message || '保存到数据库失败', 'err')
    return false
  }
}

document.getElementById('btnSave').addEventListener('click', async () => {
  await saveConfigToDb()
})

document.getElementById('btnReset').addEventListener('click', async () => {
  const ok = await openConfirmModal({
    title: '重新加载',
    message: '确定放弃未保存修改，从数据库重新加载？',
    danger: true,
    confirmText: '重新加载',
  })
  if (!ok) {
    notify('已取消重新加载', 'info')
    return
  }
  try {
    config = await loadSiteConfig()
    Object.keys(PAGE_BLOCKS).forEach((pk) => ensurePageBlocks(config, pk))
    ensureMcnHomeLists(config)
    dirty = false
    closeEditorModal()
    if (adminWorkspace) adminWorkspace.removeAttribute('data-item-id')
    renderConfigBar()
    loadPreview()
    notify(`已从数据库重新加载（v${configMeta.version ?? '?'}）`, 'ok')
  } catch (err) {
    notify(err.message || '重新加载失败', 'err')
  }
})

document.getElementById('btnRefreshPreview').addEventListener('click', () => {
  loadPreview()
  notify('预览已刷新', 'ok')
})

window.addEventListener('beforeunload', (e) => {
  if (dirty) {
    e.preventDefault()
    e.returnValue = ''
  }
})

boot().catch((err) => {
  console.error(err)
  setStatus('加载配置失败', false)
})
