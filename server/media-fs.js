import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const root = path.resolve(__dirname, '..')
export const publicRoot = path.join(root, 'public')

const libraryRoot = path.join(publicRoot, 'library')
const libraryImagesDir = path.join(libraryRoot, 'images')
const libraryVideosDir = path.join(libraryRoot, 'videos')
const libraryLogosDir = path.join(libraryRoot, 'logos')
const libraryIconsDir = path.join(libraryRoot, 'icons')
const libraryManifestPath = path.join(libraryRoot, 'manifest.json')

const siteMediaRoot = path.join(publicRoot, 'site-media')
const siteImagesDir = path.join(siteMediaRoot, 'images')
const siteIconsDir = path.join(siteMediaRoot, 'icons')
const siteVideosDir = path.join(siteMediaRoot, 'videos')
const siteManifestPath = path.join(siteMediaRoot, 'manifest.json')

const brandsDir = path.join(publicRoot, 'images/brands')
const homeImagesDir = path.join(publicRoot, 'images/home')
const uploadsDir = path.join(publicRoot, 'images/uploads')
const videosDir = path.join(publicRoot, 'videos')
const videoUploadsDir = path.join(publicRoot, 'videos/uploads')

export const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|ico)$/i
export const VIDEO_EXT = /\.(mp4|webm|ogg|mov|m4v)$/i
const MEDIA_EXT = /\.(png|jpe?g|gif|webp|svg|ico|mp4|webm|ogg|mov|m4v)$/i
const INIT_FLAG = path.join(libraryRoot, '.initialized')

export function ensureMediaDirs() {
  ;[brandsDir, homeImagesDir, uploadsDir, videosDir, videoUploadsDir, libraryImagesDir, libraryVideosDir, libraryLogosDir, libraryIconsDir, siteImagesDir, siteIconsDir, siteVideosDir].forEach((d) => fs.mkdirSync(d, { recursive: true }))
}

function safeStat(full) {
  try { return fs.statSync(full) } catch (err) {
    if (err && (err.code === 'EPERM' || err.code === 'EACCES' || err.code === 'ENOENT')) {
      console.warn('[media] skip inaccessible file:', full, err.code); return null
    }
    throw err
  }
}

function safeReaddir(dir) {
  try { return fs.readdirSync(dir) } catch (err) {
    if (err && (err.code === 'EPERM' || err.code === 'EACCES' || err.code === 'ENOENT')) {
      console.warn('[media] skip inaccessible dir:', dir, err.code); return []
    }
    throw err
  }
}

function hashBuffer(buf) { return crypto.createHash('sha256').update(buf).digest('hex') }
function hashFile(abs) { const buf = fs.readFileSync(abs); return { hash: hashBuffer(buf), buf, size: buf.length } }

function readJson(file, fallback) {
  try { if (!fs.existsSync(file)) return fallback; return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return fallback }
}
function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8')
}

function loadLibraryManifest() {
  const raw = readJson(libraryManifestPath, { items: {} })
  if (!raw.items || typeof raw.items !== 'object') raw.items = {}
  return raw
}
function saveLibraryManifest(manifest) { writeJson(libraryManifestPath, manifest) }
function loadSiteManifest() {
  const raw = readJson(siteManifestPath, { items: {} })
  if (!raw.items || typeof raw.items !== 'object') raw.items = {}
  return raw
}
function saveSiteManifest(manifest) { writeJson(siteManifestPath, manifest) }

