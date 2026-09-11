import fs from 'fs'

const p = 'src/page-registry.js'
let s = fs.readFileSync(p, 'utf8')
const inject = `
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
`
if (!s.includes("'home-who': 'home-about'")) {
  s = s.replace('export const LEGACY_COMPONENT_MAP = {', `export const LEGACY_COMPONENT_MAP = {${inject}`)
  fs.writeFileSync(p, s)
  console.log('legacy map updated')
} else {
  console.log('legacy already present')
}
