import echarts from '@/lib/echarts.js';
import { useThemeStore } from '@/stores/themeStore.js';

export function resolveEchartsThemeColors(isDark) {
  return {
    textColor: isDark ? '#a8a8a8' : '#606266',
    axisLineColor: isDark ? '#3a3a3a' : '#e8e8e8',
    splitLineColor: isDark ? '#3a3a3a' : '#ebeef5',
    backgroundColor: isDark ? '#262626' : '#ffffff'
  };
}

export function useEchartsInstance(chartRef) {
  const chartInstance = shallowRef(null);

  function initChart(render) {
    if (!chartRef.value) return null;
    if (!chartInstance.value) {
      chartInstance.value = echarts.init(chartRef.value);
    }
    render?.(chartInstance.value);
    return chartInstance.value;
  }

  function resizeChart() {
    chartInstance.value?.resize();
  }

  function disposeChart() {
    chartInstance.value?.dispose();
    chartInstance.value = null;
  }

  onMounted(() => {
    window.addEventListener('resize', resizeChart);
  });

  onBeforeUnmount(() => {
    disposeChart();
    window.removeEventListener('resize', resizeChart);
  });

  return {
    chartInstance,
    initChart,
    resizeChart,
    disposeChart
  };
}

export function useEchartsThemeColors() {
  const themeStore = useThemeStore();

  return computed(() => {
    return resolveEchartsThemeColors(themeStore.isDarkMode);
  });
}
