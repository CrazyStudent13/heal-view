<template>
  <div class="chart-container">
    <div v-if="hasData" class="sleep-overview-cards">
      <el-card class="overview-card" shadow="hover">
        <div class="overview-card-content">
          <div class="card-icon sleep-icon"><span class="icon-text">🌙</span></div>
          <div class="card-info">
            <div class="card-label">总睡眠（{{ timelineData.bedtime }} → {{ timelineData.wakeUpTime }}）</div>
            <div class="card-value">{{ totalSleepDuration }}</div>
          </div>
        </div>
      </el-card>
      <el-card class="overview-card" shadow="hover">
        <div class="overview-card-content">
          <div class="card-icon heart-icon"><span class="icon-text">❤️</span></div>
          <div class="card-info">
            <div class="card-label">睡眠平均心率</div>
            <div class="card-value">{{ avgHeartRateDisplay }}</div>
          </div>
        </div>
      </el-card>
      <el-card class="overview-card" shadow="hover">
        <div class="overview-card-content">
          <div class="card-icon interrupt-icon"><span class="icon-text">⏰</span></div>
          <div class="card-info">
            <div class="card-label">中断次数</div>
            <div class="card-value-row">
              <span class="card-value">{{ awakeEpisodes }} 次</span>
              <el-tag :type="interruptTagType" size="small">{{ interruptDesc }}</el-tag>
            </div>
          </div>
        </div>
      </el-card>
    </div>
    <div v-else-if="timelineData" class="summary-info">
      <span>{{ t('chart.bedtime') }}: {{ timelineData.bedtime || '--' }}</span>
      <span>{{ t('chart.wakeUpTime') }}: {{ timelineData.wakeUpTime || '--' }}</span>
    </div>
    <div ref="chartRef" class="chart"></div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import * as echarts from 'echarts';
import { useLocaleStore } from '../../stores/localeStore';
import { useDataStore } from '../../stores/dataStore';

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
const avgHeartRateDisplay = computed(() =>
  props.avgHeartRate ? `${props.avgHeartRate} bpm` : '-- bpm'
);

// ---- 阶段配置：4 层堆叠，各占 0.25 高度 ----
const stageConfig = {
  deep:  { color: '#2A35C0', label: '深睡',     yIdx: 0 },
  light: { color: '#29B6F6', label: '浅睡',     yIdx: 1 },
  rem:   { color: '#1DE9B6', label: '快速眼动', yIdx: 2 },
  awake: { color: '#FFAB00', label: '清醒',     yIdx: 3 }
};

function sNorm(st) { return typeof st === 'string' ? st.toLowerCase() : String(st).toLowerCase(); }
function t2m(t) { const [h, m] = t.split(':').map(Number); return h * 60 + m; }
function fmtDur(min) {
  if (!min) return '0分钟';
  const h = Math.floor(min / 60), m = min % 60;
  return h > 0 ? `${h}小时${m > 0 ? m + '分钟' : ''}` : `${m}分钟`;
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
  if (c === 0) return '整夜安睡'; if (c === 1) return '轻微中断';
  if (c <= 3) return '正常范围'; return '中断偏多';
});
const interruptTagType = computed(() => {
  const c = awakeEpisodes.value;
  if (c === 0) return 'success'; if (c === 1) return 'warning';
  if (c <= 3) return ''; return 'danger';
});

// ---- 图表核心 ----
function buildChart() {
  if (!chartInstance || !hasData.value) return;

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

  const bg = '#141414';
  const txt = '#888';
  const gridCol = '#2a2a2a';

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
    const hrPoints = hrRaw.filter(p => p.value > 0);
    if (hrPoints.length > 0) {
      hrMin = Math.min(...hrPoints.map(p => p.value));
      hrMax = Math.max(...hrPoints.map(p => p.value));
      const day0 = new Date(timelineData.value.date + 'T00:00:00').getTime() / 1000;

      hrPoints.forEach(p => {
        let m = Math.round((p.time - day0) / 60);
        if (crossesMidnight && m < 720) m += 1440;
        hrLineData.push([m, p.value]);
      });
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
        ...(hrLineData.length > 0 ? [{ name: '心率', itemStyle: { color: '#ff6b35' } }] : [])
      ],
      top: 0,
      left: 'center',
      textStyle: { color: '#aaa', fontSize: 11 },
      itemWidth: 12,
      itemHeight: 8,
      itemGap: 14
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
        const t = `${String(Math.floor(xMin / 60)).padStart(2, '0')}:${String(xMin % 60).padStart(2, '0')}`;
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
        return `<strong>${t}</strong><br/>${html || '无数据'}`;
      }
    },
    grid: { left: 48, right: 8, bottom: 30, top: 32, containLabel: false },
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
          if (v >= 0.05 && v <= 0.2) return '深睡';
          if (v >= 0.3 && v <= 0.45) return '浅睡';
          if (v >= 0.55 && v <= 0.7) return '快速眼动';
          if (v >= 0.8 && v <= 0.95) return '清醒';
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
      name: 'heartRate',
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

const initChart = () => { if (chartRef.value) { chartInstance = echarts.init(chartRef.value); buildChart(); } };

watch(() => props.data, async nd => {
  timelineData.value = nd;
  heartRateTS.value = null;
  if (nd?.date) {
    const hr = await dataStore.fetchTimeSeries(nd.date, 'heart_rate');
    if (hr?.data?.length) heartRateTS.value = hr;
  }
  buildChart();
}, { deep: true, immediate: true });

onMounted(() => { setTimeout(initChart, 100); window.addEventListener('resize', () => chartInstance?.resize()); });
onBeforeUnmount(() => { chartInstance?.dispose(); window.removeEventListener('resize', () => chartInstance?.resize()); });
</script>

<style scoped>
.chart-container {
  background: var(--card-bg); padding: 20px; border-radius: 8px;
  margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  border: 1px solid var(--card-border); min-height: 100%;
  display: flex; flex-direction: column;
}
.sleep-overview-cards {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;
  margin-bottom: 16px; flex-shrink: 0;
}
.overview-card {
  border: 2px solid var(--card-border); border-radius: 8px;
  background: var(--card-bg); transition: all 0.3s;
}
.overview-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); border-color: var(--primary-color); }
.overview-card-content { display: flex; align-items: center; gap: 16px; padding: 4px 0; }
.card-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.icon-text { font-size: 24px; line-height: 1; }
.sleep-icon { background: #fff7e6; } .heart-icon { background: #fff1f0; } .interrupt-icon { background: #e6f7ff; }
.card-info { flex: 1; min-width: 0; }
.card-label { font-size: 13px; color: var(--text-secondary); margin-bottom: 4px; }
.card-value { font-size: 20px; font-weight: 600; color: var(--text-primary); }
.card-value-row { display: flex; align-items: center; justify-content: center; gap: 8px; }
.card-value-row .card-value { margin-bottom: 0; }
.chart { width: 100%; flex: 1; min-height: 220px; }
.summary-info { display: flex; gap: 24px; margin-bottom: 12px; padding: 10px 14px; background: var(--bg-secondary); border-radius: 8px; flex-wrap: wrap; color: var(--text-secondary); font-size: 13px; }
@media (max-width: 900px) { .sleep-overview-cards { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 500px) { .sleep-overview-cards { grid-template-columns: repeat(1, 1fr); } }
</style>
