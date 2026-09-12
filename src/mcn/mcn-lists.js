/**
 * MCN 首页列表数据：种子 / 渲染 / 详情查找
 * 本版只维护业务数据，不做样式布局配置。
 */

function resolveAsset(path) {
  if (path == null || path === '') return path
  return String(path)
}

const CHECK_SVG =
  '<svg class="check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
const ARROW_SVG =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>'

const SERVICE_ICONS = {
  users:
    '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  star: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>',
  monitor:
    '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
  video:
    '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>',
  bag: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
  chart:
    '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function slugify(title, index = 0) {
  const base = String(title || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u4e00-\u9fff-]+/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return base || `item-${index + 1}`
}

export function getMcnItemId(item, index = 0) {
  if (!item) return `item-${index + 1}`
  if (item.id) return String(item.id)
  return slugify(item.title || item.name, index)
}

function linesOf(value) {
  if (Array.isArray(value)) return value.map((x) => String(x || '').trim()).filter(Boolean)
  return String(value || '')
    .split(/\n|\|\|/)
    .map((x) => x.trim())
    .filter(Boolean)
}

function normalizeMetrics(item) {
  if (item && typeof item === 'object' && !Array.isArray(item)) {
    const fromLines = linesOf(item.metricsLines)
    if (fromLines.length) {
      return fromLines.map((line) => {
        const [value, label] = String(line).split('|')
        return { value: (value || '').trim(), label: (label || '').trim() }
      })
    }
    if (Array.isArray(item.metrics) && item.metrics.length) {
      return item.metrics.map((m) => ({
        value: m.value || m.v || '',
        label: m.label || m.l || '',
      }))
    }
    return []
  }
  if (Array.isArray(item) && item.length && (item[0]?.value != null || item[0]?.v != null || item[0]?.label != null)) {
    return item.map((m) => ({
      value: m.value || m.v || '',
      label: m.label || m.l || '',
    }))
  }
  return linesOf(item).map((line) => {
    const [value, label] = String(line).split('|')
    return { value: (value || '').trim(), label: (label || '').trim() }
  })
}

function metricsHtml(itemOrMetrics, cls = 'metric') {
  const list = normalizeMetrics(itemOrMetrics)
  return list
    .map(
      (m) =>
        `<div class="${cls}"><div class="v">${escapeHtml(m.value || '')}</div><div class="l">${escapeHtml(m.label || '')}</div></div>`
    )
    .join('')
}

/** —— Hero / 数据 / 关于 / 页脚 / 表单 默认种子 —— */
export const DEFAULT_MCN_HERO_STATS = [
  { num: '58', unit: '亿+', label: '累计GMV' },
  { num: '1200', unit: '+', label: '外部合作达人' },
  { num: '86', unit: '位', label: '自有签约主播' },
  { num: '300', unit: '+', label: '服务品牌客户' },
]

export const DEFAULT_MCN_DATA_KPIS = [
  { label: '年度总GMV', value: '58.2', unit: '亿元', trend: '↑ 42.6% YOY' },
  { label: '本月GMV', value: '4.8', unit: '亿元', trend: '↑ 12.3% MOM' },
  { label: '直播场次', value: '268', unit: '场', trend: '↑ 18.5% MOM' },
  { label: '平均转化率', value: '13.6', unit: '%', trend: '↑ 2.1% MOM' },
]

export const DEFAULT_MCN_ABOUT_STATS = [
  { num: '150', unit: '+', label: '专业团队成员' },
  { num: '4', unit: '大', label: '主流平台合作' },
  { num: '6', unit: '大', label: '核心服务能力' },
]

export const DEFAULT_MCN_FOOTER_COLUMNS = [
  {
    title: '核心服务',
    linksLines: [
      '达人商务对接|#services',
      '自有主播矩阵|#talents',
      '直播代运营|#live',
      '短视频种草|#cases',
      '选品供应链|#services',
      '数据复盘优化|#data',
    ],
  },
  {
    title: '关于我们',
    linksLines: [
      '公司简介|#about',
      '达人资源|#talents',
      '成功案例|#cases',
      '数据看板|#data',
      '联系我们|#contact',
    ],
  },
  {
    title: '联系方式',
    linksLines: [
      '400-888-6666|#contact',
      'business@guangzi-media.com|#contact',
      '杭州市余杭区未来科技城|#contact',
    ],
  },
]

export const DEFAULT_MCN_FOOTER_KEYWORDS = ['达人对接', '直播带货', 'MCN机构', '品牌增长']

export const DEFAULT_MCN_CATEGORY_OPTIONS = [
  '美妆护肤',
  '服饰穿搭',
  '美食食品',
  '3C数码',
  '家居生活',
  '母婴亲子',
  '其他',
]

export const DEFAULT_MCN_SERVICE_OPTIONS = [
  '达人商务对接',
  '自有主播合作',
  '直播代运营',
  '短视频内容种草',
  '选品与供应链',
  '全案合作',
]

export const DEFAULT_MCN_DATA_CHARTS = {
  trend: {
    title: '月度销售趋势',
    subtitle: '2025年1月 - 8月 GMV走势（单位：亿元）',
    categories: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月'],
    seriesCurrent: [3.2, 2.8, 4.1, 4.5, 5.2, 6.8, 5.6, 4.8],
    seriesLast: [2.1, 1.9, 2.8, 3.0, 3.5, 4.6, 3.9, 3.3],
    legendCurrent: 'GMV',
    legendLast: '去年同期',
  },
  pie: {
    title: '品类销售占比',
    subtitle: '2025年累计各品类GMV占比',
    itemsLines: ['美妆护肤|18.2', '服饰穿搭|14.5', '美食食品|10.8', '3C数码|8.6', '家居生活|6.1'],
  },
  bar: {
    title: '各平台渠道GMV对比',
    subtitle: '2025年1-8月各平台累计GMV（单位：亿元）',
    categories: ['抖音', '快手', '淘宝直播', '小红书'],
    gmv: [24.6, 15.2, 11.8, 6.6],
    sessions: [980, 620, 450, 320],
    legendGmv: 'GMV(亿元)',
    legendSessions: '直播场次',
  },
  growth: {
    title: '月度同比增长率',
    subtitle: '2025年各月GMV同比增速',
    categories: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月'],
    rates: [52.4, 47.3, 46.2, 50.8, 48.6, 47.8, 43.5, 45.2],
  },
}

export const DEFAULT_MCN_HOME_SCALARS = {
  heroCtaPrimary: '立即对接',
  heroCtaSecondary: '了解服务',
  aboutImage: '/mcn/images/aadkueyw27ofu_ve_miaoda-124bb9e0.png',
  aboutFloatNum: '5年+',
  aboutFloatLabel: '深耕直播电商',
  aboutText:
    '<p>光子文化成立于2019年，总部位于杭州，是国内领先的以"达人BD + 自有主播"双轮驱动的MCN机构。我们深耕直播电商领域五年，构建了覆盖抖音、快手、淘宝、小红书等全平台的达人资源网络，同时签约孵化了86位自有主播。</p><p>公司拥有专业的选品团队、内容策划团队、直播运营团队和数据分析团队，为品牌提供从达人筛选、内容策划、直播执行到数据复盘的全链路服务。凭借专业的服务能力和丰富的行业资源，我们已帮助众多国内外知名品牌实现直播电商渠道的突破性增长。</p>',
  contactTelLabel: '商务合作热线',
  contactEmailLabel: '商务邮箱',
  contactAddressLabel: '公司地址',
  contactFormTitle: '合作咨询',
  contactSubmitText: '提交咨询',
  contactNameLabel: '您的姓名 *',
  contactPhoneLabel: '联系电话 *',
  contactCompanyLabel: '公司名称',
  contactCategoryLabel: '主营品类',
  contactServiceLabel: '合作服务',
  contactMsgLabel: '合作需求描述',
  contactNamePlaceholder: '请输入您的姓名',
  contactPhonePlaceholder: '请输入您的手机号',
  contactCompanyPlaceholder: '请输入公司名称',
  contactMsgPlaceholder: '请描述您的合作需求、预算范围等信息...',
  contactCategoryPlaceholder: '请选择品类',
  contactServicePlaceholder: '请选择服务类型',
}

