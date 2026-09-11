import { apiFetch } from './api.js'

let mediaCache = null

export async function fetchMediaLibrary(force = false) {
  if (mediaCache && !force) return mediaCache
  const res = await apiFetch('/api/media')
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = json.error || (res.status === 401 || res.status === 403 ? '无权限访问素材库，请检查管理员令牌' : '无法加载素材库')
    throw new Error(msg)
  }
  mediaCache = {
    brands: Array.isArray(json.brands) ? json.brands : [],
    icons: Array.isArray(json.icons) ? json.icons : [],
    home: Array.isArray(json.home) ? json.home : [],
    site: Array.isArray(json.site) ? json.site : [],
    uploads: Array.isArray(json.uploads) ? json.uploads : [],
    videos: Array.isArray(json.videos) ? json.videos : [],
    siteMedia: Array.isArray(json.siteMedia) ? json.siteMedia : [],
    library: Array.isArray(json.library) ? json.library : [],
  }
  return mediaCache
}

export function invalidateMediaCache() {
  mediaCache = null
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export async function uploadMediaFile(file, { category = 'image' } = {}) {
  const form = new FormData()
  form.append('file', file, file.name)
  form.append('category', category === 'logo' || category === 'video' || category === 'icon' ? category : 'image')
  const res = await apiFetch('/api/media/upload', { method: 'POST', body: form })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || '上传失败')
  invalidateMediaCache()
  return json.path
}

/** 将素材库路径发布到官网区，返回写入配置用的路径 */
export async function publishMediaToSite(filePath) {
  const p = String(filePath || '')
  if (!p) return p
  if (p.startsWith('/site-media/')) return p
  const res = await apiFetch('/api/media/publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: p }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || '发布到官网失败')
  return json.path || p
}

export async function deleteMediaBatch(paths) {
  const res = await apiFetch('/api/media/delete-batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paths }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || '批量删除失败')
  invalidateMediaCache()
  return json
}

/** @deprecated use uploadMediaFile */
export async function uploadImageFile(file) {
  // keep small images on JSON path for compatibility; prefer multipart
  if (file.size > 1.5 * 1024 * 1024 || !String(file.type).startsWith('image/')) {
    return uploadMediaFile(file)
  }
  try {
    const data = await fileToDataUrl(file)
    const res = await apiFetch('/api/media/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: file.name,
        mime: file.type || 'image/png',
        data,
      }),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || '上传失败')
    invalidateMediaCache()
    return json.path
  } catch {
    return uploadMediaFile(file)
  }
}

export async function deleteUploadedImage(filePath) {
  const p = String(filePath || '')
  if (!isDeletableMediaPath(p)) {
    // 官网发布区 / 旧路径：清除字段时不删磁盘，避免影响前台
    return
  }
  const res = await apiFetch(`/api/media?path=${encodeURIComponent(filePath)}`, { method: 'DELETE' })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || '删除失败')
  invalidateMediaCache()
}

/** 更改可管理上传素材的分类（Logo / 图片 / 视频） */
export async function reclassifyMediaFile(filePath, category) {
  const res = await apiFetch('/api/media/reclassify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      path: filePath,
      category: category === 'logo' || category === 'video' ? category : 'image',
    }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || '更改分类失败')
  invalidateMediaCache()
  return json
}

/** 更新素材别名（便于检索与展示） */
export async function updateMediaAlias(filePath, alias) {
  const res = await apiFetch('/api/media/alias', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: filePath, alias: String(alias ?? '').trim() }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || '更新别名失败')
  invalidateMediaCache()
  return json
}

function detectClientCategory(item) {
  const p = normalizeMediaPath(item?.path)
  if (p.startsWith('/videos/uploads/')) return 'video'
  if (p.startsWith('/library/icons/')) return 'icon'
  if (p.startsWith('/images/brands/') && /\/\d{10,}-/.test(p)) return 'logo'
  if (p.startsWith('/images/uploads/')) return 'image'
  if (item?.group === 'Logo图' || String(item?.group || '').includes('Logo')) return 'logo'
  if (item?.category === 'icon' || item?.group === '图标' || String(item?.group || '').includes('图标')) return 'icon'
  if (item?.kind === 'video' || String(item?.group || '').includes('视频')) return 'video'
  return 'image'
}

const MEDIA_TYPE_OPTIONS = [
  ['logo', 'Logo图'],
  ['icon', '图标'],
  ['image', '图片'],
  ['video', '视频'],
]

/** 配置内把旧路径整体替换为新路径（含 mediaUsage） */
export function rewriteConfigMediaPath(config, oldPath, newPath) {
  if (!config || !oldPath || !newPath || oldPath === newPath) return 0
  const from = normalizeMediaPath(oldPath)
  const to = normalizeMediaPath(newPath)
  let count = 0
  const walk = (value, parent, key) => {
    if (value == null) return
    if (typeof value === 'string') {
      if (normalizeMediaPath(value) === from) {
        parent[key] = to
        count += 1
        return
      }
      if (value.includes(from)) {
        parent[key] = value.split(from).join(to)
        count += 1
      }
      return
    }
    if (Array.isArray(value)) {
      value.forEach((v, i) => walk(v, value, i))
      return
    }
    if (typeof value === 'object') {
      Object.keys(value).forEach((k) => {
        if (k === 'mediaUsage') return
        walk(value[k], value, k)
      })
    }
  }
  walk(config, null, null)
  if (config.mediaUsage?.refs && typeof config.mediaUsage.refs === 'object') {
    const refs = config.mediaUsage.refs
    if (refs[from]) {
      refs[to] = refs[from]
      delete refs[from]
      count += 1
    }
  }
  return count
}

export function openConfirmModal({ title = '确认', message = '', confirmText = '确定', danger = false } = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div')
    overlay.className = 'modal-overlay'
    overlay.innerHTML = `
      <div class="modal-panel modal-confirm" role="dialog" aria-modal="true">
        <div class="modal-head"><strong>${title}</strong></div>
        <div class="modal-body"><p class="modal-message"></p></div>
        <div class="modal-foot">
          <button type="button" class="btn" data-act="cancel">取消</button>
          <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-act="ok">${confirmText}</button>
        </div>
      </div>`
    overlay.querySelector('.modal-message').textContent = message
    overlay.querySelector('.modal-message').style.whiteSpace = 'pre-wrap'
    const close = (val) => {
      overlay.remove()
      resolve(val)
    }
    overlay.querySelector('[data-act="cancel"]').onclick = () => close(false)
    overlay.querySelector('[data-act="ok"]').onclick = () => close(true)
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close(false)
    })
    document.body.appendChild(overlay)
  })
}

function fileNameFromPath(p) {
  if (!p) return ''
  try {
    return decodeURIComponent(String(p).split('/').pop() || p)
  } catch {
    return String(p).split('/').pop() || p
  }
}

/** 展示名：优先别名 */
function mediaDisplayName(item) {
  const alias = String(item?.alias || '').trim()
  if (alias) return alias
  return item?.name || fileNameFromPath(item?.path)
}

/** 按别名 / 文件名 / 路径检索 */
function mediaMatchesSearch(item, q) {
  if (!q) return true
  const hay = [item?.alias, item?.name, item?.path, fileNameFromPath(item?.path)]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return hay.includes(q)
}

function filterMediaItems(items, q) {
  const needle = String(q || '').trim().toLowerCase()
  if (!needle) return items || []
  return (items || []).filter((i) => mediaMatchesSearch(i, needle))
}

