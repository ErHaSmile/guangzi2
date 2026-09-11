import fs from 'fs'

const p = 'public/site-config.json'
const c = JSON.parse(fs.readFileSync(p, 'utf8'))
const h = c.pages.home || (c.pages.home = {})

c.global.brandName = 'GUANGZI'
c.global.brandSub = '光子文化'
c.global.nav = {
  service: '核心服务',
  case: '成功案例',
  about: '关于我们',
  news: '数据看板',
  contact: '合作咨询',
}
c.global.menu = [
  { title: '首页', en: 'HOME', href: '/#home' },
  { title: '核心服务', en: 'SERVICES', href: '/#services' },
  { title: '达人资源', en: 'TALENTS', href: '/#talents' },
  { title: '直播案例', en: 'LIVE', href: '/#live' },
  { title: '成功案例', en: 'CASES', href: '/#cases' },
  { title: '数据看板', en: 'DATA', href: '/#data' },
  { title: '关于我们', en: 'ABOUT', href: '/#about' },
  { title: '合作咨询', en: 'CONTACT', href: '/#contact' },
]
c.global.footer = {
  title: "LET'S GROW TOGETHER",
  lead: '达人BD × 自有主播双轮驱动，\n为品牌提供全链路直播电商增长。',
  brand: 'GUANGZI.',
  copyright: '© 2025 光子文化 GUANGZI MEDIA. All rights reserved.',
  beian: '',
  offices: [
    {
      title: '杭州总部',
      lines: ['杭州市余杭区未来科技城', '梦想小镇创业大街28号楼'],
      email: 'business@guangzi-media.com',
      tel: '400-888-6666',
    },
  ],
}

Object.assign(h, {
  seo: {
    title: '光子文化 · 达人BD × 自有主播 双轮驱动MCN',
    description:
      '光子文化深耕直播电商，以达人商务对接与自有主播孵化为核心双引擎，为品牌提供全链路MCN增长方案。',
  },
  logoMark: '光',
  heroEyebrow: 'GUANGZI CULTURE · MCN',
  heroTitleHtml:
    '达人BD × 自有主播<br/><span class="accent">双轮驱动</span>的<br/>全链路MCN机构',
  heroDesc:
    '光子文化深耕直播电商领域，以达人商务对接与自有主播孵化为核心双引擎，为品牌提供从选品策划到直播落地的一站式增长解决方案。',
  heroImage: '/mcn/images/aadkue22lsccw_ve_miaoda-d571f2a1.png',
  heroFloatNum: '98%',
  heroFloatLabel: '客户复购率',
  servicesEyebrow: 'CORE SERVICES',
  servicesTitle: '六大核心服务能力',
  servicesDesc: '从达人对接到直播落地，从内容种草到数据复盘，为品牌提供全链路的直播电商增长方案',
  talentsEyebrow: 'TALENT RESOURCES',
  talentsTitle: '双轮驱动达人资源',
  talentsDesc: '外部达人BD与自有主播矩阵并行，覆盖多品类、多层级直播带货能力',
  liveEyebrow: 'LIVE CASES',
  liveTitle: '直播战绩案例',
  liveDesc: '精选高转化专场与爆款节点，展示可复制的增长打法',
  casesEyebrow: 'SUCCESS STORIES',
  casesTitle: '品牌合作案例',
  casesDesc: '服务美妆、服饰、食品、3C 等品类客户，沉淀长期合作复购',
  dataEyebrow: 'DATA DASHBOARD',
  dataTitle: '销售数据看板',
  dataDesc: '用可视化数据呈现 GMV、品类结构与增长趋势',
  processEyebrow: 'PROCESS',
  processTitle: '标准化服务流程',
  processDesc: '从需求诊断到复盘优化，全链路可追踪、可复用',
  aboutEyebrow: 'ABOUT US',
  aboutTitle: '关于光子文化',
  aboutText:
    '光子文化成立于2019年，总部位于杭州，是国内领先的以"达人BD + 自有主播"双轮驱动的MCN机构。',
  testimonialText:
    '与光子文化合作两年，从达人对接到自有主播专场，他们的专业度和执行力让我们非常满意。今年618大促，他们帮我们实现了GMV同比增长180%的好成绩，是值得长期信赖的合作伙伴。',
  testimonialName: '王梦琪',
  testimonialRole: '某国货美妆品牌 · 电商总监',
  contactEyebrow: 'CONTACT US',
  contactTitleHtml: '让我们一起<br/>打造下一个爆款',
  contactDesc:
    '无论您是想试水直播电商的新锐品牌，还是寻求增长突破的成熟品牌，光子文化都能为您量身定制最适合的达人对接与直播运营方案。',
  contactTel: '400-888-6666',
  contactEmail: 'business@guangzi-media.com',
  contactAddress: '杭州市余杭区未来科技城梦想小镇创业大街28号楼',
  contactSuccessText: '感谢您的咨询，我们的商务团队将在24小时内与您联系！',
  blocks: {
    hero: true,
    services: true,
    talents: true,
    live: true,
    cases: true,
    data: true,
    process: true,
    about: true,
    contact: true,
  },
  blockOrder: ['hero', 'services', 'talents', 'live', 'cases', 'data', 'process', 'about', 'contact'],
})

fs.writeFileSync(p, JSON.stringify(c, null, 2) + '\n')
console.log('site-config seeded for MCN home')
