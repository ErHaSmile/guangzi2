import fs from 'fs'
import path from 'path'

const ref = process.argv[2]
const outRoot = process.argv[3]
const html = fs.readFileSync(ref, 'utf8')

// extract style
const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/)
const css = styleMatch ? styleMatch[1] : ''
fs.mkdirSync(path.join(outRoot, 'src/mcn'), { recursive: true })
fs.writeFileSync(path.join(outRoot, 'src/mcn/mcn.css'), css.trim() + '\n')

// extract body inner
const bodyMatch = html.match(/<body>([\s\S]*?)<\/body>/)
let body = bodyMatch ? bodyMatch[1] : ''

// extract inline script (charts)
const scripts = [...body.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1])
body = body.replace(/<script>[\s\S]*?<\/script>/g, '')

// fix image paths
body = body.replace(/\.\/images\//g, '/mcn/images/')
body = body.replace(/src="images\//g, 'src="/mcn/images/')

// remove feishu font dependency - use google fonts Noto Sans SC in head instead
const chartsJs = scripts.join('\n\n')
fs.writeFileSync(path.join(outRoot, 'src/mcn/mcn-charts.js'), `/* auto from reference */\nexport function initMcnCharts(echarts) {\n${chartsJs}\n}\n`)

fs.writeFileSync(path.join(outRoot, 'src/mcn/_body.html'), body.trim() + '\n')
console.log('css bytes', css.length, 'body bytes', body.length, 'charts scripts', scripts.length)
