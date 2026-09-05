<template>
  <div class="chart-container">
    <SectionTitle>{{ t('chart.heartRateMonitor') }}</SectionTitle>

    <div class="metrics-cards" v-if="hasData">
      <div class="metric-card blood-pressure-card" :class="avgBloodPressureMetrics?.status || 'normal'">
        <div class="metric-label blood-pressure-label">
          {{ t('data.avgBloodPressure') }}
          <el-tooltip :content="bloodPressureTipContent" placement="top" raw-content>
            <el-icon class="help-icon"><QuestionFilled /></el-icon>
          </el-tooltip>
        </div>
        <div class="metric-value blood-pressure-value" :class="avgBloodPressureMetrics?.status || 'normal'">
          {{ avgBloodPressure }}
        </div>
      </div>

      <div class="metric-card blood-pressure-card peak" :class="peakBloodPressureMetrics?.status || 'normal'">
        <div class="metric-label blood-pressure-label">
          {{ t('chart.bloodPressurePeak') }}
          <el-tooltip :content="bloodPressureTipContent" placement="top" raw-content>
            <el-icon class="help-icon"><QuestionFilled /></el-icon>
          </el-tooltip>
        </div>
        <div class="metric-value blood-pressure-value" :class="peakBloodPressureMetrics?.status || 'normal'">
          {{ peakBloodPressure }}
        </div>
      </div>

      <div class="metric-card heartrate-card">
        <div class="metric-label heart-label">{{ t('data.heartRate') }}</div>
        <div class="metric-value heart-value">{{ avgHeartRate }} <span class="metric-unit">{{ t('chart.unitBpm') }}</span></div>
      </div>

      <div class="metric-card heartrate-card">
        <div class="metric-label heart-label">{{ t('chart.heartRateRange') }}</div>
        <div class="metric-value heart-value">{{ heartRateRange }}</div>
      </div>
    </div>

    <div ref="chartRef" class="chart"></div>

    <div v-if="!hasData" class="empty-state">
      <p>{{ t('nav.selectDatesToCompare') }}</p>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import * as echarts from 'echarts';
import { QuestionFilled } from '@element-plus/icons-vue';
import { useLocaleStore } from '../../stores/localeStore.js';
import { useThemeStore } from '../../stores/themeStore.js';

const localeStore = useLocaleStore();
const themeStore = useThemeStore();
const { t } = localeStore;

const props = defineProps({
  data: {
    type: Array,
    required: true
  }
});

const chartRef = ref(null);
let chartInstance = null;

function isValidNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0;
}

function firstValidNumber(...values) {
  return values.find(value => isValidNumber(value));
}

function formatBloodPressure(systolic, diastolic) {
  const sys = Math.round(Number(systolic) || 0);
  const dia = Math.round(Number(diastolic) || 0);
  if (!isValidNumber(sys) || !isValidNumber(dia)) return '--';
  return `${sys}/${dia} mmHg`;
}

function bloodPressureStatus(systolic, diastolic) {
  const sys = Number(systolic) || 0;
  const dia = Number(diastolic) || 0;
  if (sys >= 140 || dia >= 90) return 'high';
  if (sys >= 130 || dia >= 85) return 'elevated';
  return 'normal';
}

function resolveBloodPressure(item) {
  const records = Array.isArray(item.bloodPressureRecords)
    ? item.bloodPressureRecords.filter(record => isValidNumber(record.systolic) && isValidNumber(record.diastolic))
    : [];

  if (isValidNumber(item.avgSystolic) && isValidNumber(item.avgDiastolic)) {
    return {
      systolic: Math.round(Number(item.avgSystolic)),
      diastolic: Math.round(Number(item.avgDiastolic))
    };
  }

  if (records.length > 0) {
    const systolic = Math.round(records.reduce((sum, record) => sum + Number(record.systolic), 0) / records.length);
    const diastolic = Math.round(records.reduce((sum, record) => sum + Number(record.diastolic), 0) / records.length);
    return { systolic, diastolic };
  }

  return null;
}

function resolvePeakBloodPressure(item) {
  const records = Array.isArray(item.bloodPressureRecords)
    ? item.bloodPressureRecords.filter(record => isValidNumber(record.systolic) && isValidNumber(record.diastolic))
    : [];

  if (records.length > 0) {
    return records.reduce((best, record) => {
      if (!best) return record;
      const currentSys = Number(record.systolic) || 0;
      const currentDia = Number(record.diastolic) || 0;
      const bestSys = Number(best.systolic) || 0;
      const bestDia = Number(best.diastolic) || 0;
      if (currentSys > bestSys) return record;
      if (currentSys === bestSys && currentDia > bestDia) return record;
      return best;
    }, null);
  }

  if (isValidNumber(item.avgSystolic) && isValidNumber(item.avgDiastolic)) {
    return {
      systolic: Math.round(Number(item.avgSystolic)),
      diastolic: Math.round(Number(item.avgDiastolic)),
      date: item.date
    };
  }

  return null;
}

