import * as echarts from 'echarts';

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
        return `${data.name}<br/>步数: ${data.value.toLocaleString()} 步`;
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
      name: '步数',
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
      name: '步数',
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
        return `${data.name}<br/>卡路里: ${data.value.toLocaleString()} kcal`;
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
      name: '卡路里 (kcal)',
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
      name: '卡路里',
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
        const data = params[0];
        return `${data.name}<br/>心率: ${data.value} bpm`;
      }
    },
    legend: {
      data: ['平均心率', '最高心率'],
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
      name: '心率 (bpm)',
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
        name: '平均心率',
        type: 'line',
        smooth: true,
        lineStyle: { color: '#ee6666' },
        data: []
      },
      {
        name: '最高心率',
        type: 'line',
        smooth: true,
        lineStyle: { color: '#fac858', type: 'dashed' },
        data: []
      }
    ]
  };
}
