import fs from 'fs'

for (const f of ['index.html', 'src/mcn/_body.html']) {
  let s = fs.readFileSync(f, 'utf8')
  s = s.replace(/<form\b[^>]*>/, '<form id="mcnContactForm">')
  s = s.replace(/id="mcnName"(?! name=)/g, 'id="mcnName" name="name"')
  s = s.replace(/id="mcnPhone"(?! name=)/g, 'id="mcnPhone" name="tel"')
  s = s.replace(/id="mcnCompany"(?! name=)/g, 'id="mcnCompany" name="company"')
  s = s.replace(/id="mcnCategory"(?! name=)/g, 'id="mcnCategory" name="category"')
  s = s.replace(/id="mcnService"(?! name=)/g, 'id="mcnService" name="serviceType"')
  s = s.replace(/id="mcnMsg"(?! name=)/g, 'id="mcnMsg" name="content"')
  if (!s.includes('id="mcnName"')) {
    s = s.replace(/id="name"/g, 'id="mcnName" name="name"')
    s = s.replace(/id="phone"/g, 'id="mcnPhone" name="tel"')
    s = s.replace(/id="company"/g, 'id="mcnCompany" name="company"')
    s = s.replace(/id="category"/g, 'id="mcnCategory" name="category"')
    s = s.replace(/id="service"/g, 'id="mcnService" name="serviceType"')
    s = s.replace(/id="msg"/g, 'id="mcnMsg" name="content"')
  }
  if (!s.includes('mcnFormStatus')) {
    s = s.replace(
      /(<button class="btn-primary" type="submit")/,
      '<p class="form-status" id="mcnFormStatus" hidden style="margin:0 0 12px;font-size:14px;"></p>\n          $1'
    )
  }
  fs.writeFileSync(f, s)
  const i = s.indexOf('<form')
  console.log(f, JSON.stringify(s.slice(i, i + 80)))
}
