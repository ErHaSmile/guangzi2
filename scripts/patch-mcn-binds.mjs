import fs from 'fs'

let s = fs.readFileSync('index.html', 'utf8')
const reps = [
  ['<div class="value">400-888-6666</div>', '<div class="value" data-bind="pages.home.contactTel">400-888-6666</div>'],
  [
    '<div class="value">business@guangzi-media.com</div>',
    '<div class="value" data-bind="pages.home.contactEmail">business@guangzi-media.com</div>',
  ],
  [
    '<div class="value">杭州市余杭区未来科技城梦想小镇创业大街28号楼</div>',
    '<div class="value" data-bind="pages.home.contactAddress">杭州市余杭区未来科技城梦想小镇创业大街28号楼</div>',
  ],
  ['<div class="num">98%</div>', '<div class="num" data-bind="pages.home.heroFloatNum">98%</div>'],
  ['<div class="label">客户复购率</div>', '<div class="label" data-bind="pages.home.heroFloatLabel">客户复购率</div>'],
]
for (const [a, b] of reps) {
  if (s.includes(a)) s = s.replace(a, b)
  else console.log('miss', a.slice(0, 40))
}
fs.writeFileSync('index.html', s)
console.log('binds patched')
