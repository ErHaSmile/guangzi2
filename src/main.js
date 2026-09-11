import { wireHashScroll } from './routes.js'
import { applySiteConfig, listenPreviewReload, loadSiteConfig } from './config.js'
import { initSmoothScroll, setSmoothScrollPaused } from './smooth-scroll.js'

const header = document.getElementById('header')
const menuBtn = document.getElementById('menuBtn')
const gnavi = document.getElementById('gnavi')
const menuCursor = document.getElementById('menuCursor')

let siteConfig = null
let cursorVisible = false

initSmoothScroll().catch(() => {})

function getGnaviLinks() {
  return [...document.querySelectorAll('.gnavi-link')]
}

function setMenuOpen(open) {
  if (!header || !gnavi || !menuBtn) return
  header.classList.toggle('show', open)
  gnavi.classList.toggle('nav-open', open)
  gnavi.setAttribute('aria-hidden', String(!open))
  document.body.classList.toggle('nav-open', open)
  menuBtn.setAttribute('aria-label', open ? '关闭菜单' : '打开菜单')
  setSmoothScrollPaused(open)
  if (
    document.body.classList.contains('page-about') ||
    document.body.classList.contains('page-contact') ||
    document.body.classList.contains('page-home') ||
    document.body.classList.contains('page-case-detail')
  ) {
    const threshold = Math.min(window.innerHeight * 0.55, 480)
    header.classList.toggle('is-solid', !open && window.scrollY > threshold)
  }
  const siteCursor = document.querySelector('.site-cursor')
  if (open) {
    siteCursor?.classList.remove('is-click', 'is-press')
  }
  if (!open && menuCursor) {
    menuCursor.classList.remove('is-active', 'is-press')
    getGnaviLinks().forEach((link) => link.classList.remove('is-hover'))
  }
}

function moveCursor(x, y) {
  if (!menuCursor) return
  menuCursor.style.setProperty('--mx', `${x}px`)
  menuCursor.style.setProperty('--my', `${y}px`)
  menuCursor.style.transform = `translate3d(${x}px, ${y}px, 0) scale(1)`
}

if (menuBtn && gnavi) {
  menuBtn.addEventListener('click', () => {
    setMenuOpen(!gnavi.classList.contains('nav-open'))
  })

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setMenuOpen(false)
  })

  gnavi.addEventListener('click', (e) => {
    const link = e.target.closest('.gnavi-link')
    if (link) setMenuOpen(false)
  })

  gnavi.addEventListener('mousemove', (e) => {
    if (!gnavi.classList.contains('nav-open')) return
    moveCursor(e.clientX, e.clientY)
  })

  gnavi.addEventListener('mouseover', (e) => {
    const link = e.target.closest('.gnavi-link')
    if (!link || !gnavi.contains(link)) return
    cursorVisible = true
    getGnaviLinks().forEach((l) => l.classList.remove('is-hover'))
    link.classList.add('is-hover')
    menuCursor?.classList.add('is-active')
    moveCursor(e.clientX, e.clientY)
  })

  gnavi.addEventListener('mouseout', (e) => {
    const link = e.target.closest('.gnavi-link')
    if (!link) return
    const related = e.relatedTarget?.closest?.('.gnavi-link')
    if (related === link) return
    if (!related) {
      cursorVisible = false
      link.classList.remove('is-hover')
      menuCursor?.classList.remove('is-active', 'is-press')
    }
  })

  gnavi.addEventListener('mousedown', (e) => {
    if (e.target.closest('.gnavi-link') && cursorVisible) menuCursor?.classList.add('is-press')
  })

  gnavi.addEventListener('mouseup', () => {
    menuCursor?.classList.remove('is-press')
  })
}

const io = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible')
        io.unobserve(entry.target)
      }
    })
  },
  { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
)

function observeReveals() {
  document.querySelectorAll('.reveal, .reveal-up, .reveal-left, .reveal-right').forEach((el, index) => {
    if (el.classList.contains('is-visible')) return
    if (el.closest('.scroll-reveal')) return
    const customDelay = el.getAttribute('data-reveal-delay')
    if (customDelay != null) el.style.transitionDelay = `${customDelay}s`
    else if (!el.style.transitionDelay) el.style.transitionDelay = `${(index % 6) * 0.08}s`
    io.observe(el)
  })
}

/** 服务卡片：滚入显示、滚出隐藏 */
const serviceCardIo = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      entry.target.classList.toggle('is-inview', entry.isIntersecting)
    })
  },
  { threshold: 0.18, rootMargin: '0px 0px -10% 0px' }
)

function observeServiceCards() {
  document.querySelectorAll('.service-block.scroll-reveal').forEach((el) => {
    serviceCardIo.observe(el)
  })
}

