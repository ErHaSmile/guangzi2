/* MCN data charts — driven by pages.home.dataCharts with hardcoded fallbacks */
import {
  DEFAULT_MCN_DATA_CHARTS,
  ensureMcnHomeLists,
} from './mcn-lists.js'

function numArr(list, fallback) {
  if (!Array.isArray(list) || !list.length) return fallback
  return list.map((x) => {
    const n = Number(x)
    return Number.isFinite(n) ? n : 0
  })
}

function strArr(list, fallback) {
  if (!Array.isArray(list) || !list.length) return fallback
  return list.map((x) => String(x ?? ''))
}

function pieItems(chart, colors) {
  const lines = Array.isArray(chart?.itemsLines) ? chart.itemsLines : []
  const parsed = lines
    .map((line) => {
      const [name, value] = String(line).split('|')
      return { name: (name || '').trim(), value: Number(String(value || '').trim()) || 0 }
    })
    .filter((x) => x.name)
  const seed = DEFAULT_MCN_DATA_CHARTS.pie.itemsLines.map((line, i) => {
    const [name, value] = String(line).split('|')
    return { name, value: Number(value) || 0, color: colors[i % colors.length] }
  })
  const base = parsed.length ? parsed : seed
  return base.map((d, i) => ({
    ...d,
    color: colors[i % colors.length],
  }))
}

