<template>
  <section class="analysis-card">
    <SectionTitle>
      <template #icon><PieChart /></template>
      {{ t('chart.sleepStageAnalysis') }}
    </SectionTitle>

    <div class="analysis-grid">
      <div class="analysis-panel">
        <el-text tag="span" class="analysis-caption">{{ t('chart.sleepStageDuration') }}</el-text>
        <div ref="barChartRef" class="analysis-chart" role="img" :aria-label="t('chart.sleepStageDuration')"></div>
      </div>
      <div class="analysis-panel">
        <el-text tag="span" class="analysis-caption">{{ t('chart.sleepStageRatio') }}</el-text>
        <div ref="pieChartRef" class="analysis-chart" role="img" :aria-label="t('chart.sleepStageRatio')"></div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import * as echarts from 'echarts';
import { useLocaleStore } from '../../stores/localeStore';
import { useThemeStore } from '../../stores/themeStore';

const props = defineProps({
  segments: {
    type: Array,
    default: () => []
  }
});

const localeStore = useLocaleStore();
const themeStore = useThemeStore();
const { t } = localeStore;

const barChartRef = ref(null);
const pieChartRef = ref(null);
let barChart = null;
let pieChart = null;
let resizeObserver = null;

const stageMeta = computed(() => ({
  deep: { name: t('chart.deep'), color: '#2A35C0' },
  light: { name: t('chart.light'), color: '#29B6F6' },
  rem: { name: t('chart.rem'), color: '#1DE9B6' },
  awake: { name: t('chart.awake'), color: '#FFAB00' }
}));

function timeToMinutes(time) {
  if (typeof time !== 'string' || !/^\d{1,2}:\d{2}$/.test(time)) return null;
  const [hours, minutes] = time.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

const stageData = computed(() => {
  const durations = { deep: 0, light: 0, rem: 0, awake: 0 };

  props.segments.forEach(segment => {
    const state = String(segment.state || '').toLowerCase();
    const start = timeToMinutes(segment.startTime);
    const end = timeToMinutes(segment.endTime);
    if (!(state in durations) || start === null || end === null) return;

    const duration = end >= start ? end - start : end + 1440 - start;
    durations[state] += duration;
  });

  return Object.entries(durations).map(([key, value]) => ({
    key,
    value,
    name: stageMeta.value[key].name,
    itemStyle: { color: stageMeta.value[key].color }
  }));
});

const totalMinutes = computed(() => stageData.value.reduce((sum, stage) => sum + stage.value, 0));

function formatDuration(minutes, compact = false) {
  const rounded = Math.round(Number(minutes) || 0);
  const hours = Math.floor(rounded / 60);
  const remainingMinutes = rounded % 60;
  const hourUnit = t('chart.hourShort');
  const minuteUnit = t('chart.minuteShort');

  if (compact && hours > 0) {
    return remainingMinutes > 0 ? `${hours}${hourUnit}${remainingMinutes}${minuteUnit}` : `${hours}${hourUnit}`;
  }
  if (hours > 0) {
    return remainingMinutes > 0 ? `${hours}${hourUnit} ${remainingMinutes}${minuteUnit}` : `${hours}${hourUnit}`;
  }
  return `${remainingMinutes}${minuteUnit}`;
}

function themeColors() {
  const rootStyle = getComputedStyle(document.documentElement);
  return {
    text: rootStyle.getPropertyValue('--text-secondary').trim() || '#606266',
    textStrong: rootStyle.getPropertyValue('--text-primary').trim() || '#303133',
    line: rootStyle.getPropertyValue('--card-border').trim() || '#e8e8e8',
    background: rootStyle.getPropertyValue('--card-bg').trim() || '#ffffff'
  };
}

function tooltipFormatter(params) {
  const datum = Array.isArray(params) ? params[0]?.data : params?.data;
  if (!datum) return '';
  const percent = totalMinutes.value > 0 ? (datum.value / totalMinutes.value * 100).toFixed(1) : '0.0';
  const marker = Array.isArray(params) ? params[0]?.marker : params?.marker;
  return `${marker || ''}${datum.name}<br/><strong>${formatDuration(datum.value)}</strong> · ${percent}%`;
}

function updateCharts() {
  if (!barChart || !pieChart) return;
  const colors = themeColors();
  const data = stageData.value;

  barChart.setOption({
    backgroundColor: 'transparent',
    animationDuration: 500,
    grid: { left: 14, right: 62, top: 20, bottom: 24, containLabel: true },
    tooltip: {
      trigger: 'item',
      formatter: tooltipFormatter,
      backgroundColor: colors.background,
      borderColor: colors.line,
      textStyle: { color: colors.textStrong }
    },
    xAxis: {
      type: 'value',
      min: 0,
      splitNumber: 4,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: colors.text, hideOverlap: true, formatter: value => formatDuration(value, true) },
      splitLine: { lineStyle: { color: colors.line, type: 'dashed' } }
    },
    yAxis: {
      type: 'category',
      inverse: true,
      data: data.map(item => item.name),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: colors.textStrong, margin: 12 }
    },
    series: [{
      type: 'bar',
      barWidth: 18,
      data,
      itemStyle: { borderRadius: [0, 4, 4, 0] },
      label: {
        show: true,
        position: 'right',
        color: colors.textStrong,
        formatter: params => formatDuration(params.value, true)
      }
    }]
  }, true);

  pieChart.setOption({
    backgroundColor: 'transparent',
    animationDuration: 500,
    tooltip: {
      trigger: 'item',
      formatter: tooltipFormatter,
      backgroundColor: colors.background,
      borderColor: colors.line,
      textStyle: { color: colors.textStrong }
    },
    legend: {
      type: 'scroll',
      bottom: 0,
      left: 'center',
      textStyle: { color: colors.text }
    },
    series: [{
      type: 'pie',
      radius: ['38%', '66%'],
      center: ['50%', '44%'],
      minShowLabelAngle: 4,
      avoidLabelOverlap: true,
      itemStyle: { borderColor: colors.background, borderWidth: 2 },
      label: {
        color: colors.textStrong,
        formatter: '{b}\n{d}%'
      },
      labelLine: { length: 10, length2: 8 },
      emphasis: { scaleSize: 6 },
      data
    }]
  }, true);
}

async function initCharts() {
  await nextTick();
  if (!barChartRef.value || !pieChartRef.value) return;
  barChart = echarts.init(barChartRef.value);
  pieChart = echarts.init(pieChartRef.value);
  updateCharts();

  resizeObserver = new ResizeObserver(() => {
    barChart?.resize();
    pieChart?.resize();
  });
  resizeObserver.observe(barChartRef.value);
  resizeObserver.observe(pieChartRef.value);
}

watch(
  [stageData, () => localeStore.currentLocale, () => themeStore.isDarkMode],
  () => nextTick(updateCharts),
  { deep: true }
);

onMounted(initCharts);

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  barChart?.dispose();
  pieChart?.dispose();
});
</script>

<style scoped>
.analysis-card {
  padding: 12px 18px 14px;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
}

.analysis-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 14px;
  flex: 1;
  align-items: stretch;
}

.analysis-panel {
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.analysis-caption {
  display: block;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 20px;
  text-align: left;
  margin-bottom: 6px;
}

.analysis-chart {
  width: 100%;
  flex: 1;
  min-height: clamp(220px, 24vh, 260px);
  min-width: 0;
}
.analysis-card :deep(.app-section-title--level-2) {
  margin-bottom: 10px;
}

@media (max-width: 760px) {
  .analysis-grid {
    grid-template-columns: 1fr;
  }
}
</style>
