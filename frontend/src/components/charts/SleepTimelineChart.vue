<template>
  <div class="chart-container">
    <h3 class="chart-title">{{ t('chart.sleepTimeline') }}</h3>
    
    <!-- Summary info -->
    <div v-if="timelineData" class="summary-info">
      <div class="info-item">
        <span class="label">{{ t('chart.bedtime') }}:</span>
        <span class="value">{{ timelineData.bedtime || '--' }}</span>
      </div>
      <div class="info-item">
        <span class="label">{{ t('chart.wakeUpTime') }}:</span>
        <span class="value">{{ timelineData.wakeUpTime || '--' }}</span>
      </div>
      <div class="info-item">
        <span class="label">{{ t('data.sleep') }}:</span>
        <span class="value">{{ timelineData.totalDuration }} {{ t('chart.minutes') }}</span>
      </div>
    </div>
    
    <div ref="chartRef" class="chart"></div>
    
    <!-- Time labels at bottom -->
    <div v-if="timelineData && timelineData.segments && timelineData.segments.length > 0" class="time-labels">
      <span class="time-label start">{{ timelineData.bedtime }} {{ t('chart.bedtimeLabel') }}</span>
      <span class="time-label end">{{ timelineData.wakeUpTime }} {{ t('chart.wakeUpLabel') }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import * as echarts from 'echarts';
import { useLocaleStore } from '../../stores/localeStore';

const localeStore = useLocaleStore();

// Translation function
function t(key) {
  return localeStore.t(key);
}

const props = defineProps({
  data: {
    type: Object,
    required: true
  }
});

const chartRef = ref(null);
let chartInstance = null;

const timelineData = ref(props.data);

// Track which legend items are selected (visible)
const legendSelected = ref({
  deep: true,
  light: true,
  rem: true,
  awake: true
});

// State color mapping
const stateColors = {
  deep: '#5b8ff9',
  light: '#5ad8a6',
  rem: '#f6bd60',
  awake: '#ee6666'
};

const stateNames = {
  deep: t('chart.deep'),
  light: t('chart.light'),
  rem: t('chart.rem'),
  awake: t('chart.awake')
};

const initChart = () => {
  if (!chartRef.value) return;
  chartInstance = echarts.init(chartRef.value);
  
  // Listen to legend select events
  chartInstance.on('legendselectchanged', (params) => {
    const selected = params.selected;
    // Update our tracking state
    legendSelected.value.deep = selected[stateNames.deep] !== false;
    legendSelected.value.light = selected[stateNames.light] !== false;
    legendSelected.value.rem = selected[stateNames.rem] !== false;
    legendSelected.value.awake = selected[stateNames.awake] !== false;
    
    // Re-render the chart with updated visibility
    updateChart();
  });
  
  updateChart();
};

const updateChart = () => {
  if (!chartInstance || !props.data || !props.data.segments || props.data.segments.length === 0) return;

  const segments = props.data.segments;
  
  // Debug: log first segment to see data structure
  console.log('[SleepTimelineChart] First segment:', segments[0]);
  console.log('[SleepTimelineChart] State value:', segments[0].state, 'Type:', typeof segments[0].state);
  console.log('[SleepTimelineChart] Is state a string?', typeof segments[0].state === 'string');
  console.log('[SleepTimelineChart] State toString():', String(segments[0].state));
  
  // Get theme colors
  const isDark = document.documentElement.classList.contains('dark-theme');
  const textColor = isDark ? '#a8a8a8' : '#606266';
  const axisLineColor = isDark ? '#3a3a3a' : '#e8e8e8';
  const gridColor = isDark ? '#3a3a3a' : '#ebeef5';

  // Convert time strings to minutes from midnight for easier calculation
  const timeToMinutes = (timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // Build bar series data - each segment is a separate bar
  const barData = segments.map((seg, index) => {
    const startMinutes = timeToMinutes(seg.startTime);
    const endMinutes = timeToMinutes(seg.endTime);
    const duration = endMinutes - startMinutes;
    
    // Ensure state is a string and lowercase
    let stateValue = seg.state;
    if (typeof stateValue !== 'string') {
      stateValue = String(stateValue).toLowerCase();
    } else {
      stateValue = stateValue.toLowerCase();
    }
    
    console.log(`[SleepTimelineChart] Segment ${index}: startTime=${seg.startTime}, endTime=${seg.endTime}, state=${stateValue}, duration=${duration}`);
    
    // Check if this state should be visible based on legend selection
    const isVisible = legendSelected.value[stateValue];
    
    return {
      name: `${seg.startTime}-${seg.endTime}`,
      value: [
        index,           // y-axis position (all at same level)
        startMinutes,    // start time in minutes
        endMinutes,      // end time in minutes
        stateValue       // state for coloring
      ],
      itemStyle: {
        color: isVisible ? (stateColors[stateValue] || '#999') : 'transparent',
        opacity: isVisible ? 1 : 0
      },
      emphasis: {
        itemStyle: {
          opacity: isVisible ? 0.8 : 0
        }
      }
    };
  });

  // Calculate min and max time for x-axis
  const minTime = timeToMinutes(segments[0].startTime);
  const maxTime = timeToMinutes(segments[segments.length - 1].endTime);
  
  // Format time for display
  const formatTime = (minutes) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const option = {
    tooltip: {
      trigger: 'item',
      formatter: (params) => {
        const data = params.data.value;
        const startTime = formatTime(data[1]);
        const endTime = formatTime(data[2]);
        const state = data[3];
        const stateName = stateNames[state] || t('chart.unknown');
        const duration = data[2] - data[1];
        
        return `<strong>${startTime} - ${endTime}</strong><br/>${params.marker}${stateName}<br/>时长: ${duration} 分钟`;
      }
    },
    legend: {
      data: [
        { name: stateNames.deep },
        { name: stateNames.light },
        { name: stateNames.rem },
        { name: stateNames.awake }
      ],
      right: 10,
      top: 0,
      textStyle: {
        color: textColor
      },
      itemWidth: 14,
      itemHeight: 10
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '10%',
      top: '15%',
      containLabel: true
    },
    xAxis: {
      type: 'value',
      min: minTime,
      max: maxTime,
      axisLabel: {
        fontSize: 11,
        color: textColor,
        formatter: (value) => formatTime(value)
      },
      axisLine: {
        lineStyle: {
          color: axisLineColor
        }
      },
      splitLine: {
        show: true,
        lineStyle: {
          color: gridColor,
          type: 'dashed'
        }
      }
    },
    yAxis: {
      type: 'category',
      data: ['睡眠'],
      axisLabel: {
        show: false
      },
      axisLine: {
        show: false
      },
      axisTick: {
        show: false
      },
      splitLine: {
        show: false
      }
    },
    series: [
      // Hidden series for legend items
      {
        name: stateNames.deep,
        type: 'bar',
        data: [],
        itemStyle: { color: stateColors.deep }
      },
      {
        name: stateNames.light,
        type: 'bar',
        data: [],
        itemStyle: { color: stateColors.light }
      },
      {
        name: stateNames.rem,
        type: 'bar',
        data: [],
        itemStyle: { color: stateColors.rem }
      },
      {
        name: stateNames.awake,
        type: 'bar',
        data: [],
        itemStyle: { color: stateColors.awake }
      },
      // Actual rendering series
      {
        name: t('chart.sleepTimeline'),
        type: 'custom',
        renderItem: function(params, api) {
          const categoryIndex = api.value(0);
          const start = api.coord([api.value(1), categoryIndex]);
          const end = api.coord([api.value(2), categoryIndex]);
          const height = api.size([0, 1])[1] * 0.6;
          
          const rectShape = echarts.graphic.clipRectByRect(
            {
              x: start[0],
              y: start[1] - height / 2,
              width: end[0] - start[0],
              height: height
            },
            {
              x: params.coordSys.x,
              y: params.coordSys.y,
              width: params.coordSys.width,
              height: params.coordSys.height
            }
          );
          
          return rectShape && {
            type: 'rect',
            transition: ['shape'],
            shape: rectShape,
            style: api.style()
          };
        },
        encode: {
          x: [1, 2],
          y: 0
        },
        data: barData
      }
    ]
  };

  chartInstance.setOption(option);
};

watch(() => props.data, (newData) => {
  timelineData.value = newData;
  if (newData && newData.segments && newData.segments.length > 0) {
    updateChart();
  }
}, { deep: true });

onMounted(() => {
  setTimeout(() => {
    initChart();
  }, 100);
  window.addEventListener('resize', handleResize);
});

onBeforeUnmount(() => {
  if (chartInstance) {
    chartInstance.dispose();
  }
  window.removeEventListener('resize', handleResize);
});

const handleResize = () => {
  chartInstance?.resize();
};
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

.chart-title {
  margin: 0 0 16px 0;
  font-size: 16px;
  color: var(--text-primary);
  font-weight: 500;
  flex-shrink: 0;
}

.summary-info {
  display: flex;
  gap: 20px;
  margin-bottom: 16px;
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: 6px;
  flex-shrink: 0;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.info-item .label {
  font-size: 13px;
  color: var(--text-secondary);
}

.info-item .value {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.chart {
  width: 100%;
  flex: 1;
  min-height: 200px;
}

.time-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  padding: 0 4px;
}

.time-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.time-label.start {
  text-align: left;
}

.time-label.end {
  text-align: right;
}
</style>
