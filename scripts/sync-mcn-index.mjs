import fs from 'fs'

const body = fs.readFileSync('src/mcn/_body.html', 'utf8')
const indexPrev = fs.readFileSync('index.html', 'utf8')
const headEnd = indexPrev.indexOf('<body class="page-home page-mcn">')
if (headEnd < 0) throw new Error('index body marker missing')
const head = indexPrev.slice(0, headEnd) + '<body class="page-home page-mcn">\n'
const foot = `\n    <script src="/vendor/echarts.min.js"></script>\n    <script type="module" src="/src/mcn/main.js"></script>\n  </body>\n</html>\n`
fs.writeFileSync('index.html', head + body + foot)
console.log('index synced from _body.html')