const comparisonRows = computed(() => {
  return props.data
    .map(item => {
      const bloodPressure = resolveBloodPressure(item);
      const peakBloodPressure = resolvePeakBloodPressure(item);

      return {
        date: item.date,
        avgHeartRate: isValidNumber(item.avgHeartRate) ? Math.round(Number(item.avgHeartRate)) : null,
        minHeartRate: isValidNumber(item.minHeartRate) ? Math.round(Number(item.minHeartRate)) : null,
        maxHeartRate: isValidNumber(item.maxHeartRate) ? Math.round(Number(item.maxHeartRate)) : null,
        bloodPressure,
        peakBloodPressure
      };
    })
    .filter(item =>
      item.avgHeartRate !== null ||
      item.minHeartRate !== null ||
      item.maxHeartRate !== null ||
      item.bloodPressure ||
      item.peakBloodPressure
    );
});

const hasData = computed(() => comparisonRows.value.length > 0);

const avgHeartRate = computed(() => {
  const values = comparisonRows.value
    .map(item => item.avgHeartRate)
    .filter(isValidNumber)
    .map(Number);

  if (values.length === 0) return '--';
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
});

const heartRateRange = computed(() => {
  const minValues = comparisonRows.value
    .map(item => firstValidNumber(item.minHeartRate, item.avgHeartRate))
    .filter(isValidNumber)
    .map(Number);

  const maxValues = comparisonRows.value
    .map(item => firstValidNumber(item.maxHeartRate, item.avgHeartRate))
    .filter(isValidNumber)
    .map(Number);

  if (minValues.length === 0 || maxValues.length === 0) return '--';
  return `${Math.min(...minValues)}-${Math.max(...maxValues)} ${t('chart.unitBpm')}`;
});

const avgBloodPressureMetrics = computed(() => {
  const allRecords = props.data.flatMap(item => {
    const records = Array.isArray(item.bloodPressureRecords) ? item.bloodPressureRecords : [];
    return records
      .filter(record => isValidNumber(record.systolic) && isValidNumber(record.diastolic))
      .map(record => ({
        systolic: Number(record.systolic),
        diastolic: Number(record.diastolic)
      }));
  });

  if (allRecords.length > 0) {
    const systolic = Math.round(allRecords.reduce((sum, record) => sum + record.systolic, 0) / allRecords.length);
    const diastolic = Math.round(allRecords.reduce((sum, record) => sum + record.diastolic, 0) / allRecords.length);
    return {
      systolic,
      diastolic,
      text: formatBloodPressure(systolic, diastolic),
      status: bloodPressureStatus(systolic, diastolic)
    };
  }

  const dailyValues = comparisonRows.value
    .map(item => item.bloodPressure)
    .filter(Boolean);

  if (dailyValues.length === 0) return null;

  const systolic = Math.round(dailyValues.reduce((sum, item) => sum + Number(item.systolic), 0) / dailyValues.length);
  const diastolic = Math.round(dailyValues.reduce((sum, item) => sum + Number(item.diastolic), 0) / dailyValues.length);
  return {
    systolic,
    diastolic,
    text: formatBloodPressure(systolic, diastolic),
    status: bloodPressureStatus(systolic, diastolic)
  };
});

const peakBloodPressureMetrics = computed(() => {
  const peakRecords = props.data.flatMap(item => {
    const records = Array.isArray(item.bloodPressureRecords) ? item.bloodPressureRecords : [];
    return records
      .filter(record => isValidNumber(record.systolic) && isValidNumber(record.diastolic))
      .map(record => ({
        ...record,
        date: item.date
      }));
  });

  let record = null;
  if (peakRecords.length > 0) {
    record = peakRecords.reduce((best, current) => {
      if (!best) return current;
      const currentSys = Number(current.systolic) || 0;
      const currentDia = Number(current.diastolic) || 0;
      const bestSys = Number(best.systolic) || 0;
      const bestDia = Number(best.diastolic) || 0;
      if (currentSys > bestSys) return current;
      if (currentSys === bestSys && currentDia > bestDia) return current;
      return best;
    }, null);
  } else {
    const dailyPeaks = comparisonRows.value
      .map(item => item.peakBloodPressure)
      .filter(Boolean);
    if (dailyPeaks.length > 0) {
      record = dailyPeaks.reduce((best, current) => {
        if (!best) return current;
        const currentSys = Number(current.systolic) || 0;
        const currentDia = Number(current.diastolic) || 0;
        const bestSys = Number(best.systolic) || 0;
        const bestDia = Number(best.diastolic) || 0;
        if (currentSys > bestSys) return current;
        if (currentSys === bestSys && currentDia > bestDia) return current;
        return best;
      }, null);
    }
  }

  if (!record) return null;

  return {
    systolic: Number(record.systolic) || 0,
    diastolic: Number(record.diastolic) || 0,
    text: formatBloodPressure(record.systolic, record.diastolic),
    status: bloodPressureStatus(record.systolic, record.diastolic)
  };
});

