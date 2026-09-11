import { brToNewlines } from '../config.js'
import { createImageField, createMultiImageField, createVideoField, openMediaPicker, publishMediaToSite } from './media.js'
import { isCustomIconRef } from '../what-icons.js'

function el(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text != null) node.textContent = text
  return node
}

function wrapField(label, hint) {
  const wrap = el('div', 'field')
  if (label) {
    const lab = el('label', 'field-label', label)
    wrap.appendChild(lab)
  }
  if (hint) wrap.appendChild(el('p', 'field-hint', hint))
  return wrap
}

function exec(cmd, value = null) {
  document.execCommand(cmd, false, value)
}

/** 轻量富文本：加粗 / 斜体 / 链接 / 列表 */
export function createRichTextField({ label, value = '', hint, onChange, placeholder = '在此输入内容…' } = {}) {
  const wrap = wrapField(label, hint || '支持加粗、链接与列表；适合正文与带格式的介绍')
  wrap.classList.add('field-richtext')

  const shell = el('div', 'richtext')
  const toolbar = el('div', 'richtext-toolbar')
  const tools = [
    { cmd: 'bold', title: '加粗', label: 'B', className: 'is-bold' },
    { cmd: 'italic', title: '斜体', label: 'I', className: 'is-italic' },
    { cmd: 'underline', title: '下划线', label: 'U', className: 'is-underline' },
    { cmd: 'insertUnorderedList', title: '无序列表', label: '• 列表' },
    { cmd: 'insertOrderedList', title: '有序列表', label: '1. 列表' },
    { cmd: 'createLink', title: '插入链接', label: '链接', action: 'link' },
    { cmd: 'unlink', title: '移除链接', label: '去链' },
    { cmd: 'removeFormat', title: '清除格式', label: '清除' },
  ]

  const editor = el('div', 'richtext-editor')
  editor.contentEditable = 'true'
  editor.setAttribute('role', 'textbox')
  editor.setAttribute('aria-multiline', 'true')
  editor.dataset.placeholder = placeholder
  editor.innerHTML = (() => {
    const s = String(value || '')
    if (!s) return ''
    if (/<[a-z][\s\S]*>/i.test(s)) return s
    return brToNewlines(s).replace(/\n/g, '<br>')
  })()

  const emit = () => {
    const html = editor.innerHTML.trim()
    const empty = html === '' || html === '<br>' || html === '<div><br></div>'
    onChange?.(empty ? '' : editor.innerHTML)
  }

  tools.forEach((t) => {
    const btn = el('button', `richtext-btn ${t.className || ''}`)
    btn.type = 'button'
    btn.title = t.title
    btn.textContent = t.label
    btn.addEventListener('mousedown', (e) => e.preventDefault())
    btn.addEventListener('click', () => {
      editor.focus()
      if (t.action === 'link') {
        const url = window.prompt('链接地址（https:// 或 /path）', 'https://')
        if (url) exec('createLink', url.trim())
      } else {
        exec(t.cmd)
      }
      emit()
    })
    toolbar.appendChild(btn)
  })

  editor.addEventListener('input', emit)
  editor.addEventListener('paste', (e) => {
    e.preventDefault()
    const text = e.clipboardData?.getData('text/plain') || ''
    exec('insertText', text)
  })

  shell.append(toolbar, editor)
  wrap.appendChild(shell)
  return wrap
}

export function createTextareaControl({ label, value = '', hint, rows = 4, placeholder, onChange } = {}) {
  const wrap = wrapField(label, hint)
  wrap.classList.add('field-textarea')
  const input = document.createElement('textarea')
  input.rows = rows
  input.value = brToNewlines(value ?? '')
  if (placeholder) input.placeholder = placeholder
  input.addEventListener('input', () => onChange?.(input.value))
  wrap.appendChild(input)
  return wrap
}

