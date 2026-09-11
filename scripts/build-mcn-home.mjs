/**
 * Build guanzi_2 MCN homepage from extracted reference body.
 * node scripts/build-mcn-home.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const bodyPath = path.join(root, 'src/mcn/_body.html')
let body = fs.readFileSync(bodyPath, 'utf8')

// Form → API-friendly
body = body.replace(
  /<form onsubmit="event\.preventDefault\(\); alert\([^"]*\)">/,
  '<form id="mcnContactForm">'
)
body = body
  .replace(/id="name"/g, 'id="mcnName" name="name"')
  .replace(/id="phone"/g, 'id="mcnPhone" name="tel"')
  .replace(/id="company"/g, 'id="mcnCompany" name="company"')
  .replace(/id="category"/g, 'id="mcnCategory" name="category"')
  .replace(/id="service"/g, 'id="mcnService" name="serviceType"')
  .replace(/id="msg"/g, 'id="mcnMsg" name="content"')
  .replace(/for="name"/g, 'for="mcnName"')
  .replace(/for="phone"/g, 'for="mcnPhone"')
  .replace(/for="company"/g, 'for="mcnCompany"')
  .replace(/for="category"/g, 'for="mcnCategory"')
  .replace(/for="service"/g, 'for="mcnService"')
  .replace(/for="msg"/g, 'for="mcnMsg"')

if (!body.includes('mcnFormStatus')) {
  body = body.replace(
    /(<button class="btn-primary" type="submit")/,
    '<p class="form-status" id="mcnFormStatus" hidden style="margin:0 0 12px;font-size:14px;"></p>\n          $1'
  )
}

// Block / compose markers for admin + visibility
const sectionMap = [
  ['class="hero" id="home"', 'class="hero" id="home" data-home-block="hero" data-compose-unit="home-hero"'],
  ['class="services" id="services"', 'class="services" id="services" data-home-block="services" data-compose-unit="home-services"'],
  ['class="talents" id="talents"', 'class="talents" id="talents" data-home-block="talents" data-compose-unit="home-talents"'],
  ['class="live-cases" id="live"', 'class="live-cases" id="live" data-home-block="live" data-compose-unit="home-live"'],
  ['class="cases" id="cases"', 'class="cases" id="cases" data-home-block="cases" data-compose-unit="home-cases"'],
  ['class="data" id="data"', 'class="data" id="data" data-home-block="data" data-compose-unit="home-data"'],
  ['class="process"', 'class="process" id="process" data-home-block="process" data-compose-unit="home-process"'],
  ['class="about" id="about"', 'class="about" id="about" data-home-block="about" data-compose-unit="home-about"'],
  ['class="contact" id="contact"', 'class="contact" id="contact" data-home-block="contact" data-compose-unit="home-contact"'],
]
for (const [from, to] of sectionMap) {
  if (body.includes(from) && !body.includes(to)) body = body.replace(from, to)
}

// Logo / brand binds
body = body.replace(
  /<span class="logo-mark">光<\/span>\s*<span>光子文化<\/span>/,
  '<span class="logo-mark" data-bind="pages.home.logoMark">光</span>\n      <span data-bind="global.brandSub">光子文化</span>'
)

// Hero binds
body = body.replace(
  /<div class="micro-label">GUANGZI CULTURE · MCN<\/div>/,
  '<div class="micro-label" data-bind="pages.home.heroEyebrow">GUANGZI CULTURE · MCN</div>'
)
body = body.replace(
  /<h1 class="hero-title">[\s\S]*?<\/h1>/,
  `<h1 class="hero-title" data-bind-html="pages.home.heroTitleHtml">
          达人BD × 自有主播<br/>
          <span class="accent">双轮驱动</span>的<br/>
          全链路MCN机构
        </h1>`
)
body = body.replace(
  /<p class="hero-desc">[\s\S]*?<\/p>/,
  `<p class="hero-desc" data-bind="pages.home.heroDesc">
          光子文化深耕直播电商领域，以达人商务对接与自有主播孵化为核心双引擎，
          为品牌提供从选品策划到直播落地的一站式增长解决方案。
        </p>`
)

// Hero image
body = body.replace(
  /<img src="\/mcn\/images\/aadkue22lsccw_ve_miaoda-d571f2a1\.png" alt="自有主播" \/>/,
  '<img data-bind="pages.home.heroImage" src="/mcn/images/aadkue22lsccw_ve_miaoda-d571f2a1.png" alt="自有主播" />'
)

// Services head
body = body.replace(
  /(<section class="services"[\s\S]*?<div class="micro-label">)CORE SERVICES(<\/div>\s*<h2 class="section-title">)六大核心服务能力(<\/h2>\s*<p class="section-desc">)[\s\S]*?(<\/p>)/,
  `$1<span data-bind="pages.home.servicesEyebrow">CORE SERVICES</span>$2<span data-bind="pages.home.servicesTitle">六大核心服务能力</span>$3<span data-bind="pages.home.servicesDesc">从达人对接到直播落地，从内容种草到数据复盘，为品牌提供全链路的直播电商增长方案</span>$4`
)

// Contact info binds
body = body.replace(
  /(<div class="contact-info">\s*<div class="micro-label">)CONTACT US(<\/div>\s*<h3>)让我们一起<br\/>打造下一个爆款(<\/h3>\s*<p>)[\s\S]*?(<\/p>)/,
  `$1<span data-bind="pages.home.contactEyebrow">CONTACT US</span>$2<span data-bind-html="pages.home.contactTitleHtml">让我们一起<br/>打造下一个爆款</span>$3<span data-bind="pages.home.contactDesc">无论您是想试水直播电商的新锐品牌，还是寻求增长突破的成熟品牌，光子文化都能为您量身定制最适合的达人对接与直播运营方案。</span>$4`
)

fs.writeFileSync(bodyPath, body)

const index = `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title data-bind="pages.home.seo.title">光子文化 · 达人BD × 自有主播 双轮驱动MCN</title>
    <meta
      name="description"
      data-bind="pages.home.seo.description"
      content="光子文化深耕直播电商，以达人商务对接与自有主播孵化为核心双引擎，为品牌提供全链路MCN增长方案。"
    />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700;900&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="/src/mcn/mcn.css" />
  </head>
  <body class="page-home page-mcn">
${body}
    <script src="/vendor/echarts.min.js"></script>
    <script type="module" src="/src/mcn/main.js"></script>
  </body>
</html>
`

fs.writeFileSync(path.join(root, 'index.html'), index)
console.log('built index.html', index.length)