const avgBloodPressure = computed(() => {
  return avgBloodPressureMetrics.value?.text || '--';
});

const peakBloodPressure = computed(() => {
  return peakBloodPressureMetrics.value?.text || '--';
});

const bloodPressureTipContent = computed(() => `
  <div style="line-height:1.8">
    <div style="font-weight:600;margin-bottom:4px">${t('chart.bloodPressureRangeTipTitle')}</div>
    <div>${t('chart.bloodPressureHighRange')}: <span style="color:#ff4d4f">${t('chart.bloodPressureHighRangeValue')}</span></div>
    <div>${t('chart.bloodPressureElevatedRange')}: <span style="color:#faad14">${t('chart.bloodPressureElevatedRangeValue')}</span></div>
  </div>
`);

function getAxisBounds(values, fallbackMin, fallbackMax, paddingRatio = 0.12, step = 5) {
  if (values.length === 0) return { min: fallbackMin, max: fallbackMax };

  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const padding = Math.max(Math.round((maxValue - minValue) * paddingRatio), step);
  return {
    min: Math.max(step, Math.floor((minValue - padding) / step) * step),
    max: Math.ceil((maxValue + padding) / step) * step
  };
}

function buildChartOption() {
  const dates = comparisonRows.value.map(item => item.date);
  const avgHeartRateSeries = comparisonRows.value.map(item => item.avgHeartRate);
  const maxHeartRateSeries = comparisonRows.value.map(item => firstValidNumber(item.maxHeartRate, item.avgHeartRate));
  const systolicSeries = comparisonRows.value.map(item => item.bloodPressure?.systolic ?? null);
  const diastolicSeries = comparisonRows.value.map(item => item.bloodPressure?.diastolic ?? null);

  const heartRateValues = comparisonRows.value.flatMap(item => [item.avgHeartRate, item.maxHeartRate, item.minHeartRate].filter(isValidNumber).map(Number));
  const bloodPressureValues = comparisonRows.value.flatMap(item => [
    item.bloodPressure?.systolic,
    item.bloodPressure?.diastolic
  ].filter(isValidNumber).map(Number));

  const isDark = themeStore.isDarkMode;
  const textColor = isDark ? '#a8a8a8' : '#606266';
  const axisLineColor = isDark ? '#3a3a3a' : '#e8e8e8';
  const splitLineColor = isDark ? '#3a3a3a' : '#ebeef5';
  const heartRateBounds = getAxisBounds(heartRateValues, 40, 180, 0.15, 5);
  const bloodPressureBounds = getAxisBounds(bloodPressureValues, 40, 160, 0.12, 5);

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      formatter: (params) => {
        if (!params || params.length === 0) return '';

        const day = params[0].name;
        const avgHr = params.find(item => item.seriesName === t('chart.avgHeartRate'));
        const maxHr = params.find(item => item.seriesName === t('chart.maxHeartRate'));
        const systolic = params.find(item => item.seriesName === t('chart.systolic'));
        const diastolic = params.find(item => item.seriesName === t('chart.diastolic'));

        let html = `<strong>${day}</strong><br/>`;
        if (avgHr && isValidNumber(avgHr.value)) {
          html += `${avgHr.marker}${t('chart.avgHeartRate')}：${avgHr.value} ${t('chart.unitBpm')}<br/>`;
        }
        if (maxHr && isValidNumber(maxHr.value)) {
          html += `${maxHr.marker}${t('chart.maxHeartRate')}：${maxHr.value} ${t('chart.unitBpm')}<br/>`;
        }
        if (systolic && isValidNumber(systolic.value)) {
          html += `${systolic.marker}${t('chart.systolic')}：${systolic.value} mmHg<br/>`;
        }
        if (diastolic && isValidNumber(diastolic.value)) {
          html += `${diastolic.marker}${t('chart.diastolic')}：${diastolic.value} mmHg<br/>`;
        }
        return html;
      }
    },
    legend: {
      data: [t('chart.avgHeartRate'), t('chart.maxHeartRate'), t('chart.systolic'), t('chart.diastolic')],
      right: 0,
      top: 0,
      itemWidth: 12,
      itemHeight: 8,
      textStyle: { color: textColor }
    },
    grid: {
      left: '3%',
      right: '8%',
      bottom: '10%',
      top: '18%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: dates,
      axisLabel: {
        rotate: 45,
        fontSize: 12,
        color: textColor
      },
      axisLine: {
        lineStyle: { color: axisLineColor }
      }
    },
    yAxis: [
      {
        type: 'value',
        name: `${t('data.heartRate')} (${t('chart.unitBpm')})`,
        min: heartRateBounds.min,
        max: heartRateBounds.max,
        nameTextStyle: { color: textColor },
        axisLabel: { color: textColor },
        axisLine: { lineStyle: { color: axisLineColor } },
        splitLine: { lineStyle: { color: splitLineColor } }
      },
      {
        type: 'value',
        name: 'mmHg',
        position: 'right',
        min: bloodPressureBounds.min,
        max: bloodPressureBounds.max,
        nameTextStyle: { color: textColor },
        axisLabel: { color: '#ff4d5f' },
        axisLine: { lineStyle: { color: axisLineColor } },
        splitLine: { show: false }
      }
    ],
    series: [
      {
        name: t('chart.avgHeartRate'),
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 7,
        lineStyle: { color: '#5470c6', width: 2 },
        itemStyle: { color: '#5470c6' },
        data: avgHeartRateSeries
      },
      {
        name: t('chart.maxHeartRate'),
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 7,
        lineStyle: { color: '#7f9cf5', width: 2, type: 'dashed' },
        itemStyle: { color: '#7f9cf5' },
        data: maxHeartRateSeries
      },
      {
        name: t('chart.systolic'),
        type: 'bar',
        yAxisIndex: 1,
        barWidth: 16,
        barCategoryGap: '45%',
        itemStyle: {
          color: 'rgba(245, 108, 108, 0.65)',
          borderRadius: [5, 5, 0, 0]
        },
        data: systolicSeries
      },
      {
        name: t('chart.diastolic'),
        type: 'bar',
        yAxisIndex: 1,
        barWidth: 12,
        barCategoryGap: '45%',
        itemStyle: {
          color: 'rgba(250, 173, 20, 0.72)',
          borderRadius: [5, 5, 0, 0]
        },
        data: diastolicSeries
      }
    ]
  };
}

