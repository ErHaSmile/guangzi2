/**
 * Shared site chrome helpers for multi-page static site.
 * Pages still embed header markup; this keeps behavior consistent.
 */

export const routes = {
  home: '/',
  about: '/about.html',
  service: '/service.html',
  news: '/news.html',
  case: '/case.html',
  contact: '/contact.html',
  page: '/page.html',
  feedback: '/contact.html#feedback',
  tel: 'tel:010-8596-8820',
}

export function wireHashScroll() {
  if (!location.hash) return
  const el = document.querySelector(location.hash)
  if (el) {
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }
}