const NAV_CTA_SVG =
  '<svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>'

function parseLinkLines(lines) {
  return linesOf(lines).map((line) => {
    const idx = line.indexOf('|')
    if (idx < 0) return { label: line, href: '#' }
    return { label: line.slice(0, idx).trim(), href: line.slice(idx + 1).trim() || '#' }
  })
}

function parseNumLines(lines) {
  return linesOf(lines).map((x) => {
    const n = Number(String(x).trim())
    return Number.isFinite(n) ? n : 0
  })
}

function toLinesArray(value) {
  if (Array.isArray(value)) return value.map((x) => String(x ?? '').trim()).filter((x) => x !== '')
  return linesOf(value)
}

function ensureDataCharts(home) {
  if (!home.dataCharts || typeof home.dataCharts !== 'object') home.dataCharts = {}
  const seed = DEFAULT_MCN_DATA_CHARTS
  ;['trend', 'pie', 'bar', 'growth'].forEach((key) => {
    if (!home.dataCharts[key] || typeof home.dataCharts[key] !== 'object') {
      home.dataCharts[key] = JSON.parse(JSON.stringify(seed[key]))
      return
    }
    const cur = home.dataCharts[key]
    const def = seed[key]
    Object.keys(def).forEach((k) => {
      if (cur[k] == null || (Array.isArray(cur[k]) && !cur[k].length) || cur[k] === '') {
        cur[k] = Array.isArray(def[k]) ? [...def[k]] : def[k]
      }
    })
  })
  // normalize admin lines ↔ arrays
  const trend = home.dataCharts.trend
  if (trend.categoriesLines) trend.categories = toLinesArray(trend.categoriesLines)
  if (trend.seriesCurrentLines) trend.seriesCurrent = parseNumLines(trend.seriesCurrentLines)
  if (trend.seriesLastLines) trend.seriesLast = parseNumLines(trend.seriesLastLines)
  trend.categoriesLines = toLinesArray(trend.categories)
  trend.seriesCurrentLines = (trend.seriesCurrent || []).map(String)
  trend.seriesLastLines = (trend.seriesLast || []).map(String)

  const pie = home.dataCharts.pie
  if (!pie.itemsLines || !toLinesArray(pie.itemsLines).length) {
    if (Array.isArray(pie.items) && pie.items.length) {
      pie.itemsLines = pie.items.map((it) => `${it.name || ''}|${it.value ?? ''}`)
    } else {
      pie.itemsLines = [...seed.pie.itemsLines]
    }
  }

  const bar = home.dataCharts.bar
  if (bar.categoriesLines) bar.categories = toLinesArray(bar.categoriesLines)
  if (bar.gmvLines) bar.gmv = parseNumLines(bar.gmvLines)
  if (bar.sessionsLines) bar.sessions = parseNumLines(bar.sessionsLines)
  bar.categoriesLines = toLinesArray(bar.categories)
  bar.gmvLines = (bar.gmv || []).map(String)
  bar.sessionsLines = (bar.sessions || []).map(String)

  const growth = home.dataCharts.growth
  if (growth.categoriesLines) growth.categories = toLinesArray(growth.categoriesLines)
  if (growth.ratesLines) growth.rates = parseNumLines(growth.ratesLines)
  growth.categoriesLines = toLinesArray(growth.categories)
  growth.ratesLines = (growth.rates || []).map(String)
}

/** —— 默认种子（从参考页静态内容抽出） —— */
export const DEFAULT_MCN_SERVICE_ITEMS = [
  {
    id: 'bd',
    title: '达人商务对接',
    summary: '全平台各层级达人资源库，为品牌方精准匹配最优达人组合，提供从筛选沟通到落地执行的全链路BD服务。',
    icon: 'users',
    advantages: ['1200+ 外部达人资源', '智能匹配算法推荐', '全程商务谈判执行'],
  },
  {
    id: 'owned',
    title: '自有主播矩阵',
    summary: '公司签约孵化86位自有主播，覆盖美妆、服饰、食品、3C、家居等核心品类，为品牌提供稳定可控的直播带货能力。',
    icon: 'star',
    advantages: ['86位 签约孵化主播', '6大核心品类覆盖', '稳定档期可预约'],
  },
  {
    id: 'ops',
    title: '品牌直播代运营',
    summary: '从直播间搭建、脚本策划、主播输出到场控运营的一站式直播代运营服务，品牌方全程无忧。',
    icon: 'monitor',
    advantages: ['专业直播间搭建', '资深运营团队驻场', '全流程品控管理'],
  },
  {
    id: 'video',
    title: '短视频内容种草',
    summary: '短视频策划、拍摄、剪辑、投放全流程服务，为品牌打造多平台种草内容矩阵，实现品效合一。',
    icon: 'video',
    advantages: ['专业内容策划团队', '多平台内容分发', '精准投放优化'],
  },
  {
    id: 'supply',
    title: '选品与供应链',
    summary: '基于达人画像和直播数据的智能选品系统，对接优质供应链资源，为品牌和达人搭建高效的商品桥梁。',
    icon: 'bag',
    advantages: ['智能选品数据系统', '优质供应链对接', '品控质检保障'],
  },
  {
    id: 'data',
    title: '数据复盘与优化',
    summary: '每场直播、每条视频的全维度数据复盘，深度分析转化漏斗，提供可落地的优化建议与增长策略。',
    icon: 'chart',
    advantages: ['多维度数据报表', '转化漏斗分析', '迭代优化建议'],
  },
]

export const DEFAULT_MCN_TALENT_CATEGORIES = ['自有签约主播', '外部合作达人']

const IMG = {
  xiaoyu: '/mcn/images/aadkue22lsccw_ve_miaoda-d571f2a1.png',
  lily: '/mcn/images/aadkue4zzsajw_ve_miaoda-6c4ae319.png',
  home: '/mcn/images/aadkue5df3ycs_ve_miaoda-376b9d21.png',
  foodie: '/mcn/images/aadkue2qormhw_ve_miaoda-be7d9ea4.png',
  beauty: '/mcn/images/aadkuew4ld4fw_ve_miaoda-e668bda3.png',
  phone: '/mcn/images/aadkue4zmf2jw_ve_miaoda-5a2f1980.png',
  snack: '/mcn/images/aadkue5f7tyqu_ve_miaoda-f3e238f8.png',
  night: '/mcn/images/aadkue474ywas_ve_miaoda-1dcb517e.png',
  extra: '/mcn/images/aadkueyw27ofu_ve_miaoda-124bb9e0.png',
}