export function createImageField({ label, value, onChange, onStatus }) {
  const wrap = document.createElement('div')
  wrap.className = 'field media-field'

  const lab = document.createElement('label')
  lab.textContent = label
  wrap.appendChild(lab)

  const box = document.createElement('div')
  box.className = 'media-box media-box-image'
  wrap.appendChild(box)

  let current = value || ''

  const render = () => {
    box.innerHTML = ''
    const preview = document.createElement('div')
    preview.className = `media-thumb${current ? '' : ' is-empty'}`
    if (current) {
      const img = document.createElement('img')
      img.src = current
      img.alt = ''
      preview.appendChild(img)
    } else {
      preview.innerHTML = '<span class="media-empty-icon">🖼</span><span>暂无图片</span>'
    }
    box.appendChild(preview)

    const meta = document.createElement('div')
    meta.className = 'media-meta'
    const name = document.createElement('div')
    name.className = 'media-filename'
    name.textContent = current ? fileNameFromPath(current) : '未选择图片'
    name.title = current || ''
    meta.appendChild(name)

    const actions = document.createElement('div')
    actions.className = 'media-actions'

    const fileInput = document.createElement('input')
    fileInput.type = 'file'
    fileInput.accept = 'image/*'
    fileInput.hidden = true

    const uploadBtn = document.createElement('button')
    uploadBtn.type = 'button'
    uploadBtn.className = 'btn btn-sm btn-primary'
    uploadBtn.textContent = current ? '更换' : '上传'
    uploadBtn.addEventListener('click', () => fileInput.click())

    const pickBtn = document.createElement('button')
    pickBtn.type = 'button'
    pickBtn.className = 'btn btn-sm'
    pickBtn.textContent = '素材库'
    pickBtn.addEventListener('click', async () => {
      const picked = await openMediaPicker({ multiple: false, kind: 'image' })
      if (!picked) return
      current = picked
      onChange?.(current)
      render()
    })

    const clearBtn = document.createElement('button')
    clearBtn.type = 'button'
    clearBtn.className = 'btn btn-sm btn-danger'
    clearBtn.textContent = '清除'
    clearBtn.disabled = !current
    clearBtn.addEventListener('click', async () => {
      if (!current) return
      const ok = await openConfirmModal({ title: '清除图片', message: '确定清除当前图片吗？', danger: true, confirmText: '清除' })
      if (!ok) {
        onStatus?.('已取消清除')
        return
      }
      const pathToClear = current
      current = ''
      onChange?.(current)
      render()
      if (pathToClear.startsWith('/images/uploads/')) {
        try {
          await deleteUploadedImage(pathToClear)
          onStatus?.('已删除上传文件')
        } catch (err) {
          onStatus?.(err.message, false)
        }
      } else {
        onStatus?.('已清除图片')
      }
    })

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0]
      fileInput.value = ''
      if (!file) return
      try {
        onStatus?.('上传中…')
        const path = await uploadImageFile(file)
        current = path
        onChange?.(current)
        render()
        onStatus?.('上传成功')
      } catch (err) {
        onStatus?.(err.message || '上传失败', false)
      }
    })

    actions.append(uploadBtn, pickBtn, clearBtn, fileInput)
    meta.appendChild(actions)
    box.appendChild(meta)
  }

  render()
  return wrap
}

export function createVideoField({ label, value, onChange, onStatus }) {
  const wrap = document.createElement('div')
  wrap.className = 'field media-field'

  const lab = document.createElement('label')
  lab.textContent = label
  wrap.appendChild(lab)

  const box = document.createElement('div')
  box.className = 'media-box media-box-video'
  wrap.appendChild(box)

  let current = value || ''

  const render = () => {
    box.innerHTML = ''
    const preview = document.createElement('div')
    preview.className = `media-thumb media-thumb-video${current ? '' : ' is-empty'}`
    if (current) {
      const video = document.createElement('video')
      video.src = current
      video.muted = true
      video.playsInline = true
      video.preload = 'metadata'
      video.controls = true
      video.setAttribute('controlsList', 'nodownload')
      preview.appendChild(video)
    } else {
      preview.innerHTML = '<span class="media-empty-icon">▶</span><span>暂无视频</span>'
    }
    box.appendChild(preview)

    const meta = document.createElement('div')
    meta.className = 'media-meta'
    const name = document.createElement('div')
    name.className = 'media-filename'
    name.textContent = current ? fileNameFromPath(current) : '未选择视频'
    name.title = current || ''
    meta.appendChild(name)

    const actions = document.createElement('div')
    actions.className = 'media-actions'

    const fileInput = document.createElement('input')
    fileInput.type = 'file'
    fileInput.accept = 'video/mp4,video/webm,video/*'
    fileInput.hidden = true

    const uploadBtn = document.createElement('button')
    uploadBtn.type = 'button'
    uploadBtn.className = 'btn btn-sm btn-primary'
    uploadBtn.textContent = current ? '更换视频' : '上传视频'
    uploadBtn.addEventListener('click', () => fileInput.click())

    const pickBtn = document.createElement('button')
    pickBtn.type = 'button'
    pickBtn.className = 'btn btn-sm'
    pickBtn.textContent = '素材库'
    pickBtn.addEventListener('click', async () => {
      const picked = await openMediaPicker({ multiple: false, kind: 'video' })
      if (!picked) return
      current = picked
      onChange?.(current)
      render()
    })

    const clearBtn = document.createElement('button')
    clearBtn.type = 'button'
    clearBtn.className = 'btn btn-sm btn-danger'
    clearBtn.textContent = '清除'
    clearBtn.disabled = !current
    clearBtn.addEventListener('click', async () => {
      if (!current) return
      const ok = await openConfirmModal({ title: '清除视频', message: '确定清除当前视频吗？', danger: true, confirmText: '清除' })
      if (!ok) {
        onStatus?.('已取消清除')
        return
      }
      const pathToClear = current
      current = ''
      onChange?.(current)
      render()
      if (pathToClear.startsWith('/videos/uploads/')) {
        try {
          await deleteUploadedImage(pathToClear)
          onStatus?.('已删除上传文件')
        } catch (err) {
          onStatus?.(err.message, false)
        }
      } else {
        onStatus?.('已清除视频')
      }
    })

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0]
      fileInput.value = ''
      if (!file) return
      try {
        onStatus?.(`上传中… ${(file.size / 1024 / 1024).toFixed(1)}MB`)
        const path = await uploadMediaFile(file)
        current = path
        onChange?.(current)
        render()
        onStatus?.('视频上传成功')
      } catch (err) {
        onStatus?.(err.message || '上传失败', false)
      }
    })

    actions.append(uploadBtn, pickBtn, clearBtn, fileInput)
    meta.appendChild(actions)
    box.appendChild(meta)
  }

  render()
  return wrap
}

