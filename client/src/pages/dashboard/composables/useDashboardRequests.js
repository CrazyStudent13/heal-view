import { normalizeDailySummary, normalizeSleepTimeline, normalizeWeightData } from '@/domain/healthDataFallbacks.js';
import { createLatestRequest } from '@/utils/requestState.js';

export function useDashboardRequests({ dateStore, dataStore, viewMode, currentChartType, chartData, sleepTimelineData, compareSleepTimelineData, weightData, loading, datesKey }) {
  const singleRequest = createLatestRequest();
  const compareRequest = createLatestRequest();
  const sleepRequest = createLatestRequest();
  const compareSleepRequest = createLatestRequest();
  const weightRequest = createLatestRequest();
  const weightSidebarRequest = createLatestRequest();

  async function fetchSleepTimelineForDate(date) {
    const request = sleepRequest.next();
    if (!date) { sleepTimelineData.value = null; return; }
    const timeline = await dataStore.fetchSleepTimeline(date, { signal: request.signal });
    if (request.isCurrent() && dateStore.selectedDate === date && currentChartType.value === 'sleep') {
      sleepTimelineData.value = normalizeSleepTimeline(timeline, date);
    }
  }

  async function fetchCompareSleepTimelines(dates) {
    const request = compareSleepRequest.next();
    if (dates.length === 0) { compareSleepTimelineData.value = []; return; }
    const data = [];
    for (const date of dates) {
      if (!request.isCurrent()) return;
      const timeline = await dataStore.fetchSleepTimeline(date, { signal: request.signal });
      if (timeline) data.push(normalizeSleepTimeline(timeline, date));
    }
    if (!request.isCurrent() || viewMode.value !== 'compare' || currentChartType.value !== 'sleep') return;
    compareSleepTimelineData.value = data.sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  async function fetchSingleDayData(date) {
    const request = singleRequest.next();
    if (!date) { chartData.value = []; loading.value = false; return; }
    loading.value = true;
    const summary = await dataStore.fetchDailySummary(date, { signal: request.signal });
    if (!request.isCurrent() || viewMode.value !== 'single' || dateStore.selectedDate !== date) return;
    chartData.value = summary ? [normalizeDailySummary(summary, date)] : [];
    if (request.isCurrent()) loading.value = false;
  }

  async function fetchCompareData(dates, options = {}) {
    const { includeWeightForSidebar = true } = options;
    const request = compareRequest.next();
    if (dates.length === 0) { chartData.value = []; loading.value = false; return; }
    loading.value = true;
    const data = [];
    for (const date of dates) {
      if (!request.isCurrent()) return;
      const summary = await dataStore.fetchDailySummary(date, { signal: request.signal });
      if (summary) data.push(normalizeDailySummary(summary, date));
    }
    if (!request.isCurrent() || viewMode.value !== 'compare') return;
    chartData.value = data.sort((a, b) => new Date(a.date) - new Date(b.date));
    loading.value = false;
    if (includeWeightForSidebar) fetchWeightDataForSidebar(dates);
  }

  async function fetchWeightDataForSidebar(dates) {
    const request = weightSidebarRequest.next();
    if (dates.length === 0) return;
    const requestedKey = datesKey(dates);
    try {
      const sorted = [...dates].sort();
      const data = normalizeWeightData(await dataStore.fetchWeightData({ startDate: sorted[0], endDate: sorted[sorted.length - 1] }, { signal: request.signal }));
      if (!request.isCurrent() || viewMode.value !== 'compare' || requestedKey !== datesKey(dateStore.selectedDates)) return;
      if (data?.dailyData) {
        const weightChartData = data.dailyData.map(item => ({ date: item.date, avgWeight: item.avgWeight }));
        if (weightChartData.length > 0) {
          chartData.value = chartData.value.map(item => {
            const weightItem = weightChartData.find(w => w.date === item.date);
            return weightItem ? { ...item, avgWeight: weightItem.avgWeight } : item;
          });
        }
      }
    } catch (error) { console.error('Failed to fetch weight data for sidebar:', error); }
  }

  async function fetchWeightData(dates = dateStore.selectedDates) {
    const request = weightRequest.next();
    weightSidebarRequest.cancel();
    if (dates.length === 0) { weightData.value = null; loading.value = false; return; }
    try {
      const sorted = [...dates].sort();
      loading.value = true;
      const data = normalizeWeightData(await dataStore.fetchWeightData({ startDate: sorted[0], endDate: sorted[sorted.length - 1] }, { signal: request.signal }));
      if (!request.isCurrent() || viewMode.value !== 'compare') return;
      weightData.value = data;
      if (data?.dailyData) {
        const weightChartData = data.dailyData.map(item => ({ date: item.date, avgWeight: item.avgWeight }));
        if (weightChartData.length > 0) {
          chartData.value = chartData.value.map(item => {
            const weightItem = weightChartData.find(w => w.date === item.date);
            return weightItem ? { ...item, avgWeight: weightItem.avgWeight } : item;
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch weight data:', error);
      if (request.isCurrent()) weightData.value = null;
    } finally { if (request.isCurrent()) loading.value = false; }
  }

  function cancelAll() {
    singleRequest.cancel(); compareRequest.cancel(); sleepRequest.cancel();
    compareSleepRequest.cancel(); weightRequest.cancel(); weightSidebarRequest.cancel();
  }

  return { fetchSleepTimelineForDate, fetchCompareSleepTimelines, fetchSingleDayData, fetchCompareData, fetchWeightData, cancelAll };
}
