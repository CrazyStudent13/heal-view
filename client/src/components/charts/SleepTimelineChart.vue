<template>
  <div class="sleep-timeline-view" v-if="hasData">
    <div class="sleep-overview-cards">
      <el-card class="overview-card" shadow="hover">
        <div class="overview-card-content">
          <div class="card-icon sleep-icon"><span class="icon-text">🌙</span></div>
          <div class="card-info">
            <div class="card-label">{{ t('sleep.totalLabel', { bedtime: timelineData.bedtime, wakeUpTime: timelineData.wakeUpTime }) }}</div>
            <div class="card-value">{{ totalSleepDuration }}</div>
          </div>
        </div>
      </el-card>
      <el-card class="overview-card" shadow="hover">
        <div class="overview-card-content">
          <div class="card-icon heart-icon"><span class="icon-text">❤️</span></div>
          <div class="card-info">
            <div class="card-label">{{ t('sleep.avgHeartRate') }}</div>
            <div class="card-value">{{ avgHeartRateDisplay }}</div>
          </div>
        </div>
      </el-card>
      <el-card class="overview-card" shadow="hover">
        <div class="overview-card-content">
          <div class="card-icon interrupt-icon"><span class="icon-text">⏰</span></div>
          <div class="card-info">
            <div class="card-label">{{ t('sleep.interruptions') }}</div>
            <div class="card-value-row">
              <span class="card-value">{{ t('sleep.interruptionCount', { count: awakeEpisodes }) }}</span>
              <el-tag :type="interruptTagType" size="small">{{ interruptDesc }}</el-tag>
            </div>
          </div>
        </div>
      </el-card>
    </div>
    <section class="timeline-card">
      <SectionTitle>
        <template #icon><MoonNight /></template>
        {{ t('chart.sleepTimeline') }}
      </SectionTitle>
      <div ref="chartRef" class="chart"></div>
    </section>
    <SleepStageAnalysis :segments="timelineData.segments" />
  </div>
  <div class="empty-state" v-else>
    <el-empty :description="t('chart.noSleepData')" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import * as echarts from 'echarts';
import { ElEmpty } from 'element-plus';
import { useLocaleStore } from '../../stores/localeStore';
import { useDataStore } from '../../stores/dataStore';
import SleepStageAnalysis from './SleepStageAnalysis.vue';

const localeStore = useLocaleStore();
function t(key) { return localeStore.t(key); }
const dataStore = useDataStore();

const props = defineProps({
  data: { type: Object, required: true },
  avgHeartRate: { type: Number, default: null }
});

const chartRef = ref(null);
let chartInstance = null;
const timelineData = ref(props.data);
const heartRateTS = ref(null);
const hasData = computed(() => timelineData.value?.segments?.length > 0);
function isValidHeartRate(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0;
}
const avgHeartRateDisplay = computed(() =>
  isValidHeartRate(props.avgHeartRate) ? `${props.avgHeartRate} bpm` : '-- bpm'
);

// ---- 阶段配置：4 层堆叠，各占 0.25 高度 ----
const stageConfig = {
  deep:  { color: '#2A35C0', get label() { return t('chart.deep'); }, yIdx: 0 },
  light: { color: '#29B6F6', get label() { return t('chart.light'); }, yIdx: 1 },
  rem:   { color: '#1DE9B6', get label() { return t('chart.rem'); }, yIdx: 2 },
  awake: { color: '#FFAB00', get label() { return t('chart.awake'); }, yIdx: 3 }
};

function sNorm(st) { return typeof st === 'string' ? st.toLowerCase() : String(st).toLowerCase(); }
function t2m(t) { const [h, m] = t.split(':').map(Number); return h * 60 + m; }
function fmtDur(min) {
  if (!min) return t('sport.zeroMinutes');
  const h = Math.floor(min / 60), m = min % 60;
  return h > 0
    ? t('sport.durationHoursMinutes', { hours: h, minutes: m })
    : t('sport.durationMinutes', { minutes: m });
}