export function createMultiImageField({ label, values, onChange, onStatus }) {
  const wrap = document.createElement('div')
  wrap.className = 'field media-field'
  const lab = document.createElement('label')
  lab.textContent = label
  wrap.appendChild(lab)

  const toolbar = document.createElement('div')
  toolbar.className = 'media-multi-toolbar'
  wrap.appendChild(toolbar)

  const box = document.createElement('div')
  box.className = 'media-multi'
  wrap.appendChild(box)

  const actionsHost = document.createElement('div')
  wrap.appendChild(actionsHost)

  let list = Array.isArray(values) ? values.slice() : []
  /** @type {Set<number>} */
  let selected = new Set()
  let dragFrom = -1

  const emit = () => onChange?.(list.slice())

  const syncToolbar = () => {
    toolbar.innerHTML = ''
    const n = selected.size
    const hint = document.createElement('span')
    hint.className = 'field-hint media-multi-hint'
    hint.textContent = n ? `已选 ${n} 张 · 可拖动缩略图排序` : '勾选后可批量移除 · 拖动缩略图可排序'
    toolbar.appendChild(hint)

    const selectAll = document.createElement('button')
    selectAll.type = 'button'
    selectAll.className = 'btn btn-sm'
    const allOn = list.length > 0 && selected.size === list.length
    selectAll.textContent = allOn ? '取消全选' : '全选'
    selectAll.disabled = list.length === 0
    selectAll.addEventListener('click', () => {
      if (allOn) selected.clear()
      else list.forEach((_, i) => selected.add(i))
      renderAll()
    })
    toolbar.appendChild(selectAll)

    const batchDel = document.createElement('button')
    batchDel.type = 'button'
    batchDel.className = 'btn btn-sm btn-danger'
    batchDel.textContent = n ? `批量移除（${n}）` : '批量移除'
    batchDel.disabled = n === 0
    batchDel.addEventListener('click', async () => {
      const indexes = [...selected].sort((a, b) => b - a)
      if (!indexes.length) return
      const ok = await openConfirmModal({
        title: '批量移除图片',
        message: `从列表中移除选中的 ${indexes.length} 张图片？\n（仅改配置列表，不删除素材库/官网文件）`,
        danger: true,
        confirmText: `移除 ${indexes.length} 张`,
      })
      if (!ok) {
        onStatus?.('已取消移除')
        return
      }
      indexes.forEach((i) => list.splice(i, 1))
      selected.clear()
      emit()
      renderAll()
      onStatus?.(`已移除 ${indexes.length} 张图片`)
    })
    toolbar.appendChild(batchDel)
  }

  const moveItem = (from, to) => {
    if (from < 0 || to < 0 || from >= list.length || to >= list.length || from === to) return
    const [item] = list.splice(from, 1)
    list.splice(to, 0, item)
    selected.clear()
    emit()
    renderAll()
  }

  const renderAll = () => {
    // 索引失效时清理选中
    selected = new Set([...selected].filter((i) => i >= 0 && i < list.length))
    syncToolbar()
    box.innerHTML = ''
    actionsHost.innerHTML = ''

    list.forEach((src, index) => {
      const card = document.createElement('div')
      card.className = 'media-chip'
      if (selected.has(index)) card.classList.add('is-selected')
      card.draggable = true
      card.dataset.index = String(index)
      card.title = '拖动排序 · 勾选后可批量移除'

      const check = document.createElement('input')
      check.type = 'checkbox'
      check.className = 'media-chip-check'
      check.checked = selected.has(index)
      check.title = '选择'
      check.addEventListener('mousedown', (e) => e.stopPropagation())
      check.addEventListener('pointerdown', (e) => e.stopPropagation())
      check.addEventListener('click', (e) => e.stopPropagation())
      check.addEventListener('change', () => {
        if (check.checked) selected.add(index)
        else selected.delete(index)
        card.classList.toggle('is-selected', check.checked)
        syncToolbar()
      })

      const img = document.createElement('img')
      img.src = src
      img.alt = ''
      img.draggable = false

      const del = document.createElement('button')
      del.type = 'button'
      del.className = 'media-chip-del'
      del.textContent = '×'
      del.title = '移除'
      del.addEventListener('mousedown', (e) => e.stopPropagation())
      del.addEventListener('pointerdown', (e) => e.stopPropagation())
      del.addEventListener('click', async (e) => {
        e.stopPropagation()
        const ok = await openConfirmModal({
          title: '移除图片',
          message: '从列表中移除该图片？',
          danger: true,
          confirmText: '移除',
        })
        if (!ok) {
          onStatus?.('已取消移除')
          return
        }
        list.splice(index, 1)
        selected.clear()
        emit()
        renderAll()
        onStatus?.('已从列表移除图片')
      })

      card.append(check, img, del)

      card.addEventListener('dragstart', (e) => {
        if (e.target.closest('.media-chip-check, .media-chip-del')) {
          e.preventDefault()
          return
        }
        dragFrom = index
        card.classList.add('is-dragging')
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', String(index))
      })
      card.addEventListener('dragend', () => {
        dragFrom = -1
        card.classList.remove('is-dragging')
        box.querySelectorAll('.media-chip.is-drag-over').forEach((el) => el.classList.remove('is-drag-over'))
      })
      card.addEventListener('dragover', (e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        card.classList.add('is-drag-over')
      })
      card.addEventListener('dragleave', () => {
        card.classList.remove('is-drag-over')
      })
      card.addEventListener('drop', (e) => {
        e.preventDefault()
        card.classList.remove('is-drag-over')
        const from = Number(e.dataTransfer.getData('text/plain'))
        const to = index
        if (!Number.isFinite(from) || from === to) return
        moveItem(from, to)
        onStatus?.('已调整图片顺序')
      })

      box.appendChild(card)
    })

    const add = document.createElement('button')
    add.type = 'button'
    add.className = 'media-add'
    add.textContent = '+'
    add.title = '从素材库添加'
    add.addEventListener('click', async () => {
      const picked = await openMediaPicker({ multiple: true, kind: 'image' })
      if (!picked?.length) {
        onStatus?.('未选择图片')
        return
      }
      list = list.concat(picked)
      emit()
      renderAll()
      onStatus?.(`已添加 ${picked.length} 张图片`)
    })
    box.appendChild(add)

    const upload = document.createElement('button')
    upload.type = 'button'
    upload.className = 'btn btn-sm'
    upload.textContent = '本地上传'
    const fileInput = document.createElement('input')
    fileInput.type = 'file'
    fileInput.accept = 'image/*'
    fileInput.multiple = true
    fileInput.hidden = true
    upload.addEventListener('click', () => fileInput.click())
    fileInput.addEventListener('change', async () => {
      const files = [...(fileInput.files || [])]
      fileInput.value = ''
      let ok = 0
      for (const file of files) {
        try {
          const libPath = await uploadMediaFile(file, { category: 'image' })
          const sitePath = await publishMediaToSite(libPath)
          list.push(sitePath)
          ok += 1
        } catch (err) {
          onStatus?.(err.message || '上传失败', false)
        }
      }
      emit()
      renderAll()
      if (ok) onStatus?.(`已上传 ${ok} 张并加入列表`)
    })
    actionsHost.className = 'media-actions'
    actionsHost.append(upload, fileInput)
  }

  renderAll()
  return wrap
}