export const DEFAULT_MCN_TALENT_ITEMS = [
  {
    id: 'xiaoyu',
    name: '小雨同学',
    cat: '自有签约主播',
    badge: '自有主播',
    track: 'owned',
    platform: '抖音 · 美妆垂类 / 580万粉',
    avatar: IMG.xiaoyu,
    metrics: [
      { value: '580万', label: '粉丝数' },
      { value: '15.2%', label: '转化率' },
      { value: '860万', label: '场均GMV' },
    ],
    metricsLines: ['580万|粉丝数', '15.2%|转化率', '860万|场均GMV'],
    summary: '美妆垂类头部自有主播，擅长成分科普与场景种草，场均转化稳定，适合新品首发与大促节点。',
    body: '深耕美妆护肤赛道多年，短视频种草覆盖成分测评、早晚护肤流程与妆容示范；直播端以「讲解—试用—限时权益」节奏推动成交。可承接精华、面霜、彩妆套组等高客单品类，支持品牌专场与矩阵联播。',
    gallery: [IMG.xiaoyu, IMG.beauty, IMG.extra],
  },
  {
    id: 'lily',
    name: '穿搭女王Lily',
    cat: '自有签约主播',
    badge: '自有主播',
    track: 'owned',
    platform: '抖音 · 服饰垂类 / 420万粉',
    avatar: IMG.lily,
    metrics: [
      { value: '420万', label: '粉丝数' },
      { value: '11.8%', label: '转化率' },
      { value: '620万', label: '场均GMV' },
    ],
    metricsLines: ['420万|粉丝数', '11.8%|转化率', '620万|场均GMV'],
    summary: '服饰穿搭垂类自有主播，以 lookbook 与场景演绎带动连带购买，联名首发表现突出。',
    body: '擅长将季节主题、设计师联名与通勤/度假场景包装成可传播穿搭提案。短视频侧重多 look 混搭，直播侧重试穿对比与尺码建议，适合女装、配饰、鞋包等品类的矩阵投放与首发专场。',
    gallery: [IMG.lily, IMG.night, IMG.beauty],
  },
  {
    id: 'tech-max',
    name: '科技玩家Max',
    cat: '自有签约主播',
    badge: '自有主播',
    track: 'owned',
    platform: '抖音 · 3C数码 / 360万粉',
    avatar: IMG.phone,
    metrics: [
      { value: '360万', label: '粉丝数' },
      { value: '12.3%', label: '转化率' },
      { value: '1180万', label: '场均GMV' },
    ],
    metricsLines: ['360万|粉丝数', '12.3%|转化率', '1180万|场均GMV'],
    summary: '3C 数码垂类自有主播，开箱测评与参数对比专业度高，擅长推动高客单转化。',
    body: '内容覆盖旗舰手机、智能穿戴与数码配件。预热期输出对比测评与场景演示，直播期配合品牌专属券包与以旧换新权益，适合新品发布会专场与大促节点的高客单成交。',
    gallery: [IMG.phone, IMG.extra, IMG.night],
  },
  {
    id: 'home-life',
    name: '家居生活家',
    cat: '外部合作达人',
    badge: '合作达人',
    track: 'bd',
    platform: '小红书 · 家居垂类 / 280万粉',
    avatar: IMG.home,
    metrics: [
      { value: '280万', label: '粉丝数' },
      { value: '9.6%', label: '转化率' },
      { value: '380万', label: '场均GMV' },
    ],
    metricsLines: ['280万|粉丝数', '9.6%|转化率', '380万|场均GMV'],
    summary: '家居生活垂类外部达人，场景化陈列与种草笔记转化能力突出，适合长效内容投放。',
    body: '以真实居住场景为主，擅长收纳改造、软装搭配与日用好物清单。小红书笔记种草后可衔接淘宝/抖音直播转化，适合家居、日用、收纳、香氛等品类的持续合作。',
    gallery: [IMG.home, IMG.snack, IMG.extra],
  },
  {
    id: 'foodie',
    name: '吃货小当家',
    cat: '外部合作达人',
    badge: '合作达人',
    track: 'bd',
    platform: '快手 · 美食垂类 / 650万粉',
    avatar: IMG.foodie,
    metrics: [
      { value: '650万', label: '粉丝数' },
      { value: '18.5%', label: '转化率' },
      { value: '980万', label: '场均GMV' },
    ],
    metricsLines: ['650万|粉丝数', '18.5%|转化率', '980万|场均GMV'],
    summary: '美食垂类高互动达人，试吃玩法与限时福利拉升转化显著，大场爆发力强。',
    body: '擅长快节奏互动、组合满减与主题节庆包装。可承接零食、速食、饮料、地方特产等品类，适合品牌盛典夜、零食节与平台大促的集中爆发。',
    gallery: [IMG.foodie, IMG.snack, IMG.beauty],
  },
  {
    id: 'style-nova',
    name: '潮流主理人Nova',
    cat: '外部合作达人',
    badge: '合作达人',
    track: 'bd',
    platform: '小红书 · 潮流生活方式 / 210万粉',
    avatar: IMG.extra,
    metrics: [
      { value: '210万', label: '粉丝数' },
      { value: '10.4%', label: '转化率' },
      { value: '290万', label: '场均GMV' },
    ],
    metricsLines: ['210万|粉丝数', '10.4%|转化率', '290万|场均GMV'],
    summary: '潮流生活方式外部达人，内容审美在线，适合新锐品牌心智建设与种草转化。',
    body: '覆盖街头潮流、轻奢配饰与生活方式单品。笔记侧重氛围感与穿搭故事，直播侧重限定色与联名款解读，适合新锐品牌冷启动与年轻人群触达。',
    gallery: [IMG.extra, IMG.lily, IMG.night],
  },
]

