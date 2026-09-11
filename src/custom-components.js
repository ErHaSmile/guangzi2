/**
 * 个性组件：可多实例（如图片组件）
 */
export const CUSTOM_GROUP = '个性组件'

export const CUSTOM_COMPONENT_TYPES = {
  gallery: {
    type: 'gallery',
    label: '图片组件',
    description: '多图上传与栅格布局（可多实例）',
    group: CUSTOM_GROUP,
    preview: 'index.html',
    templateSelector: '[data-gallery-template]',
  },
}

const GALLERY_ASPECTS = new Set(['auto', '1', '4/3', '3/4', '16/9', '3/2'])

function newId(type) {
  return `${type}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

export function normalizeGalleryData(raw = {}) {
  const data = { ...raw }
  if (data.title == null) data.title = ''
  if (!Array.isArray(data.images)) data.images = []
  let cols = Number(data.columns)
  if (!Number.isFinite(cols)) cols = 3
  data.columns = Math.min(6, Math.max(1, Math.round(cols)))
  let gap = Number(data.gap)
  if (!Number.isFinite(gap)) gap = 12
  data.gap = Math.min(48, Math.max(0, Math.round(gap)))
  let radius = Number(data.radius)
  if (!Number.isFinite(radius)) radius = 0
  data.radius = Math.min(40, Math.max(0, Math.round(radius)))
  const aspect = String(data.aspect || 'auto')
  data.aspect = GALLERY_ASPECTS.has(aspect) ? aspect : 'auto'
  return data
}

function defaultGalleryData() {
  return normalizeGalleryData({
    title: '',
    images: [],
    columns: 3,
    gap: 12,
    radius: 0,
    aspect: 'auto',
  })
}

export function unitFromCustomInstance(inst) {
  if (!inst?.id || !inst?.type) return null
  const typeDef = CUSTOM_COMPONENT_TYPES[inst.type]
  if (!typeDef) return null
  return {
    id: inst.id,
    label: typeDef.label,
    description: typeDef.description || `个性${typeDef.label}实例`,
    group: CUSTOM_GROUP,
    kind: 'content',
    section: 'custom',
    itemId: inst.id,
    preview: typeDef.preview,
    customType: inst.type,
    composeSelector: `[data-custom-unit="${inst.id}"]`,
  }
}

export function ensureCustomComponents(config) {
  if (!config || typeof config !== 'object') return config
  if (!config.global || typeof config.global !== 'object') config.global = {}
  if (!Array.isArray(config.global.customComponents)) config.global.customComponents = []

  config.global.customComponents = config.global.customComponents
    .filter((c) => c && c.id && CUSTOM_COMPONENT_TYPES[c.type])
    .map((c) => {
      if (c.type === 'gallery') {
        const norm = normalizeGalleryData(c)
        return { id: c.id, type: 'gallery', ...norm }
      }
      return c
    })

  migrateLegacyHomeGallery(config)
  return config
}

/** 把旧的单例 pages.home.gallery* 迁成一个个性图片组件 */
function migrateLegacyHomeGallery(config) {
  if (config.global._legacyGalleryMigrated) return

  const home = config.pages?.home
  const list = config.global.customComponents
  const hasLegacyField =
    home &&
    (String(home.galleryTitle || '').trim() ||
      (Array.isArray(home.galleryImages) && home.galleryImages.length) ||
      home.galleryColumns != null ||
      home.galleryGap != null)

  const assemblies = Array.isArray(config.global.menuAssembly) ? config.global.menuAssembly : []
  const usedLegacyId = assemblies.some(
    (s) => Array.isArray(s.components) && s.components.includes('home-gallery')
  )

  if (!hasLegacyField && !usedLegacyId) {
    config.global._legacyGalleryMigrated = true
    return
  }

  let target = list.find((c) => c.type === 'gallery')
  if (!target) {
    target = {
      id: newId('gallery'),
      type: 'gallery',
      ...defaultGalleryData(),
    }
    if (home) {
      Object.assign(
        target,
        normalizeGalleryData({
          title: home.galleryTitle || '',
          images: Array.isArray(home.galleryImages) ? home.galleryImages : [],
          columns: home.galleryColumns,
          gap: home.galleryGap,
          radius: home.galleryRadius,
          aspect: home.galleryAspect,
        })
      )
    }
    list.push(target)
  }

  assemblies.forEach((slot) => {
    if (!Array.isArray(slot.components)) return
    slot.components = slot.components.map((id) => (id === 'home-gallery' ? target.id : id))
  })

  if (config.global.pageCatalog?.labels?.['home-gallery'] && !config.global.pageCatalog.labels[target.id]) {
    config.global.pageCatalog.labels[target.id] = config.global.pageCatalog.labels['home-gallery']
  }

  if (home) {
    delete home.galleryTitle
    delete home.galleryImages
    delete home.galleryColumns
    delete home.galleryGap
    delete home.galleryRadius
    delete home.galleryAspect
    if (home.blocks && typeof home.blocks === 'object') delete home.blocks.gallery
    if (Array.isArray(home.blockOrder)) {
      home.blockOrder = home.blockOrder.filter((id) => id !== 'gallery')
    }
  }

  config.global._legacyGalleryMigrated = true
}

export function listCustomInstances(config) {
  ensureCustomComponents(config)
  return config.global.customComponents.slice()
}

export function getCustomComponent(config, id) {
  if (!config || !id) return null
  ensureCustomComponents(config)
  return config.global.customComponents.find((c) => c.id === id) || null
}

export function listCustomUnits(config) {
  return listCustomInstances(config)
    .map(unitFromCustomInstance)
    .filter(Boolean)
}

export function createCustomComponent(config, type, seed = {}) {
  ensureCustomComponents(config)
  const typeDef = CUSTOM_COMPONENT_TYPES[type]
  if (!typeDef) throw new Error(`未知个性组件类型：${type}`)
  const id = newId(type)
  let item
  if (type === 'gallery') {
    item = { id, type: 'gallery', ...defaultGalleryData(), ...normalizeGalleryData(seed) }
  } else {
    item = { id, type, ...seed }
  }
  config.global.customComponents.push(item)
  return item
}

export function removeCustomComponent(config, id) {
  ensureCustomComponents(config)
  const before = config.global.customComponents.length
  config.global.customComponents = config.global.customComponents.filter((c) => c.id !== id)
  if (config.global.pageCatalog?.labels) delete config.global.pageCatalog.labels[id]
  if (config.global.pageCatalog?.order?.[CUSTOM_GROUP]) {
    config.global.pageCatalog.order[CUSTOM_GROUP] = config.global.pageCatalog.order[CUSTOM_GROUP].filter(
      (x) => x !== id
    )
  }
  const assemblies = Array.isArray(config.global.menuAssembly) ? config.global.menuAssembly : []
  assemblies.forEach((slot) => {
    if (!Array.isArray(slot.components)) return
    slot.components = slot.components.filter((cid) => cid !== id)
    if (slot.componentSettings) delete slot.componentSettings[id]
  })
  return before !== config.global.customComponents.length
}

export function updateCustomComponent(config, id, patch) {
  const inst = getCustomComponent(config, id)
  if (!inst) return null
  if (inst.type === 'gallery') {
    Object.assign(inst, normalizeGalleryData({ ...inst, ...patch, id: inst.id, type: 'gallery' }))
  } else {
    Object.assign(inst, patch, { id: inst.id, type: inst.type })
  }
  return inst
}

function escapeAttr(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
}

/** 填充已有 gallery DOM */
export function fillGalleryElement(el, data, resolveAsset = (s) => s) {
  if (!el) return
  const d = normalizeGalleryData(data)
  const titleEl = el.querySelector('[data-gallery-title]')
  if (titleEl) {
    const title = String(d.title || '').trim()
    titleEl.hidden = !title
    if (title) titleEl.textContent = title
  }
  const grid = el.querySelector('[data-gallery-grid]')
  if (!grid) return
  grid.style.setProperty('--gallery-cols', String(d.columns))
  grid.style.setProperty('--gallery-gap', `${d.gap}px`)
  grid.style.setProperty('--gallery-radius', `${d.radius}px`)
  grid.dataset.aspect = d.aspect || 'auto'
  const images = (Array.isArray(d.images) ? d.images : []).filter(Boolean)
  if (!images.length) {
    grid.innerHTML = '<p class="home-gallery-empty">暂无图片，请在工作台上传</p>'
    return
  }
  grid.innerHTML = images
    .map((src, i) => {
      const url = escapeAttr(resolveAsset(src))
      return `<figure class="home-gallery-item"><img src="${url}" alt="图片 ${i + 1}" loading="${
        i < 6 ? 'eager' : 'lazy'
      }" decoding="async" /></figure>`
    })
    .join('')
}

