import fs from 'fs'

const p = 'public/site-config.json'
const c = JSON.parse(fs.readFileSync(p, 'utf8'))

c.global.brandName = 'GUANGZI'
c.global.brandSub = '光子文化 · MCN'
c.global.footer.title = "LET'S GROW TOGETHER"
c.global.footer.lead = '达人BD × 自有主播双轮驱动，\n为品牌提供全链路直播电商增长。'
c.global.footer.brand = 'GUANGZI.'
c.global.footer.copyright = '© 2019 – 2026 光子文化 GUANGZI MEDIA'

c.pages.home.seo.title = '光子文化 · 达人BD × 自有主播 双轮驱动MCN'
c.pages.home.seo.description =
  '光子文化深耕直播电商，以达人商务对接与自有主播孵化为核心双引擎，提供全链路MCN服务。'
c.pages.home.heroTitle = '双轮驱动'
c.pages.home.heroSubtitle = '达人BD × 自有主播 · 全链路MCN机构'
c.pages.home.specialtyTitle = '达人对接与主播孵化。<br />这是我们的双引擎。'
c.pages.home.whoLabel = '[ 关于我们 ]'
c.pages.home.introTitle =
  '多年来，我们以<a href="/case.html">达人资源</a>与<a href="/case.html">自有主播</a>双轮驱动，服务品牌直播增长'
c.pages.home.introText =
  '光子文化深耕直播电商领域，以达人商务对接与自有主播孵化为核心双引擎。\n\n从达人对接到专场策划、从主播孵化到货盘运营，我们提供可复用的增长链路。\n\n聊聊你的下一个直播项目…'
c.pages.home.whatEyebrow = 'WHAT WE DO'
c.pages.home.whatTitle = '六大核心服务能力'
c.pages.home.whatDesc =
  '围绕达人BD与自有主播双轮驱动，覆盖商务对接、直播运营、内容种草与复盘增长。'

const items = [
  ['达人商务对接', '覆盖头部/腰部达人资源，精准匹配品类与档期，缩短品牌合作链路。'],
  ['自有主播孵化', '选拔、培训、人设打造与账号运营，沉淀可复制的自有主播矩阵。'],
  ['直播运营执行', '从脚本、货盘到中控与复盘，保障专场转化与品牌安全。'],
  ['内容种草投放', '短视频与直播切片联动，放大达人声量与长尾转化。'],
]
;(c.pages.home.whatItems || []).forEach((it, i) => {
  if (items[i]) {
    it.title = items[i][0]
    it.desc = items[i][1]
  }
})

if (c.pages.about?.seo) {
  c.pages.about.seo.title = '关于我们-光子文化双轮驱动MCN'
  c.pages.about.seo.description =
    '光子文化成立于2019年，是以达人BD + 自有主播双轮驱动的MCN机构。'
}

fs.writeFileSync(p, JSON.stringify(c, null, 2) + '\n')
console.log('ok', c.global.brandSub, c.pages.home.heroTitle, c.pages.home.whatItems[0].title)