export const DEFAULT_MCN_LIVE_ITEMS = [
  {
    id: 'live-beauty-618',
    title: '618美妆超级品牌日专场',
    category: '美妆护肤',
    talent: '主播：小雨同学 · 抖音平台',
    cover: '/mcn/images/aadkuew4ld4fw_ve_miaoda-e668bda3.png',
    viewers: '128.6万人观看',
    metrics: [
      { value: '1280万', label: 'GMV' },
      { value: '15.2%', label: '转化率' },
      { value: '8.2万', label: '订单数' },
    ],
    summary: '美妆垂类自有主播专场，预热短视频 + 直播转化组合，单场 GMV 破千万。',
    body: '本场聚焦国货精华与彩妆套组，通过达人实测、限时赠品与场控节奏设计，完成从种草到成交的完整链路。',
    gallery: [
      '/mcn/images/aadkuew4ld4fw_ve_miaoda-e668bda3.png',
      '/mcn/images/aadkue22lsccw_ve_miaoda-d571f2a1.png',
      '/mcn/images/aadkueyw27ofu_ve_miaoda-124bb9e0.png',
    ],
  },
  {
    id: 'live-phone',
    title: '旗舰手机新品发布会专场',
    category: '3C数码',
    talent: '主播：科技玩家Max · 抖音平台',
    cover: '/mcn/images/aadkue4zmf2jw_ve_miaoda-5a2f1980.png',
    viewers: '86.2万人观看',
    metrics: [
      { value: '2150万', label: 'GMV' },
      { value: '12.3%', label: '转化率' },
      { value: '3.6万', label: '订单数' },
    ],
    summary: '新品手机发布会直播，专业测评 + 限时权益，推动高客单转化。',
    body: '联合科技垂类达人完成开箱、对比测评与场景演示，配合品牌专属券包提升下单意愿。',
    gallery: [
      '/mcn/images/aadkue4zmf2jw_ve_miaoda-5a2f1980.png',
      '/mcn/images/aadkueyw27ofu_ve_miaoda-124bb9e0.png',
      '/mcn/images/aadkue474ywas_ve_miaoda-1dcb517e.png',
    ],
  },
  {
    id: 'live-snack',
    title: '零食狂欢夜 · 年度品牌盛典',
    category: '美食食品',
    talent: '主播：吃货小当家 · 快手平台',
    cover: '/mcn/images/aadkue5f7tyqu_ve_miaoda-f3e238f8.png',
    viewers: '215.8万人观看',
    metrics: [
      { value: '960万', label: 'GMV' },
      { value: '22.5%', label: '转化率' },
      { value: '15.8万', label: '订单数' },
    ],
    summary: '零食节主题专场，高互动玩法拉升转化。',
    body: '以「零食狂欢夜」为主题，结合试吃互动与满减组合，实现品效双收。',
    gallery: [
      '/mcn/images/aadkue5f7tyqu_ve_miaoda-f3e238f8.png',
      '/mcn/images/aadkue2qormhw_ve_miaoda-be7d9ea4.png',
      '/mcn/images/aadkuew4ld4fw_ve_miaoda-e668bda3.png',
    ],
  },
  {
    id: 'live-fashion',
    title: '设计师联名款服饰首发',
    category: '服饰穿搭',
    talent: '主播：穿搭女王Lily · 小红书',
    cover: '/mcn/images/aadkue4zzsajw_ve_miaoda-6c4ae319.png',
    viewers: '92.4万人观看',
    metrics: [
      { value: '650万', label: 'GMV' },
      { value: '11.8%', label: '转化率' },
      { value: '2.1万', label: '订单数' },
    ],
    summary: '联名服饰首发直播，穿搭场景种草带动转化。',
    body: '围绕联名故事与穿搭提案组织多 look 演示，突出稀缺与首发权益。',
    gallery: [
      '/mcn/images/aadkue4zzsajw_ve_miaoda-6c4ae319.png',
      '/mcn/images/aadkue474ywas_ve_miaoda-1dcb517e.png',
      '/mcn/images/aadkueyw27ofu_ve_miaoda-124bb9e0.png',
    ],
  },
  {
    id: 'live-618-night',
    title: '618巅峰夜 · 全品类狂欢',
    category: '全品类',
    talent: '多位自有主播联合 · 抖音',
    cover: '/mcn/images/aadkue474ywas_ve_miaoda-1dcb517e.png',
    viewers: '156.3万人观看',
    metrics: [
      { value: '3680万', label: 'GMV' },
      { value: '16.8%', label: '转化率' },
      { value: '28.5万', label: '订单数' },
    ],
    summary: '多主播接力大场，全品类爆发式成交。',
    body: '采用分段主播接力与品类专场轮换，配合平台大促流量完成峰值成交。',
    gallery: [
      '/mcn/images/aadkue474ywas_ve_miaoda-1dcb517e.png',
      '/mcn/images/aadkuew4ld4fw_ve_miaoda-e668bda3.png',
      '/mcn/images/aadkue4zmf2jw_ve_miaoda-5a2f1980.png',
    ],
  },
  {
    id: 'live-home',
    title: '家居好物品牌超级品牌日',
    category: '家居生活',
    talent: '主播：家居生活家 · 淘宝直播',
    cover: '/mcn/images/aadkue5df3ycs_ve_miaoda-376b9d21.png',
    viewers: '68.9万人观看',
    metrics: [
      { value: '520万', label: 'GMV' },
      { value: '9.6%', label: '转化率' },
      { value: '3.2万', label: '订单数' },
    ],
    summary: '家居好物超级品牌日，场景化带货。',
    body: '以生活场景陈列与套组推荐为主，提升连带购买。',
    gallery: [
      '/mcn/images/aadkue5df3ycs_ve_miaoda-376b9d21.png',
      '/mcn/images/aadkue5f7tyqu_ve_miaoda-f3e238f8.png',
      '/mcn/images/aadkueyw27ofu_ve_miaoda-124bb9e0.png',
    ],
  },
]

export const DEFAULT_MCN_CASE_ITEMS = [
  {
    id: 'case-serum',
    title: '新品精华液首发直播战役',
    brand: '某国货美妆品牌',
    cover: '/mcn/images/aadkuew4ld4fw_ve_miaoda-e668bda3.png',
    summary:
      '联合5位头部美妆达人+3位自有主播打造新品首发矩阵，通过预热短视频+直播带货组合拳，实现新品上线首月销售额破千万。',
    metrics: [
      { value: '1280万', label: '总GMV' },
      { value: '18.6%', label: '转化率' },
      { value: '320万', label: '曝光量' },
    ],
    body: '围绕新品功效卖点拆解内容矩阵，预热期以测评与成分科普铺量，直播期以达人矩阵 + 自有主播承接转化，形成完整增长闭环。',
    gallery: [
      '/mcn/images/aadkuew4ld4fw_ve_miaoda-e668bda3.png',
      '/mcn/images/aadkue22lsccw_ve_miaoda-d571f2a1.png',
      '/mcn/images/aadkueyw27ofu_ve_miaoda-124bb9e0.png',
    ],
  },
  {
    id: 'case-watch',
    title: '智能手表618大促合作',
    brand: '某知名数码品牌',
    cover: '/mcn/images/aadkue4zmf2jw_ve_miaoda-5a2f1980.png',
    summary: '策划618数码品类专场直播，邀请8位科技垂类达人组成带货天团，通过专业测评+限时优惠的组合策略，单场GMV再创新高。',
    metrics: [
      { value: '2150万', label: '总GMV' },
      { value: '12.3%', label: '转化率' },
      { value: '580万', label: '观看人数' },
    ],
    body: '大促节点强化对比测评与权益节奏，形成「认知—种草—成交」三段式内容推进。',
    gallery: [
      '/mcn/images/aadkue4zmf2jw_ve_miaoda-5a2f1980.png',
      '/mcn/images/aadkue474ywas_ve_miaoda-1dcb517e.png',
      '/mcn/images/aadkueyw27ofu_ve_miaoda-124bb9e0.png',
    ],
  },
  {
    id: 'case-snack',
    title: '年度零食节品牌专场',
    brand: '某零食头部品牌',
    cover: '/mcn/images/aadkue5f7tyqu_ve_miaoda-f3e238f8.png',
    summary: '定制年度零食节直播方案，打造"零食狂欢夜"主题专场，结合达人个人IP与品牌调性，实现品牌声量与销量双增长。',
    metrics: [
      { value: '860万', label: '总GMV' },
      { value: '22.5%', label: '转化率' },
      { value: '410万', label: '观看人数' },
    ],
    body: '主题化包装提升记忆点，互动玩法拉动停留与转化。',
    gallery: [
      '/mcn/images/aadkue5f7tyqu_ve_miaoda-f3e238f8.png',
      '/mcn/images/aadkue2qormhw_ve_miaoda-be7d9ea4.png',
      '/mcn/images/aadkuew4ld4fw_ve_miaoda-e668bda3.png',
    ],
  },
  {
    id: 'case-autumn',
    title: '秋冬新品穿搭种草计划',
    brand: '某快时尚服饰品牌',
    cover: '/mcn/images/aadkue4zzsajw_ve_miaoda-6c4ae319.png',
    summary: '联合15位穿搭达人打造"秋冬穿搭图鉴"内容矩阵，通过短视频种草+直播转化的组合玩法，实现秋冬系列上线即售罄。',
    metrics: [
      { value: '1680万', label: '总GMV' },
      { value: '14.2%', label: '转化率' },
      { value: '720万', label: '曝光量' },
    ],
    body: '短视频图鉴铺量后，直播承接高意向用户，缩短决策链路。',
    gallery: [
      '/mcn/images/aadkue4zzsajw_ve_miaoda-6c4ae319.png',
      '/mcn/images/aadkue474ywas_ve_miaoda-1dcb517e.png',
      '/mcn/images/aadkueyw27ofu_ve_miaoda-124bb9e0.png',
    ],
  },
  {
    id: 'case-1111',
    title: '双十一大促全案服务',
    brand: '某国民服饰品牌',
    cover: '/mcn/images/aadkue5df3ycs_ve_miaoda-376b9d21.png',
    summary: '承接双十一全案直播运营，从达人筛选到直播执行全链路跟进，30天内组织28场直播，总GMV突破3000万。',
    metrics: [
      { value: '3200万', label: '总GMV' },
      { value: '28场', label: '直播场次' },
      { value: '960万', label: '总观看' },
    ],
    body: '以排期密度与达人分层覆盖保证大促持续曝光与成交。',
    gallery: [
      '/mcn/images/aadkue5df3ycs_ve_miaoda-376b9d21.png',
      '/mcn/images/aadkue4zzsajw_ve_miaoda-6c4ae319.png',
      '/mcn/images/aadkue474ywas_ve_miaoda-1dcb517e.png',
    ],
  },
  {
    id: 'case-lipstick',
    title: '彩妆新品达人种草计划',
    brand: '某新锐彩妆品牌',
    cover: '/mcn/images/aadkue2qormhw_ve_miaoda-be7d9ea4.png',
    summary: '为新品口红策划"百人口红测评"活动，联动100位美妆达人，多平台内容种草+集中直播转化，新品上市7天销量破百万支。',
    metrics: [
      { value: '1850万', label: '总GMV' },
      { value: '20.1%', label: '转化率' },
      { value: '1200万', label: '总曝光' },
    ],
    body: '大规模达人测评制造话题，再以集中直播完成转化收口。',
    gallery: [
      '/mcn/images/aadkue2qormhw_ve_miaoda-be7d9ea4.png',
      '/mcn/images/aadkuew4ld4fw_ve_miaoda-e668bda3.png',
      '/mcn/images/aadkue22lsccw_ve_miaoda-d571f2a1.png',
    ],
  },
]

