/**
 * Slim guanzi_2 registry to MCN-only menus + components.
 * node scripts/patch-mcn-registry.mjs
 */
import fs from 'fs'

const path = 'src/page-registry.js'
let s = fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n')

function replaceBetween(src, startMarker, endMarker, replacement) {
  const start = src.indexOf(startMarker)
  if (start < 0) throw new Error(`start not found: ${JSON.stringify(startMarker.slice(0, 80))}`)
  const end = src.indexOf(endMarker, start)
  if (end < 0) throw new Error(`end not found: ${JSON.stringify(endMarker.slice(0, 80))}`)
  return src.slice(0, start) + replacement + src.slice(end)
}

const shellBlock = `/** 可选落地页壳（MCN 站以首页单页为主） */
export const SHELL_OPTIONS = [
  { shell: 'page.html', href: '/page.html', label: '通用页', pageKey: null, generic: true },
  { shell: 'index.html', href: '/', label: '首页', pageKey: 'home' },
  { shell: 'contact.html', href: '/contact.html', label: '联系', pageKey: 'contact' },
]

`

const menuBlock = `/**
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

`

const unitsBlock = `/**
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
    description: '全站页脚文案、版权与办公地址',
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
  { id: 'home-about', label: '关于我们', description: '关于光子文化与客户证言', group: '首页', kind: 'content', section: 'home', itemId: 'about', preview: 'index.html', pageKey: 'home', blockId: 'about' },
  { id: 'home-contact', label: '合作咨询', description: '联系信息与咨询表单', group: '首页', kind: 'content', section: 'home', itemId: 'contact', preview: 'index.html', pageKey: 'home', blockId: 'contact' },
]

`

const legacyBlock = `/** 旧组装 id → 新独立组件 id（兼容已保存配置） */
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
  'home-clients': 'home-cases',
  'home-news': 'home-data',
  'about-intro': 'home-about',
  'about-kt-hero': 'home-about',
  'about-kt-stats': 'home-about',
  'about-kt-story': 'home-about',
  'about-kt-cards': 'home-about',
  'about-team': 'home-about',
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

`

s = replaceBetween(s, '/** 可选落地页壳', '/** 通用壳链接', shellBlock)
s = replaceBetween(s, '/**\n * 默认菜单种子', '/** 主页面文件名', menuBlock)

const unitsStart = s.includes('/**\n * 内置组件注册表')
  ? '/**\n * 内置组件注册表'
  : 'export const SITE_PAGE_UNITS = ['
s = replaceBetween(s, unitsStart, '/** 旧组装 id', unitsBlock)
s = replaceBetween(s, '/** 旧组装 id', 'export function getPageUnit', legacyBlock)

s = s.replace(
  /const expandProfile = \[[^\]]*\]\n  ;\(Array\.isArray\(ids\) \? ids : \[\]\)\.forEach\(\(raw\) => \{\n    \/\/ 旧「关于我们3」单块 → 展开为经天四段组装\n    if \(String\(raw\) === 'about-profile'\) \{\n      expandProfile\.forEach\(\(id\) => \{\n        if \(seen\.has\(id\)\) return\n        if \(!isComposableUnit\(getPageUnit\(id, config\)\)\) return\n        seen\.add\(id\)\n        out\.push\(id\)\n      \}\)\n      return\n    \}\n    let id = normalizeComponentId\(raw\)/,
  `;(Array.isArray(ids) ? ids : []).forEach((raw) => {
    let id = normalizeComponentId(raw)`
)

s = s.replace(
  /export function defaultComponentsForSlot\(_slot\) \{\n  return \[\]\n\}/,
  `export function defaultComponentsForSlot(slot) {
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
}`
)

fs.writeFileSync(path, s.replace(/\n/g, '\r\n'))

const checks = [
  [!s.includes("href: '/about.html'"), 'no about.html menu'],
  [s.includes("href: '/#services'"), 'has /#services'],
  [s.includes("id: 'home-services'"), 'has home-services'],
  [!s.includes("id: 'about-kt-hero'"), 'no about-kt-hero unit'],
  [!s.includes("id: 'news-page'"), 'no news-page unit'],
  [s.includes("services: ['home-services']"), 'defaultComponents map'],
]
for (const [ok, label] of checks) {
  if (!ok) {
    console.error('FAIL:', label)
    process.exit(1)
  }
  console.log('OK:', label)
}
console.log('page-registry patched')