export function openMediaPicker({ multiple = false, kind = 'image' } = {}) {
  return new Promise(async (resolve) => {
    const overlay = document.createElement('div')
    overlay.className = 'modal-overlay media-picker-overlay'

    const panel = document.createElement('div')
    panel.className = 'modal-panel media-picker'
    panel.setAttribute('role', 'dialog')
    panel.setAttribute('aria-modal', 'true')

    const kindLabel =
      kind === 'video' ? '视频' : kind === 'icon' ? '图标' : kind === 'all' ? '全部素材' : '图片'
    panel.innerHTML = `
      <div class="modal-head media-picker-head">
        <div>
          <strong>选择素材</strong>
          <span>${kindLabel}${multiple ? ' · 可多选' : ' · 单击选用'} · 也可上传</span>
        </div>
        <button type="button" class="modal-close" data-act="close" aria-label="关闭">×</button>
      </div>`

    const toolbar = document.createElement('div')
    toolbar.className = 'media-picker-toolbar'

    const typeSelect = document.createElement('select')
    typeSelect.className = 'content-list-cat-filter media-picker-type'
    typeSelect.setAttribute('aria-label', '素材类型')
    typeSelect.title = '按类型筛选'
    const typeOptions =
      kind === 'video'
        ? [['video', '视频']]
        : kind === 'icon'
          ? [['icon', '图标']]
          : kind === 'all'
            ? [
                ['all', '全部类型'],
                ['logo', 'Logo图'],
                ['icon', '图标'],
                ['image', '图片'],
                ['video', '视频'],
              ]
            : [
                ['all', '全部类型'],
                ['logo', 'Logo图'],
                ['image', '图片'],
              ]
    typeOptions.forEach(([v, t]) => {
      const opt = document.createElement('option')
      opt.value = v
      opt.textContent = t
      typeSelect.appendChild(opt)
    })

    const searchInput = document.createElement('input')
    searchInput.type = 'search'
    searchInput.className = 'content-list-search'
    searchInput.placeholder = '搜索别名 / 文件名 / 路径'
    searchInput.autocomplete = 'off'
    searchInput.title = '按名称搜索'
    // 左侧类型下拉 + 右侧名称搜索，两者并存
    toolbar.append(typeSelect, searchInput)

    const body = document.createElement('div')
    body.className = 'media-picker-body modal-body'
    const selected = new Set()
    /** @type {Awaited<ReturnType<typeof fetchMediaLibrary>> | null} */
    let libCache = null

    const section = (title, items, itemKind) => {
      const sec = document.createElement('div')
      sec.className = 'media-picker-section'
      const h = document.createElement('h4')
      h.textContent = `${title}（${items.length}）`
      sec.appendChild(h)
      const grid = document.createElement('div')
      grid.className = 'media-picker-grid'
      items.forEach((item) => {
        const btn = document.createElement('button')
        btn.type = 'button'
        btn.className = 'media-picker-item'
        btn.dataset.path = item.path
        btn.title = [mediaDisplayName(item), item.name, item.path].filter(Boolean).join('\n')
        if (selected.has(item.path)) btn.classList.add('is-selected')
        if (itemKind === 'video' || item.kind === 'video') {
          const v = document.createElement('video')
          v.src = item.path
          v.muted = true
          v.preload = 'metadata'
          v.playsInline = true
          btn.appendChild(v)
          const badge = document.createElement('em')
          badge.className = 'media-badge'
          badge.textContent = '视频'
          btn.appendChild(badge)
        } else {
          const img = document.createElement('img')
          img.src = item.path
          img.alt = mediaDisplayName(item)
          btn.appendChild(img)
        }
        const name = document.createElement('span')
        name.textContent = mediaDisplayName(item)
        btn.appendChild(name)
        btn.addEventListener('click', () => {
          if (multiple) {
            if (selected.has(item.path)) {
              selected.delete(item.path)
              btn.classList.remove('is-selected')
            } else {
              selected.add(item.path)
              btn.classList.add('is-selected')
            }
          } else {
            ;(async () => {
              try {
                const published = await publishMediaToSite(item.path)
                cleanup()
                resolve(published)
              } catch (err) {
                alert(err.message || '选用失败')
              }
            })()
          }
        })
        grid.appendChild(btn)
      })
      sec.appendChild(grid)
      return sec
    }

    function buildSections(q, typeFilter) {
      if (!libCache) return []
      const tf = typeFilter || 'all'
      if (kind === 'video') return [['视频', filterMediaItems(libCache.videos, q), 'video']]
      if (kind === 'icon') return [['图标', filterMediaItems(libCache.icons, q), 'image']]

      const rows = []
      const allowLogo = kind === 'all' || kind === 'image'
      const allowIcon = kind === 'all'
      const allowImage = kind === 'all' || kind === 'image'
      const allowVideo = kind === 'all'

      if (allowLogo && (tf === 'all' || tf === 'logo')) {
        rows.push(['Logo图', filterMediaItems(libCache.brands, q), 'image'])
      }
      if (allowIcon && (tf === 'all' || tf === 'icon')) {
        rows.push(['图标', filterMediaItems(libCache.icons, q), 'image'])
      }
      if (allowImage && (tf === 'all' || tf === 'image')) {
        rows.push([
          '图片',
          filterMediaItems([...(libCache.home || []), ...(libCache.site || []), ...(libCache.uploads || [])], q),
          'image',
        ])
      }
      if (allowVideo && (tf === 'all' || tf === 'video')) {
        rows.push(['视频', filterMediaItems(libCache.videos, q), 'video'])
      }
      return rows
    }

    function paintGrid() {
      if (!libCache) return
      const q = searchInput.value.trim()
      const typeFilter = typeSelect.value
      body.innerHTML = ''
      const sections = buildSections(q, typeFilter)
      let count = 0
      sections.forEach(([title, items, itemKind]) => {
        if (!items.length) return
        count += items.length
        body.append(section(title, items, itemKind))
      })
      if (!count) {
        const empty = document.createElement('div')
        empty.className = 'media-picker-empty'
        empty.textContent = q || typeFilter !== 'all' ? '无匹配素材，请调整筛选条件' : '暂无素材'
        body.appendChild(empty)
      }
    }

    async function paint() {
      body.innerHTML = '<div class="media-picker-empty">加载中…</div>'
      try {
        libCache = await fetchMediaLibrary(true)
        paintGrid()
      } catch (err) {
        body.innerHTML = ''
        const empty = document.createElement('div')
        empty.className = 'media-picker-empty'
        empty.textContent = err.message || '素材库加载失败，请检查管理员登录与 API'
        body.appendChild(empty)
      }
    }

    searchInput.addEventListener('input', () => paintGrid())
    typeSelect.addEventListener('change', () => paintGrid())

    await paint()
    panel.append(toolbar, body)

    const foot = document.createElement('div')
    foot.className = 'modal-foot media-picker-foot'

    const fileInput = document.createElement('input')
    fileInput.type = 'file'
    fileInput.hidden = true
    fileInput.accept =
      kind === 'video' ? 'video/*' : kind === 'all' ? 'image/*,video/*' : 'image/*,.svg,.ico'
    fileInput.multiple = multiple

    const uploadBtn = document.createElement('button')
    uploadBtn.type = 'button'
    uploadBtn.className = 'btn btn-primary'
    uploadBtn.textContent = kind === 'video' ? '上传视频' : '上传并选用'
    uploadBtn.addEventListener('click', () => fileInput.click())
    fileInput.addEventListener('change', async () => {
      const files = [...(fileInput.files || [])]
      fileInput.value = ''
      if (!files.length) return
      uploadBtn.disabled = true
      uploadBtn.textContent = '上传中…'
      const paths = []
      try {
        for (const file of files) {
          const uploadCat = kind === 'video' ? 'video' : kind === 'icon' ? 'icon' : 'image'
          const path = await uploadMediaFile(file, { category: uploadCat })
          const published = await publishMediaToSite(path)
          paths.push(published)
        }
        if (!multiple) {
          cleanup()
          resolve(paths[0] || null)
          return
        }
        paths.forEach((p) => selected.add(p))
        await paint()
        body.querySelectorAll('.media-picker-item').forEach((btn) => {
          if (selected.has(btn.dataset.path)) btn.classList.add('is-selected')
        })
      } catch (err) {
        alert(err.message || '上传失败')
      } finally {
        uploadBtn.disabled = false
        uploadBtn.textContent = kind === 'video' ? '上传视频' : '上传并选用'
      }
    })

    const cancel = document.createElement('button')
    cancel.type = 'button'
    cancel.className = 'btn'
    cancel.textContent = '取消'
    cancel.addEventListener('click', () => {
      cleanup()
      resolve(null)
    })
    foot.append(uploadBtn, fileInput, cancel)
    if (multiple) {
      const ok = document.createElement('button')
      ok.type = 'button'
      ok.className = 'btn btn-primary'
      ok.textContent = '确认添加'
      ok.addEventListener('click', async () => {
        ok.disabled = true
        try {
          const published = []
          for (const p of selected) {
            published.push(await publishMediaToSite(p))
          }
          cleanup()
          resolve(published)
        } catch (err) {
          alert(err.message || '发布失败')
          ok.disabled = false
        }
      })
      foot.appendChild(ok)
    }
    panel.appendChild(foot)
    overlay.appendChild(panel)
    document.body.appendChild(overlay)

    overlay.querySelector('[data-act="close"]').onclick = () => {
      cleanup()
      resolve(null)
    }
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        cleanup()
        resolve(null)
      }
    })

    function cleanup() {
      overlay.remove()
    }
  })
}