function categoryDir(category, zone = 'library') {
  if (zone === 'site') {
    if (category === 'video') return siteVideosDir
    if (category === 'icon') return siteIconsDir
    return siteImagesDir
  }
  if (category === 'video') return libraryVideosDir
  if (category === 'logo') return libraryLogosDir
  if (category === 'icon') return libraryIconsDir
  return libraryImagesDir
}
function categoryUrlPrefix(category, zone = 'library') {
  if (zone === 'site') {
    if (category === 'video') return '/site-media/videos'
    if (category === 'icon') return '/site-media/icons'
    return '/site-media/images'
  }
  if (category === 'video') return '/library/videos'
  if (category === 'logo') return '/library/logos'
  if (category === 'icon') return '/library/icons'
  return '/library/images'
}
function normalizeCategory(category, filename = '') {
  const c = String(category || '').toLowerCase()
  if (c === 'video' || VIDEO_EXT.test(filename)) return 'video'
  if (c === 'icon') return 'icon'
  if (c === 'logo') return 'logo'
  return 'image'
}
function resolveCategoryFromSource(sourceUrlOrAbs, baseName) {
  const src = String(sourceUrlOrAbs || '')
  if (src.startsWith('/library/')) {
    const manifest = loadLibraryManifest()
    const hit = Object.values(manifest.items).find((i) => i.path === src)
    if (hit?.category) return hit.category
    if (src.includes('/icons/')) return 'icon'
    if (src.includes('/logos/')) return 'logo'
    if (src.includes('/videos/')) return 'video'
  }
  if (VIDEO_EXT.test(baseName)) return 'video'
  return 'image'
}
function extOf(name, fallback = '.bin') { return path.extname(name || '') || fallback }

export function safeUploadName(name, fallbackExt = '.png') {
  const base = path.basename(name || `file${fallbackExt}`).replace(/[^\w.\u4e00-\u9fa5-]+/g, '_')
  const ext = path.extname(base) || fallbackExt
  const stem = path.basename(base, ext).slice(0, 40) || 'file'
  return `${Date.now()}-${stem}${ext.toLowerCase()}`
}

function assertInside(abs, roots) {
  const normalized = path.resolve(abs)
  return roots.some((d) => normalized === d || normalized.startsWith(d + path.sep))
}

export function isLibraryPath(urlPath) {
  const p = String(urlPath || '').replace(/\\/g, '/')
  return !!(p && !p.includes('..') && p.startsWith('/library/'))
}
export function isSiteMediaPath(urlPath) {
  const p = String(urlPath || '').replace(/\\/g, '/')
  return !!(p && !p.includes('..') && p.startsWith('/site-media/'))
}
export function isUploadPath(urlPath) { return isLibraryPath(urlPath) }

