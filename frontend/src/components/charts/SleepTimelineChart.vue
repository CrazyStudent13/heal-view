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

const localeStore = useLocaleStore();
function t(key) { return localeStore.t(key); }

const props = defineProps({
  data: { type: Object, required: true },
  avgHeartRate: { type: Number, default: null }
});

const chartRef = ref(null);
let chartInstance = null;
const timelineData = ref(props.data);
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
    if (d[st] !== undefined) d[st] += t2m(s.endTime) - t2m(s.startTime);
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
      if (t2m(cur.startTime) > t2m(prev.endTime)) {
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

  const minT = t2m(segs[0].startTime);
  const maxT = t2m(segs[segs.length - 1].endTime);
  const pad = Math.max(2, Math.round((maxT - minT) * 0.02));

  // 格式化时间，用 Math.round 避免浮点数显示
  const fmtT = v => {
    const m = Math.round(v);
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  };

  // 构建系列数据：[stageIndex, startMinutes, endMinutes]
  const seriesData = segs.map(s => {
    const st = sNorm(s.state);
    const cfg = stageConfig[st] || stageConfig.light;
    const sm = Math.round(t2m(s.startTime));
    const em = Math.round(t2m(s.endTime));
    return { value: [cfg.yIdx, sm, em], itemStyle: { color: cfg.color } };
  });

  const option = {
    backgroundColor: bg,
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(10,10,10,0.92)',
      borderColor: '#333',
      textStyle: { color: '#ddd', fontSize: 13 },
      formatter: p => {
        const s = segs[p.dataIndex]; if (!s) return '';
        const st = sNorm(s.state);
        const cfg = stageConfig[st] || stageConfig.light;
        const d = Math.round(t2m(s.endTime) - t2m(s.startTime));
        return `<strong>${s.startTime} - ${s.endTime}</strong><br/>
          <span style="display:inline-block;width:10px;height:10px;background:${cfg.color};margin-right:6px;border-radius:2px;"></span>
          ${cfg.label}：${d}分钟`;
      }
    },
    grid: { left: 8, right: 8, bottom: 30, top: 8, containLabel: false },
    xAxis: {
      type: 'value',
      min: Math.round(minT - pad),
      max: Math.round(maxT + pad),
      axisLine: { lineStyle: { color: '#333' } },
      axisTick: { show: false },
      axisLabel: { color: txt, fontSize: 11, formatter: v => fmtT(v) },
      splitLine: { show: true, lineStyle: { color: gridCol, type: 'dashed' } }
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 1,
      axisLabel: { show: false },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: false }
    },
    series: [{
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
          style: api.style()
        };
      },
      data: seriesData
    }]
  };

  chartInstance.setOption(option, true);
}

const initChart = () => { if (chartRef.value) { chartInstance = echarts.init(chartRef.value); buildChart(); } };

watch(() => props.data, nd => { timelineData.value = nd; if (nd?.segments?.length) buildChart(); }, { deep: true });

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
