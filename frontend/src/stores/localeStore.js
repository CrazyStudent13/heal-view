import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useLocaleStore = defineStore('locale', () => {
  const currentLocale = ref(localStorage.getItem('locale') || 'zh-CN');

  // Element Plus locale mapping
  const elementPlusLocale = computed(() => {
    return currentLocale.value === 'zh-CN' ? 'zh-cn' : 'en';
  });

  // Translation data
  const translations = {
    'zh-CN': {
      // Common
      'common.loading': '加载中...',
      'common.empty': '暂无数据',
      'common.reset': '重置',
      'common.selectAll': '全选',
      'common.query': '查询',
      
      // Navigation
      'nav.singleDay': '单日视图',
      'nav.multiDay': '多日对比',
      'nav.selectDate': '选择日期',
      'nav.selectDatesToCompare': '请在左侧选择要对比的日期',
      'nav.selectDateToView': '请选择日期查看数据',
      'nav.startDate': '开始日期',
      'nav.endDate': '结束日期',
      'nav.sportType': '运动类型',
      'nav.selectSport': '选择运动类型',
      
      // Settings
      'settings.title': '设置',
      'settings.language': '语言',
      'settings.theme': '主题',
      
      // Data Cards
      'data.overview': '数据概览',
      'data.steps': '步数',
      'data.avgSteps': '平均步数',
      'data.maxSteps': '最高步数',
      'data.calories': '卡路里',
      'data.avgCalories': '平均卡路里',
      'data.heartRate': '平均心率',
      'data.stress': '压力指数',
      'data.avgStress': '平均压力',
      'data.sleep': '睡眠时长',
      'data.avgSleep': '平均睡眠',
      
      // Charts
      'chart.noData': '请在顶部选择日期查看数据',
      'chart.selectDate': '请在顶部选择日期',
      'chart.trend': '趋势',
      'chart.heartRateMonitor': '心率监测',
      'chart.caloriesBurned': '卡路里消耗',
      'chart.totalSleep': '总睡眠',
      'chart.sleepAnalysis': '分析',
      'chart.deepSleep': '深睡',
      'chart.lightSleep': '浅睡',
      'chart.hours': '小时(h)',
      'chart.stepsDistanceTrend': '步数与距离趋势',
      'chart.dailyActivityTrend': '日内活动趋势',
      'chart.dailySportActivities': '今日运动记录',
      'chart.noSportRecords': '今天没有运动记录',
      'chart.timeRange': '时间区间',
      'chart.sportType': '运动类型',
      'chart.duration': '时长',
      'chart.calories': '消耗',
      'chart.details': '详细信息',
      'chart.avgHeartRate': '平均心率',
      'chart.maxHeartRate': '最高心率',
      'chart.avgSpeed': '平均速度',
      'chart.avgPace': '平均配速',
      'chart.formula': '计算公式',
      'chart.description': '说明',
      'chart.avgExerciseDurationFormula': '总运动时长 ÷ 有运动的天数',
      'chart.avgExerciseDurationDesc': '仅统计有运动记录的日期的平均值',
      'chart.avgExerciseDistanceFormula': '总运动距离 ÷ 有运动的天数',
      'chart.avgExerciseDistanceDesc': '仅统计有运动记录的日期的平均距离（单位：km）',
      'chart.avgDailyCaloriesFormula': '总消耗热量 ÷ 有运动的天数',
      'chart.avgDailyCaloriesDesc': '基于运动记录中的卡路里数据计算的平均值',
      'chart.totalExerciseDurationFormula': '所有运动记录时长之和',
      'chart.totalExerciseDurationDesc': '选中时间段内所有运动的总时长（单位：小时）',
      'chart.totalExerciseDistanceFormula': '所有运动记录距离之和',
      'chart.totalExerciseDistanceDesc': '选中时间段内所有运动的总距离（单位：km）',
      'chart.exerciseFrequencyFormula': '有运动记录的天数 / 选中总天数',
      'chart.exerciseFrequencyDesc': '分子是有运动的天数，分母是选中的日期总数',
      'chart.steps': '步数',
      'chart.distance': '距离',
      'chart.sportCalories': '运动热量',
      'chart.unitSteps': '步',
      'chart.exerciseStats': '运动统计',
      'chart.avgExerciseDuration': '日均运动时长',
      'chart.avgExerciseDistance': '日均运动距离',
      'chart.avgDailyCalories': '日均消耗热量',
      'chart.totalExerciseDuration': '累计运动时长',
      'chart.totalExerciseDistance': '累计运动距离',
      'chart.exerciseDays': '运动天数',
      'chart.minutes': '分钟',
      'chart.days': '天',
      
      // Days of week
      'day.monday': '周一',
      'day.tuesday': '周二',
      'day.wednesday': '周三',
      'day.thursday': '周四',
      'day.friday': '周五',
      'day.saturday': '周六',
      'day.sunday': '周日'
    },
    'en': {
      // Common
      'common.loading': 'Loading...',
      'common.empty': 'No data',
      'common.reset': 'Reset',
      'common.selectAll': 'Select All',
      'common.query': 'Query',
      
      // Navigation
      'nav.singleDay': 'Single Day',
      'nav.multiDay': 'Multi-Day',
      'nav.selectDate': 'Select Date',
      'nav.selectDatesToCompare': 'Please select dates to compare on the left',
      'nav.selectDateToView': 'Please select a date to view data',
      'nav.startDate': 'Start Date',
      'nav.endDate': 'End Date',
      'nav.sportType': 'Sport Type',
      'nav.selectSport': 'Select Sport Type',
      
      // Settings
      'settings.title': 'Settings',
      'settings.language': 'Language',
      'settings.theme': 'Theme',
      
      // Data Cards
      'data.overview': 'Data Overview',
      'data.steps': 'Steps',
      'data.avgSteps': 'Avg Steps',
      'data.maxSteps': 'Max Steps',
      'data.calories': 'Calories',
      'data.avgCalories': 'Avg Calories',
      'data.heartRate': 'Avg Heart Rate',
      'data.stress': 'Stress Level',
      'data.avgStress': 'Avg Stress',
      'data.sleep': 'Sleep Duration',
      'data.avgSleep': 'Avg Sleep',
      
      // Charts
      'chart.noData': 'Please select a date above to view data',
      'chart.selectDate': 'Please select a date above',
      'chart.trend': 'Trend',
      'chart.heartRateMonitor': 'Heart Rate Monitor',
      'chart.caloriesBurned': 'Calories Burned',
      'chart.totalSleep': 'Total Sleep',
      'chart.sleepAnalysis': 'Analysis',
      'chart.deepSleep': 'Deep Sleep',
      'chart.lightSleep': 'Light Sleep',
      'chart.hours': 'Hours(h)',
      'chart.stepsDistanceTrend': 'Steps & Distance Trend',
      'chart.dailyActivityTrend': 'Daily Activity Trend',
      'chart.dailySportActivities': 'Today\'s Sport Activities',
      'chart.noSportRecords': 'No sport records today',
      'chart.timeRange': 'Time Range',
      'chart.sportType': 'Sport Type',
      'chart.duration': 'Duration',
      'chart.calories': 'Calories',
      'chart.details': 'Details',
      'chart.avgHeartRate': 'Avg Heart Rate',
      'chart.maxHeartRate': 'Max Heart Rate',
      'chart.avgSpeed': 'Avg Speed',
      'chart.avgPace': 'Avg Pace',
      'chart.formula': 'Formula',
      'chart.description': 'Description',
      'chart.avgExerciseDurationFormula': 'Total exercise duration ÷ Days with exercise',
      'chart.avgExerciseDurationDesc': 'Average value for days with exercise records only',
      'chart.avgExerciseDistanceFormula': 'Total exercise distance ÷ Days with exercise',
      'chart.avgExerciseDistanceDesc': 'Average distance for days with exercise records (unit: km)',
      'chart.avgDailyCaloriesFormula': 'Total calories burned ÷ Days with exercise',
      'chart.avgDailyCaloriesDesc': 'Average calculated from calorie data in exercise records',
      'chart.totalExerciseDurationFormula': 'Sum of all exercise session durations',
      'chart.totalExerciseDurationDesc': 'Total duration of all exercises in selected period (unit: hours)',
      'chart.totalExerciseDistanceFormula': 'Sum of all exercise session distances',
      'chart.totalExerciseDistanceDesc': 'Total distance of all exercises in selected period (unit: km)',
      'chart.exerciseFrequencyFormula': 'Days with exercise / Total selected days',
      'chart.exerciseFrequencyDesc': 'Numerator is days with exercise, denominator is total selected dates',
      'chart.steps': 'Steps',
      'chart.distance': 'Distance',
      'chart.sportCalories': 'Sport Calories',
      'chart.unitSteps': 'steps',
      'chart.exerciseStats': 'Exercise Stats',
      'chart.avgExerciseDuration': 'Avg Exercise Duration',
      'chart.avgExerciseDistance': 'Avg Exercise Distance',
      'chart.avgDailyCalories': 'Avg Daily Calories',
      'chart.totalExerciseDuration': 'Total Exercise Duration',
      'chart.totalExerciseDistance': 'Total Exercise Distance',
      'chart.exerciseDays': 'Exercise Days',
      'chart.minutes': 'min',
      'chart.days': 'days',
      
      // Days of week
      'day.monday': 'Mon',
      'day.tuesday': 'Tue',
      'day.wednesday': 'Wed',
      'day.thursday': 'Thu',
      'day.friday': 'Fri',
      'day.saturday': 'Sat',
      'day.sunday': 'Sun'
    }
  };

  function setLocale(locale) {
    currentLocale.value = locale;
    localStorage.setItem('locale', locale);
  }

  function t(key) {
    const locale = currentLocale.value;
    return translations[locale]?.[key] || translations['zh-CN']?.[key] || key;
  }

  return {
    currentLocale,
    elementPlusLocale,
    setLocale,
    t
  };
});