/** 从模板克隆或手写创建 gallery 区块 */
export function createGalleryElement(inst, templateEl, resolveAsset) {
  const data = normalizeGalleryData(inst)
  const doc = templateEl?.ownerDocument || document
  let el
  if (templateEl) {
    el = templateEl.cloneNode(true)
  } else {
    el = doc.createElement('section')
    el.className = 'home-section home-gallery-section'
    el.innerHTML = `
      <div class="home-wrap home-gallery-wrap">
        <h2 class="home-gallery-title reveal" data-gallery-title></h2>
        <div class="home-gallery-grid reveal" data-gallery-grid></div>
      </div>`
  }
  el.removeAttribute('data-gallery-template')
  el.removeAttribute('data-home-block')
  el.removeAttribute('hidden')
  el.classList.remove('is-compose-parked', 'is-home-block-off', 'is-page-block-off')
  el.dataset.customUnit = inst.id
  el.dataset.customType = 'gallery'
  el.setAttribute('data-compose-unit', inst.id)
  el.querySelectorAll('[id]').forEach((node) => {
    node.id = `custom-${inst.id}-${node.id}`
  })
  fillGalleryElement(el, data, resolveAsset)
  return el
}

/** 渲染页面上所有已挂载的个性图片组件 */
export function renderMountedCustomGalleries(config, resolveAsset, slot = null) {
  ensureCustomComponents(config)
  document.querySelectorAll('[data-custom-unit][data-custom-type="gallery"]').forEach((el) => {
    const id = el.getAttribute('data-custom-unit')
    const inst = getCustomComponent(config, id)
    if (!inst) return
    let data = inst
    if (slot?.componentSettings?.[id]?.custom) {
      data = { ...inst, ...slot.componentSettings[id].custom, id: inst.id, type: inst.type }
    }
    fillGalleryElement(el, data, resolveAsset)
  })
}