const stageDurations = computed(() => {
  const d = { deep: 0, light: 0, rem: 0, awake: 0 };
  timelineData.value?.segments?.forEach(s => {
    const st = sNorm(s.state);
    let dur = t2m(s.endTime) - t2m(s.startTime);
    if (dur < 0) dur += 1440; // 跨午夜修正
    if (d[st] !== undefined) d[st] += dur;
  });
  return d;
});
const totalSleepMinutes = computed(() => Object.values(stageDurations.value).reduce((a, b) => a + b, 0));
const totalSleepDuration = computed(() => fmtDur(totalSleepMinutes.value));
const awakeEpisodes = computed(() =>
  timelineData.value?.segments?.filter(s => sNorm(s.state) === 'awake').length || 0
);
const interruptDesc = computed(() => {
  const c = awakeEpisodes.value;
  if (c === 0) return t('sleep.uninterrupted');
  if (c === 1) return t('sleep.slightlyInterrupted');
  if (c <= 3) return t('sleep.normalInterruptions');
  return t('sleep.frequentInterruptions');
});
const interruptTagType = computed(() => {
  const c = awakeEpisodes.value;
  if (c === 0) return 'success'; if (c === 1) return 'warning';
  if (c <= 3) return 'info'; return 'danger';
});

// ---- 图表核心 ----
function buildChart() {
  if (!hasData.value) return;

  // Dispose old chart instance and create new one to avoid artifacts
  if (chartInstance) {
    chartInstance.clear(); // Clear all elements first
    chartInstance.dispose();
    chartInstance = null;
  }
  
  if (chartRef.value) {
    chartInstance = echarts.init(chartRef.value);
  } else {
    return;
  }

  // ---- 预处理：强制首尾相连 + 填充缝隙为清醒 ----
  const rawSegs = timelineData.value.segments;

  // 跨午夜处理：提前判断
  const crossesMidnight = rawSegs.length > 0 && t2m(rawSegs[0].startTime) > t2m(rawSegs[rawSegs.length - 1].endTime);
  const toContMin = (t) => {
    let m = t2m(t);
    if (crossesMidnight && m < 720) m += 1440;
    return m;
  };

  const segs = [];
  for (let i = 0; i < rawSegs.length; i++) {
    const cur = { ...rawSegs[i] };
    if (i > 0) {
      // 首尾相连
      cur.startTime = rawSegs[i - 1].endTime;
    }
    // 如果和上一个色块有时间缝隙，插入清醒填充块
    if (segs.length > 0) {
      const prev = segs[segs.length - 1];
      if (toContMin(cur.startTime) > toContMin(prev.endTime)) {
        segs.push({
          startTime: prev.endTime,
          endTime: cur.startTime,
          state: 'awake'
        });
      }
    }
    segs.push(cur);
  }

  // Get theme-aware colors from CSS variables
  const rootStyle = getComputedStyle(document.documentElement);
  const bg = rootStyle.getPropertyValue('--card-bg').trim() || '#ffffff';
  const txt = rootStyle.getPropertyValue('--text-secondary').trim() || '#999';
  const gridCol = document.documentElement.classList.contains('dark') ? '#2a2a2a' : '#e0e0e0';

  const minT = toContMin(segs[0].startTime);
  const maxT = toContMin(segs[segs.length - 1].endTime);
  const pad = Math.max(2, Math.round((maxT - minT) * 0.02));

  // 格式化时间
  const fmtT = v => {
    const m = Math.round(v) % 1440;
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  };

  // 构建系列数据：[stageIndex, startMinutes, endMinutes]
  const seriesData = segs.map(s => {
    const st = sNorm(s.state);
    const cfg = stageConfig[st] || stageConfig.light;
    const sm = Math.round(toContMin(s.startTime));
    const em = Math.round(toContMin(s.endTime));
    return { value: [cfg.yIdx, sm, em], itemStyle: { color: cfg.color } };
  });

  // ---- 心率折线数据 ----
  const hrLineData = [];
  let hrMin = 50, hrMax = 100;
  const hrRaw = heartRateTS.value?.data;
  if (hrRaw && hrRaw.length > 0) {
    const hrPoints = hrRaw.filter(p => isValidHeartRate(p.value));
    if (hrPoints.length > 0) {
      hrMin = Math.min(...hrPoints.map(p => Number(p.value)));
      hrMax = Math.max(...hrPoints.map(p => Number(p.value)));
      const day0 = new Date(timelineData.value.date + 'T00:00:00').getTime() / 1000;

      // Filter heart rate data to only include points within chart X axis range
      hrPoints.forEach(p => {
        let m = Math.round((p.time - day0) / 60);
        if (crossesMidnight && m < 720) m += 1440;
        // Only add points within chart X axis range to avoid ECharts connecting out-of-range points
        if (m >= minT - pad && m <= maxT + pad) {
          hrLineData.push([m, Number(p.value)]);
        }
      });
      
      // Sort heart rate data by X value (time) to ensure correct line rendering
      hrLineData.sort((a, b) => a[0] - b[0]);
    }
  }
  // 心率轴范围取整
  const hrAxisMin = Math.floor(hrMin / 5) * 5;
  const hrAxisMax = Math.ceil(hrMax / 5) * 5;

  // 隐藏的触碰点：每个睡眠段中点，用于 axis trigger 匹配
  const sleepHoverPts = segs.map(s => {
    const st = sNorm(s.state);
    const cfg = stageConfig[st] || stageConfig.light;
    const mid = (t2m(s.startTime) + t2m(s.endTime)) / 2;
    return { value: [mid, cfg.yIdx], _st: st, _cfg: cfg };
  });

  const option = {
    backgroundColor: bg,
    legend: {
      data: [
        { name: stageConfig.deep.label, itemStyle: { color: stageConfig.deep.color } },
        { name: stageConfig.light.label, itemStyle: { color: stageConfig.light.color } },
        { name: stageConfig.rem.label, itemStyle: { color: stageConfig.rem.color } },
        { name: stageConfig.awake.label, itemStyle: { color: stageConfig.awake.color } },
        ...(hrLineData.length > 0 ? [{ name: t('sport.heartRate'), itemStyle: { color: '#ff6b35' } }] : [])
      ],
      orient: 'vertical', // 垂直排列
      right: 10,
      top: 0,
      textStyle: { color: txt, fontSize: 11 },
      itemWidth: 12,
      itemHeight: 8,
      itemGap: 10
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(10,10,10,0.92)',
      borderColor: '#555',
      textStyle: { color: '#ddd', fontSize: 13 },
      axisPointer: {
        type: 'line',
        lineStyle: { color: '#444', type: 'dashed', opacity: 0.3 },
        label: {
          show: true,
          backgroundColor: '#333',
          color: '#ddd',
          fontSize: 11,
          formatter: (v) => {
            const m = Math.round(v.value);
            return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
          }
        }
      },
      formatter: (params) => {
        if (!Array.isArray(params) || params.length === 0) return '';
        const xMin = Math.round(params[0].axisValue);
        const timeLabel = `${String(Math.floor((xMin % 1440) / 60)).padStart(2, '0')}:${String((xMin % 1440) % 60).padStart(2, '0')}`;
        // 查睡眠阶段
        let foundSeg = null;
        for (const seg of segs) {
          const sm = toContMin(seg.startTime);
          const em = toContMin(seg.endTime);
          if (xMin >= sm && xMin < em) { foundSeg = seg; break; }
        }
        // 查心率
        let foundHR = null;
        for (const d of hrLineData) {
          if (Math.abs(d[0] - xMin) <= 1) { foundHR = d[1]; break; }
        }
        let html = '';
        if (foundSeg) {
          const st2 = sNorm(foundSeg.state);
          const cfg2 = stageConfig[st2] || stageConfig.light;
          html += `<span style="display:inline-block;width:10px;height:10px;background:${cfg2.color};margin-right:6px;border-radius:2px;"></span>${cfg2.label}`;
        }
        if (foundHR != null) {
          const int2 = foundHR > 85 ? '#ff6b6b' : foundHR > 70 ? '#ffa94d' : '#ccc';
          html += html ? '&nbsp;|&nbsp;' : '';
          html += `<span style="color:${int2};font-weight:700;">♥ ${foundHR} bpm</span>`;
        }
        return `<strong>${timeLabel}</strong><br/>${html || t('common.empty')}`;
      }
    },
    grid: { left: 48, right: 80, bottom: 30, top: 22, containLabel: false },
    xAxis: {
      type: 'value',
      min: Math.round(minT - pad),
      max: Math.round(maxT + pad),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: txt, fontSize: 11, formatter: v => fmtT(v) },
      splitLine: { show: true, lineStyle: { color: gridCol, type: 'dashed' } }
    },
    yAxis: [{
      type: 'value',
      min: 0,
      max: 1,
      axisLabel: {
        show: true,
        color: '#999',
        fontSize: 10,
        formatter: (v) => {
          if (v >= 0.05 && v <= 0.2) return t('chart.deep');
          if (v >= 0.3 && v <= 0.45) return t('chart.light');
          if (v >= 0.55 && v <= 0.7) return t('chart.rem');
          if (v >= 0.8 && v <= 0.95) return t('chart.awake');
          return '';
        },
        interval: 0.125,
        margin: 4
      },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: false }
    },
    // 右侧心率刻度轴（完全隐藏，仅作数据映射）
    ...(hrLineData.length > 0 ? [{
      type: 'value',
      show: false,
      min: hrAxisMin,
      max: hrAxisMax,
      axisLabel: { show: false },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
      position: 'right'
    }] : [])
    ],
    series: [
      // 隐藏柱系列：仅为图例提供颜色标记
      { name: stageConfig.deep.label, type: 'bar', data: [], itemStyle: { color: stageConfig.deep.color } },
      { name: stageConfig.light.label, type: 'bar', data: [], itemStyle: { color: stageConfig.light.color } },
      { name: stageConfig.rem.label, type: 'bar', data: [], itemStyle: { color: stageConfig.rem.color } },
      { name: stageConfig.awake.label, type: 'bar', data: [], itemStyle: { color: stageConfig.awake.color } },
      // 隐藏散点：为 axis trigger 提供睡眠段匹配点
      ...(sleepHoverPts.length > 0 ? [{
        name: 'sleepPt',
        type: 'scatter',
        symbolSize: 0,
        data: sleepHoverPts,
        z: 1
      }] : []),
      {
      name: 'sleep',
      type: 'custom',
      encode: { x: [1, 2], y: 0 },
      renderItem: (params, api) => {
        // api.value(0)=stageIndex(0-3), api.value(1)=start, api.value(2)=end
        const catIdx = api.value(0);
        const startVal = api.value(1);
        const endVal = api.value(2);

        // 每层 0.25 高：深睡 0-0.25, 浅睡 0.25-0.5, REM 0.5-0.75, 清醒 0.75-1.0
        const bandBtm = catIdx * 0.25;
        const bandTop = (catIdx + 1) * 0.25;

        // 左下角：时间起点 + 层级底部
        const pointStart = api.coord([startVal, bandBtm]);
        // 右上角：时间终点 + 层级顶部
        const pointEnd = api.coord([endVal, bandTop]);

        // 左右各延伸 0.5px 让相邻色块微重叠，消除抗锯齿缝隙
        const x = pointStart[0] - 0.5;
        const y = pointEnd[1];
        const w = Math.max(1, pointEnd[0] - pointStart[0] + 1);
        const h = pointStart[1] - pointEnd[1];

        const rectShape = echarts.graphic.clipRectByRect(
          { x, y, width: w, height: h },
          { x: params.coordSys.x, y: params.coordSys.y, width: params.coordSys.width, height: params.coordSys.height }
        );

        return rectShape && {
          type: 'rect',
          shape: rectShape,
          style: { fill: segs[params.dataIndex] ? stageConfig[sNorm(segs[params.dataIndex].state)]?.color || '#999' : '#999' }
        };
      },
      data: seriesData
    },
    // 心率平滑折线
    ...(hrLineData.length > 0 ? [{
      name: t('sport.heartRate'),
      type: 'line',
      yAxisIndex: 1,
      smooth: 0.4,
      data: hrLineData,
      symbol: 'none',
      lineStyle: { color: '#ff6b35', width: 2 },
      itemStyle: { color: '#ff6b35' },
      emphasis: { itemStyle: { borderWidth: 2, borderColor: '#fff', symbolSize: 8 } },
      z: 20
    }] : [])
    ]
  };

  chartInstance.setOption(option, true);
}

