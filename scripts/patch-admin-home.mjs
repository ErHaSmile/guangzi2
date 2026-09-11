import fs from 'fs'

const path = 'src/admin/admin.js'
let src = fs.readFileSync(path, 'utf8')
const start = src.indexOf("  if (sectionId === 'home') {")
const end = src.indexOf("  if (sectionId === 'service') {")
if (start < 0 || end < 0 || end <= start) throw new Error('home section bounds not found')

const replacement = `  if (sectionId === 'home') {
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
        build: () =>
          block('', [
            homeBlockToggleNote('services'),
            field('眉题', 'pages.home.servicesEyebrow'),
            field('标题', 'pages.home.servicesTitle'),
            field('描述', 'pages.home.servicesDesc', 'textarea', { rows: 3 }),
            sectionNote('服务卡片目前按参考站静态展示；后续可再做成列表编辑。'),
          ]),
      },
      {
        id: 'talents',
        category: '达人',
        label: '达人资源',
        hint: '双轮驱动达人区文案',
        toggleKey: 'talents',
        build: () =>
          block('', [
            homeBlockToggleNote('talents'),
            field('眉题', 'pages.home.talentsEyebrow'),
            field('标题', 'pages.home.talentsTitle'),
            field('描述', 'pages.home.talentsDesc', 'textarea', { rows: 3 }),
          ]),
      },
      {
        id: 'live',
        category: '案例',
        label: '直播案例',
        hint: '直播战绩区文案',
        toggleKey: 'live',
        build: () =>
          block('', [
            homeBlockToggleNote('live'),
            field('眉题', 'pages.home.liveEyebrow'),
            field('标题', 'pages.home.liveTitle'),
            field('描述', 'pages.home.liveDesc', 'textarea', { rows: 3 }),
          ]),
      },
      {
        id: 'cases',
        category: '案例',
        label: '成功案例',
        hint: '品牌合作案例区文案',
        toggleKey: 'cases',
        build: () =>
          block('', [
            homeBlockToggleNote('cases'),
            field('眉题', 'pages.home.casesEyebrow'),
            field('标题', 'pages.home.casesTitle'),
            field('描述', 'pages.home.casesDesc', 'textarea', { rows: 3 }),
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
          ]),
      },
      {
        id: 'process',
        category: '流程',
        label: '服务流程',
        hint: '标准化服务流程文案',
        toggleKey: 'process',
        build: () =>
          block('', [
            homeBlockToggleNote('process'),
            field('眉题', 'pages.home.processEyebrow'),
            field('标题', 'pages.home.processTitle'),
            field('描述', 'pages.home.processDesc', 'textarea', { rows: 3 }),
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

`

src = src.slice(0, start) + replacement + src.slice(end)
fs.writeFileSync(path, src)
console.log('admin home forms replaced', replacement.length)
