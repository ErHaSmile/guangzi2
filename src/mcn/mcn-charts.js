/* auto from reference */
export function initMcnCharts(echarts) {
  if (!echarts) return
  const need = ['chart-trend', 'chart-pie', 'chart-bar', 'chart-growth']
  if (need.some((id) => !document.getElementById(id))) return

  // ===== Chart palette - lime monochrome 5-level =====
  const chartColors = {
    c1: '#6B8A2A',   // deepest
    c2: '#8FB339',   // accent-text
    c3: '#B4CE6E',
    c4: '#D8E7A9',
    c5: '#EDF4D4',   // lightest
    textMuted: '#9CA3AF',
    text: '#1A1A1A',
    textSoft: '#6B7280',
    border: '#E5E7EB',
    surface: '#FFFFFF'
  };

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
      fontFamily: "'Noto Sans SC', sans-serif"
    }
  };

  // ===== 1. 月度销售趋势（折线图）=====
  const trendChart = echarts.init(document.getElementById('chart-trend'));
  trendChart.setOption({
    tooltip: {
      ...tooltipStyle,
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: chartColors.border } },
      formatter: function(params) {
        let s = '<div style="font-weight:700;margin-bottom:8px;">' + params[0].axisValue + '</div>';
        params.forEach(p => {
          s += `<div style="display:flex;align-items:center;justify-content:space-between;gap:20px;font-size:12px;margin-bottom:4px;">
            <span style="display:flex;align-items:center;gap:8px;">
              <span style="display:inline-block;width:8px;height:6px;background:${p.color};border-radius:2px;"></span>
              <span style="color:${chartColors.textSoft};font-weight:500;">${p.seriesName}</span>
            </span>
            <span style="font-weight:700;color:${chartColors.text};">${p.value} 亿</span>
          </div>`;
        });
        return s;
      }
    },
    legend: {
      data: ['GMV', '去年同期'],
      textStyle: {
        color: chartColors.textMuted,
        fontSize: 11,
        fontWeight: 500
      },
      top: 0,
      right: 0,
      itemWidth: 12,
      itemHeight: 6,
      itemGap: 16
    },
    grid: {
      left: 0,
      right: 0,
      bottom: 0,
      top: 32,
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: ['1月','2月','3月','4月','5月','6月','7月','8月'],
      axisLine: { lineStyle: { color: chartColors.border } },
      axisLabel: { color: chartColors.textMuted, fontSize: 11, fontWeight: 500 },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { show: false },
      splitLine: { lineStyle: { color: chartColors.border } }
    },
    series: [
      {
        name: 'GMV',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { color: chartColors.c2, width: 2.5 },
        itemStyle: { color: chartColors.c2 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(143, 179, 57, 0.25)' },
            { offset: 1, color: 'rgba(143, 179, 57, 0.02)' }
          ])
        },
        data: [3.2, 2.8, 4.1, 4.5, 5.2, 6.8, 5.6, 4.8]
      },
      {
        name: '去年同期',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 5,
        lineStyle: { color: chartColors.c4, width: 1.5, type: 'dashed' },
        itemStyle: { color: chartColors.c4 },
        data: [2.1, 1.9, 2.8, 3.0, 3.5, 4.6, 3.9, 3.3]
      }
    ]
  });
  new ResizeObserver(() => trendChart.resize()).observe(document.getElementById('chart-trend'));

  // ===== 2. 品类销售占比（环形饼图）=====
  const pieChart = echarts.init(document.getElementById('chart-pie'));
  const pieData = [
    { value: 18.2, name: '美妆护肤', color: chartColors.c1 },
    { value: 14.5, name: '服饰穿搭', color: chartColors.c2 },
    { value: 10.8, name: '美食食品', color: chartColors.c3 },
    { value: 8.6, name: '3C数码', color: chartColors.c4 },
    { value: 6.1, name: '家居生活', color: chartColors.c5 }
  ];
  pieChart.setOption({
    tooltip: {
      ...tooltipStyle,
      trigger: 'item',
      formatter: function(params) {
        return `<div style="font-weight:700;margin-bottom:4px;">${params.name}</div>
          <div style="font-size:12px;color:${chartColors.textSoft};">GMV：${params.value} 亿元 (${params.percent}%)</div>`;
      }
    },
    legend: {
      orient: 'vertical',
      right: '5%',
      top: 'center',
      textStyle: { color: chartColors.textSoft, fontSize: 12, fontWeight: 500 },
      itemWidth: 10,
      itemHeight: 10,
      itemGap: 12
    },
    series: [{
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
        formatter: function(params) {
          return params.percent + '%';
        }
      },
      labelLine: { show: false },
      data: pieData.map(d => ({
        value: d.value,
        name: d.name,
        itemStyle: { color: d.color }
      }))
    }]
  });
  new ResizeObserver(() => pieChart.resize()).observe(document.getElementById('chart-pie'));

  // ===== 3. 各平台渠道GMV对比（柱状图）=====
  const barChart = echarts.init(document.getElementById('chart-bar'));
  barChart.setOption({
    tooltip: {
      ...tooltipStyle,
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: function(params) {
        let s = '<div style="font-weight:700;margin-bottom:8px;">' + params[0].axisValue + '</div>';
        params.forEach(p => {
          s += `<div style="display:flex;align-items:center;justify-content:space-between;gap:20px;font-size:12px;margin-bottom:4px;">
            <span style="display:flex;align-items:center;gap:8px;">
              <span style="display:inline-block;width:8px;height:6px;background:${p.color};border-radius:2px;"></span>
              <span style="color:${chartColors.textSoft};font-weight:500;">${p.seriesName}</span>
            </span>
            <span style="font-weight:700;color:${chartColors.text};">${p.value}</span>
          </div>`;
        });
        return s;
      }
    },
    legend: {
      data: ['GMV(亿元)', '直播场次'],
      textStyle: { color: chartColors.textMuted, fontSize: 11, fontWeight: 500 },
      top: 0,
      right: 0,
      itemWidth: 12,
      itemHeight: 6,
      itemGap: 16
    },
    grid: {
      left: 0,
      right: 0,
      bottom: 0,
      top: 32,
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: ['抖音', '快手', '淘宝直播', '小红书'],
      axisLine: { lineStyle: { color: chartColors.border } },
      axisLabel: { color: chartColors.textMuted, fontSize: 11, fontWeight: 500 },
      axisTick: { show: false }
    },
    yAxis: [
      {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false },
        splitLine: { lineStyle: { color: chartColors.border } }
      },
      {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false },
        splitLine: { show: false }
      }
    ],
    series: [
      {
        name: 'GMV(亿元)',
        type: 'bar',
        barWidth: 22,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: chartColors.c2 },
            { offset: 1, color: chartColors.c3 }
          ]),
          borderRadius: [6, 6, 0, 0]
        },
        data: [24.6, 15.2, 11.8, 6.6]
      },
      {
        name: '直播场次',
        type: 'bar',
        yAxisIndex: 1,
        barWidth: 22,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: chartColors.c4 },
            { offset: 1, color: chartColors.c5 }
          ]),
          borderRadius: [6, 6, 0, 0]
        },
        data: [980, 620, 450, 320]
      }
    ]
  });
  new ResizeObserver(() => barChart.resize()).observe(document.getElementById('chart-bar'));

  // ===== 4. 月度同比增长率（柱状图）=====
  const growthChart = echarts.init(document.getElementById('chart-growth'));
  growthChart.setOption({
    tooltip: {
      ...tooltipStyle,
      trigger: 'axis',
      formatter: function(params) {
        return '<div style="font-weight:700;">' + params[0].axisValue + '同比增长</div>' +
               '<div style="font-size:12px;color:' + chartColors.textSoft + ';margin-top:4px;">增速：' + params[0].value + '%</div>';
      }
    },
    grid: {
      left: 0,
      right: 0,
      bottom: 0,
      top: 24,
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: ['1月','2月','3月','4月','5月','6月','7月','8月'],
      axisLine: { lineStyle: { color: chartColors.border } },
      axisLabel: { color: chartColors.textMuted, fontSize: 11, fontWeight: 500 },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { show: false },
      splitLine: { lineStyle: { color: chartColors.border } }
    },
    series: [{
      type: 'bar',
      barWidth: 26,
      data: [
        { value: 52.4, itemStyle: { color: chartColors.c2, borderRadius: [6, 6, 0, 0] } },
        { value: 47.3, itemStyle: { color: chartColors.c2, borderRadius: [6, 6, 0, 0] } },
        { value: 46.2, itemStyle: { color: chartColors.c3, borderRadius: [6, 6, 0, 0] } },
        { value: 50.8, itemStyle: { color: chartColors.c2, borderRadius: [6, 6, 0, 0] } },
        { value: 48.6, itemStyle: { color: chartColors.c2, borderRadius: [6, 6, 0, 0] } },
        { value: 47.8, itemStyle: { color: chartColors.c3, borderRadius: [6, 6, 0, 0] } },
        { value: 43.5, itemStyle: { color: chartColors.c3, borderRadius: [6, 6, 0, 0] } },
        { value: 45.2, itemStyle: { color: chartColors.c3, borderRadius: [6, 6, 0, 0] } }
      ],
      label: {
        show: true,
        position: 'top',
        color: chartColors.c2,
        fontSize: 11,
        fontWeight: 700,
        formatter: '{c}%'
      }
    }]
  });
  new ResizeObserver(() => growthChart.resize()).observe(document.getElementById('chart-growth'));

  // Tab toggle handled by bindMcnTalentFilter in mcn-lists.js

}

