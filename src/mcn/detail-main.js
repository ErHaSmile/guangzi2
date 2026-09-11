import { applySiteConfig, listenPreviewReload, loadSiteConfig } from '../config.js'
import './mcn.css'
import './mcn-detail.css'

async function boot() {
  try {
    const config = await loadSiteConfig()
    await applySiteConfig(config)
  } catch (err) {
    console.warn('[mcn-detail] config load failed', err)
  }
  listenPreviewReload?.(() => window.location.reload())
}

boot()
