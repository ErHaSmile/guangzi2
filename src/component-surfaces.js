/**
 * 各组件「风格」预设的对比度配置。
 * lightIslands：深色区块背景下仍保持浅底的子区域（内部用深色字）
 * darkIslands：浅色区块背景下仍保持深底的子区域（内部用浅色字）
 * nativeTone：组件未设风格时的默认明暗倾向（用于后台提示）
 */
export const COMPONENT_SURFACE_PROFILES = {
  'home-hero': {
    label: '首屏 Hero',
    nativeTone: 'light',
    hint: 'MCN 浅色有机风首屏；可选浅雾灰或纯白。',
    prefer: ['', 'white', 'mist', 'cloud', 'accent-soft'],
  },
  'creative-hero': {
    label: '影像首屏 Creative Media',
    nativeTone: 'dark',
    hint: '全屏视频 Hero；建议默认或深色风格。',
    darkIslands: ['.home-hero-content', '.home-sound-toggle'],
    prefer: ['', 'ink', 'noir', 'slate', 'midnight'],
  },
  'home-clients': {
    label: '合作客户',
    nativeTone: 'light',
    hint: '客户 Logo 矩阵；深色风格下 Logo 格保持可读。',
    lightIslands: ['.home-clients-logo', '.home-clients-groups'],
  },
  'about-team': {
    label: '核心团队架构',
    nativeTone: 'light',
    hint: '成员卡片为浅底；深色风格下卡片内保持深色字。',
    lightIslands: ['.about-team-card', '.about-team-avatar'],
  },
  'home-services': {
    label: '核心服务',
    nativeTone: 'light',
    hint: '服务卡片浅底；深色风格下卡片保持深色字。',
    lightIslands: ['.service-card'],
  },
  'home-talents': {
    label: '达人资源',
    nativeTone: 'light',
    hint: '双轮达人资源区。',
  },
  'home-live': {
    label: '直播案例',
    nativeTone: 'light',
    hint: '直播战绩案例卡片。',
  },
  'home-cases': {
    label: '成功案例',
    nativeTone: 'light',
    hint: '品牌合作案例区。',
  },
  'home-data': {
    label: '数据看板',
    nativeTone: 'light',
    hint: '图表区建议保持浅色底。',
    prefer: ['', 'white', 'mist'],
  },
  'home-process': {
    label: '服务流程',
    nativeTone: 'light',
    hint: '标准化流程步骤。',
  },
  'home-about': {
    label: '关于我们',
    nativeTone: 'light',
    hint: '关于与客户证言。',
  },
  'home-contact': {
    label: '合作咨询',
    nativeTone: 'dark',
    hint: '咨询表单区；浅色风格下仍可保持深色底。',
    darkIslands: ['.contact-form'],
    prefer: ['', 'ink', 'noir', 'slate', 'midnight'],
  },
}

export function getComponentSurfaceProfile(unitId) {
  const key = String(unitId || '')
  if (COMPONENT_SURFACE_PROFILES[key]) return COMPONENT_SURFACE_PROFILES[key]
  if (key.startsWith('gallery-')) {
    return {
      label: '图片组件',
      nativeTone: 'light',
      hint: '图片格为浅灰底；深色风格下格内与说明保持深色字。',
      lightIslands: ['.home-gallery-item', '.home-gallery-empty'],
    }
  }
  return {
    label: key || '组件',
    nativeTone: 'light',
    hint: '未配置专用风格提示时的默认项。',
  }
}