export const DEFAULT_MCN_PROCESS_STEPS = [
  { id: 'p1', step: '01', title: '需求对接', desc: '深入了解品牌需求，明确合作目标与预期指标' },
  { id: 'p2', step: '02', title: '方案策划', desc: '定制达人组合方案与内容策略，确定排期与预算' },
  { id: 'p3', step: '03', title: '选品筹备', desc: '智能选品匹配，脚本策划与预热内容制作' },
  { id: 'p4', step: '04', title: '直播执行', desc: '专业运营团队全程跟进，保障直播顺利进行' },
  { id: 'p5', step: '05', title: '复盘优化', desc: '数据复盘报告输出，提供迭代优化建议' },
]

function normalizeTalentCategoryLabel(value) {
  if (value == null) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'object') {
    const named = value.name || value.label || value.title || value.id
    if (named != null && named !== value) return String(named).trim()
  }
  return ''
}

function normalizeTalentCategories(list) {
  const raw = Array.isArray(list) ? list : []
  const out = []
  const seen = new Set()
  raw.forEach((item) => {
    const label = normalizeTalentCategoryLabel(item)
    if (!label || seen.has(label)) return
    // 过滤被错误展开成 {0:'自',1:'有'...} 的脏数据
    if (item && typeof item === 'object' && !item.name && !item.label && !item.title && !item.id) return
    seen.add(label)
    out.push(label)
  })
  return out.length ? out : [...DEFAULT_MCN_TALENT_CATEGORIES]
}

function resolveTalentCategory(item, categories) {
  const cats = normalizeTalentCategories(categories)
  const existing = normalizeTalentCategoryLabel(item?.cat)
  if (existing && cats.includes(existing)) return existing
  if (existing) return existing
  const track = String(item?.track || '').trim().toLowerCase()
  if (track === 'bd' || track === 'partner' || track === 'external') {
    return cats.find((c) => /外部|合作|bd/i.test(c)) || cats[1] || cats[0] || '外部合作达人'
  }
  if (track === 'owned' || track === 'internal') {
    return cats.find((c) => /自有|签约|owned/i.test(c)) || cats[0] || '自有签约主播'
  }
  const badge = String(item?.badge || '')
  if (/合作|外部|bd/i.test(badge)) {
    return cats.find((c) => /外部|合作|bd/i.test(c)) || cats[1] || cats[0] || '外部合作达人'
  }
  return cats[0] || '自有签约主播'
}