function formatBytes(n) {
  const size = Number(n) || 0
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function isDeletableMediaPath(p) {
  const path = String(p || '').replace(/\\/g, '/')
  if (!path || path.includes('..')) return false
  // 仅素材库可删；官网 site-media 与旧路径受保护
  return path.startsWith('/library/')
}

/** 同名其它路径（用于删重复时自动改引用） */
function findSameNameAlternate(lib, filePath) {
  const key = normalizeMediaPath(filePath)
  const name = fileNameFromPath(key).toLowerCase()
  if (!name || !lib) return null
  const groups = [lib.videos, lib.uploads, lib.brands, lib.home, lib.site].filter(Array.isArray)
  for (const list of groups) {
    for (const item of list) {
      const p = normalizeMediaPath(item?.path)
      if (!p || p === key) continue
      if (fileNameFromPath(p).toLowerCase() === name) return p
    }
  }
  return null
}

function normalizeMediaPath(p) {
  let s = String(p || '')
    .replace(/\\/g, '/')
    .trim()
  try {
    s = decodeURIComponent(s)
  } catch {
    /* keep raw */
  }
  s = s.split(/[?#]/)[0]
  if (/^(?:https?:)?\/\//i.test(s)) {
    try {
      s = new URL(s.startsWith('//') ? `https:${s}` : s).pathname
    } catch {
      /* keep */
    }
  }
  if (s && !s.startsWith('/') && /^(?:\.\/)?(?:images|videos)\//i.test(s)) {
    s = `/${s.replace(/^\.\//, '')}`
  }
  return s
}

/** 从字符串中提取站点图片/视频路径 */
export function extractMediaPathsFromString(value) {
  const out = []
  const s = String(value || '')
  if (!s) return out
  const push = (raw) => {
    const p = normalizeMediaPath(raw)
    if (p && /\/(?:images|videos)\//i.test(p)) out.push(p)
  }
  for (const m of s.matchAll(/(?:https?:\/\/[^"'\\\s]+)?(\/(?:images|videos)\/[^"'\\\s?#]+)/gi)) {
    push(m[1])
  }
  for (const m of s.matchAll(/(?:^|["'\s(=])((?:\.\/)?(?:images|videos)\/[^"'\\\s?#]+)/gi)) {
    push(m[1])
  }
  return out
}

/**
 * 一次遍历配置：路径集合 + 引用位置。
 * 跳过根级 mediaUsage（保存时写入的引用索引，避免自引用）。
 */
export function buildMediaUsageIndex(config) {
  const paths = new Set()
  /** @type {Map<string, string[]>} */
  const byPath = new Map()
  const add = (filePath, loc) => {
    const p = normalizeMediaPath(filePath)
    if (!p) return
    paths.add(p)
    if (!byPath.has(p)) byPath.set(p, [])
    const list = byPath.get(p)
    if (loc && !list.includes(loc)) list.push(loc)
  }
  const walk = (value, pathKeys = []) => {
    if (value == null) return
    if (typeof value === 'string') {
      const loc = pathKeys.join('.') || '(根)'
      extractMediaPathsFromString(value).forEach((p) => add(p, loc))
      return
    }
    if (Array.isArray(value)) {
      value.forEach((v, i) => walk(v, [...pathKeys, String(i)]))
      return
    }
    if (typeof value === 'object') {
      Object.entries(value).forEach(([k, v]) => {
        if (!pathKeys.length && k === 'mediaUsage') return
        walk(v, [...pathKeys, k])
      })
    }
  }
  walk(config)
  return { paths, byPath }
}

/** 从站点配置中收集已引用的图片/视频路径 */
export function collectConfigMediaPaths(config) {
  return buildMediaUsageIndex(config).paths
}

/**
 * 保存前写入引用索引：清理时直接读标记，只需再校验一次当前配置。
 * @returns {{ updatedAt: string, refs: Record<string, string[]> }}
 */
export function syncMediaUsageIndex(config) {
  if (!config || typeof config !== 'object') return null
  const { byPath } = buildMediaUsageIndex(config)
  const refs = {}
  byPath.forEach((locs, path) => {
    refs[path] = locs.slice(0, 40)
  })
  config.mediaUsage = {
    updatedAt: new Date().toISOString(),
    refs,
  }
  return config.mediaUsage
}

function isPathReferenced(filePath, refs) {
  const path = normalizeMediaPath(filePath)
  if (!path || !refs || typeof refs.has !== 'function') return false
  if (refs.has(path)) return true
  // 仅允许「完整路径后缀」匹配（避免短路径误伤）
  const base = path.split('/').pop()
  if (!base || base.length < 8) return false
  for (const ref of refs) {
    if (ref === path) return true
    if (ref.endsWith(path) || path.endsWith(ref)) {
      const shorter = ref.length <= path.length ? ref : path
      if (shorter.includes('/images/') || shorter.includes('/videos/')) return true
    }
  }
  return false
}

function listDeletableUploads(lib) {
  const logos = (lib.brands || [])
    .filter((i) => isDeletableMediaPath(i.path))
    .map((i) => ({ ...i, kind: 'image', group: 'Logo图' }))
  const icons = (lib.icons || [])
    .filter((i) => isDeletableMediaPath(i.path))
    .map((i) => ({ ...i, kind: 'image', group: '图标' }))
  const images = (lib.uploads || []).map((i) => ({ ...i, kind: i.kind || 'image', group: '图片' }))
  const videos = (lib.videos || [])
    .filter((i) => isDeletableMediaPath(i.path))
    .map((i) => ({ ...i, kind: 'video', group: '视频' }))
  return [...logos, ...icons, ...images, ...videos]
}

function findDuplicatePaths(lib) {
  const items = listDeletableUploads(lib)
  const bySize = new Map()
  items.forEach((item) => {
    const key = Number(item.size) || 0
    if (!bySize.has(key)) bySize.set(key, [])
    bySize.get(key).push(item)
  })
  const dups = new Set()
  bySize.forEach((arr) => {
    if (arr.length > 1) arr.forEach((i) => dups.add(normalizeMediaPath(i.path)))
  })
  return dups
}

function formatMediaTime(ms) {
  const n = Number(ms)
  if (!Number.isFinite(n) || n <= 0) return '—'
  try {
    return new Date(n).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

function findConfigRefsForPath(config, filePath, usageIndex = null) {
  const target = normalizeMediaPath(filePath)
  const index = usageIndex || buildMediaUsageIndex(config)
  if (index.byPath.has(target)) return index.byPath.get(target).slice(0, 40)
  const hits = []
  index.byPath.forEach((locs, path) => {
    if (path === target) hits.push(...locs)
    else if (
      (path.endsWith(target) || target.endsWith(path)) &&
      (path.includes('/images/') || path.includes('/videos/')) &&
      (target.includes('/images/') || target.includes('/videos/'))
    ) {
      hits.push(...locs)
    }
  })
  return [...new Set(hits)].slice(0, 40)
}

function openMediaDetailModal(item, { getConfig, onStatus, usageIndex, onChanged, findAlternate } = {}) {
  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay media-detail-overlay'
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove()
  })
  const panel = document.createElement('div')
  panel.className = 'modal-panel media-detail-panel'
  panel.setAttribute('role', 'dialog')
  const head = document.createElement('div')
  head.className = 'modal-head'
  head.innerHTML = `<div><strong>素材详情</strong><span>${mediaDisplayName(item)}</span></div>`
  const closeBtn = document.createElement('button')
  closeBtn.type = 'button'
  closeBtn.className = 'modal-close'
  closeBtn.textContent = '×'
  closeBtn.addEventListener('click', () => overlay.remove())
  head.appendChild(closeBtn)

  const body = document.createElement('div')
  body.className = 'modal-body media-detail-body'
  const preview = document.createElement('div')
  preview.className = 'media-detail-preview'
  if (item.kind === 'video' || String(item.group || '').includes('视频')) {
    const v = document.createElement('video')
    v.src = item.path
    v.controls = true
    v.playsInline = true
    preview.appendChild(v)
  } else {
    const img = document.createElement('img')
    img.src = item.path
    img.alt = item.name || ''
    preview.appendChild(img)
  }

  const config = typeof getConfig === 'function' ? getConfig() : null
  const index = usageIndex || buildMediaUsageIndex(config)
  const used = isPathReferenced(item.path, index.paths)
  const refPaths = findConfigRefsForPath(config, item.path, index)
  const deletable = isDeletableMediaPath(item.path)
  const currentCat = detectClientCategory(item)

  const dl = document.createElement('dl')
  dl.className = 'media-detail-dl'

  const aliasDt = document.createElement('dt')
  aliasDt.textContent = '别名'
  const aliasDd = document.createElement('dd')
  if (deletable) {
    const aliasInput = document.createElement('input')
    aliasInput.type = 'text'
    aliasInput.className = 'field-input media-detail-alias'
    aliasInput.placeholder = '便于检索的自定义名称（可空）'
    aliasInput.value = item.alias || ''
    aliasInput.maxLength = 80
    const aliasHint = document.createElement('p')
    aliasHint.className = 'field-hint'
    aliasHint.textContent = '别名会显示在素材库与选择弹窗中，并参与搜索。'
    const saveAliasBtn = document.createElement('button')
    saveAliasBtn.type = 'button'
    saveAliasBtn.className = 'btn btn-sm btn-primary'
    saveAliasBtn.textContent = '保存别名'
    saveAliasBtn.addEventListener('click', async () => {
      const next = aliasInput.value.trim()
      if (next === String(item.alias || '').trim()) {
        onStatus?.('别名未变化')
        return
      }
      saveAliasBtn.disabled = true
      try {
        const result = await updateMediaAlias(item.path, next)
        item.alias = result.alias || ''
        onStatus?.('别名已保存')
        head.querySelector('span').textContent = mediaDisplayName(item)
        saveAliasBtn.disabled = false
        onChanged?.(0, { refresh: true })
      } catch (err) {
        onStatus?.(err.message || '保存别名失败', false)
        saveAliasBtn.disabled = false
      }
    })
    aliasDd.append(aliasInput, saveAliasBtn, aliasHint)
  } else {
    aliasDd.textContent = item.alias || '—'
    const tip = document.createElement('p')
    tip.className = 'field-hint'
    tip.textContent = '官网发布区文件不可在此修改别名。'
    aliasDd.appendChild(tip)
  }
  dl.append(aliasDt, aliasDd)

  ;[
    ['文件名', item.name || fileNameFromPath(item.path)],
    ['路径', item.path || '—'],
    ['大小', formatBytes(item.size)],
    ['修改时间', formatMediaTime(item.mtime)],
    ['引用状态', used ? `使用中（${refPaths.length || 1} 处）` : '未引用'],
  ].forEach(([k, v]) => {
    const dt = document.createElement('dt')
    dt.textContent = k
    const dd = document.createElement('dd')
    dd.textContent = v
    dl.append(dt, dd)
  })

  const typeDt = document.createElement('dt')
  typeDt.textContent = '素材类型'
  const typeDd = document.createElement('dd')
  if (deletable) {
    const typeSelect = document.createElement('select')
    typeSelect.className = 'content-list-cat-filter media-detail-type'
    MEDIA_TYPE_OPTIONS.forEach(([v, t]) => {
      const opt = document.createElement('option')
      opt.value = v
      opt.textContent = t
      if (v === currentCat) opt.selected = true
      typeSelect.appendChild(opt)
    })
    const typeHint = document.createElement('p')
    typeHint.className = 'field-hint'
    typeHint.textContent = '更改后文件会移动到对应目录；若已被配置引用，将自动更新路径。'
    const saveTypeBtn = document.createElement('button')
    saveTypeBtn.type = 'button'
    saveTypeBtn.className = 'btn btn-sm btn-primary'
    saveTypeBtn.textContent = '保存类型'
    saveTypeBtn.addEventListener('click', async () => {
      const next = typeSelect.value
      if (next === currentCat) {
        onStatus?.('类型未变化')
        return
      }
      saveTypeBtn.disabled = true
      try {
        const result = await reclassifyMediaFile(item.path, next)
        const cfg = typeof getConfig === 'function' ? getConfig() : null
        let rewritten = 0
        if (cfg && result.moved && result.oldPath !== result.path) {
          rewritten = rewriteConfigMediaPath(cfg, result.oldPath, result.path)
        }
        onStatus?.(result.moved ? `已改为「${MEDIA_TYPE_OPTIONS.find(([v]) => v === next)?.[1] || next}」` : '类型未变化')
        overlay.remove()
        onChanged?.(rewritten, { refresh: true })
      } catch (err) {
        onStatus?.(err.message || '更改类型失败', false)
        saveTypeBtn.disabled = false
      }
    })
    typeDd.append(typeSelect, saveTypeBtn, typeHint)
  } else {
    typeDd.textContent = item.group || (item.kind === 'video' ? '视频' : '图片')
    const tip = document.createElement('p')
    tip.className = 'field-hint'
    tip.textContent = '官网发布区文件不在此改分类。素材库文件可删除，不影响官网副本。'
    typeDd.appendChild(tip)
  }
  dl.append(typeDt, typeDd)

  if (refPaths.length) {
    const dt = document.createElement('dt')
    dt.textContent = '配置引用'
    const dd = document.createElement('dd')
    dd.className = 'media-detail-refs'
    dd.textContent = refPaths.join('\n')
    dl.append(dt, dd)
  }

  body.append(preview, dl)

  const foot = document.createElement('div')
  foot.className = 'modal-foot'
  if (deletable) {
    const delBtn = document.createElement('button')
    delBtn.type = 'button'
    delBtn.className = 'btn btn-danger'
    delBtn.textContent = used ? '强制删除' : '删除'
    delBtn.addEventListener('click', async () => {
      const alt = typeof findAlternate === 'function' ? findAlternate(item.path) : null
      const ok = await openConfirmModal({
        title: used ? '强制删除素材' : '删除素材',
        message: used
          ? alt
            ? `「${item.name}」仍被配置引用。检测到同名文件：\n${alt}\n\n删除后将把引用改到该路径。确定？`
            : `「${item.name}」仍被配置引用。删除后前台可能裂图/黑屏。\n若只是清重复，请保留被引用的那一份。\n\n仍要强制删除？`
          : `确定删除「${item.name}」？`,
        danger: true,
        confirmText: used ? '强制删除' : '删除',
      })
      if (!ok) {
        onStatus?.('已取消删除')
        return
      }
      try {
        const cfg = typeof getConfig === 'function' ? getConfig() : null
        let rewritten = 0
        if (used && alt && cfg) {
          rewritten = rewriteConfigMediaPath(cfg, item.path, alt)
        }
        await deleteUploadedImage(item.path)
        onStatus?.(
          rewritten
            ? `已删除，并改写 ${rewritten} 处引用 → ${alt}`
            : used
              ? '已强制删除（配置中仍可能残留旧路径，请检查）'
              : '已删除'
        )
        overlay.remove()
        onChanged?.(rewritten, { refresh: true })
      } catch (err) {
        onStatus?.(err.message || '删除失败', false)
      }
    })
    foot.appendChild(delBtn)
  }
  const copyBtn = document.createElement('button')
  copyBtn.type = 'button'
  copyBtn.className = 'btn btn-primary'
  copyBtn.textContent = '复制路径'
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(item.path)
      onStatus?.('已复制路径')
    } catch {
      onStatus?.('复制失败', false)
    }
  })
  const openBtn = document.createElement('a')
  openBtn.className = 'btn'
  openBtn.href = item.path
  openBtn.target = '_blank'
  openBtn.rel = 'noopener'
  openBtn.textContent = '新窗口打开'
  const done = document.createElement('button')
  done.type = 'button'
  done.className = 'btn'
  done.textContent = '关闭'
  done.addEventListener('click', () => overlay.remove())
  foot.append(copyBtn, openBtn, done)

  panel.append(head, body, foot)
  overlay.appendChild(panel)
  document.body.appendChild(overlay)
}

/** 上传前选择素材类型 */
function openMediaUploadModal({ onConfirm } = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div')
    overlay.className = 'modal-overlay media-upload-overlay'
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove()
        resolve(null)
      }
    })
    const panel = document.createElement('div')
    panel.className = 'modal-panel media-upload-panel'
    panel.setAttribute('role', 'dialog')

    const head = document.createElement('div')
    head.className = 'modal-head'
    head.innerHTML = `<div><strong>上传素材</strong><span>请先选择类型再选择文件</span></div>`
    const closeBtn = document.createElement('button')
    closeBtn.type = 'button'
    closeBtn.className = 'modal-close'
    closeBtn.textContent = '×'
    closeBtn.addEventListener('click', () => {
      overlay.remove()
      resolve(null)
    })
    head.appendChild(closeBtn)

    const body = document.createElement('div')
    body.className = 'modal-body'
    const hint = document.createElement('p')
    hint.className = 'section-note'
    hint.textContent = 'Logo / 图标 / 图片 / 视频分别进入对应目录；图标建议 PNG 或 SVG。可一次多选。'
    body.appendChild(hint)

    const typeField = document.createElement('div')
    typeField.className = 'field'
    const typeLab = document.createElement('label')
    typeLab.className = 'field-label'
    typeLab.textContent = '素材类型'
    const typeSelect = document.createElement('select')
    typeSelect.className = 'field-input'
    MEDIA_TYPE_OPTIONS.forEach(([v, t]) => {
      const opt = document.createElement('option')
      opt.value = v
      opt.textContent = t
      if (v === 'image') opt.selected = true
      typeSelect.appendChild(opt)
    })
    typeField.append(typeLab, typeSelect)
    body.appendChild(typeField)

    const fileInput = document.createElement('input')
    fileInput.type = 'file'
    fileInput.multiple = true
    fileInput.hidden = true
    const syncAccept = () => {
      fileInput.accept = typeSelect.value === 'video' ? 'video/*' : 'image/*,.svg,.ico'
    }
    syncAccept()
    typeSelect.addEventListener('change', syncAccept)

    const pickBtn = document.createElement('button')
    pickBtn.type = 'button'
    pickBtn.className = 'btn btn-primary'
    pickBtn.textContent = '选择文件并上传'
    pickBtn.addEventListener('click', () => {
      syncAccept()
      fileInput.click()
    })

    fileInput.addEventListener('change', async () => {
      const files = [...(fileInput.files || [])]
      fileInput.value = ''
      if (!files.length) return
      const category = typeSelect.value
      overlay.remove()
      resolve({ category, files })
      onConfirm?.({ category, files })
    })

    const foot = document.createElement('div')
    foot.className = 'modal-foot'
    const cancel = document.createElement('button')
    cancel.type = 'button'
    cancel.className = 'btn'
    cancel.textContent = '取消'
    cancel.addEventListener('click', () => {
      overlay.remove()
      resolve(null)
    })
    foot.append(cancel, pickBtn, fileInput)

    panel.append(head, body, foot)
    overlay.appendChild(panel)
    document.body.appendChild(overlay)
  })
}

/** 工作台「素材库」维护面板：浏览 / 上传 / 复制路径 / 删除上传文件 */
export function createMediaLibraryManager({ onStatus, getConfig, onConfigChange } = {}) {
  const wrap = document.createElement('div')
  wrap.className = 'edit-block media-library-manager'

  const toolbar = document.createElement('div')
  toolbar.className = 'list-toolbar media-lib-toolbar'

  const titleWrap = document.createElement('div')
  titleWrap.className = 'media-lib-title'
  const title = document.createElement('h3')
  title.textContent = '素材库'
  title.style.margin = '0'
  const count = document.createElement('span')
  count.className = 'content-list-count'
  titleWrap.append(title, count)

  const tools = document.createElement('div')
  tools.className = 'media-lib-tools'

  const filtersRow = document.createElement('div')
  filtersRow.className = 'media-lib-filters'

  const search = document.createElement('input')
  search.type = 'search'
  search.className = 'content-list-search'
  search.placeholder = '搜索别名 / 文件名 / 路径'
  search.autocomplete = 'off'

  const filter = document.createElement('select')
  filter.className = 'content-list-cat-filter'
  ;[
    ['all', '全部'],
    ['logo', 'Logo图'],
    ['icon', '图标'],
    ['image', '图片'],
    ['video', '视频'],
    ['dupes', '疑似重复'],
  ].forEach(([v, t]) => {
    const opt = document.createElement('option')
    opt.value = v
    opt.textContent = t
    filter.appendChild(opt)
  })

  filtersRow.append(search, filter)

  const actionsRow = document.createElement('div')
  actionsRow.className = 'media-lib-actions-bar'

  const uploadBtn = document.createElement('button')
  uploadBtn.type = 'button'
  uploadBtn.className = 'btn btn-sm btn-primary'
  uploadBtn.textContent = '上传'
  uploadBtn.addEventListener('click', async () => {
    const picked = await openMediaUploadModal()
    if (!picked?.files?.length) {
      onStatus?.('已取消上传')
      return
    }
    await handleUpload(picked.files, picked.category)
  })

  const refreshBtn = document.createElement('button')
  refreshBtn.type = 'button'
  refreshBtn.className = 'btn btn-sm'
  refreshBtn.textContent = '刷新'
  refreshBtn.addEventListener('click', () => render(true))

  const selectAllBtn = document.createElement('button')
  selectAllBtn.type = 'button'
  selectAllBtn.className = 'btn btn-sm'
  selectAllBtn.textContent = '全选'

  const batchDelBtn = document.createElement('button')
  batchDelBtn.type = 'button'
  batchDelBtn.className = 'btn btn-sm btn-danger'
  batchDelBtn.textContent = '批量删除'
  batchDelBtn.disabled = true

  actionsRow.append(uploadBtn, refreshBtn, selectAllBtn, batchDelBtn)
  tools.append(filtersRow, actionsRow)
  toolbar.append(titleWrap, tools)
  wrap.appendChild(toolbar)

  const note = document.createElement('p')
  note.className = 'field-hint media-lib-hint'
  note.textContent =
    '素材库与官网文件分离：删除/批量删除只影响素材库。选用到页面时会按内容哈希复制到官网区（去重），不影响库内原文件。'
  wrap.appendChild(note)

  const box = document.createElement('div')
  box.className = 'media-lib-box'
  wrap.appendChild(box)

  let lib = { brands: [], home: [], site: [], uploads: [], videos: [], siteMedia: [] }
  /** @type {{ paths: Set<string>, byPath: Map<string, string[]> }} */
  let usage = { paths: new Set(), byPath: new Map() }
  let dupes = new Set()
  /** @type {Set<string>} */
  const selectedPaths = new Set()

  const refreshRefs = () => {
    const cfg = typeof getConfig === 'function' ? getConfig() : null
    usage = buildMediaUsageIndex(cfg)
    dupes = findDuplicatePaths(lib)
  }

  const syncBatchBtn = () => {
    const n = selectedPaths.size
    batchDelBtn.disabled = n === 0
    batchDelBtn.textContent = n ? `批量删除（${n}）` : '批量删除'
  }

  const collect = () => {
    const q = search.value.trim().toLowerCase()
    const cat = filter.value
    let buckets = []
    if (cat === 'dupes') {
      buckets = listDeletableUploads(lib).filter((i) => dupes.has(normalizeMediaPath(i.path)))
    } else {
      if (cat === 'all' || cat === 'logo') {
        buckets.push(...(lib.brands || []).map((i) => ({ ...i, group: 'Logo图', kind: 'image' })))
      }
      if (cat === 'all' || cat === 'icon') {
        buckets.push(...(lib.icons || []).map((i) => ({ ...i, group: '图标', kind: 'image' })))
      }
      if (cat === 'all' || cat === 'image') {
        buckets.push(...(lib.uploads || []).map((i) => ({ ...i, group: '图片', kind: i.kind || 'image' })))
      }
      if (cat === 'all' || cat === 'video') {
        buckets.push(...(lib.videos || []).map((i) => ({ ...i, group: '视频', kind: 'video' })))
      }
    }
    if (!q) return buckets
    return buckets.filter((i) => mediaMatchesSearch(i, q))
  }

  async function copyPath(path) {
    try {
      await navigator.clipboard.writeText(path)
      onStatus?.('已复制路径')
    } catch {
      const ta = document.createElement('textarea')
      ta.value = path
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
      onStatus?.('已复制路径')
    }
  }

  async function handleUpload(files, category = 'image') {
    const list = [...files]
    if (!list.length) return
    const type = category === 'logo' || category === 'video' || category === 'icon' ? category : 'image'
    const expectVideo = type === 'video'
    const expectImage = type === 'logo' || type === 'image'
    onStatus?.(`上传中…（${list.length}）`)
    let ok = 0
    const existing = listDeletableUploads(lib)
    for (const file of list) {
      const mime = String(file.type || '')
      if (expectVideo && !mime.startsWith('video/') && !/\.(mp4|webm|ogg|mov|m4v)$/i.test(file.name)) {
        onStatus?.(`已跳过非视频文件：${file.name}`, false)
        continue
      }
      if (expectImage && !mime.startsWith('image/') && !/\.(png|jpe?g|gif|webp|svg|ico)$/i.test(file.name)) {
        onStatus?.(`已跳过非图片文件：${file.name}`, false)
        continue
      }
      const sameSize = existing.find((i) => Number(i.size) === Number(file.size))
      if (sameSize) {
        const proceed = await openConfirmModal({
          title: '可能重复导入',
          message: `「${file.name}」与已有素材大小相同（${formatBytes(file.size)}）。相同内容会自动去重。仍要上传吗？`,
          confirmText: '继续上传',
        })
        if (!proceed) continue
      }
      try {
        await uploadMediaFile(file, { category: type })
        ok += 1
      } catch (err) {
        onStatus?.(err.message || '上传失败', false)
      }
    }
    await render(true)
    if (ok) onStatus?.(`已上传 ${ok} 个到素材库`)
  }

  search.addEventListener('input', () => paintGrid())
  filter.addEventListener('change', () => {
    selectedPaths.clear()
    syncBatchBtn()
    paintGrid()
  })

  selectAllBtn.addEventListener('click', () => {
    const items = collect()
    const allSelected = items.length && items.every((i) => selectedPaths.has(normalizeMediaPath(i.path)))
    if (allSelected) {
      items.forEach((i) => selectedPaths.delete(normalizeMediaPath(i.path)))
      selectAllBtn.textContent = '全选'
    } else {
      items.forEach((i) => selectedPaths.add(normalizeMediaPath(i.path)))
      selectAllBtn.textContent = '取消全选'
    }
    syncBatchBtn()
    paintGrid()
  })

  batchDelBtn.addEventListener('click', async () => {
    const paths = [...selectedPaths]
    if (!paths.length) return
    const ok = await openConfirmModal({
      title: '批量删除素材库文件',
      message: `将删除素材库中 ${paths.length} 个文件。\n官网已发布文件（site-media）不受影响。\n\n此操作不可恢复。`,
      danger: true,
      confirmText: `删除 ${paths.length} 个`,
    })
    if (!ok) {
      onStatus?.('已取消删除')
      return
    }
    try {
      const result = await deleteMediaBatch(paths)
      selectedPaths.clear()
      syncBatchBtn()
      await render(true)
      onStatus?.(`已删除 ${result.deleted || 0} 个素材库文件`, true)
    } catch (err) {
      onStatus?.(err.message || '批量删除失败', false)
    }
  })

  function paintGrid() {
    refreshRefs()
    const items = collect()
    const siteHashes = new Set((lib.siteMedia || []).map((i) => i.hash).filter(Boolean))
    count.textContent = `${items.length} 项 · 官网区 ${(lib.siteMedia || []).length} 份`
    syncBatchBtn()
    box.innerHTML = ''
    if (!items.length) {
      box.innerHTML =
        filter.value === 'dupes'
          ? '<div class="content-list-empty">未发现同大小的疑似重复文件。</div>'
          : '<div class="content-list-empty">素材库为空。请先运行迁移或点「上传」。</div>'
      return
    }
    const grid = document.createElement('div')
    grid.className = 'media-lib-grid'
    items.forEach((item) => {
      const card = document.createElement('article')
      card.className = 'media-lib-card'
      card.title = item.path || ''
      const pathKey = normalizeMediaPath(item.path)
      const deletable = isDeletableMediaPath(item.path)
      const isDup = deletable && dupes.has(pathKey)
      const published = !!(item.hash && siteHashes.has(item.hash))
      if (isDup) card.classList.add('is-dupe')
      if (selectedPaths.has(pathKey)) card.classList.add('is-selected')

      const check = document.createElement('input')
      check.type = 'checkbox'
      check.className = 'media-lib-check'
      check.checked = selectedPaths.has(pathKey)
      check.title = '选择'
      check.addEventListener('click', (e) => e.stopPropagation())
      check.addEventListener('change', () => {
        if (check.checked) selectedPaths.add(pathKey)
        else selectedPaths.delete(pathKey)
        card.classList.toggle('is-selected', check.checked)
        syncBatchBtn()
      })

      const preview = document.createElement('div')
      preview.className = 'media-lib-preview'
      if (item.kind === 'video' || item.group?.includes('视频')) {
        const v = document.createElement('video')
        v.src = item.path
        v.muted = true
        v.preload = 'metadata'
        v.playsInline = true
        preview.appendChild(v)
      } else {
        const img = document.createElement('img')
        img.src = item.path
        img.alt = item.name || ''
        img.loading = 'lazy'
        preview.appendChild(img)
      }
      if (deletable) {
        const badge = document.createElement('span')
        badge.className = `media-lib-badge${published ? ' is-used' : ' is-orphan'}${isDup ? ' is-dupe' : ''}`
        badge.textContent = published ? '已同步官网' : isDup ? '疑似重复' : '仅素材库'
        preview.appendChild(badge)
      }
      card.append(check, preview)

      const meta = document.createElement('div')
      meta.className = 'media-lib-meta'
      const name = document.createElement('strong')
      name.textContent = mediaDisplayName(item)
      const sub = document.createElement('span')
      sub.className = 'media-lib-sub'
      sub.textContent = [
        item.alias ? item.name || fileNameFromPath(item.path) : null,
        item.group || '',
        formatBytes(item.size),
      ]
        .filter(Boolean)
        .join(' · ')
      meta.append(name, sub)
      card.appendChild(meta)

      const actions = document.createElement('div')
      actions.className = 'media-lib-actions'
      const detailBtn = document.createElement('button')
      detailBtn.type = 'button'
      detailBtn.className = 'btn btn-sm'
      detailBtn.textContent = '详情'
      detailBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        openMediaDetailModal(item, {
          getConfig,
          onStatus,
          usageIndex: usage,
          findAlternate: (p) => findSameNameAlternate(lib, p),
          onChanged: async (rewritten, opts) => {
            if (rewritten > 0) {
              onConfigChange?.({ rewritten })
              onStatus?.(`已更新配置中 ${rewritten} 处路径引用`)
            }
            if (opts?.refresh !== false) await render(true)
          },
        })
      })
      const copyBtn = document.createElement('button')
      copyBtn.type = 'button'
      copyBtn.className = 'btn btn-sm'
      copyBtn.textContent = '复制'
      copyBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        copyPath(item.path)
      })
      actions.append(detailBtn, copyBtn)

      if (deletable) {
        const delBtn = document.createElement('button')
        delBtn.type = 'button'
        delBtn.className = 'btn btn-sm btn-danger'
        delBtn.textContent = '删除'
        delBtn.addEventListener('click', async (e) => {
          e.stopPropagation()
          const ok = await openConfirmModal({
            title: '删除素材库文件',
            message: published
              ? `删除「${item.name}」仅移除素材库副本。\n官网已发布文件不受影响。确定？`
              : `确定删除素材库文件「${item.name}」？`,
            danger: true,
            confirmText: '删除',
          })
          if (!ok) {
            onStatus?.('已取消删除')
            return
          }
          try {
            await deleteUploadedImage(item.path)
            selectedPaths.delete(pathKey)
            onStatus?.('已从素材库删除')
            await render(true)
          } catch (err) {
            onStatus?.(err.message || '删除失败', false)
          }
        })
        actions.appendChild(delBtn)
      }
      card.appendChild(actions)
      card.addEventListener('click', (e) => {
        if (e.target === check) return
        openMediaDetailModal(item, {
          getConfig,
          onStatus,
          usageIndex: usage,
          findAlternate: (p) => findSameNameAlternate(lib, p),
          onChanged: async (rewritten, opts) => {
            if (rewritten > 0) {
              onConfigChange?.({ rewritten })
              onStatus?.(`已更新配置中 ${rewritten} 处路径引用`)
            }
            if (opts?.refresh !== false) await render(true)
          },
        })
      })
      grid.appendChild(card)
    })
    box.appendChild(grid)
  }

  async function render(force = false) {
    box.innerHTML = '<div class="content-list-empty">加载中…</div>'
    try {
      lib = await fetchMediaLibrary(force)
      paintGrid()
      const total =
        (lib.brands?.length || 0) +
        (lib.icons?.length || 0) +
        (lib.home?.length || 0) +
        (lib.site?.length || 0) +
        (lib.uploads?.length || 0) +
        (lib.videos?.length || 0)
      if (!total) onStatus?.('素材库为空：请运行 npm run media:migrate 或点「上传」', false)
    } catch (err) {
      box.innerHTML = `<div class="content-list-empty">${err.message || '加载失败'}<br/><button type="button" class="btn btn-sm" data-retry>重试</button></div>`
      box.querySelector('[data-retry]')?.addEventListener('click', () => render(true))
      onStatus?.(err.message || '素材库加载失败', false)
    }
  }

  render(true)
  return wrap
}
