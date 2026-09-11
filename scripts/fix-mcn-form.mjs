import fs from 'fs'

for (const f of ['index.html', 'src/mcn/_body.html']) {
  let s = fs.readFileSync(f, 'utf8')
  s = s.replace(
    /<form onsubmit="event\.preventDefault\(\); alert\([^"]*\)">/,
    '<form id="mcnContactForm">'
  )
  const pairs = [
    [/id="name"/g, 'id="mcnName" name="name"'],
    [/id="phone"/g, 'id="mcnPhone" name="tel"'],
    [/id="company"/g, 'id="mcnCompany" name="company"'],
    [/id="category"/g, 'id="mcnCategory" name="category"'],
    [/id="service"/g, 'id="mcnService" name="serviceType"'],
    [/id="msg"/g, 'id="mcnMsg" name="content"'],
    [/for="name"/g, 'for="mcnName"'],
    [/for="phone"/g, 'for="mcnPhone"'],
    [/for="company"/g, 'for="mcnCompany"'],
    [/for="category"/g, 'for="mcnCategory"'],
    [/for="service"/g, 'for="mcnService"'],
    [/for="msg"/g, 'for="mcnMsg"'],
  ]
  for (const [re, to] of pairs) s = s.replace(re, to)
  if (!s.includes('mcnFormStatus')) {
    s = s.replace(
      /(<button class="btn-primary" type="submit")/,
      '<p class="form-status" id="mcnFormStatus" hidden style="margin:0 0 12px;font-size:14px;"></p>\n          $1'
    )
  }
  fs.writeFileSync(f, s)
  console.log('fixed', f, 'form=', s.includes('mcnContactForm'))
}