export function ensureMcnHomeLists(config) {
  if (!config.pages || typeof config.pages !== 'object') config.pages = {}
  if (!config.pages.home || typeof config.pages.home !== 'object') config.pages.home = {}
  const home = config.pages.home
  const fillObjects = (key, seed) => {
    if (!Array.isArray(home[key]) || !home[key].length) home[key] = seed.map((x) => ({ ...x, ...(Array.isArray(x.gallery) ? { gallery: [...x.gallery] } : {}) }))
  }
  fillObjects('serviceItems', DEFAULT_MCN_SERVICE_ITEMS)
  fillObjects('heroStats', DEFAULT_MCN_HERO_STATS)
  fillObjects('dataKpis', DEFAULT_MCN_DATA_KPIS)
  fillObjects('aboutStats', DEFAULT_MCN_ABOUT_STATS)
  fillObjects('footerColumns', DEFAULT_MCN_FOOTER_COLUMNS)
  if (Array.isArray(home.footerColumns)) {
    home.footerColumns = home.footerColumns.map((c) => ({
      title: c?.title || '',
      linksLines: Array.isArray(c?.linksLines)
        ? [...c.linksLines]
        : Array.isArray(c?.links)
          ? c.links.map((l) => `${l.label || ''}|${l.href || '#'}`)
          : [],
    }))
  }
  if (!Array.isArray(home.footerKeywords) || !home.footerKeywords.length) {
    home.footerKeywords = [...DEFAULT_MCN_FOOTER_KEYWORDS]
  }
  if (!Array.isArray(home.contactCategoryOptions) || !home.contactCategoryOptions.length) {
    home.contactCategoryOptions = [...DEFAULT_MCN_CATEGORY_OPTIONS]
  }
  if (!Array.isArray(home.contactServiceOptions) || !home.contactServiceOptions.length) {
    home.contactServiceOptions = [...DEFAULT_MCN_SERVICE_OPTIONS]
  }
  Object.entries(DEFAULT_MCN_HOME_SCALARS).forEach(([key, val]) => {
    if (home[key] == null || home[key] === '') home[key] = val
  })
  // longer about text if still short single-sentence default from old seed
  if (
    typeof home.aboutText === 'string' &&
    home.aboutText.length < 120 &&
    !/<p[\s>]/i.test(home.aboutText)
  ) {
    // keep short custom text; only fill when blank already handled
  }
  ensureDataCharts(home)
  if (!home.testimonialAvatar && home.testimonialName) {
    home.testimonialAvatar = String(home.testimonialName).trim().charAt(0) || '客'
  }
  if (!Array.isArray(home.talentCategories) || !home.talentCategories.length) {
    home.talentCategories = [...DEFAULT_MCN_TALENT_CATEGORIES]
  } else {
    home.talentCategories = normalizeTalentCategories(home.talentCategories)
  }
  fillObjects('talentItems', DEFAULT_MCN_TALENT_ITEMS)
  fillObjects('liveItems', DEFAULT_MCN_LIVE_ITEMS)
  fillObjects('caseItems', DEFAULT_MCN_CASE_ITEMS)
  fillObjects('processSteps', DEFAULT_MCN_PROCESS_STEPS)

  const defaultCat = normalizeTalentCategoryLabel(home.talentDefaultCategory)
  home.talentDefaultCategory =
    defaultCat && home.talentCategories.includes(defaultCat)
      ? defaultCat
      : home.talentCategories[0] || ''

  const isBlank = (v) => v == null || (typeof v === 'string' && !String(v).trim()) || (Array.isArray(v) && !v.length)
  const enrichFromSeed = (items, seed, fields) => {
    const byId = new Map(seed.map((s) => [String(s.id || ''), s]))
    ;(items || []).forEach((it, index) => {
      if (!it || typeof it !== 'object') return
      const seedItem = byId.get(String(it.id || '')) || seed[index]
      if (!seedItem) return
      fields.forEach((key) => {
        if (!isBlank(it[key])) return
        const val = seedItem[key]
        if (isBlank(val)) return
        it[key] = Array.isArray(val) ? [...val] : val
      })
    })
  }

  enrichFromSeed(home.talentItems, DEFAULT_MCN_TALENT_ITEMS, [
    'name',
    'cat',
    'badge',
    'track',
    'platform',
    'avatar',
    'summary',
    'body',
    'gallery',
    'metrics',
    'metricsLines',
  ])
  enrichFromSeed(home.liveItems, DEFAULT_MCN_LIVE_ITEMS, [
    'title',
    'category',
    'talent',
    'cover',
    'viewers',
    'summary',
    'body',
    'gallery',
    'metrics',
    'metricsLines',
  ])
  enrichFromSeed(home.caseItems, DEFAULT_MCN_CASE_ITEMS, [
    'title',
    'brand',
    'cover',
    'summary',
    'body',
    'gallery',
    'metrics',
    'metricsLines',
  ])

  ;(home.talentItems || []).forEach((it) => {
    if (!it || typeof it !== 'object') return
    it.cat = resolveTalentCategory(it, home.talentCategories)
    it.track = /外部|合作|bd/i.test(it.cat) ? 'bd' : 'owned'
    if (!it.badge) it.badge = it.track === 'bd' ? '合作达人' : '自有主播'
    if (isBlank(it.summary)) it.summary = `${it.name || '达人'}，专注${it.platform || '内容电商'}合作。`
    if (isBlank(it.body)) it.body = it.summary
    if (!Array.isArray(it.gallery) || !it.gallery.length) {
      it.gallery = [it.avatar].filter(Boolean)
    }
  })

  ;(home.liveItems || []).forEach((it) => {
    if (!it || typeof it !== 'object') return
    if (isBlank(it.summary)) it.summary = it.title || '直播案例'
    if (isBlank(it.body)) it.body = it.summary
    if (!Array.isArray(it.gallery) || !it.gallery.length) {
      it.gallery = [it.cover].filter(Boolean)
    }
  })

  ;(home.caseItems || []).forEach((it) => {
    if (!it || typeof it !== 'object') return
    if (isBlank(it.summary)) it.summary = it.title || '成功案例'
    if (isBlank(it.body)) it.body = it.summary
    if (!Array.isArray(it.gallery) || !it.gallery.length) {
      it.gallery = [it.cover].filter(Boolean)
    }
  })

  const syncMetricsLines = (items) => {
    ;(items || []).forEach((it) => {
      if (!it || typeof it !== 'object') return
      if ((!it.metricsLines || !String(it.metricsLines).length) && Array.isArray(it.metrics)) {
        it.metricsLines = it.metrics.map((m) => `${m.value || m.v || ''}|${m.label || m.l || ''}`)
      }
    })
  }
  syncMetricsLines(home.talentItems)
  syncMetricsLines(home.liveItems)
  syncMetricsLines(home.caseItems)
  return config
}

export function findMcnLiveItem(config, id) {
  const items = config?.pages?.home?.liveItems || []
  const key = String(id || '')
  return items.find((it, i) => getMcnItemId(it, i) === key) || null
}

export function findMcnCaseItem(config, id) {
  const items = config?.pages?.home?.caseItems || []
  const key = String(id || '')
  return items.find((it, i) => getMcnItemId(it, i) === key) || null
}

export function findMcnTalentItem(config, id) {
  const items = config?.pages?.home?.talentItems || []
  const key = String(id || '')
  return items.find((it, i) => getMcnItemId(it, i) === key) || null
}

export function mcnLiveDetailHref(item, index = 0) {
  return `./live-detail.html?id=${encodeURIComponent(getMcnItemId(item, index))}`
}

export function mcnCaseDetailHref(item, index = 0) {
  return `./mcn-case-detail.html?id=${encodeURIComponent(getMcnItemId(item, index))}`
}

export function mcnTalentDetailHref(item, index = 0) {
  return `./talent-detail.html?id=${encodeURIComponent(getMcnItemId(item, index))}`
}

export function renderMcnServiceItems(container, items) {
  if (!container) return
  const list = Array.isArray(items) ? items : []
  container.innerHTML = list
    .map((it) => {
      const icon = SERVICE_ICONS[it.icon] || SERVICE_ICONS.users
      const adv = linesOf(it.advantages)
        .map((t) => `<li>${CHECK_SVG}${escapeHtml(t)}</li>`)
        .join('')
      return `<div class="service-card">
        <div class="service-icon">${icon}</div>
        <h3>${escapeHtml(it.title || '')}</h3>
        <p>${escapeHtml(it.summary || '')}</p>
        <ul class="service-advantages">${adv}</ul>
        <div class="service-arrow">${ARROW_SVG}</div>
      </div>`
    })
    .join('')
}

export function renderMcnTalentTabs(container, categories, defaultCategory) {
  if (!container) return
  const cats = Array.isArray(categories) ? categories.map((c) => String(c || '').trim()).filter(Boolean) : []
  const preferred = String(defaultCategory || '').trim()
  const active = cats.includes(preferred) ? preferred : cats[0] || 'all'
  const tabs = [...cats.map((c) => ({ id: c, label: c })), { id: 'all', label: '全部分类' }]
  container.innerHTML = tabs
    .map((t) => {
      const selected = t.id === active
      return `<button type="button" class="tab-btn${selected ? ' active' : ''}" data-cat="${escapeHtml(t.id)}" role="tab" aria-selected="${selected}">${escapeHtml(t.label)}</button>`
    })
    .join('')
}

export function bindMcnTalentFilter(root = document) {
  const section = root.querySelector?.('.talents') || document.querySelector('.talents')
  if (!section || section.dataset.talentFilterBound === '1') return
  section.dataset.talentFilterBound = '1'
  section.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn')
    if (!btn || !section.contains(btn)) return
    const cat = btn.dataset.cat || 'all'
    section.querySelectorAll('.tab-btn').forEach((b) => {
      const on = b === btn
      b.classList.toggle('active', on)
      b.setAttribute('aria-selected', on ? 'true' : 'false')
    })
    section.querySelectorAll('.talent-card').forEach((card) => {
      const match = cat === 'all' || card.dataset.cat === cat
      card.hidden = !match
      card.style.display = match ? '' : 'none'
    })
  })
}

export function applyMcnTalentFilter(section) {
  const root = section || document.querySelector('.talents')
  if (!root) return
  const active = root.querySelector('.tab-btn.active')
  const cat = active?.dataset?.cat || 'all'
  root.querySelectorAll('.talent-card').forEach((card) => {
    const match = cat === 'all' || card.dataset.cat === cat
    card.hidden = !match
    card.style.display = match ? '' : 'none'
  })
}

