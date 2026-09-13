import { computed, ref } from 'vue';

export function useDashboardSelection(dateStore) {
  const viewMode = computed({
    get: () => dateStore.viewMode,
    set: value => dateStore.setViewMode(value)
  });
  const currentChartType = ref('personal');

  function formatLocalDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function getDefaultSingleDate() {
    if (dateStore.selectedDate) return dateStore.selectedDate;
    if (dateStore.dateList.length === 0) return null;
    const today = formatLocalDate(new Date());
    return dateStore.dateList.includes(today) ? today : dateStore.dateList[0];
  }

  function isCompareChartType(type) {
    return ['weight', 'steps', 'heartrate', 'sleep', 'calories'].includes(type);
  }

  function datesKey(dates) {
    return [...dates].sort().join('|');
  }

  function getLast30Days() {
    const trainingDates = dateStore.trainingDates;
    if (trainingDates.length === 0) return [];
    return [...trainingDates].sort((a, b) => new Date(b) - new Date(a)).slice(0, 30);
  }

  function initializeCompareSelection() {
    if (dateStore.selectedDateRange[0] && dateStore.selectedDateRange[1]) {
      dateStore.selectDateRange(dateStore.selectedDateRange);
      return dateStore.selectedDates;
    }
    const last30Days = getLast30Days();
    dateStore.setSelectedDates(last30Days);
    return last30Days;
  }

  return {
    viewMode,
    currentChartType,
    getDefaultSingleDate,
    isCompareChartType,
    datesKey,
    initializeCompareSelection
  };
}