const initChart = () => { 
  if (chartRef.value && hasData.value && !chartInstance) { 
    chartInstance = echarts.init(chartRef.value); 
    buildChart(); 
  } else if (chartInstance && hasData.value) {
    // Chart already exists, just rebuild
    buildChart();
  }
};

watch(() => props.data, async nd => {
  timelineData.value = nd;
  heartRateTS.value = null;
  if (nd?.date) {
    const hr = await dataStore.fetchTimeSeries(nd.date, 'heart_rate');
    if (hr?.data?.length) {
      heartRateTS.value = {
        ...hr,
        data: hr.data.filter(item => isValidHeartRate(item.value))
      };
    }
  }
  // Wait for DOM to update before building chart
  await new Promise(resolve => setTimeout(resolve, 50));
  if (chartInstance) {
    // Chart already initialized, just rebuild with new data
    buildChart();
  }
  // If chart not initialized yet, it will be handled by watch(hasData)
}, { deep: true, immediate: true });

// Watch hasData changes to re-init chart when data becomes available
watch(hasData, async (newVal) => {
  if (newVal && !chartInstance && chartRef.value) {
    // Chart instance doesn't exist but we have data, initialize it
    await new Promise(resolve => setTimeout(resolve, 100));
    initChart();
  }
});

watch(() => localeStore.currentLocale, () => {
  if (chartInstance && hasData.value) buildChart();
});