const HOME_SOUND_KEY = 'guanzi-home-video-sound'

/**
 * 首页 Hero 声音状态
 * - want: 用户偏好（默认关，避免未操作就出声）
 * - token: 递增以作废进行中的异步 play/mute，避免把用户刚开的声又静音
 * - bound: 是否已绑定手势
 */
const homeSoundState = {
  want: false,
  token: 0,
  bound: false,
}

function getHomeSoundPref() {
  try {
    const raw = localStorage.getItem(HOME_SOUND_KEY)
    if (raw == null) return false
    return raw === '1' || raw === 'true'
  } catch {
    return false
  }
}

function setHomeSoundPref(on) {
  try {
    localStorage.setItem(HOME_SOUND_KEY, on ? '1' : '0')
  } catch {
    /* ignore */
  }
}

function getHomeVideoEls() {
  return {
    video: document.getElementById('homeVideo'),
    btn: document.getElementById('homeSoundToggle'),
  }
}

function setHomeVideoMuted(video, muted) {
  if (!video) return
  video.muted = Boolean(muted)
  video.defaultMuted = Boolean(muted)
  video.volume = 1
  if (muted) video.setAttribute('muted', '')
  else video.removeAttribute('muted')
}

function syncHomeSoundUi(video, btn) {
  if (!video || !btn) return
  // 偏好为关时强制静音，避免 UI 显示 Off 仍出声
  if (!homeSoundState.want && !video.muted) setHomeVideoMuted(video, true)
  const liveMuted = Boolean(video.muted)
  const sounding = homeSoundState.want && !liveMuted
  const noAudio = video.dataset.noAudio === '1'
  btn.classList.toggle('is-muted', liveMuted)
  btn.classList.toggle('is-on', sounding)
  btn.classList.toggle('is-blocked', Boolean(homeSoundState.want && liveMuted))
  btn.classList.toggle('is-no-audio', noAudio)
  btn.setAttribute('aria-pressed', sounding ? 'true' : 'false')
  btn.setAttribute('aria-label', sounding ? '关闭声音' : '开启声音')
  const label = btn.querySelector('.home-sound-label')
  if (label) {
    if (noAudio) label.textContent = 'N/A'
    else if (homeSoundState.want && liveMuted) label.textContent = 'Tap'
    else label.textContent = sounding ? 'On' : 'Off'
  }
}

function detectHomeVideoAudio(video) {
  if (!video) return
  const mark = () => {
    try {
      const tracks = typeof video.audioTracks !== 'undefined' ? video.audioTracks : null
      // audioTracks 仅部分浏览器可读；有 length===0 时基本可判定无音轨
      if (tracks && typeof tracks.length === 'number' && video.readyState >= 1) {
        video.dataset.noAudio = tracks.length === 0 ? '1' : '0'
      }
    } catch {
      /* ignore */
    }
    const { btn } = getHomeVideoEls()
    syncHomeSoundUi(video, btn)
  }
  if (video.readyState >= 1) mark()
  else video.addEventListener('loadedmetadata', mark, { once: true })
}

/** 仅在用户手势栈内调用：同步 unmute；已在播则不必再 play（避免 AbortError 误关声） */
function enableHomeSoundFromGesture() {
  const { video, btn } = getHomeVideoEls()
  if (!video) return false
  homeSoundState.want = true
  setHomeSoundPref(true)
  // 作废任何还在跑的「先静音再尝试」异步逻辑
  const myToken = ++homeSoundState.token
  setHomeVideoMuted(video, false)
  syncHomeSoundUi(video, btn)

  const ensureUnmuted = () => {
    if (myToken !== homeSoundState.token) return
    if (video.muted) setHomeVideoMuted(video, false)
    video.setAttribute('data-ready', 'true')
    syncHomeSoundUi(video, btn)
  }

  // 静音自动播已在播时，手势内 unmute 即可出声；再调 play() 易被并发 play 打断
  if (!video.paused) {
    ensureUnmuted()
    return true
  }

  const playPromise = video.play()
  if (playPromise && typeof playPromise.then === 'function') {
    playPromise.then(ensureUnmuted).catch((err) => {
      if (myToken !== homeSoundState.token) return
      // 被后来的 play/load 打断时，不要把用户刚开的声又静音
      if (err && err.name === 'AbortError') {
        ensureUnmuted()
        return
      }
      // NotAllowed 等：保持 want，UI 继续「点击开声」，切勿强行 remute 误判
      syncHomeSoundUi(video, btn)
    })
  }
  return true
}

