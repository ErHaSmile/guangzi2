/**
 * 服务能力卡片图标库（SVG，currentColor）
 * id 写入 pages.home.whatItems[].icon
 */

const fill = (d, viewBox = '0 0 24 24') =>
  `<svg viewBox="${viewBox}" aria-hidden="true"><path fill="currentColor" d="${d}"/></svg>`

/** @type {{ id: string, label: string, svg: string }[]} */
export const WHAT_ICON_CATALOG = [
  {
    id: 'pencil',
    label: '铅笔',
    svg: fill(
      'M232 76.7L179.3 24a16.1 16.1 0 0 0-22.6 0L90.3 90.3l-36 36L24 156.7a15.9 15.9 0 0 0 0 22.6L76.7 232a15.9 15.9 0 0 0 22.6 0L232 99.3a15.9 15.9 0 0 0 0-22.6ZM220.7 88L88 220.7L35.3 168L60 143.3l26.3 26.4a8.2 8.2 0 0 0 11.4 0a8.1 8.1 0 0 0 0-11.4L71.3 132L96 107.3l26.3 26.4a8.2 8.2 0 0 0 11.4 0a8.1 8.1 0 0 0 0-11.4L107.3 96L132 71.3l26.3 26.4a8.2 8.2 0 0 0 11.4 0a8.1 8.1 0 0 0 0-11.4L143.3 60L168 35.3L220.7 88Z',
      '0 0 256 256'
    ),
  },
  {
    id: 'doc',
    label: '文档',
    svg: fill(
      'm212.2 83.8l-56-56A5.6 5.6 0 0 0 152 26H56a14 14 0 0 0-14 14v176a14 14 0 0 0 14 14h144a14 14 0 0 0 14-14V88a5.6 5.6 0 0 0-1.8-4.2ZM158 46.5L193.5 82H158ZM200 218H56a2 2 0 0 1-2-2V40a2 2 0 0 1 2-2h90v50a6 6 0 0 0 6 6h50v122a2 2 0 0 1-2 2Z',
      '0 0 256 256'
    ),
  },
  {
    id: 'hex',
    label: '六边形',
    svg: fill('M12 2L2 7.5V16.5L12 22l10-5.5V7.5L12 2zm0 2.2l7.5 4.1v7.4L12 19.8l-7.5-4.1V8.3L12 4.2z'),
  },
  {
    id: 'list',
    label: '列表',
    svg: fill('M4 4h16v2H4V4zm0 4h10v2H4V8zm0 4h16v2H4v-2zm0 4h10v2H4v-2z'),
  },
  {
    id: 'image',
    label: '图片',
    svg: fill(
      'M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Zm0 16H5V5h14v14ZM8.5 11.5A1.5 1.5 0 1 0 7 10a1.5 1.5 0 0 0 1.5 1.5ZM19 17l-4.5-6-3.5 4.5-2-2.5L5 17h14Z'
    ),
  },
  {
    id: 'cart',
    label: '购物车',
    svg: fill(
      'M7 18a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm10 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM3 4h2l3.6 7.59-1.35 2.44A2 2 0 0 0 9 17h10v-2H9.42a.25.25 0 0 1-.23-.15L9.6 14h7.45a2 2 0 0 0 1.9-1.37L21 6H6.21l-.94-2H3v2z'
    ),
  },
  {
    id: 'check-doc',
    label: '勾选文档',
    svg: fill(
      'M10 4a2 2 0 0 0-2 2v20a2 2 0 0 0 2 2h4v-2h-4V6h12v9h2V6a2 2 0 0 0-2-2H10zm0 2v2h12V6H10zm10 17.18-2.59-2.59L16 22l4 4 8-8-1.41-1.41L20 23.18z',
      '0 0 32 32'
    ),
  },
  {
    id: 'film',
    label: '胶片',
    svg: fill(
      'M18 3H6a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3ZM7 5h2v2H7V5Zm0 4h2v2H7V9Zm0 4h2v2H7v-2Zm0 4h2v2H7v-2Zm10 2h-2v-2h2v2Zm0-4h-2v-2h2v2Zm0-4h-2V9h2v2Zm0-4h-2V5h2v2ZM9 7h6v10H9V7Z'
    ),
  },
  {
    id: 'clapboard',
    label: '场记板',
    svg: fill(
      'M20 4H9.83l1.58-1.59A1 1 0 0 0 10.7 1H4a1 1 0 0 0-.7.29L1.29 3.7A1 1 0 0 0 1 4.41V20a2 2 0 0 0 2 2h17a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2ZM4.41 3H9.6L8.3 4.29A1 1 0 0 1 7.59 4.5H3.41L4.41 3ZM20 20H3V6h4.59l5.7-5.71L15.41 6H20v14Z'
    ),
  },
  {
    id: 'camera',
    label: '相机',
    svg: fill(
      'M20 5h-2.6l-1.7-2.3A2 2 0 0 0 14.1 2H9.9a2 2 0 0 0-1.6.7L6.6 5H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm0 14H4V7h3.4l1.8-2.4h5.6L16.6 7H20v12Zm-8-2.5A4.5 4.5 0 1 0 7.5 12 4.5 4.5 0 0 0 12 16.5Zm0-7A2.5 2.5 0 1 1 9.5 12 2.5 2.5 0 0 1 12 9.5Z'
    ),
  },
  {
    id: 'megaphone',
    label: '喇叭',
    svg: fill(
      'M21 6.5a1.5 1.5 0 0 0-1.5-1.5H15l-5.2-3.12A2 2 0 0 0 6.7 3.6v16.8a2 2 0 0 0 3.1 1.72L15 19h4.5A1.5 1.5 0 0 0 21 17.5v-11ZM8.7 5.4 13 8h5v8h-5l-4.3 2.6V5.4ZM5 9H3v6h2V9Zm-4 2v2h2v-2H1Z'
    ),
  },
  {
    id: 'palette',
    label: '调色盘',
    svg: fill(
      'M12 2a10 10 0 0 0-1 19.95 1.5 1.5 0 0 0 1.45-1.86 2.5 2.5 0 0 1 2.4-3.09H16a4 4 0 0 0 0-8h-.5a1.5 1.5 0 0 1 0-3H16A7 7 0 1 1 9 19.1 8 8 0 1 0 12 4a1 1 0 0 0 0-2Zm-4.5 7.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm3-4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm2.5 4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z'
    ),
  },
  {
    id: 'brush',
    label: '画笔',
    svg: fill(
      'M20.71 4.63a1 1 0 0 0-1.42 0l-3.34 3.34-1.41-1.41 3.34-3.34a1 1 0 0 0 0-1.42 3 3 0 0 0-4.24 0L7.76 7.76a1 1 0 0 0 0 1.41l6.07 6.07a1 1 0 0 0 1.41 0l5.47-5.47a3 3 0 0 0 0-4.14ZM12.83 13.83 8.17 9.17l4.95-4.95 1.41 1.41-2.12 2.12 1.41 1.41 2.12-2.12 1.41 1.41-4.52 4.53ZM7 14.5c-2 0-4 1.5-4 3.5S4.5 22 7 22s4-1.79 4-4c0-1.5-1.5-2-2.5-2.5S7 15 7 14.5Z'
    ),
  },
  {
    id: 'layers',
    label: '图层',
    svg: fill(
      'm12 2 10 5.5v1.1L12 14 2 8.6V7.5L12 2Zm0 14.2 8.5-4.7.5.3v1.1L12 18.2 3 12.9v-1.1l.5-.3L12 16.2Zm0 3.8 8.5-4.7.5.3v1.1L12 22 3 16.7v-1.1l.5-.3L12 20Z'
    ),
  },
  {
    id: 'layout',
    label: '版式',
    svg: fill(
      'M3 3h8v8H3V3Zm10 0h8v5h-8V3ZM3 13h5v8H3v-8Zm7 0h11v8H10v-8Z'
    ),
  },
  {
    id: 'chart',
    label: '图表',
    svg: fill('M3 3h2v18H3V3Zm4 10h2v8H7v-8Zm4-6h2v14h-2V7Zm4 4h2v10h-2V11Zm4-8h2v18h-2V3Z'),
  },
  {
    id: 'users',
    label: '人群',
    svg: fill(
      'M16 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-8 0a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-2.67 0-8 1.34-8 4v2h10v-2c0-1.36.62-2.5 1.66-3.37A13.1 13.1 0 0 0 8 13Zm8 0c-.29 0-.62.02-.97.05A4.84 4.84 0 0 1 17 17v2h7v-2c0-2.66-5.33-4-8-4Z'
    ),
  },
  {
    id: 'calendar',
    label: '日历',
    svg: fill(
      'M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 16H5V10h14v10Zm0-12H5V6h14v2Z'
    ),
  },
  {
    id: 'map-pin',
    label: '定位',
    svg: fill(
      'M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 14.5 9 2.5 2.5 0 0 1 12 11.5Z'
    ),
  },
  {
    id: 'sparkles',
    label: '星光',
    svg: fill(
      'M11 2 9.5 7.5 4 9l5.5 1.5L11 16l1.5-5.5L18 9l-5.5-1.5L11 2Zm7 9-1 3.5L13.5 15 17 16l1 3.5L19 16l3.5-1L19 14.5 18 11Zm-12 3-.7 2.3L3 17l2.3.7L6 20l.7-2.3L9 17l-2.3-.7L6 14Z'
    ),
  },
  {
    id: 'play',
    label: '播放',
    svg: fill('M8 5.14v14l11-7-11-7Z'),
  },
  {
    id: 'mic',
    label: '麦克风',
    svg: fill(
      'M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a1 1 0 0 0-2 0 3 3 0 0 1-6 0 1 1 0 0 0-2 0 5 5 0 0 0 4 4.9V19H9a1 1 0 0 0 0 2h6a1 1 0 0 0 0-2h-2v-3.1A5 5 0 0 0 17 11Z'
    ),
  },
  {
    id: 'monitor',
    label: '显示器',
    svg: fill(
      'M20 3H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h6v2H8a1 1 0 0 0 0 2h8a1 1 0 0 0 0-2h-2v-2h6a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Zm0 12H4V5h16v10Z'
    ),
  },
  {
    id: 'package',
    label: '包裹',
    svg: fill(
      'm21.6 7.7-9-5a1 1 0 0 0-1.2 0l-9 5A1 1 0 0 0 2 8.5v7a1 1 0 0 0 .4.8l9 5a1 1 0 0 0 1.2 0l9-5a1 1 0 0 0 .4-.8v-7a1 1 0 0 0-.4-.8ZM12 4.2 18.9 8 12 11.8 5.1 8 12 4.2ZM4 9.7l7 3.9v6.5l-7-3.9V9.7Zm9 10.4v-6.5l7-3.9v6.5l-7 3.9Z'
    ),
  },
  {
    id: 'target',
    label: '靶心',
    svg: fill(
      'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8Zm0-14a6 6 0 1 0 6 6 6 6 0 0 0-6-6Zm0 10a4 4 0 1 1 4-4 4 4 0 0 1-4 4Zm0-6a2 2 0 1 0 2 2 2 2 0 0 0-2-2Z'
    ),
  },
  {
    id: 'zap',
    label: '闪电',
    svg: fill('M13 2 4 14h7l-1 8 10-14h-7l0-6Z'),
  },
  {
    id: 'globe',
    label: '地球',
    svg: fill(
      'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm7.9 9h-3.2a15.4 15.4 0 0 0-1.3-5 8 8 0 0 1 4.5 5ZM12 4c.9 0 2.3 2.1 3.1 5H8.9C9.7 6.1 11.1 4 12 4ZM4.1 13h3.2a15.4 15.4 0 0 0 1.3 5 8 8 0 0 1-4.5-5Zm3.2-2H4.1a8 8 0 0 1 4.5-5 15.4 15.4 0 0 0-1.3 5Zm.6 2h8.2c-.8 2.9-2.2 5-4.1 5s-3.3-2.1-4.1-5Zm8.2-2h-8.2c.8-2.9 2.2-5 4.1-5s3.3 2.1 4.1 5Zm.6 2h3.2a8 8 0 0 1-4.5 5 15.4 15.4 0 0 0 1.3-5Z'
    ),
  },
  {
    id: 'message',
    label: '对话',
    svg: fill(
      'M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2Zm0 14H5.2L4 17.2V4h16v12Z'
    ),
  },
  {
    id: 'star',
    label: '星星',
    svg: fill(
      'm12 2 2.9 6.3L22 9.3l-5 4.9 1.2 7L12 17.8 5.8 21.2 7 14.2 2 9.3l7.1-1L12 2Z'
    ),
  },
  {
    id: 'heart',
    label: '心形',
    svg: fill(
      'M12 21.35 10.55 20C5.4 15.36 2 12.28 2 8.5A4.5 4.5 0 0 1 6.5 4 5.3 5.3 0 0 1 12 6.09 5.3 5.3 0 0 1 17.5 4 4.5 4.5 0 0 1 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35Z'
    ),
  },
  {
    id: 'coffee',
    label: '咖啡',
    svg: fill(
      'M18 8h2a3 3 0 0 1 0 6h-2v2a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2Zm0 4h2a1 1 0 0 0 0-2h-2v2ZM6 6v10a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V6H6Zm1 16h10v2H7v-2Z'
    ),
  },
]