const initChart = () => {
  if (!chartRef.value) return;
  if (!chartInstance) {
    chartInstance = echarts.init(chartRef.value);
  }
  updateChart();
};

const updateChart = () => {
  if (!chartInstance) return;

  if (!hasData.value) {
    chartInstance.clear();
    return;
  }

  chartInstance.setOption(buildChartOption(), true);
};

const handleResize = () => {
  chartInstance?.resize();
};

watch(() => props.data, updateChart, { deep: true });
watch(() => localeStore.currentLocale, updateChart);
watch(() => themeStore.isDarkMode, updateChart);

onMounted(() => {
  initChart();
  window.addEventListener('resize', handleResize);
});

onBeforeUnmount(() => {
  chartInstance?.dispose();
  window.removeEventListener('resize', handleResize);
});
</script>

<style scoped>
.chart-container {
  background: var(--card-bg);
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  border: 1px solid var(--card-border);
  height: 100%;
  display: flex;
  flex-direction: column;
}

.metrics-cards {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 18px;
  flex-shrink: 0;
}

.metric-card {
  border-radius: 8px;
  padding: 14px 12px;
  text-align: center;
  border: 1px solid transparent;
  min-width: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.blood-pressure-card {
  background: rgba(245, 108, 108, 0.05);
  border-color: rgba(245, 108, 108, 0.18);
}

.blood-pressure-card.peak {
  background: rgba(250, 173, 20, 0.08);
  border-color: rgba(250, 173, 20, 0.2);
}

.blood-pressure-card.normal {
  background: rgba(245, 108, 108, 0.05);
}

.blood-pressure-card.elevated {
  background: rgba(250, 173, 20, 0.08);
}

.blood-pressure-card.high {
  background: rgba(255, 77, 79, 0.08);
  border-color: rgba(255, 77, 79, 0.28);
}

.heartrate-card {
  background: rgba(84, 112, 198, 0.08);
  border-color: rgba(84, 112, 198, 0.22);
}

.metric-label {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 8px;
  white-space: nowrap;
}

.blood-pressure-label {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.metric-value {
  font-size: 22px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
}

.metric-unit {
  font-size: 14px;
  font-weight: 400;
  color: var(--text-secondary);
}

.blood-pressure-value.high {
  color: #ff4d4f;
}

.blood-pressure-value.elevated {
  color: #faad14;
}

.heart-label {
  color: #5b84f1;
}

.heart-value {
  color: #3569dd;
}

.help-icon {
  font-size: 14px;
  color: var(--text-secondary);
  cursor: help;
}

.chart {
  width: 100%;
  flex: 1;
  min-height: 420px;
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  background: var(--card-bg);
  border-radius: 8px;
  border: 1px solid var(--card-border);
  min-height: 320px;
}
</style>
