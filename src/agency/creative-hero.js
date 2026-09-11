/** 影像首屏静音切换（从项目一迁入） */
const HOME_SOUND_KEY = 'guanzi2-creative-hero-sound'

function getHomeSoundPref() {
  try {
    const raw = localStorage.getItem(HOME_SOUND_KEY)
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

function wireCreativeHeroSound() {
  const video = document.getElementById('homeVideo')
  const btn = document.getElementById('homeSoundToggle')
  if (!video || !btn || btn.dataset.wired === '1') return
  btn.dataset.wired = '1'

  const setMuted = (muted) => {
    video.muted = Boolean(muted)
    video.defaultMuted = Boolean(muted)
    if (muted) video.setAttribute('muted', '')
    else video.removeAttribute('muted')
  }

  const syncUi = () => {
    const muted = Boolean(video.muted)
    btn.classList.toggle('is-muted', muted)
    btn.classList.toggle('is-on', !muted)
    btn.setAttribute('aria-pressed', muted ? 'false' : 'true')
    btn.setAttribute('aria-label', muted ? '开启声音' : '关闭声音')
    const label = btn.querySelector('.home-sound-label')
    if (label) label.textContent = muted ? 'Off' : 'On'
  }

  setMuted(!getHomeSoundPref())
  syncUi()
  video.play?.()?.catch(() => {})

  btn.addEventListener('click', () => {
    const nextMuted = !video.muted
    setMuted(nextMuted)
    setHomeSoundPref(!nextMuted)
    syncUi()
    if (!nextMuted) video.play?.()?.catch(() => {})
  })
}

export { wireCreativeHeroSound }