function disableHomeSound() {
  const { video, btn } = getHomeVideoEls()
  if (!video) return
  homeSoundState.want = false
  setHomeSoundPref(false)
  homeSoundState.token += 1
  setHomeVideoMuted(video, true)
  if (video.paused) video.play()?.catch(() => {})
  syncHomeSoundUi(video, btn)
}

/** 静音自动播放（不尝试有声，避免异步竞态把开声打回去） */
function startHomeVideoMuted(token) {
  const { video, btn } = getHomeVideoEls()
  if (!video) return
  // 用户已开声：不要被后续 boot/resume 再静音
  if (token !== homeSoundState.token) return
  if (!video.muted && homeSoundState.want) {
    syncHomeSoundUi(video, btn)
    return
  }
  video.playsInline = true
  video.setAttribute('playsinline', '')
  video.setAttribute('webkit-playsinline', '')
  video.loop = true
  video.preload = 'auto'
  video.volume = 1
  setHomeVideoMuted(video, true)
  const playPromise = video.play()
  syncHomeSoundUi(video, btn)
  if (playPromise && typeof playPromise.then === 'function') {
    playPromise
      .then(() => {
        if (token !== homeSoundState.token) return
        video.setAttribute('data-ready', 'true')
        syncHomeSoundUi(video, btn)
      })
      .catch(() => {
        if (token !== homeSoundState.token) return
        syncHomeSoundUi(video, btn)
      })
  }
}

/** 首页 Hero 声音：静音自动播 + 点击/手势开声（一次性绑定） */
function initHomeHeroSound() {
  if (!document.body.classList.contains('page-home')) return
  const { video, btn } = getHomeVideoEls()
  if (!video || !btn) return

  homeSoundState.want = getHomeSoundPref()
  video.dataset.mediaManaged = '1'
  video.dataset.homeSound = '1'
  detectHomeVideoAudio(video)

  if (!homeSoundState.bound) {
    homeSoundState.bound = true
    let handledByPointer = false

    const toggleSound = () => {
      if (video.muted || !homeSoundState.want) enableHomeSoundFromGesture()
      else disableHomeSound()
    }

    // pointerdown 更早进入用户激活窗口；click 作键盘/仅 click 环境兜底（防双触发）
    btn.addEventListener('pointerdown', (e) => {
      if (typeof e.button === 'number' && e.button !== 0) return
      handledByPointer = true
      e.preventDefault()
      e.stopPropagation()
      toggleSound()
    })
    btn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (handledByPointer) {
        handledByPointer = false
        return
      }
      toggleSound()
    })

    // 点 Hero 空白处也可开声（链接/按钮除外）
    const hero = document.getElementById('homeHero') || video.closest('.home-hero')
    hero?.addEventListener(
      'pointerdown',
      (e) => {
        if (!homeSoundState.want || !video.muted) return
        if (e.target.closest('a, button, input, textarea, select')) return
        enableHomeSoundFromGesture()
      },
      { passive: true }
    )
  }

  // 已开声则不要在 bootInteractive 二次 init 时再静音
  if (!video.muted && homeSoundState.want) {
    syncHomeSoundUi(video, btn)
    return
  }

  const token = ++homeSoundState.token
  startHomeVideoMuted(token)
}

/** 配置绑定后：仅在仍静音时补播；用户已开声则绝不 remute */
function resumeHomeHeroSoundAfterBind() {
  if (!document.body.classList.contains('page-home')) return
  const { video, btn } = getHomeVideoEls()
  if (!video || video.dataset.homeSound !== '1') return
  homeSoundState.want = getHomeSoundPref()
  detectHomeVideoAudio(video)
  if (!video.muted && homeSoundState.want) {
    syncHomeSoundUi(video, btn)
    return
  }
  const token = ++homeSoundState.token
  startHomeVideoMuted(token)
  syncHomeSoundUi(video, btn)
}

