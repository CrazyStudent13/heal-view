/**
 * DailySportChart 的纯展示辅助函数。
 *
 * 这些函数原本内联在组件的 <script setup> 里，只能在浏览器里点开页面才能验证。
 * 搬出来之后有两个好处：① 组件只留响应式状态与 ECharts 实例生命周期；
 * ② 它们可以在 node:test 里直接断言，不必挂载组件。
 *
 * 需要翻译的函数统一由工厂注入 t，而不是各自 import localeStore：t 必须在调用时
 * 读取当前语言，工厂在 setup 阶段取一次引用即可。
 */
export function createDailySportChartFormatters(t) {
  function getRowingGroupDuration(record) {
    if (!record || record.sport_type !== 13) return null;
    const totalDuration = record.duration || 0;
    const restTime = record.restTime || 0;
    const groupCount = record.segmentCount || 0;

    if (groupCount === 0) return null;

    // Calculate average training time per group (excluding rest time)
    const trainingTime = totalDuration - restTime;
    const avgDurationPerGroup = Math.round(trainingTime / groupCount);

    return avgDurationPerGroup;
  }

  function formatTime(timestamp) {
    if (!timestamp) return '--:--';
    const date = new Date(timestamp * 1000);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  function formatDuration(seconds) {
    if (!seconds || seconds === 0) return t('sport.zeroMinutes');

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return t('sport.durationHoursMinutes', { hours, minutes });
    }
    return t('sport.durationMinutes', { minutes });
  }

  function formatPace(paceSeconds) {
    if (!paceSeconds || paceSeconds === 0) return '--';
    // Convert seconds per km to km/h: speed = 3600 / paceSeconds
    const speedKmh = 3600 / paceSeconds;
    return `${speedKmh.toFixed(1)} ${t('settings.units.kmh')}`;
  }

  function getCategoryName(record) {
    const sportType = record.sport_type;

    if (sportType !== undefined && sportType !== null) {
      const sportTypeMap = {
        0: 'other',
        1: 'running',
        2: 'walking',
        3: 'cycling',
        4: 'swimming',
        5: 'hiking',
        6: 'outdoorRiding',
        7: 'fitness',
        8: 'freeTraining',
        9: 'yoga',
        10: 'jumpRope',
        11: 'elliptical',
        12: 'basketball',
        13: 'rowing',
        14: 'badminton',
        15: 'outdoorHiking',
        16: 'tennis',
        17: 'volleyball',
        18: 'golf',
        19: 'skiing',
        20: 'skating',
        21: 'climbing',
        22: 'outdoorWalking'
      };

      if (sportTypeMap[sportType]) {
        return t(`sport.typeName.${sportTypeMap[sportType]}`);
      }
    }

    const category = record.category || 'other';
    const categoryMap = {
      walking: 'walking',
      running: 'running',
      cycling: 'cycling',
      outdoor_riding: 'outdoorRiding',
      swimming: 'swimming',
      hiking: 'hiking',
      outdoor_hiking: 'outdoorHiking',
      climbing: 'climbing',
      fitness: 'fitness',
      free_training: 'freeTraining',
      yoga: 'yoga',
      elliptical: 'elliptical',
      elliptical_trainer: 'elliptical',
      rowing: 'rowing',
      rowing_machine: 'rowing',
      jump_rope: 'jumpRope',
      basketball: 'basketball',
      football: 'football',
      badminton: 'badminton',
      table_tennis: 'tableTennis',
      tennis: 'tennis',
      volleyball: 'volleyball',
      golf: 'golf',
      skiing: 'skiing',
      skating: 'skating',
      rock_climbing: 'climbing',
      outdoor_walking: 'outdoorWalking',
      other: 'other'
    };

    return categoryMap[category] ? t(`sport.typeName.${categoryMap[category]}`) : category;
  }

  function isTrainingSegment(type) {
    return ['训练', 'training', 'work'].includes(String(type || '').toLowerCase());
  }

  function getSegmentTypeLabel(type) {
    return isTrainingSegment(type) ? t('sport.training') : t('sport.rest');
  }

  function getCategoryTagType(record) {
    const sportType = record.sport_type;

    if (sportType !== undefined && sportType !== null) {
      // Map sport_type codes to tag types (based on actual data from CSV)
      const typeMap = {
        0: 'info',
        1: 'danger',
        2: 'info',
        3: 'success',
        4: 'primary',
        5: 'warning',
        6: 'success', // outdoor_riding
        7: 'danger',
        8: 'warning', // free_training
        9: 'success',
        10: 'danger',
        11: 'warning', // elliptical_trainer
        12: 'warning',
        13: 'primary', // rowing_machine
        14: 'info',
        15: 'warning', // outdoor_hiking
        16: 'info',
        17: 'info',
        18: 'success',
        19: 'primary',
        20: 'primary',
        21: 'warning',
        22: 'info'
      };
      return typeMap[sportType] || 'info';
    }

    // Fallback to category
    const category = record.category || 'other';
    const typeMap = {
      walking: 'info',
      running: 'danger',
      cycling: 'success',
      outdoor_riding: 'success',
      swimming: 'primary',
      hiking: 'warning',
      outdoor_hiking: 'warning',
      climbing: '',
      fitness: 'danger',
      free_training: 'warning',
      yoga: 'success',
      elliptical: 'warning',
      elliptical_trainer: 'warning',
      rowing: 'primary',
      rowing_machine: 'primary',
      jump_rope: 'danger',
      basketball: 'warning',
      football: 'danger',
      badminton: 'info',
      table_tennis: 'info',
      tennis: 'info',
      volleyball: 'info',
      golf: 'success',
      skiing: 'primary',
      skating: 'primary',
      rock_climbing: 'warning',
      outdoor_walking: 'info',
      other: 'info'
    };
    return typeMap[category] || 'info';
  }

  // Get pace bar width
  function getPaceBarWidth(pace) {
    if (!pace) return 0;
    // Faster pace = longer bar (inverse relationship)
    const maxPace = 600; // 10 min/km
    const minPace = 180; // 3 min/km
    const percentage = ((maxPace - pace) / (maxPace - minPace)) * 100;
    return Math.max(0, Math.min(100, percentage));
  }

  return {
    formatDuration,
    formatPace,
    formatTime,
    getCategoryName,
    getCategoryTagType,
    getPaceBarWidth,
    getRowingGroupDuration,
    getSegmentTypeLabel,
    isTrainingSegment
  };
}