export function createTextControl({ label, value = '', hint, type = 'text', placeholder, onChange } = {}) {
  const wrap = wrapField(label, hint)
  wrap.classList.add('field-text')
  if (type === 'color') {
    wrap.classList.add('field-color')
    const row = el('div', 'field-color-row')
    const picker = document.createElement('input')
    picker.type = 'color'
    const text = document.createElement('input')
    text.type = 'text'
    text.className = 'is-mono'
    text.placeholder = placeholder || '#101214'
    const toPicker = (hex) => {
      const v = String(hex || '').trim()
      if (/^#[0-9a-fA-F]{6}$/.test(v)) return v
      if (/^#[0-9a-fA-F]{3}$/.test(v)) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`
      return '#101214'
    }
    picker.value = toPicker(value)
    text.value = String(value || '')
    picker.addEventListener('input', () => {
      text.value = picker.value
      onChange?.(picker.value)
    })
    text.addEventListener('input', () => {
      const v = text.value.trim()
      if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)) picker.value = toPicker(v)
      onChange?.(v)
    })
    row.append(picker, text)
    wrap.appendChild(row)
    return wrap
  }
  const input = document.createElement('input')
  input.type = type === 'number' ? 'number' : type === 'url' ? 'url' : type === 'tel' ? 'tel' : 'text'
  if (type === 'url' || type === 'path') input.classList.add('is-mono')
  input.value = value ?? ''
  if (placeholder) input.placeholder = placeholder
  // 中文 IME：组合过程中的拼音（如 g → 公司）不要写进配置
  let composing = false
  input.addEventListener('compositionstart', () => {
    composing = true
  })
  input.addEventListener('compositionend', () => {
    composing = false
    onChange?.(type === 'number' ? Number(input.value) : input.value)
  })
  input.addEventListener('input', () => {
    if (composing) return
    onChange?.(type === 'number' ? Number(input.value) : input.value)
  })
  wrap.appendChild(input)
  return wrap
}

export function createParagraphsControl({ label, value = [], hint, onChange } = {}) {
  const text = Array.isArray(value) ? value.join('\n\n') : brToNewlines(value ?? '')
  return createTextareaControl({
    label,
    value: text,
    rows: 6,
    hint: hint || '每段之间空一行；保存为段落列表',
    placeholder: '第一段\n\n第二段',
    onChange: (raw) => {
      const parts = String(raw)
        .split(/\n\s*\n/)
        .map((s) => s.trim())
        .filter(Boolean)
      onChange?.(parts)
    },
  })
}

export function createLinesControl({ label, value = [], hint, onChange } = {}) {
  const text = Array.isArray(value) ? value.join('\n') : brToNewlines(value ?? '')
  return createTextareaControl({
    label,
    value: text,
    rows: 4,
    hint: hint || '每行一条',
    placeholder: '一行一项',
    onChange: (raw) => {
      const parts = String(raw)
        .split(/\n/)
        .map((s) => s.trim())
        .filter(Boolean)
      onChange?.(parts)
    },
  })
}