function playVideos() {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  // 首页 Hero 由 initHomeHeroSound 托管（含声音开关）
  const criticalIds = new Set(['contactVideo'])
  const allIds = ['homeMobileVideo', 'homeAdVideo', 'video1', 'contactVideo']

  const canShow = (video) => {
    if (!video || video.closest('[hidden], .is-home-block-off')) return false
    if (getComputedStyle(video).display === 'none') return false
    const pin = video.closest('.service-media-pin')
    if (pin && getComputedStyle(pin).display === 'none') return false
    return true
  }

  const warm = (video) => {
    if (!video) return
    video.muted = true
    video.playsInline = true
    // 靠近视口再升到 auto，避免首屏同时拉多路视频
    if (video.preload !== 'auto') video.preload = 'auto'
    if (video.readyState < 1) {
      try {
        video.load()
      } catch {
        /* ignore */
      }
    }
  }

  const setPlaying = (video, on) => {
    if (!video) return
    video.muted = true
    if (on) {
      if (video.preload !== 'auto') video.preload = 'auto'
      const play = () =>
        video
          .play()
          ?.then(() => video.setAttribute('data-ready', 'true'))
          .catch(() => {})
      if (video.readyState >= 2) play()
      else {
        video.addEventListener('loadeddata', play, { once: true })
        video.addEventListener('canplay', play, { once: true })
      }
    } else if (!video.paused) {
      video.pause()
      // 离屏释放解码：保留当前帧，降低多视频同时解码卡顿
      try {
        video.removeAttribute('data-ready')
      } catch {
        /* ignore */
      }
    }
  }

  allIds.forEach((id) => {
    const video = document.getElementById(id)
    if (!video || !canShow(video)) return
    if (video.dataset.mediaManaged === '1') return
    video.dataset.mediaManaged = '1'
    if (!video.getAttribute('preload')) video.preload = 'metadata'

    if (reduceMotion) {
      video.removeAttribute('autoplay')
      video.pause()
      video.removeAttribute('data-ready')
      return
    }

    if (criticalIds.has(id)) {
      warm(video)
      setPlaying(video, !document.hidden)
      document.addEventListener('visibilitychange', () => setPlaying(video, !document.hidden))
      return
    }

    const serviceStack = id === 'video1' ? document.querySelector('.service-stack') : null
    const observeTargets = serviceStack
      ? [serviceStack]
      : [video.closest('.home-section, .home-hero, .contact-hero, .media-band') || video]

    // 提前约半屏缓冲即可，避免过早抢带宽/解码
    const warmIo = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            warm(video)
            warmIo.disconnect()
          }
        })
      },
      { rootMargin: '50% 0px', threshold: 0 }
    )
    observeTargets.forEach((el) => warmIo.observe(el))

    const visible = new Set()
    const sync = () => setPlaying(video, visible.size > 0 && !document.hidden)
    const playIo = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) visible.add(entry.target)
          else visible.delete(entry.target)
        })
        sync()
      },
      { rootMargin: '12% 0px', threshold: 0.05 }
    )
    observeTargets.forEach((el) => playIo.observe(el))
    document.addEventListener('visibilitychange', sync)
  })
}

/** 靠近视口的懒加载图提前拉起，滚动时几乎无等待 */
function warmLazyImages() {
  const imgs = [...document.querySelectorAll('img[loading="lazy"]')]
  if (!imgs.length || !('IntersectionObserver' in window)) return
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        const img = entry.target
        if (img.dataset.warmed === '1') return
        img.dataset.warmed = '1'
        // 触发浏览器开始拉取（保持 lazy 语义，仅提前）
        const src = img.currentSrc || img.src
        if (src) {
          const probe = new Image()
          probe.decoding = 'async'
          probe.src = src
        }
        io.unobserve(img)
      })
    },
    { rootMargin: '120% 0px', threshold: 0.01 }
  )
  imgs.forEach((img) => io.observe(img))
}

/** 首页区块视频：点击进入播放模式（灯箱 + 控件 + 声音） */
function initHomeMediaPlayback() {
  if (!document.body.classList.contains('page-home')) return
  const triggers = [...document.querySelectorAll('[data-video-play]')]
  if (!triggers.length) return
  if (document.documentElement.dataset.videoLightboxBound === '1') return
  document.documentElement.dataset.videoLightboxBound = '1'

  const box = document.createElement('div')
  box.className = 'video-lightbox'
  box.setAttribute('role', 'dialog')
  box.setAttribute('aria-modal', 'true')
  box.setAttribute('aria-label', '视频播放')
  box.innerHTML = `
    <div class="video-lightbox-dialog">
      <button type="button" class="video-lightbox-close" aria-label="关闭播放">&times;</button>
      <video playsinline controls controlslist="nodownload"></video>
    </div>
  `
  document.body.appendChild(box)

  const player = box.querySelector('video')
  const closeBtn = box.querySelector('.video-lightbox-close')
  let sourceVideo = null
  let lastFocus = null

  const resolveSrc = (video) => {
    if (!video) return ''
    const source = video.querySelector('source')
    return source?.getAttribute('src') || video.currentSrc || video.src || ''
  }

  const close = () => {
    if (!box.classList.contains('is-open')) return
    box.classList.remove('is-open')
    document.body.classList.remove('is-video-lightbox-open')
    player.pause()
    player.removeAttribute('src')
    player.load()
    if (sourceVideo) {
      sourceVideo.muted = true
      sourceVideo.play()?.catch(() => {})
      sourceVideo = null
    }
    lastFocus?.focus?.()
    lastFocus = null
  }

  const open = (frame) => {
    const video = frame.querySelector('video')
    const src = resolveSrc(video)
    if (!src) return
    lastFocus = document.activeElement
    sourceVideo = video
    try {
      video.pause()
    } catch {
      /* ignore */
    }
    const startAt = Number(video?.currentTime) || 0
    player.muted = false
    player.src = src
    const startPlay = () => {
      try {
        if (Number.isFinite(startAt) && startAt > 0) player.currentTime = startAt
      } catch {
        /* ignore */
      }
      player.play()?.catch(() => {
        player.muted = true
        player.play()?.catch(() => {})
      })
    }
    if (player.readyState >= 1) startPlay()
    else player.addEventListener('loadedmetadata', startPlay, { once: true })
    box.classList.add('is-open')
    document.body.classList.add('is-video-lightbox-open')
    closeBtn.focus()
  }

  triggers.forEach((frame) => {
    const openFrom = (e) => {
      e.preventDefault()
      e.stopPropagation()
      open(frame)
    }
    frame.addEventListener('click', openFrom)
    frame.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') openFrom(e)
    })
  })

  closeBtn.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    close()
  })
  box.addEventListener('click', (e) => {
    if (e.target === box) close()
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close()
  })
}