export function renderMcnTalentItems(container, items) {
  if (!container) return
  const list = Array.isArray(items) ? items : []
  container.innerHTML = list
    .map((it, i) => {
      const src = resolveAsset(it.avatar || '')
      const href = mcnTalentDetailHref(it, i)
      const cat = it.cat || ''
      return `<a class="talent-card" href="${escapeHtml(href)}" data-cat="${escapeHtml(cat)}" data-track="${escapeHtml(it.track || '')}">
        <div class="talent-img">
          <img src="${escapeHtml(src)}" alt="${escapeHtml(it.name || '达人')}" />
          <span class="talent-badge">${escapeHtml(it.badge || it.cat || '达人')}</span>
        </div>
        <div class="talent-info">
          <div class="talent-name">${escapeHtml(it.name || '')}</div>
          <div class="talent-platform">${escapeHtml(it.platform || '')}</div>
          <div class="talent-metrics">${metricsHtml(it, 'metric')}</div>
        </div>
      </a>`
    })
    .join('')
}

export function renderMcnLiveItems(container, items) {
  if (!container) return
  const list = Array.isArray(items) ? items : []
  container.innerHTML = list
    .map((it, i) => {
      const href = mcnLiveDetailHref(it, i)
      const src = resolveAsset(it.cover || '')
      return `<a class="live-card" href="${escapeHtml(href)}">
        <div class="live-thumb">
          <img src="${escapeHtml(src)}" alt="${escapeHtml(it.title || '直播')}" />
          <div class="live-live-badge"><span class="dot"></span>LIVE</div>
          <div class="live-viewers">${escapeHtml(it.viewers || '')}</div>
        </div>
        <div class="live-body">
          <div class="live-category">${escapeHtml(it.category || '')}</div>
          <div class="live-title">${escapeHtml(it.title || '')}</div>
          <div class="live-talent">${escapeHtml(it.talent || '')}</div>
          <div class="live-metrics">${metricsHtml(it, 'live-metric')}</div>
        </div>
      </a>`
    })
    .join('')
}

export function renderMcnCaseItems(container, items) {
  if (!container) return
  const list = Array.isArray(items) ? items : []
  container.innerHTML = list
    .map((it, i) => {
      const href = mcnCaseDetailHref(it, i)
      const src = resolveAsset(it.cover || '')
      return `<a class="case-card" href="${escapeHtml(href)}">
        <div class="case-img">
          <img src="${escapeHtml(src)}" alt="${escapeHtml(it.title || '案例')}" />
          <span class="case-brand-badge">${escapeHtml(it.brand || '')}</span>
        </div>
        <div class="case-body">
          <h3 class="case-title">${escapeHtml(it.title || '')}</h3>
          <p class="case-desc">${escapeHtml(it.summary || '')}</p>
          <div class="case-stats">${metricsHtml(it, 'case-stat')}</div>
        </div>
      </a>`
    })
    .join('')
}

export function renderMcnProcessSteps(container, items) {
  if (!container) return
  const list = Array.isArray(items) ? items : []
  container.innerHTML = list
    .map((it, i) => {
      const num = it.step || String(i + 1).padStart(2, '0')
      return `<div class="process-step">
        <div class="step-num-badge">${escapeHtml(num)}</div>
        <h4 class="step-title">${escapeHtml(it.title || '')}</h4>
        <p class="step-desc">${escapeHtml(it.desc || '')}</p>
      </div>`
    })
    .join('')
}

export function renderMcnHeroStats(container, items) {
  if (!container) return
  const list = Array.isArray(items) ? items : []
  container.innerHTML = list
    .map(
      (it) => `<div class="hero-stat">
        <div class="num">${escapeHtml(it.num || '')}<span class="unit">${escapeHtml(it.unit || '')}</span></div>
        <div class="label">${escapeHtml(it.label || '')}</div>
      </div>`
    )
    .join('')
}

export function renderMcnDataKpis(container, items) {
  if (!container) return
  const list = Array.isArray(items) ? items : []
  container.innerHTML = list
    .map(
      (it) => `<div class="kpi-card">
        <div class="kpi-label">${escapeHtml(it.label || '')}</div>
        <div class="kpi-value">${escapeHtml(it.value || '')}<span class="kpi-unit">${escapeHtml(it.unit || '')}</span></div>
        <span class="kpi-trend">${escapeHtml(it.trend || '')}</span>
      </div>`
    )
    .join('')
}

export function renderMcnAboutStats(container, items) {
  if (!container) return
  const list = Array.isArray(items) ? items : []
  container.innerHTML = list
    .map(
      (it) => `<div class="about-stat">
        <div class="num">${escapeHtml(it.num || '')}<span class="unit">${escapeHtml(it.unit || '')}</span></div>
        <div class="label">${escapeHtml(it.label || '')}</div>
      </div>`
    )
    .join('')
}

export function renderMcnNavMenu(container, menu) {
  if (!container) return
  const list = Array.isArray(menu) ? menu.filter((m) => m && (m.title || m.label)) : []
  if (!list.length) return
  const ctaSvg = NAV_CTA_SVG
  container.innerHTML = list
    .map((item, index) => {
      const title = item.title || item.label || ''
      const href = item.href || '#'
      const isLast = index === list.length - 1
      const isCta = item.cta === true || item.cta === 'true' || isLast
      if (isCta) {
        return `<li><a href="${escapeHtml(href)}" class="nav-cta">${escapeHtml(title)}${ctaSvg}</a></li>`
      }
      return `<li><a href="${escapeHtml(href)}">${escapeHtml(title)}</a></li>`
    })
    .join('')
}

export function renderMcnFooterColumns(container, columns) {
  if (!container) return
  const list = Array.isArray(columns) ? columns : []
  container.innerHTML = list
    .map((col) => {
      const links = parseLinkLines(col.linksLines || col.links)
      const lis = links
        .map((l) => `<li><a href="${escapeHtml(l.href)}">${escapeHtml(l.label)}</a></li>`)
        .join('')
      return `<div class="footer-col"><h5>${escapeHtml(col.title || '')}</h5><ul>${lis}</ul></div>`
    })
    .join('')
}

export function renderMcnFooterKeywords(container, keywords) {
  if (!container) return
  const list = toLinesArray(keywords)
  container.innerHTML = list
    .map((kw, i) => {
      const sep = i < list.length - 1 ? '<span>·</span>' : ''
      return `<span>${escapeHtml(kw)}</span>${sep}`
    })
    .join('')
}

