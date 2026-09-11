import fs from 'fs'

function replaceGrid(html, className, dataList) {
  const start = html.indexOf(`<div class="${className}">`)
  if (start < 0) throw new Error('missing ' + className)
  const afterStart = html.slice(start)
  const m = afterStart.match(new RegExp(`^<div class="${className}">[\\s\\S]*?</div>\\s*</div>\\s*</section>`))
  if (!m) throw new Error('end not found for ' + className)
  const replaced = `<div class="${className}" data-list="${dataList}"></div>\n  </div>\n</section>`
  return html.slice(0, start) + afterStart.replace(m[0], replaced)
}

let body = fs.readFileSync('src/mcn/_body.html', 'utf8')
const pairs = [
  ['services-grid', 'pages.home.serviceItems'],
  ['talent-grid', 'pages.home.talentItems'],
  ['live-grid', 'pages.home.liveItems'],
  ['case-grid', 'pages.home.caseItems'],
  ['process-steps', 'pages.home.processSteps'],
]
for (const [cls, path] of pairs) {
  body = replaceGrid(body, cls, path)
  console.log('ok', cls)
}
fs.writeFileSync('src/mcn/_body.html', body)

const indexPrev = fs.readFileSync('index.html', 'utf8')
const headEnd = indexPrev.indexOf('<body class="page-home page-mcn">')
const head = indexPrev.slice(0, headEnd) + '<body class="page-home page-mcn">\n'
const foot = `\n    <script src="/vendor/echarts.min.js"></script>\n    <script type="module" src="/src/mcn/main.js"></script>\n  </body>\n</html>\n`
fs.writeFileSync('index.html', head + body + foot)
console.log('index rebuilt')