function escapeHeroChar(ch) {
  return ch.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function splitHeroText(el, baseDelay = 0) {
  if (!el) return 0
  // applySiteConfig 会先写入纯文本，这里以当前 textContent 为准
  const text = (el.textContent || '').replace(/\s+/g, ' ').trim()
  if (!text) return 0
  el.setAttribute('data-text', text)
  el.setAttribute('aria-label', text)
  el.classList.remove('is-ready')
  el.classList.add('is-split')

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduce) {
    el.textContent = text
    el.classList.remove('is-split')
    return text.length
  }

  const chars = Array.from(text)
  el.innerHTML = chars
    .map((ch, i) => {
      if (ch === ' ') return '<span class="home-space" aria-hidden="true">&nbsp;</span>'
      return `<span class="home-char-wrap" aria-hidden="true"><span class="home-char" style="--i:${i};--d:${baseDelay}s">${escapeHeroChar(ch)}</span></span>`
    })
    .join('')

  requestAnimationFrame(() => {
    requestAnimationFrame(() => el.classList.add('is-ready'))
  })
  return chars.length
}

function initHeroTextReveal() {
  if (!document.body.classList.contains('page-home')) return
  const title = document.querySelector('.home-title')
  const subtitle = document.querySelector('.home-subtitle')
  const titleLen = splitHeroText(title, 0.12)
  splitHeroText(subtitle, 0.12 + titleLen * 0.038 + 0.18)
}

function initHomeCaseRail() {
  const section = document.getElementById('homeCases')
  const rail = document.getElementById('homeCaseRail')
  const thumb = document.getElementById('homeCaseThumb')
  const viewport = section?.querySelector('.home-case-viewport')
  if (!section || !rail || !thumb || !viewport) return

  let raf = 0

  const maxTranslate = () => Math.max(rail.scrollWidth - viewport.clientWidth, 0)

  const sync = () => {
    raf = 0
    const mobile = window.matchMedia('(max-width: 900px)').matches
    if (mobile) {
      rail.style.transform = ''
      const max = Math.max(rail.scrollWidth - rail.clientWidth, 1)
      const ratio = rail.clientWidth / Math.max(rail.scrollWidth, 1)
      const thumbW = Math.min(Math.max(ratio * 100, 14), 100)
      const progress = rail.scrollLeft / max
      thumb.style.width = `${thumbW}%`
      thumb.style.left = `${progress * (100 - thumbW)}%`
      return
    }

    const total = Math.max(section.offsetHeight - window.innerHeight, 1)
    const scrolled = Math.min(Math.max(-section.getBoundingClientRect().top, 0), total)
    const progress = scrolled / total
    const x = progress * maxTranslate()
    rail.style.transform = `translate3d(${-x}px, 0, 0)`

    const cards = Math.max(rail.children.length, 1)
    const thumbW = Math.min(Math.max(100 / cards, 12), 100)
    thumb.style.width = `${thumbW}%`
    thumb.style.left = `${progress * (100 - thumbW)}%`
  }

  const requestSync = () => {
    if (raf) return
    raf = requestAnimationFrame(sync)
  }

  sync()
  window.addEventListener('scroll', requestSync, { passive: true })
  window.addEventListener('resize', requestSync)
  rail.addEventListener('scroll', requestSync, { passive: true })
}

