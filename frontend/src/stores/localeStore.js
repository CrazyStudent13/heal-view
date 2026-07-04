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