export function createIconPicker({ label, value = '', hint, options = [], onChange, onStatus } = {}) {
  const wrap = wrapField(label, hint || '内置图标或从素材库选择自定义图标（PNG/SVG）')
  wrap.classList.add('field-icon-picker')

  let current = String(value || '')

  const customBar = el('div', 'icon-picker-custom')
  const customPreview = el('div', 'icon-picker-custom-preview')
  const customMeta = el('div', 'icon-picker-custom-meta')
  const customActions = el('div', 'icon-picker-custom-actions')

  const pickMediaBtn = el('button', 'btn btn-sm btn-primary', '从素材库选择')
  pickMediaBtn.type = 'button'
  pickMediaBtn.addEventListener('click', async () => {
    try {
      const picked = await openMediaPicker({ multiple: false, kind: 'icon' })
      if (!picked) {
        onStatus?.('未选择图标')
        return
      }
      const sitePath = await publishMediaToSite(picked)
      current = sitePath
      onChange?.(sitePath)
      render()
      onStatus?.('已选用自定义图标')
    } catch (err) {
      onStatus?.(err.message || '选用失败', false)
    }
  })

  const clearCustomBtn = el('button', 'btn btn-sm', '恢复内置图标')
  clearCustomBtn.type = 'button'
  clearCustomBtn.addEventListener('click', () => {
    if (!isCustomIconRef(current)) return
    current = options[0]?.id || ''
    onChange?.(current)
    render()
    onStatus?.('已恢复内置图标')
  })

  customActions.append(pickMediaBtn, clearCustomBtn)
  customBar.append(customPreview, customMeta, customActions)
  wrap.appendChild(customBar)

  const builtInLab = el('p', 'field-hint icon-picker-builtin-label', '内置图标库')
  wrap.appendChild(builtInLab)

  const grid = el('div', 'icon-picker-grid')
  grid.setAttribute('role', 'listbox')
  grid.setAttribute('aria-label', label || '选择图标')

  const render = () => {
    const isCustom = isCustomIconRef(current)
    customPreview.innerHTML = ''
    customMeta.innerHTML = ''
    if (isCustom) {
      const img = document.createElement('img')
      img.src = current
      img.alt = ''
      customPreview.appendChild(img)
      customMeta.textContent = '当前：自定义图标'
      clearCustomBtn.disabled = false
      customBar.classList.add('is-active')
    } else {
      customMeta.textContent = '未使用自定义图标'
      clearCustomBtn.disabled = true
      customBar.classList.remove('is-active')
    }

    grid.innerHTML = ''
    options.forEach((opt) => {
      const active = !isCustom && opt.id === current
      const btn = el('button', `icon-picker-item${active ? ' is-active' : ''}`)
      btn.type = 'button'
      btn.setAttribute('role', 'option')
      btn.setAttribute('aria-selected', String(active))
      btn.title = opt.label || opt.id
      btn.dataset.id = opt.id
      btn.innerHTML = `<span class="icon-picker-glyph">${opt.svg || ''}</span><span class="icon-picker-name">${opt.label || opt.id}</span>`
      btn.addEventListener('click', () => {
        current = opt.id
        onChange?.(opt.id)
        render()
      })
      grid.appendChild(btn)
    })
  }

  render()
  wrap.appendChild(grid)
  return wrap
}

/**
 * 统一表单控件
 * type: text | textarea | richtext | paragraphs | number | url | path | tel | color | image | video | images | icon
 */
export function createControl(spec) {
  const {
    label,
    value,
    type = 'text',
    hint,
    rows,
    placeholder,
    onChange,
    onStatus,
    options,
  } = spec

  if (type === 'icon') {
    return createIconPicker({
      label,
      value,
      hint,
      options: Array.isArray(options) ? options : [],
      onChange,
      onStatus,
    })
  }
  if (type === 'image') {
    return createImageField({ label, value: value || '', onChange, onStatus })
  }
  if (type === 'video') {
    return createVideoField({ label, value: value || '', onChange, onStatus })
  }
  if (type === 'images') {
    return createMultiImageField({
      label,
      values: Array.isArray(value) ? value : [],
      onChange,
      onStatus,
    })
  }
  if (type === 'richtext') {
    return createRichTextField({ label, value, hint, placeholder, onChange })
  }
  if (type === 'paragraphs') {
    return createParagraphsControl({ label, value, hint, onChange })
  }
  if (type === 'lines') {
    return createLinesControl({ label, value, hint, onChange })
  }
  if (type === 'textarea') {
    return createTextareaControl({ label, value, hint, rows: rows || 4, placeholder, onChange })
  }
  if (type === 'color') {
    return createTextControl({ label, value, hint, type: 'color', placeholder, onChange })
  }
  if (type === 'path') {
    return createTextControl({
      label,
      value,
      hint,
      type: 'path',
      placeholder: placeholder || '/path 或 https://…',
      onChange,
    })
  }
  return createTextControl({
    label,
    value,
    hint,
    type,
    placeholder,
    onChange,
  })
}