const byId = new Map(WHAT_ICON_CATALOG.map((i) => [i.id, i]))

/** 与历史硬编码顺序对齐的默认图标 */
export const DEFAULT_WHAT_ICON_IDS = [
  'pencil',
  'doc',
  'hex',
  'list',
  'image',
  'cart',
  'check-doc',
]

export function getWhatIconById(id) {
  return byId.get(String(id || '')) || null
}

/** 配置中存的是图片路径（/site-media/icons/...）而非内置 id */
export function isCustomIconRef(ref) {
  const s = String(ref || '').trim()
  return s.startsWith('/') && /\.(png|jpe?g|gif|webp|svg|ico)(\?|#|$)/i.test(s)
}

function escapeIconAttr(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
}

export function resolveWhatIconSvg(iconId, fallbackIndex = 0) {
  if (isCustomIconRef(iconId)) {
    return `<img src="${escapeIconAttr(iconId)}" alt="" class="what-custom-icon" loading="lazy" />`
  }
  const hit = getWhatIconById(iconId)
  if (hit) return hit.svg
  const fallbackId = DEFAULT_WHAT_ICON_IDS[fallbackIndex % DEFAULT_WHAT_ICON_IDS.length]
  return getWhatIconById(fallbackId)?.svg || WHAT_ICON_CATALOG[0].svg
}

export function listWhatIconOptions() {
  return WHAT_ICON_CATALOG.map(({ id, label, svg: svgHtml }) => ({ id, label, svg: svgHtml }))
}