function urlToAbs(urlPath) {
  return path.join(publicRoot, String(urlPath || '').replace(/^\//, '').replace(/\\/g, '/'))
}

export function saveUploadBuffer(filename, buf, category = 'image') {
  ensureMediaDirs()
  const cat = normalizeCategory(category, filename)
  const hash = hashBuffer(buf)
  const ext = extOf(filename, cat === 'video' ? '.mp4' : '.png').toLowerCase()
  const storedName = `${hash.slice(0, 24)}${ext}`
  const dir = categoryDir(cat, 'library')
  const abs = path.join(dir, storedName)
  const urlPath = `${categoryUrlPrefix(cat, 'library')}/${storedName}`
  const originalName = path.basename(filename || storedName)
  let deduped = false
  if (fs.existsSync(abs)) deduped = true
  else fs.writeFileSync(abs, buf)
  const manifest = loadLibraryManifest()
  const prev = manifest.items[hash]
  manifest.items[hash] = {
    hash, path: urlPath, name: originalName, storedName, category: cat, size: buf.length, mtime: Date.now(),
    ...(prev?.alias ? { alias: prev.alias } : {}),
  }
  saveLibraryManifest(manifest)
  return { path: urlPath, hash, name: originalName, size: buf.length, kind: cat === 'video' ? 'video' : 'image', category: cat, deduped }
}

export function publishToSiteMedia(sourceUrlOrAbs, preferredName = '') {
  ensureMediaDirs()
  let abs = sourceUrlOrAbs
  if (typeof sourceUrlOrAbs === 'string' && sourceUrlOrAbs.startsWith('/')) abs = urlToAbs(sourceUrlOrAbs)
  abs = path.resolve(String(abs))
  if (!fs.existsSync(abs) || !safeStat(abs)?.isFile()) {
    const err = new Error('源文件不存在'); err.status = 404; throw err
  }
  const { hash, buf, size } = hashFile(abs)
  const baseName = preferredName || path.basename(abs)
  const cat = resolveCategoryFromSource(String(sourceUrlOrAbs), baseName)
  const ext = extOf(baseName, cat === 'video' ? '.mp4' : '.png').toLowerCase()
  const storedName = `${hash.slice(0, 24)}${ext}`
  const destAbs = path.join(categoryDir(cat, 'site'), storedName)
  const urlPath = `${categoryUrlPrefix(cat, 'site')}/${storedName}`
  let deduped = false
  if (fs.existsSync(destAbs)) deduped = true
  else fs.writeFileSync(destAbs, buf)
  const manifest = loadSiteManifest()
  manifest.items[hash] = {
    hash, path: urlPath, name: path.basename(baseName), storedName, category: cat, size, mtime: Date.now(), source: String(sourceUrlOrAbs),
  }
  saveSiteManifest(manifest)
  return { path: urlPath, hash, name: path.basename(baseName), size, kind: cat === 'video' ? 'video' : 'image', category: cat, deduped }
}

export function publishLibraryPath(libraryUrlPath) {
  if (isSiteMediaPath(libraryUrlPath)) return { path: libraryUrlPath, deduped: true, alreadySite: true }
  return publishToSiteMedia(libraryUrlPath)
}

export function deleteUpload(urlPath) {
  if (!isLibraryPath(urlPath)) {
    const err = new Error('只能删除素材库文件（不会影响官网已发布文件）'); err.status = 400; throw err
  }
  const abs = urlToAbs(urlPath)
  if (!assertInside(abs, [libraryImagesDir, libraryVideosDir, libraryLogosDir, libraryIconsDir, libraryRoot])) {
    const err = new Error('非法路径'); err.status = 400; throw err
  }
  try { if (fs.existsSync(abs)) fs.unlinkSync(abs) } catch (err) {
    if (err && (err.code === 'EPERM' || err.code === 'EACCES')) {
      const e = new Error('文件被占用或无权限删除，请关闭占用后重试'); e.status = 500; throw e
    }
    throw err
  }
  const manifest = loadLibraryManifest()
  const key = Object.keys(manifest.items).find((h) => manifest.items[h]?.path === urlPath)
  if (key) { delete manifest.items[key]; saveLibraryManifest(manifest) }
}

export function deleteUploads(paths) {
  return (Array.isArray(paths) ? paths : []).map((p) => {
    try { deleteUpload(p); return { path: p, ok: true } }
    catch (err) { return { path: p, ok: false, error: err.message || '删除失败' } }
  })
}

export function listSiteMedia() {
  ensureMediaDirs()
  const manifest = loadSiteManifest()
  return Object.values(manifest.items)
    .filter((item) => item?.path && fs.existsSync(urlToAbs(item.path)))
    .map((item) => ({
      name: item.name || path.basename(item.path), path: item.path, size: item.size || 0, mtime: item.mtime || 0,
      kind: item.category === 'video' ? 'video' : 'image', category: item.category || 'image', hash: item.hash, zone: 'site', deletable: false,
    }))
    .sort((a, b) => (b.mtime || 0) - (a.mtime || 0))
}

export function listMediaLibrary() {
  ensureMediaDirs()
  const manifest = loadLibraryManifest()
  const logos = []; const icons = []; const images = []; const videos = []
  Object.values(manifest.items).forEach((item) => {
    if (!item?.path) return
    const abs = urlToAbs(item.path)
    if (!fs.existsSync(abs)) return
    const row = {
      name: item.name || path.basename(item.path), path: item.path, size: item.size || safeStat(abs)?.size || 0,
      mtime: item.mtime || safeStat(abs)?.mtimeMs || 0, kind: item.category === 'video' ? 'video' : 'image',
      category: item.category || 'image', hash: item.hash, zone: 'library', deletable: true,
      alias: typeof item.alias === 'string' ? item.alias.trim() : '',
    }
    if (item.category === 'video') videos.push(row)
    else if (item.category === 'logo') logos.push(row)
    else if (item.category === 'icon') icons.push(row)
    else images.push(row)
  })
  const byMtime = (a, b) => (b.mtime || 0) - (a.mtime || 0)
  logos.sort(byMtime); icons.sort(byMtime); images.sort(byMtime); videos.sort(byMtime)
  return { brands: logos, icons, home: [], site: [], uploads: images, videos, library: [...logos, ...icons, ...images, ...videos], siteMedia: listSiteMedia() }
}

export function detectUploadCategory(urlPath) {
  const p = String(urlPath || '').replace(/\\/g, '/')
  if (p.startsWith('/library/videos/') || p.startsWith('/site-media/videos/') || p.startsWith('/videos/')) return 'video'
  if (p.startsWith('/library/icons/') || p.startsWith('/site-media/icons/')) return 'icon'
  if (p.startsWith('/library/logos/')) return 'logo'
  if (p.startsWith('/library/images/') || p.startsWith('/site-media/images/') || p.startsWith('/images/')) return 'image'
  return null
}

export function reclassifyUpload(urlPath, category) {
  if (!isLibraryPath(urlPath)) {
    const err = new Error('只能调整素材库文件的分类'); err.status = 400; throw err
  }
  const abs = urlToAbs(urlPath)
  if (!fs.existsSync(abs)) { const err = new Error('文件不存在'); err.status = 404; throw err }
  const kind = normalizeCategory(category, path.basename(abs))
  const current = detectUploadCategory(urlPath)
  if (current === kind) {
    return { path: urlPath, oldPath: urlPath, name: path.basename(abs), kind: kind === 'video' ? 'video' : 'image', category: kind, moved: false }
  }
  const manifest = loadLibraryManifest()
  const oldKey = Object.keys(manifest.items).find((h) => manifest.items[h]?.path === urlPath)
  const oldAlias = oldKey ? manifest.items[oldKey]?.alias : undefined
  const buf = fs.readFileSync(abs)
  deleteUpload(urlPath)
  const saved = saveUploadBuffer(path.basename(abs), buf, kind)
  if (oldAlias && saved.hash) {
    const next = loadLibraryManifest()
    if (next.items[saved.hash]) {
      next.items[saved.hash].alias = oldAlias
      saveLibraryManifest(next)
    }
  }
  return { path: saved.path, oldPath: urlPath, name: saved.name, size: saved.size, kind: saved.kind, category: saved.category, moved: saved.path !== urlPath }
}

/** 更新素材库条目的别名（便于检索与展示） */
export function updateMediaAlias(urlPath, alias) {
  if (!isLibraryPath(urlPath)) {
    const err = new Error('只能为素材库文件设置别名'); err.status = 400; throw err
  }
  const manifest = loadLibraryManifest()
  const key = Object.keys(manifest.items).find((h) => manifest.items[h]?.path === urlPath)
  if (!key) {
    const err = new Error('素材不存在'); err.status = 404; throw err
  }
  const trimmed = String(alias || '').trim()
  if (trimmed) manifest.items[key].alias = trimmed
  else delete manifest.items[key].alias
  saveLibraryManifest(manifest)
  return { path: urlPath, alias: trimmed || null, name: manifest.items[key].name }
}

function copyRecursive(src, dest) {
  const st = safeStat(src)
  if (!st) return { files: 0, bytes: 0 }
  if (st.isFile()) {
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.copyFileSync(src, dest)
    return { files: 1, bytes: st.size }
  }
  let files = 0; let bytes = 0
  safeReaddir(src).forEach((name) => {
    if (name === 'library' || name === 'site-media') return
    const r = copyRecursive(path.join(src, name), path.join(dest, name))
    files += r.files; bytes += r.bytes
  })
  return { files, bytes }
}

export function backupCurrentMedia(backupDir) {
  fs.mkdirSync(backupDir, { recursive: true })
  let fileCount = 0; let bytes = 0
  for (const [srcName, destName] of [['images', 'images'], ['videos', 'videos'], ['library', 'library'], ['site-media', 'site-media']]) {
    const src = path.join(publicRoot, srcName)
    if (!fs.existsSync(src)) continue
    const r = copyRecursive(src, path.join(backupDir, destName))
    fileCount += r.files; bytes += r.bytes
  }
  writeJson(path.join(backupDir, 'backup-meta.json'), { at: new Date().toISOString(), fileCount, bytes })
  return { fileCount, bytes, backupDir }
}

function walkMediaFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  safeReaddir(dir).forEach((name) => {
    if (name.startsWith('.') || name.startsWith('_')) return
    if (name === 'library' || name === 'site-media') return
    const full = path.join(dir, name)
    const st = safeStat(full)
    if (!st) return
    if (st.isDirectory()) { walkMediaFiles(full, out); return }
    if (!MEDIA_EXT.test(name)) return
    out.push(full)
  })
  return out
}

function extractPathsFromValue(value, bag) {
  if (value == null) return
  if (typeof value === 'string') {
    const re = /(?:^|[\s"'=(])(\/(?:images|videos|library|site-media)\/[^\s"'<>)]+)/g
    let m
    while ((m = re.exec(value))) {
      const p = m[1].replace(/[.,;]+$/, '')
      if (MEDIA_EXT.test(p)) bag.add(p)
    }
    return
  }
  if (Array.isArray(value)) { value.forEach((v) => extractPathsFromValue(v, bag)); return }
  if (typeof value === 'object') {
    Object.entries(value).forEach(([k, v]) => { if (k !== 'mediaUsage') extractPathsFromValue(v, bag) })
  }
}

function rewritePathsInConfig(config, map) {
  if (!config || !map?.size) return { config, count: 0 }
  let count = 0
  const walk = (value, parent, key) => {
    if (value == null) return
    if (typeof value === 'string') {
      let next = value
      map.forEach((to, from) => { if (next.includes(from)) { next = next.split(from).join(to); count += 1 } })
      if (parent != null && key != null && next !== value) parent[key] = next
      return
    }
    if (Array.isArray(value)) { value.forEach((v, i) => walk(v, value, i)); return }
    if (typeof value === 'object') {
      Object.keys(value).forEach((k) => { if (k !== 'mediaUsage') walk(value[k], value, k) })
    }
  }
  const clone = JSON.parse(JSON.stringify(config))
  walk(clone, null, null)
  return { config: clone, count }
}

export function migrateToLibraryAndSite({ configs = [] } = {}) {
  ensureMediaDirs()
  const allFiles = [...walkMediaFiles(path.join(publicRoot, 'images')), ...walkMediaFiles(path.join(publicRoot, 'videos'))]
  for (const abs of allFiles) {
    const rel = abs.slice(publicRoot.length).replace(/\\/g, '/')
    const buf = fs.readFileSync(abs)
    let category = 'image'
    if (VIDEO_EXT.test(abs)) category = 'video'
    else if (rel.includes('/brands/')) category = 'logo'
    saveUploadBuffer(path.basename(abs), buf, category)
  }

  const refBag = new Set()
  configs.forEach((c) => extractPathsFromValue(c, refBag))
  ;['/videos/home-hero.mp4','/videos/web/home-hero.mp4','/videos/web/contact.mp4','/videos/web/4kQUrEG9jUUA.mp4','/videos/contact.mp4','/videos/4kQUrEG9jUUA.mp4'].forEach((p) => refBag.add(p))

  const pathMap = new Map()
  let siteCount = 0
  for (const urlPath of refBag) {
    const abs = urlToAbs(urlPath)
    if (!fs.existsSync(abs)) continue
    const published = publishToSiteMedia(urlPath, path.basename(urlPath))
    pathMap.set(urlPath, published.path)
    siteCount += 1
  }

  let rewriteCount = 0
  let configOut = null
  let fileConfigOut = null
  if (configs[0]) {
    const r = rewritePathsInConfig(configs[0], pathMap)
    configOut = r.config; rewriteCount += r.count
  }
  if (configs[1]) {
    const r = rewritePathsInConfig(configs[1], pathMap)
    fileConfigOut = r.config; rewriteCount += r.count
  }

  writeJson(path.join(libraryRoot, 'migrate-report.json'), {
    at: new Date().toISOString(), libraryCount: Object.keys(loadLibraryManifest().items).length, siteCount, rewriteCount, mapped: [...pathMap.entries()],
  })
  fs.writeFileSync(INIT_FLAG, new Date().toISOString(), 'utf8')
  return {
    libraryCount: Object.keys(loadLibraryManifest().items).length,
    siteCount: Object.keys(loadSiteManifest().items).length,
    rewriteCount, pathMap, configOut, fileConfigOut,
  }
}

export function isMediaMigrated() { return fs.existsSync(INIT_FLAG) }