export function initMcnCharts(echarts, config) {
  if (!echarts) return
  const need = ['chart-trend', 'chart-pie', 'chart-bar', 'chart-growth']
  if (need.some((id) => !document.getElementById(id))) return

  // 预览热更新时先销毁旧实例，避免重复 init
  need.forEach((id) => {
    const el = document.getElementById(id)
    if (!el) return
    echarts.getInstanceByDom(el)?.dispose()
  })

  if (config) ensureMcnHomeLists(config)
  const charts = config?.pages?.home?.dataCharts || DEFAULT_MCN_DATA_CHARTS
  const trendCfg = { ...DEFAULT_MCN_DATA_CHARTS.trend, ...(charts.trend || {}) }
  const pieCfg = { ...DEFAULT_MCN_DATA_CHARTS.pie, ...(charts.pie || {}) }
  const barCfg = { ...DEFAULT_MCN_DATA_CHARTS.bar, ...(charts.bar || {}) }
  const growthCfg = { ...DEFAULT_MCN_DATA_CHARTS.growth, ...(charts.growth || {}) }

  const chartColors = {
    c1: '#6B8A2A',
    c2: '#8FB339',
    c3: '#B4CE6E',
    c4: '#D8E7A9',
    c5: '#EDF4D4',
    textMuted: '#9CA3AF',
    text: '#1A1A1A',
    textSoft: '#6B7280',
    border: '#E5E7EB',
    surface: '#FFFFFF',
  }
  const piePalette = [chartColors.c1, chartColors.c2, chartColors.c3, chartColors.c4, chartColors.c5]

  const tooltipStyle = {
    backgroundColor: chartColors.surface,
    borderColor: chartColors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    textStyle: {
      color: chartColors.text,
      fontSize: 12,
      fontWeight: 500,
      fontFamily: "'Noto Sans SC', sans-serif",
    },
  }

  const legendCurrent = trendCfg.legendCurrent || 'GMV'
  const legendLast = trendCfg.legendLast || '去年同期'
  const trendCategories = strArr(trendCfg.categories || trendCfg.categoriesLines, DEFAULT_MCN_DATA_CHARTS.trend.categories)
  const seriesCurrent = numArr(trendCfg.seriesCurrent || trendCfg.seriesCurrentLines, DEFAULT_MCN_DATA_CHARTS.trend.seriesCurrent)
  const seriesLast = numArr(trendCfg.seriesLast || trendCfg.seriesLastLines, DEFAULT_MCN_DATA_CHARTS.trend.seriesLast)

  const trendChart = echarts.init(document.getElementById('chart-trend'))
  trendChart.setOption({
    tooltip: {
      ...tooltipStyle,
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: chartColors.border } },
      formatter(params) {
        let s = `<div style="font-weight:700;margin-bottom:8px;">${params[0].axisValue}</div>`
        params.forEach((p) => {
          s += `<div style="display:flex;align-items:center;justify-content:space-between;gap:20px;font-size:12px;margin-bottom:4px;">
            <span style="display:flex;align-items:center;gap:8px;">
              <span style="display:inline-block;width:8px;height:6px;background:${p.color};border-radius:2px;"></span>
              <span style="color:${chartColors.textSoft};font-weight:500;">${p.seriesName}</span>
            </span>
            <span style="font-weight:700;color:${chartColors.text};">${p.value} 亿</span>
          </div>`
        })
        return s
      },
    },
    legend: {
      data: [legendCurrent, legendLast],
      textStyle: { color: chartColors.textMuted, fontSize: 11, fontWeight: 500 },
      top: 0,
      right: 0,
      itemWidth: 12,
      itemHeight: 6,
      itemGap: 16,
    },
    grid: { left: 0, right: 0, bottom: 0, top: 32, containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: trendCategories,
      axisLine: { lineStyle: { color: chartColors.border } },
      axisLabel: { color: chartColors.textMuted, fontSize: 11, fontWeight: 500 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { show: false },
      splitLine: { lineStyle: { color: chartColors.border } },
    },
    series: [
      {
        name: legendCurrent,
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { color: chartColors.c2, width: 2.5 },
        itemStyle: { color: chartColors.c2 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(143, 179, 57, 0.25)' },
            { offset: 1, color: 'rgba(143, 179, 57, 0.02)' },
          ]),
        },
        data: seriesCurrent,
      },
      {
        name: legendLast,
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 5,
        lineStyle: { color: chartColors.c4, width: 1.5, type: 'dashed' },
        itemStyle: { color: chartColors.c4 },
        data: seriesLast,
      },
    ],
  })
  new ResizeObserver(() => trendChart.resize()).observe(document.getElementById('chart-trend'))

  const pieChart = echarts.init(document.getElementById('chart-pie'))
  const pieData = pieItems(pieCfg, piePalette)
  pieChart.setOption({
    tooltip: {
      ...tooltipStyle,
      trigger: 'item',
      formatter(params) {
        return `<div style="font-weight:700;margin-bottom:4px;">${params.name}</div>
          <div style="font-size:12px;color:${chartColors.textSoft};">GMV：${params.value} 亿元 (${params.percent}%)</div>`
      },
    },
    legend: {
      orient: 'vertical',
      right: '5%',
      top: 'center',
      textStyle: { color: chartColors.textSoft, fontSize: 12, fontWeight: 500 },
      itemWidth: 10,
      itemHeight: 10,
      itemGap: 12,
    },
    series: [
      {
        type: 'pie',
        radius: ['45%', '68%'],
        center: ['32%', '50%'],
        padAngle: 2,
        avoidLabelOverlap: true,
        label: {
          show: true,
          position: 'inside',
          color: '#fff',
          fontSize: 11,
          fontWeight: 700,
          formatter(params) {
            return `${params.percent}%`
          },
        },
        labelLine: { show: false },
        data: pieData.map((d) => ({
          value: d.value,
          name: d.name,
          itemStyle: { color: d.color },
        })),
      },
    ],
  })
  new ResizeObserver(() => pieChart.resize()).observe(document.getElementById('chart-pie'))

  const barCategories = strArr(barCfg.categories || barCfg.categoriesLines, DEFAULT_MCN_DATA_CHARTS.bar.categories)
  const barGmv = numArr(barCfg.gmv || barCfg.gmvLines, DEFAULT_MCN_DATA_CHARTS.bar.gmv)
  const barSessions = numArr(barCfg.sessions || barCfg.sessionsLines, DEFAULT_MCN_DATA_CHARTS.bar.sessions)
  const legendGmv = barCfg.legendGmv || 'GMV(亿元)'
  const legendSessions = barCfg.legendSessions || '直播场次'

  const barChart = echarts.init(document.getElementById('chart-bar'))
  barChart.setOption({
    tooltip: {
      ...tooltipStyle,
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter(params) {
        let s = `<div style="font-weight:700;margin-bottom:8px;">${params[0].axisValue}</div>`
        params.forEach((p) => {
          s += `<div style="display:flex;align-items:center;justify-content:space-between;gap:20px;font-size:12px;margin-bottom:4px;">
            <span style="display:flex;align-items:center;gap:8px;">
              <span style="display:inline-block;width:8px;height:6px;background:${p.color};border-radius:2px;"></span>
              <span style="color:${chartColors.textSoft};font-weight:500;">${p.seriesName}</span>
            </span>
            <span style="font-weight:700;color:${chartColors.text};">${p.value}</span>
          </div>`
        })
        return s
      },
    },
    legend: {
      data: [legendGmv, legendSessions],
      textStyle: { color: chartColors.textMuted, fontSize: 11, fontWeight: 500 },
      top: 0,
      right: 0,
      itemWidth: 12,
      itemHeight: 6,
      itemGap: 16,
    },
    grid: { left: 0, right: 0, bottom: 0, top: 32, containLabel: true },
    xAxis: {
      type: 'category',
      data: barCategories,
      axisLine: { lineStyle: { color: chartColors.border } },
      axisLabel: { color: chartColors.textMuted, fontSize: 11, fontWeight: 500 },
      axisTick: { show: false },
    },
    yAxis: [
      {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false },
        splitLine: { lineStyle: { color: chartColors.border } },
      },
      {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: legendGmv,
        type: 'bar',
        barWidth: 22,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: chartColors.c2 },
            { offset: 1, color: chartColors.c3 },
          ]),
          borderRadius: [6, 6, 0, 0],
        },
        data: barGmv,
      },
      {
        name: legendSessions,
        type: 'bar',
        yAxisIndex: 1,
        barWidth: 22,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: chartColors.c4 },
            { offset: 1, color: chartColors.c5 },
          ]),
          borderRadius: [6, 6, 0, 0],
        },
        data: barSessions,
      },
    ],
  })
  new ResizeObserver(() => barChart.resize()).observe(document.getElementById('chart-bar'))

  const growthCategories = strArr(
    growthCfg.categories || growthCfg.categoriesLines,
    DEFAULT_MCN_DATA_CHARTS.growth.categories
  )
  const growthRates = numArr(growthCfg.rates || growthCfg.ratesLines, DEFAULT_MCN_DATA_CHARTS.growth.rates)

  const growthChart = echarts.init(document.getElementById('chart-growth'))
  growthChart.setOption({
    tooltip: {
      ...tooltipStyle,
      trigger: 'axis',
      formatter(params) {
        return (
          `<div style="font-weight:700;">${params[0].axisValue}同比增长</div>` +
          `<div style="font-size:12px;color:${chartColors.textSoft};margin-top:4px;">增速：${params[0].value}%</div>`
        )
      },
    },
    grid: { left: 0, right: 0, bottom: 0, top: 24, containLabel: true },
    xAxis: {
      type: 'category',
      data: growthCategories,
      axisLine: { lineStyle: { color: chartColors.border } },
      axisLabel: { color: chartColors.textMuted, fontSize: 11, fontWeight: 500 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { show: false },
      splitLine: { lineStyle: { color: chartColors.border } },
    },
    series: [
      {
        type: 'bar',
        barWidth: 26,
        data: growthRates.map((value, i) => ({
          value,
          itemStyle: {
            color: i % 3 === 2 ? chartColors.c3 : chartColors.c2,
            borderRadius: [6, 6, 0, 0],
          },
        })),
        label: {
          show: true,
          position: 'top',
          color: chartColors.c2,
          fontSize: 11,
          fontWeight: 700,
          formatter: '{c}%',
        },
      },
    ],
  })
  new ResizeObserver(() => growthChart.resize()).observe(document.getElementById('chart-growth'))
}
