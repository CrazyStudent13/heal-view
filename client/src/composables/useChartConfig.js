import * as echarts from 'echarts';
import { translate as t } from '../i18n';

/**
 * Get chart theme colors based on current theme
 */
function getChartThemeColors() {
  const isDark = document.documentElement.classList.contains('dark-theme');
  
  return {
    textColor: isDark ? '#a8a8a8' : '#606266',
    axisLineColor: isDark ? '#3a3a3a' : '#e8e8e8',
    splitLineColor: isDark ? '#3a3a3a' : '#ebeef5',
    backgroundColor: isDark ? '#262626' : '#ffffff'
  };
}

/**
 * Steps chart configuration
 */
export function useStepsChartConfig() {
  const colors = getChartThemeColors();
  
  return {
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        const data = params[0];
        return `${data.name}<br/>${t('chart.steps')}: ${data.value.toLocaleString()} ${t('chart.unitSteps')}`;
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: [],
      axisLabel: {
        rotate: 45,
        fontSize: 12,
        color: colors.textColor
      },
      axisLine: {
        lineStyle: {
          color: colors.axisLineColor
        }
      }
    },
    yAxis: {
      type: 'value',
      name: t('chart.steps'),
      nameTextStyle: {
        color: colors.textColor
      },
      axisLabel: {
        formatter: (value) => `${(value / 1000).toFixed(0)}k`,
        color: colors.textColor
      },
      axisLine: {
        lineStyle: {
          color: colors.axisLineColor
        }
      },
      splitLine: {
        lineStyle: {
          color: colors.splitLineColor
        }
      }
    },
    series: [{
      name: t('chart.steps'),
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: {
        color: '#5470c6',
        width: 2
      },
      itemStyle: {
        color: '#5470c6'
      },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(84, 112, 198, 0.3)' },
          { offset: 1, color: 'rgba(84, 112, 198, 0.05)' }
        ])
      },
      data: []
    }]
  };
}

/**
 * Calories chart configuration
 */
export function useCaloriesChartConfig() {
  const colors = getChartThemeColors();
  
  return {
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        const data = params[0];
        return `${data.name}<br/>${t('data.calories')}: ${data.value.toLocaleString()} kcal`;
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: [],
      axisLabel: {
        rotate: 45,
        fontSize: 12,
        color: colors.textColor
      },
      axisLine: {
        lineStyle: {
          color: colors.axisLineColor
        }
      }
    },
    yAxis: {
      type: 'value',
      name: `${t('data.calories')} (kcal)`,
      nameTextStyle: {
        color: colors.textColor
      },
      axisLabel: {
        formatter: (value) => `${value} kcal`,
        color: colors.textColor
      },
      axisLine: {
        lineStyle: {
          color: colors.axisLineColor
        }
      },
      splitLine: {
        lineStyle: {
          color: colors.splitLineColor
        }
      }
    },
    series: [{
      name: t('data.calories'),
      type: 'bar',
      itemStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: '#91cc75' },
          { offset: 1, color: '#73a35e' }
        ]),
        borderRadius: [4, 4, 0, 0]
      },
      emphasis: {
        itemStyle: {
          color: '#73a35e'
        }
      },
      data: []
    }]
  };
}

/**
 * Heart rate chart configuration
 */
export function useHeartRateChartConfig() {
  const colors = getChartThemeColors();
  
  return {
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        let result = `${params[0].name}<br/>`;
        params.forEach(param => {
          result += `${param.marker}${param.seriesName}: ${param.value} bpm<br/>`;
        });
        return result;
      }
    },
    legend: {
      data: [t('chart.avgHeartRate'), t('chart.maxHeartRate')],
      right: 0,
      top: 0,
      textStyle: {
        color: colors.textColor
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '15%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: [],
      axisLabel: {
        rotate: 45,
        fontSize: 12,
        color: colors.textColor
      },
      axisLine: {
        lineStyle: {
          color: colors.axisLineColor
        }
      }
    },
    yAxis: {
      type: 'value',
      name: `${t('data.heartRate')} (bpm)`,
      min: 50,
      max: 180,
      nameTextStyle: {
        color: colors.textColor
      },
      axisLabel: {
        color: colors.textColor
      },
      axisLine: {
        lineStyle: {
          color: colors.axisLineColor
        }
      },
      splitLine: {
        lineStyle: {
          color: colors.splitLineColor
        }
      }
    },
    series: [
      {
        name: t('chart.avgHeartRate'),
        type: 'line',
        smooth: true,
        lineStyle: { color: '#ee6666' },
        data: []
      },
      {
        name: t('chart.maxHeartRate'),
        type: 'line',
        smooth: true,
        lineStyle: { color: '#fac858', type: 'dashed' },
        data: []
      }
    ]
  };
}