function initHomeOverseasHover() {
  const list = document.querySelector('.home-overseas-list')
  if (!list) return
  const items = [...list.children]
  if (!items.length) return

  const clear = () => {
    list.classList.remove('is-active')
    items.forEach((li) => li.classList.remove('is-hover', 'is-dim'))
  }

  items.forEach((li) => {
    li.addEventListener('mouseenter', () => {
      if (window.matchMedia('(max-width: 900px)').matches) return
      list.classList.add('is-active')
      items.forEach((other) => {
        other.classList.toggle('is-hover', other === li)
        other.classList.toggle('is-dim', other !== li)
      })
    })
  })
  list.addEventListener('mouseleave', clear)
}

function initHomeNewsFilter() {
  const cats = document.getElementById('homeNewsCats')
  const grid = document.getElementById('homeNewsGrid')
  if (!cats || !grid) return
  const buttons = [...cats.querySelectorAll('.home-news-cat-btn')]
  const cards = [...grid.querySelectorAll('.home-news-card')]
  if (!buttons.length) return

  const apply = (cat) => {
    buttons.forEach((btn) => {
      const active = btn.dataset.cat === cat
      btn.setAttribute('aria-pressed', String(active))
      btn.closest('.home-news-cat')?.classList.toggle('is-active', active)
    })
    cards.forEach((card) => {
      const match = cat === 'all' || card.dataset.cat === cat
      card.classList.toggle('is-hidden', !match)
    })
  }

  cats.addEventListener('click', (e) => {
    const btn = e.target.closest('.home-news-cat-btn')
    if (!btn) return
    apply(btn.dataset.cat || 'all')
  })
}

const SITE_CURSOR_HOVER =
  '.home-news-card-link, .home-case-link, .home-overseas-item, a[data-cursor="click"]'

let siteCursorReady = false

function initSiteCursor() {
  if (siteCursorReady) return
  if (window.matchMedia('(max-width: 1024px), (pointer: coarse)').matches) return
  siteCursorReady = true

  let cursor = document.querySelector('.site-cursor')
  if (!cursor) {
    cursor = document.createElement('div')
    cursor.className = 'site-cursor'
    cursor.innerHTML =
      '<div class="site-cursor-ball" aria-hidden="true"><span class="site-cursor-text">Click</span></div>'
    document.body.appendChild(cursor)
  }

  document.documentElement.classList.add('has-site-cursor')

  let mouseX = window.innerWidth / 2
  let mouseY = window.innerHeight / 2
  let curX = mouseX
  let curY = mouseY
  let started = false

  const tick = () => {
    curX += (mouseX - curX) / 5
    curY += (mouseY - curY) / 5
    cursor.style.transform = `translate3d(${curX}px, ${curY}px, 0)`
    requestAnimationFrame(tick)
  }

  const onMove = (e) => {
    mouseX = e.clientX
    mouseY = e.clientY
    if (!started) {
      started = true
      curX = mouseX
      curY = mouseY
      cursor.classList.add('is-on')
      tick()
    }
  }

  window.addEventListener('mousemove', onMove, { passive: true })
  document.addEventListener('mouseleave', () => cursor.classList.remove('is-on'))
  document.addEventListener('mouseenter', () => {
    if (started) cursor.classList.add('is-on')
  })

  document.addEventListener('mouseover', (e) => {
    if (e.target.closest?.(SITE_CURSOR_HOVER)) cursor.classList.add('is-click')
  })
  document.addEventListener('mouseout', (e) => {
    const from = e.target.closest?.(SITE_CURSOR_HOVER)
    if (!from) return
    const to = e.relatedTarget?.closest?.(SITE_CURSOR_HOVER)
    if (!to) cursor.classList.remove('is-click')
  })

  document.addEventListener('mousedown', () => cursor.classList.add('is-press'))
  document.addEventListener('mouseup', () => cursor.classList.remove('is-press'))
}

if (
  document.body.classList.contains('page-about') ||
  document.body.classList.contains('page-contact') ||
  document.body.classList.contains('page-home') ||
  document.body.classList.contains('page-case-detail')
) {
  const onScroll = () => {
    if (!header || !gnavi) return
    const threshold = Math.min(window.innerHeight * 0.55, 480)
    header.classList.toggle('is-solid', window.scrollY > threshold && !gnavi.classList.contains('nav-open'))
  }
  onScroll()
  window.addEventListener('scroll', onScroll, { passive: true })
}

wireHashScroll()

