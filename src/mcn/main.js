import { applySiteConfig, listenPreviewReload, loadSiteConfig } from '../config.js'
import { initMcnCharts } from './mcn-charts.js'
import { wireCreativeHeroSound } from '../agency/creative-hero.js'
import './mcn.css'
import './mcn-detail.css'
import '../agency/agency-components.css'

let siteConfig = null

function wireNavToggle() {
  const btn = document.querySelector('.nav-toggle')
  const links = document.querySelector('.nav-links')
  if (!btn || !links) return
  btn.addEventListener('click', () => {
    const open = getComputedStyle(links).display === 'flex'
    links.style.display = open ? 'none' : 'flex'
  })
}

function wireSmoothAnchors() {
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href')?.slice(1)
      if (!id) return
      const el = document.getElementById(id)
      if (!el) return
      e.preventDefault()
      el.scrollIntoView({ behavior: 'smooth' })
    })
  })
}

function wireContactForm() {
  const form = document.getElementById('mcnContactForm')
  if (!form) return
  const status = document.getElementById('mcnFormStatus')
  const setMessage = (text, isError) => {
    if (!status) return
    status.hidden = !text
    status.textContent = text || ''
    status.style.color = isError ? '#b91c1c' : '#6B8A2A'
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const fd = new FormData(form)
    const category = String(fd.get('category') || '').trim()
    const serviceType = String(fd.get('serviceType') || '').trim()
    const contentRaw = String(fd.get('content') || '').trim()
    const extra = [category && `品类：${category}`, serviceType && `服务：${serviceType}`]
      .filter(Boolean)
      .join('；')
    const payload = {
      name: String(fd.get('name') || '').trim(),
      tel: String(fd.get('tel') || '').trim(),
      company: String(fd.get('company') || '').trim(),
      content: [extra, contentRaw].filter(Boolean).join('\n'),
      source: 'mcn-home',
    }
    if (!payload.name || !payload.tel || !contentRaw) {
      setMessage('请填写姓名、电话与需求描述', true)
      return
    }
    const submitBtn = form.querySelector('[type="submit"]')
    if (submitBtn) submitBtn.disabled = true
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || '提交失败，请稍后重试')
      setMessage(siteConfig?.pages?.home?.contactSuccessText || '感谢您的咨询，我们的商务团队将在24小时内与您联系！', false)
      form.reset()
    } catch (err) {
      setMessage(err.message || '提交失败，请稍后重试', true)
    } finally {
      if (submitBtn) submitBtn.disabled = false
    }
  })
}

async function boot() {
  wireNavToggle()
  wireSmoothAnchors()
  wireContactForm()

  try {
    siteConfig = await loadSiteConfig()
    await applySiteConfig(siteConfig)
  } catch (err) {
    console.warn('[mcn] config load failed', err)
  }

  wireCreativeHeroSound()

  if (typeof window.echarts !== 'undefined') {
    try {
      initMcnCharts(window.echarts)
    } catch (err) {
      console.warn('[mcn] charts init failed', err)
    }
  }

  listenPreviewReload?.(() => window.location.reload())
}

boot()
