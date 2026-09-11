/**
 * Inject agency component fragments into MCN body + index.
 * node scripts/inject-agency-components.mjs
 */
import fs from 'fs'

const frag = fs.readFileSync('src/agency/_fragments.html', 'utf8').trim()
const marker = '<!-- AGENCY_COMPONENTS -->'

function inject(file) {
  let s = fs.readFileSync(file, 'utf8')
  if (s.includes('data-compose-unit="creative-hero"')) {
    // replace existing agency block if present
    s = s.replace(
      /<!-- AGENCY_COMPONENTS -->[\s\S]*?<!-- \/AGENCY_COMPONENTS -->\n?/,
      `${marker}\n${frag}\n<!-- /AGENCY_COMPONENTS -->\n`
    )
    if (!s.includes('<!-- /AGENCY_COMPONENTS -->')) {
      // previously injected without wrapper — skip duplicate
      console.log('skip duplicate', file)
      return
    }
  } else {
    const needle = '<section class="contact" id="contact"'
    const i = s.indexOf(needle)
    if (i < 0) throw new Error('contact section not found in ' + file)
    s = s.slice(0, i) + `${marker}\n${frag}\n<!-- /AGENCY_COMPONENTS -->\n\n` + s.slice(i)
  }
  fs.writeFileSync(file, s)
  console.log('injected', file)
}

inject('src/mcn/_body.html')

// rebuild index from body
const body = fs.readFileSync('src/mcn/_body.html', 'utf8')
const indexPrev = fs.readFileSync('index.html', 'utf8')
const headEnd = indexPrev.indexOf('<body class="page-home page-mcn">')
const head = indexPrev.slice(0, headEnd) + '<body class="page-home page-mcn">\n'
const foot = `\n    <script src="/vendor/echarts.min.js"></script>\n    <script type="module" src="/src/mcn/main.js"></script>\n  </body>\n</html>\n`
fs.writeFileSync('index.html', head + body + foot)
console.log('index rebuilt')