const handleResize = () => chartInstance?.resize();

onMounted(() => { setTimeout(initChart, 100); window.addEventListener('resize', handleResize); });
onBeforeUnmount(() => { chartInstance?.dispose(); window.removeEventListener('resize', handleResize); });
</script>

<style scoped>
.sleep-timeline-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 100%;
  padding-bottom: 0;
}
.timeline-card {
  display: flex;
  flex-direction: column;
  min-height: clamp(240px, 32vh, 340px);
  padding: 16px 20px 18px;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}
.sleep-overview-cards {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;
  margin-bottom: 16px; flex-shrink: 0;
}
.overview-card {
  border: 2px solid var(--card-border); border-radius: 8px;
  background: var(--card-bg); transition: all 0.3s;
  min-width: 0;
}
.overview-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); border-color: var(--primary-color); }
.overview-card-content { display: flex; align-items: center; gap: 12px; min-width: 0; padding: 4px 0; }
.card-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.icon-text { font-size: 24px; line-height: 1; }
.sleep-icon { background: rgba(250, 140, 22, 0.12); } .heart-icon { background: rgba(245, 108, 108, 0.12); } .interrupt-icon { background: rgba(64, 158, 255, 0.12); }
.card-info { flex: 1; min-width: 0; }
.card-label { font-size: 13px; color: var(--text-secondary); line-height: 1.4; margin-bottom: 4px; overflow-wrap: anywhere; }
.card-value { font-size: 20px; font-weight: 600; color: var(--text-primary); white-space: nowrap; }
.card-value-row { display: flex; align-items: center; justify-content: flex-start; flex-wrap: wrap; gap: 8px; }
.card-value-row .card-value { margin-bottom: 0; }
.chart { width: 100%; flex: 1; min-height: clamp(220px, 28vh, 300px); }
.empty-state {
  text-align: center;
  height: 100%; /* Fill entire container height to match sidebar */
  display: flex;
  align-items: center;
  justify-content: center;
}
.summary-info { display: flex; gap: 24px; margin-bottom: 12px; padding: 10px 14px; background: var(--bg-secondary); border-radius: 8px; flex-wrap: wrap; color: var(--text-secondary); font-size: 13px; }
@media (max-width: 900px) { .sleep-overview-cards { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 500px) { .sleep-overview-cards { grid-template-columns: repeat(1, 1fr); } }
</style>