export function applyMcnContactFormOptions(config) {
  const home = config?.pages?.home || {}
  const fillSelect = (id, options, placeholder) => {
    const sel = document.getElementById(id)
    if (!sel) return
    const opts = toLinesArray(options)
    const ph = placeholder || '请选择'
    const current = sel.value
    sel.innerHTML =
      `<option value="">${escapeHtml(ph)}</option>` +
      opts.map((o) => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join('')
    if (current && opts.includes(current)) sel.value = current
  }
  fillSelect('mcnCategory', home.contactCategoryOptions, home.contactCategoryPlaceholder)
  fillSelect('mcnService', home.contactServiceOptions, home.contactServicePlaceholder)
}

export function applyMcnHomeLists(config) {
  ensureMcnHomeLists(config)
  const home = config.pages.home
  document.querySelectorAll('[data-list="pages.home.serviceItems"]').forEach((el) => renderMcnServiceItems(el, home.serviceItems))
  document.querySelectorAll('[data-list="pages.home.talentCategories"]').forEach((el) =>
    renderMcnTalentTabs(el, home.talentCategories, home.talentDefaultCategory)
  )
  document.querySelectorAll('[data-list="pages.home.talentItems"]').forEach((el) => renderMcnTalentItems(el, home.talentItems))
  document.querySelectorAll('[data-list="pages.home.liveItems"]').forEach((el) => renderMcnLiveItems(el, home.liveItems))
  document.querySelectorAll('[data-list="pages.home.caseItems"]').forEach((el) => renderMcnCaseItems(el, home.caseItems))
  document.querySelectorAll('[data-list="pages.home.processSteps"]').forEach((el) => renderMcnProcessSteps(el, home.processSteps))
  document.querySelectorAll('[data-list="pages.home.heroStats"]').forEach((el) => renderMcnHeroStats(el, home.heroStats))
  document.querySelectorAll('[data-list="pages.home.dataKpis"]').forEach((el) => renderMcnDataKpis(el, home.dataKpis))
  document.querySelectorAll('[data-list="pages.home.aboutStats"]').forEach((el) => renderMcnAboutStats(el, home.aboutStats))
  document.querySelectorAll('[data-list="pages.home.footerColumns"]').forEach((el) =>
    renderMcnFooterColumns(el, home.footerColumns)
  )
  document.querySelectorAll('[data-list="pages.home.footerKeywords"]').forEach((el) =>
    renderMcnFooterKeywords(el, home.footerKeywords)
  )
  document.querySelectorAll('[data-list="global.menu"]').forEach((el) => {
    if (el.classList.contains('nav-links') || el.closest('.nav')) {
      renderMcnNavMenu(el, config.global?.menu)
    }
  })
  applyMcnContactFormOptions(config)
  // sync testimonial avatar from name when empty bind
  const avatarEl = document.querySelector('[data-bind="pages.home.testimonialAvatar"]')
  if (avatarEl && home.testimonialName && (!home.testimonialAvatar || home.testimonialAvatar === '王')) {
    const ch = String(home.testimonialName).trim().charAt(0)
    if (ch) {
      home.testimonialAvatar = ch
      avatarEl.textContent = ch
    }
  }
  bindMcnTalentFilter()
  applyMcnTalentFilter()
}

export function applyMcnLiveDetail(config) {
  ensureMcnHomeLists(config)
  const id = new URLSearchParams(location.search).get('id')
  const item = findMcnLiveItem(config, id)
  const root = document.getElementById('mcnDetailRoot')
  if (!root) return
  if (!item) {
    root.innerHTML = `<div class="container detail-empty"><p>未找到该直播案例</p><a href="/#live">返回直播案例</a></div>`
    return
  }
  const cover = resolveAsset(item.cover || '')
  const gallery = (Array.isArray(item.gallery) && item.gallery.length ? item.gallery : [item.cover].filter(Boolean))
    .map((src) => `<img src="${escapeHtml(resolveAsset(src))}" alt="" />`)
    .join('')
  root.innerHTML = `
    <div class="container detail-wrap">
      <a class="detail-back" href="/#live">← 返回直播案例</a>
      <div class="detail-hero">
        <img src="${escapeHtml(cover)}" alt="${escapeHtml(item.title || '')}" />
        <div class="detail-hero-meta">
          <div class="micro-label">${escapeHtml(item.category || 'LIVE')}</div>
          <h1>${escapeHtml(item.title || '')}</h1>
          <p class="detail-sub">${escapeHtml(item.talent || '')}</p>
          <p class="detail-viewers">${escapeHtml(item.viewers || '')}</p>
          <div class="detail-metrics">${metricsHtml(item, 'detail-metric')}</div>
        </div>
      </div>
      <div class="detail-body">
        <h2>案例亮点</h2>
        <p>${escapeHtml(item.summary || '')}</p>
        <h2>详细介绍</h2>
        <p>${escapeHtml(item.body || item.summary || '')}</p>
        <div class="detail-gallery">${gallery}</div>
        <a class="btn-primary" href="/#contact">合作咨询</a>
      </div>
    </div>`
  if (item.title) document.title = `${item.title} · 直播案例 · 光子文化`
}

export function applyMcnCaseDetail(config) {
  ensureMcnHomeLists(config)
  const id = new URLSearchParams(location.search).get('id')
  const item = findMcnCaseItem(config, id)
  const root = document.getElementById('mcnDetailRoot')
  if (!root) return
  if (!item) {
    root.innerHTML = `<div class="container detail-empty"><p>未找到该成功案例</p><a href="/#cases">返回成功案例</a></div>`
    return
  }
  const cover = resolveAsset(item.cover || '')
  const gallery = (Array.isArray(item.gallery) && item.gallery.length ? item.gallery : [item.cover].filter(Boolean))
    .map((src) => `<img src="${escapeHtml(resolveAsset(src))}" alt="" />`)
    .join('')
  root.innerHTML = `
    <div class="container detail-wrap">
      <a class="detail-back" href="/#cases">← 返回成功案例</a>
      <div class="detail-hero">
        <img src="${escapeHtml(cover)}" alt="${escapeHtml(item.title || '')}" />
        <div class="detail-hero-meta">
          <div class="micro-label">${escapeHtml(item.brand || 'CASE')}</div>
          <h1>${escapeHtml(item.title || '')}</h1>
          <div class="detail-metrics">${metricsHtml(item, 'detail-metric')}</div>
        </div>
      </div>
      <div class="detail-body">
        <h2>项目概述</h2>
        <p>${escapeHtml(item.summary || '')}</p>
        <h2>执行复盘</h2>
        <p>${escapeHtml(item.body || item.summary || '')}</p>
        <div class="detail-gallery">${gallery}</div>
        <a class="btn-primary" href="/#contact">合作咨询</a>
      </div>
    </div>`
  if (item.title) document.title = `${item.title} · 成功案例 · 光子文化`
}

export function applyMcnTalentDetail(config) {
  ensureMcnHomeLists(config)
  const id = new URLSearchParams(location.search).get('id')
  const item = findMcnTalentItem(config, id)
  const root = document.getElementById('mcnDetailRoot')
  if (!root) return
  if (!item) {
    root.innerHTML = `<div class="container detail-empty"><p>未找到该达人</p><a href="/#talents">返回达人资源</a></div>`
    return
  }
  const cover = resolveAsset(item.avatar || '')
  const gallery = (Array.isArray(item.gallery) && item.gallery.length ? item.gallery : [item.avatar].filter(Boolean))
    .map((src) => `<img src="${escapeHtml(resolveAsset(src))}" alt="" />`)
    .join('')
  root.innerHTML = `
    <div class="container detail-wrap">
      <a class="detail-back" href="/#talents">← 返回达人资源</a>
      <div class="detail-hero">
        <img src="${escapeHtml(cover)}" alt="${escapeHtml(item.name || '')}" />
        <div class="detail-hero-meta">
          <div class="micro-label">${escapeHtml(item.badge || item.cat || 'TALENT')}</div>
          <h1>${escapeHtml(item.name || '')}</h1>
          <p class="detail-sub">${escapeHtml(item.platform || '')}</p>
          <p class="detail-viewers">${escapeHtml(item.cat || '')}</p>
          <div class="detail-metrics">${metricsHtml(item, 'detail-metric')}</div>
        </div>
      </div>
      <div class="detail-body">
        <h2>达人简介</h2>
        <p>${escapeHtml(item.summary || '')}</p>
        <h2>合作亮点</h2>
        <p>${escapeHtml(item.body || item.summary || '')}</p>
        <div class="detail-gallery">${gallery}</div>
        <a class="btn-primary" href="/#contact">合作咨询</a>
      </div>
    </div>`
  if (item.name) document.title = `${item.name} · 达人资源 · 光子文化`
}