function initNewsFilter() {
  const newsTabs = [...document.querySelectorAll('.news-tab')]
  const newsGrid = document.querySelector('.news-grid')
  const newsPaging = document.getElementById('newsPaging')
  const newsBreadcrumb = document.querySelector('.news-breadcrumb')
  const newsCrumbCurr = document.querySelector('.news-breadcrumb .crumb-curr')
  if (!newsTabs.length) return

  const pageSize = Number(siteConfig?.pages?.news?.pageSize) || 6
  let currentCat =
    siteConfig?.pages?.news?.defaultCategory ||
    newsTabs.find((t) => t.classList.contains('is-active'))?.dataset.cat ||
    'all'
  let currentPage = 1

  const getCards = () => [...document.querySelectorAll('.news-card')]

  const filteredCards = () => {
    const cards = getCards()
    return cards.filter((card) => currentCat === 'all' || card.dataset.cat === currentCat)
  }

  const renderPaging = (totalPages) => {
    if (!newsPaging) return
    if (totalPages <= 1) {
      newsPaging.hidden = true
      newsPaging.innerHTML = ''
      return
    }
    newsPaging.hidden = false

    const maxButtons = 5
    let start = Math.max(1, currentPage - Math.floor(maxButtons / 2))
    let end = Math.min(totalPages, start + maxButtons - 1)
    start = Math.max(1, end - maxButtons + 1)

    const parts = []
    for (let p = start; p <= end; p++) {
      const active = p === currentPage
      parts.push(
        `<button type="button" class="news-paging-btn${active ? ' is-current' : ''}" data-page="${p}" aria-label="第 ${p} 页"${active ? ' aria-current="page"' : ''}>${p}</button>`
      )
    }
    if (end < totalPages || currentPage < totalPages) {
      parts.push(
        `<button type="button" class="news-paging-next" data-page="${Math.min(totalPages, currentPage + 1)}" aria-label="下一页">-</button>`
      )
    }

    newsPaging.innerHTML = `<div class="news-paging-list">${parts.join('')}</div>`
  }

  const syncVisible = () => {
    const cards = getCards()
    const list = filteredCards()
    const totalPages = Math.max(1, Math.ceil(list.length / pageSize))
    if (currentPage > totalPages) currentPage = totalPages

    cards.forEach((card) => {
      const inCat = currentCat === 'all' || card.dataset.cat === currentCat
      card.classList.toggle('is-hidden', !inCat)
      card.classList.remove('is-paged-out')
    })

    const start = (currentPage - 1) * pageSize
    const end = start + pageSize
    list.forEach((card, index) => {
      card.classList.toggle('is-paged-out', index < start || index >= end)
    })

    renderPaging(totalPages)
  }

  const applyNewsFilter = (cat, page = 1) => {
    currentCat = cat
    currentPage = page
    newsTabs.forEach((t) => {
      const active = t.dataset.cat === cat
      t.classList.toggle('is-active', active)
      t.setAttribute('aria-selected', String(active))
      t.closest('li')?.classList.toggle('is-active-item', active)
    })
    if (newsBreadcrumb) newsBreadcrumb.classList.toggle('is-all', cat === 'all')
    if (newsCrumbCurr && cat !== 'all') newsCrumbCurr.textContent = cat
    syncVisible()
  }

  newsTabs.forEach((tab) => {
    tab.onclick = () => applyNewsFilter(tab.dataset.cat, 1)
  })

  newsPaging?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-page]')
    if (!btn) return
    const page = Number(btn.dataset.page)
    if (!page || page === currentPage) return
    currentPage = page
    syncVisible()
    newsGrid?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })

  applyNewsFilter(currentCat, 1)
}

function initCaseFilter() {
  const caseTabs = [...document.querySelectorAll('.case-tab')]
  const caseCards = [...document.querySelectorAll('.case-card')]
  const breadcrumbCurr = document.querySelector('.breadcrumb-curr')
  const moreWrap = document.getElementById('caseMoreWrap')
  const moreBtn = document.getElementById('caseMoreBtn')
  if (!caseTabs.length) return

  const pageSize = 6
  let visibleCount = pageSize
  const catIds = caseTabs.map((t) => t.dataset.cat).filter(Boolean)
  // 默认选中分类排序第一项（与后台分类顺序一致）
  let currentCat = catIds[0] || ''

  const filteredCards = () =>
    caseCards.filter((card) => !currentCat || card.dataset.cat === currentCat)

  const syncVisible = () => {
    const list = filteredCards()
    caseCards.forEach((card) => {
      const inCat = !currentCat || card.dataset.cat === currentCat
      card.classList.toggle('is-hidden', !inCat)
      card.classList.remove('is-paged-out')
    })
    list.forEach((card, index) => {
      card.classList.toggle('is-paged-out', index >= visibleCount)
    })
    const hasMore = list.length > visibleCount
    moreWrap?.classList.toggle('is-hidden', !hasMore)
  }

  const applyCaseFilter = (cat) => {
    currentCat = cat
    visibleCount = pageSize
    caseTabs.forEach((t) => {
      const on = t.dataset.cat === cat
      t.classList.toggle('is-active', on)
      t.setAttribute('aria-selected', String(on))
    })
    if (breadcrumbCurr) breadcrumbCurr.textContent = cat || '案例集'
    syncVisible()
  }

  caseTabs.forEach((tab) => {
    tab.onclick = () => applyCaseFilter(tab.dataset.cat)
  })

  moreBtn?.addEventListener('click', () => {
    visibleCount += pageSize
    syncVisible()
  })

  applyCaseFilter(currentCat)
}

