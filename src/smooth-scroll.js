/** 对标 king-tin：Lenis 平滑滚动（带惯性） */

let lenis = null
let rafId = 0
let loading = null

function raf(time) {
  lenis?.raf(time)
  rafId = requestAnimationFrame(raf)
}

function loadLenisCtor() {
  if (typeof window !== 'undefined' && window.Lenis) return Promise.resolve(window.Lenis)
  if (loading) return loading

  loading = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-lenis]')
    if (existing) {
      existing.addEventListener('load', () => resolve(window.Lenis))
      existing.addEventListener('error', reject)
      if (window.Lenis) resolve(window.Lenis)
      return
    }
    const script = document.createElement('script')
    script.src = '/vendor/lenis.js'
    script.async = true
    script.dataset.lenis = '1'
    script.onload = () => {
      if (!window.Lenis) reject(new Error('Lenis missing after load'))
      else resolve(window.Lenis)
    }
    script.onerror = () => reject(new Error('Failed to load Lenis'))
    document.head.appendChild(script)
  })

  return loading
}

export async function initSmoothScroll() {
  if (lenis) return lenis
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null

  try {
    const LenisCtor = await loadLenisCtor()
    document.documentElement.classList.add('lenis', 'lenis-smooth')

    lenis = new LenisCtor({
      duration: 1.5,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      direction: 'vertical',
      gestureDirection: 'vertical',
      smooth: true,
      mouseMultiplier: 1,
      smoothTouch: false,
      touchMultiplier: 1,
      infinite: false,
    })

    cancelAnimationFrame(rafId)
    rafId = requestAnimationFrame(raf)
    return lenis
  } catch (err) {
    console.warn('[lenis]', err)
    return null
  }
}

export function getLenis() {
  return lenis
}

export function setSmoothScrollPaused(paused) {
  if (!lenis) return
  if (paused) lenis.stop()
  else lenis.start()
}