function initContactForm() {
  const contactForm = document.getElementById('contactForm')
  const formMessage = document.getElementById('formMessage')
  if (!contactForm) return

  const setMessage = (text, isError = false) => {
    if (!formMessage) {
      if (isError) alert(text)
      return
    }
    formMessage.textContent = text
    formMessage.hidden = false
    formMessage.classList.toggle('is-error', isError)
  }

  contactForm.onsubmit = async (e) => {
    e.preventDefault()
    const fd = new FormData(contactForm)
    const payload = {
      name: String(fd.get('name') || '').trim(),
      tel: String(fd.get('tel') || '').trim(),
      company: String(fd.get('company') || '').trim(),
      content: String(fd.get('content') || '').trim(),
      source: 'contact',
    }

    if (!payload.name || !payload.tel || !payload.content) {
      setMessage('请填写姓名、电话与需求描述', true)
      return
    }

    const submitBtn = contactForm.querySelector('[type="submit"]')
    if (submitBtn) submitBtn.disabled = true

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || '提交失败，请稍后重试')

      const successText = siteConfig?.pages?.contact?.successText || '提交成功，我们会尽快与您联系'
      setMessage(successText, false)
      contactForm.reset()
    } catch (err) {
      // 离线兜底：写入本机，避免丢单
      try {
        const key = 'guanzi-contact-leads-fallback'
        const prev = JSON.parse(localStorage.getItem(key) || '[]')
        prev.push({ ...payload, createdAt: new Date().toISOString(), fallback: true })
        localStorage.setItem(key, JSON.stringify(prev))
        setMessage('已暂存到本机，网络恢复后请联系管理员同步。也可稍后重试提交。', true)
      } catch {
        setMessage(err.message || '提交失败，请稍后重试', true)
      }
    } finally {
      if (submitBtn) submitBtn.disabled = false
    }
  }
}

function initCounters() {
  const counters = [...document.querySelectorAll('[data-count]')]
  if (!counters.length) return
  const animateCount = (el) => {
    const target = Number(el.dataset.count || 0)
    const duration = 1400
    const start = performance.now()
    const step = (now) => {
      const p = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      const value = Math.round(target * eased)
      el.textContent = target >= 1000 ? value.toLocaleString('en-US') : String(value)
      if (p < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }

  const counterIo = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        animateCount(entry.target)
        counterIo.unobserve(entry.target)
      })
    },
    { threshold: 0.4 }
  )
  counters.forEach((el) => counterIo.observe(el))
}

function bootInteractive() {
  setMenuOpen(false)
  observeReveals()
  observeServiceCards()
  playVideos()
  initHomeHeroSound()
  initHomeMediaPlayback()
  warmLazyImages()
  initHeroTextReveal()
  initHomeCaseRail()
  initHomeOverseasHover()
  initHomeNewsFilter()
  initSiteCursor()
  initNewsFilter()
  initCaseFilter()
  initContactForm()
  initCounters()
}

async function boot(configOverride) {
  // 首屏关键视频先开播，不等待配置接口，减少黑屏等待
  playVideos()
  initHomeHeroSound()
  siteConfig = configOverride ? await applySiteConfig(configOverride) : await applySiteConfig()
  resumeHomeHeroSoundAfterBind()
  bootInteractive()
}

boot().catch((err) => {
  console.warn('[site-config]', err)
  bootInteractive()
})

listenPreviewReload(async (incoming, meta) => {
  try {
    const next = incoming || (await loadSiteConfig())
    await boot(next)
    // 仅在明确请求时打开菜单，默认保持关闭
    if (meta?.openMenu === true) setMenuOpen(true)
    if (meta?.resetScroll) window.scrollTo(0, 0)
  } catch (err) {
    console.warn('[site-config reload]', err)
  }
})

window.addEventListener('message', (event) => {
  if (event.data?.type === 'guanzi-open-menu') setMenuOpen(true)
  if (event.data?.type === 'guanzi-close-menu') setMenuOpen(false)
})
