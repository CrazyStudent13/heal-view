<template>
  <div class="daily-sport-chart">
    <h3 class="chart-title">{{ t('chart.dailySportActivities') }}</h3>
    
    <!-- Empty state -->
    <div v-if="sportRecords.length === 0" class="empty-state">
      <p>{{ t('chart.noSportRecords') }}</p>
    </div>

    <!-- Sport table -->
    <el-table 
      v-else
      :data="sportRecords" 
      stripe
      style="width: 100%"
      :header-cell-style="{ background: '#f5f7fa', color: '#606266' }"
    >
      <!-- Time column -->
      <el-table-column 
        prop="timeRange" 
        :label="t('chart.timeRange')" 
        width="180"
        align="center"
      >
        <template #default="{ row }">
          <span class="time-range">{{ row.timeRange }}</span>
        </template>
      </el-table-column>

      <!-- Category column -->
      <el-table-column 
        prop="categoryName" 
        :label="t('chart.sportType')" 
        width="120"
        align="center"
      >
        <template #default="{ row }">
          <el-tag :type="getCategoryTagType(row)" size="small">
            {{ row.categoryName }}
          </el-tag>
        </template>
      </el-table-column>

      <!-- Duration column -->
      <el-table-column 
        prop="durationText" 
        :label="t('chart.duration')" 
        width="120"
        align="center"
      />

      <!-- Calories column -->
      <el-table-column 
        prop="calories" 
        :label="t('chart.calories')" 
        width="120"
        align="center"
      >
        <template #default="{ row }">
          <span class="highlight-text">🔥 {{ row.calories }} kcal</span>
        </template>
      </el-table-column>

      <!-- Distance column -->
      <el-table-column 
        prop="distanceKm" 
        :label="t('chart.distance')" 
        width="120"
        align="center"
      >
        <template #default="{ row }">
          <span>📏 {{ row.distanceKm }} km</span>
        </template>
      </el-table-column>

      <!-- Steps column -->
      <el-table-column 
        prop="steps" 
        :label="t('data.steps')" 
        width="140"
        align="center"
      >
        <template #default="{ row }">
          <span>👟 {{ row.steps.toLocaleString() }}</span>
        </template>
      </el-table-column>

      <!-- Details column -->
      <el-table-column 
        :label="t('chart.details')" 
        min-width="200"
      >
        <template #default="{ row }">
          <div class="details-content">
            <span v-if="row.avgHrm" class="detail-item">❤️ {{ t('chart.avgHeartRate') }}: {{ row.avgHrm }} bpm</span>
            <span v-if="row.maxHrm" class="detail-item">💓 {{ t('chart.maxHeartRate') }}: {{ row.maxHrm }} bpm</span>
            <span v-if="row.avgSpeed" class="detail-item">⚡ {{ t('chart.avgSpeed') }}: {{ row.avgSpeed }} km/h</span>
            <span v-if="row.avgPace" class="detail-item">🏃 {{ t('chart.avgPace') }}: {{ formatPace(row.avgPace) }}</span>
          </div>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { ElTable, ElTableColumn, ElTag } from 'element-plus';
import { useDateStore } from '../../stores/dateStore.js';
import { useDataStore } from '../../stores/dataStore.js';
import { useLocaleStore } from '../../stores/localeStore.js';

const dateStore = useDateStore();
const dataStore = useDataStore();
const localeStore = useLocaleStore();
const { t } = localeStore;

const sportRecords = ref([]);

// Format timestamp to time string (HH:mm)
function formatTime(timestamp) {
  if (!timestamp) return '--:--';
  const date = new Date(timestamp * 1000);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

// Format duration from seconds to readable format
function formatDuration(seconds) {
  if (!seconds || seconds === 0) return '0分钟';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}小时${minutes}分钟`;
  }
  return `${minutes}分钟`;
}

// Format pace from seconds per km to min/km
function formatPace(paceSeconds) {
  if (!paceSeconds || paceSeconds === 0) return '--';
  const minutes = Math.floor(paceSeconds / 60);
  const seconds = paceSeconds % 60;
  return `${minutes}'${seconds.toString().padStart(2, '0')}"`;
}

// Get category name in Chinese (based on sport_type or category)
function getCategoryName(record) {
  // Try to get from sport_type first (numeric code)
  const sportType = record.sport_type;
  
  if (sportType !== undefined && sportType !== null) {
    // Map sport_type codes to names (based on actual data from CSV)
    const sportTypeMap = {
      0: '其他',
      1: '跑步',
      2: '步行',
      3: '骑行',
      4: '游泳',
      5: '徒步',
      6: '户外骑行',
      7: '健身',
      8: '自由训练',
      9: '瑜伽',
      10: '跳绳',
      11: '椭圆机',
      12: '篮球',
      13: '划船机',
      14: '羽毛球',
      15: '户外徒步',
      16: '网球',
      17: '排球',
      18: '高尔夫',
      19: '滑雪',
      20: '滑冰',
      21: '攀岩',
      22: '户外步行'
    };
    
    if (sportTypeMap[sportType]) {
      return sportTypeMap[sportType];
    }
  }
  
  // Fallback to category field
  const category = record.category || 'other';
  const categoryMap = {
    'walking': '步行',
    'running': '跑步',
    'cycling': '骑行',
    'outdoor_riding': '户外骑行',
    'swimming': '游泳',
    'hiking': '徒步',
    'outdoor_hiking': '户外徒步',
    'climbing': '登山',
    'fitness': '健身',
    'free_training': '自由训练',
    'yoga': '瑜伽',
    'elliptical': '椭圆机',
    'elliptical_trainer': '椭圆机',
    'rowing': '划船机',
    'rowing_machine': '划船机',
    'jump_rope': '跳绳',
    'basketball': '篮球',
    'football': '足球',
    'badminton': '羽毛球',
    'table_tennis': '乒乓球',
    'tennis': '网球',
    'volleyball': '排球',
    'golf': '高尔夫',
    'skiing': '滑雪',
    'skating': '滑冰',
    'rock_climbing': '攀岩',
    'outdoor_walking': '户外步行',
    'other': '其他'
  };
  
  return categoryMap[category] || category;
}

// Get tag type for category (based on sport_type or category)
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
      6: 'success',  // outdoor_riding
      7: 'danger',
      8: 'warning',  // free_training
      9: 'success',
      10: 'danger',
      11: 'warning',  // elliptical_trainer
      12: 'warning',
      13: 'primary',  // rowing_machine
      14: 'info',
      15: 'warning',  // outdoor_hiking
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
    'walking': 'info',
    'running': 'danger',
    'cycling': 'success',
    'outdoor_riding': 'success',
    'swimming': 'primary',
    'hiking': 'warning',
    'outdoor_hiking': 'warning',
    'climbing': '',
    'fitness': 'danger',
    'free_training': 'warning',
    'yoga': 'success',
    'elliptical': 'warning',
    'elliptical_trainer': 'warning',
    'rowing': 'primary',
    'rowing_machine': 'primary',
    'jump_rope': 'danger',
    'basketball': 'warning',
    'football': 'danger',
    'badminton': 'info',
    'table_tennis': 'info',
    'tennis': 'info',
    'volleyball': 'info',
    'golf': 'success',
    'skiing': 'primary',
    'skating': 'primary',
    'rock_climbing': 'warning',
    'outdoor_walking': 'info',
    'other': 'info'
  };
  return typeMap[category] || 'info';
}

// Filter out night time records (23:00 - 08:00)
function filterNightRecords(records) {
  if (!records || records.length === 0) return [];
  
  return records.filter(record => {
    if (!record.start_time) return false;
    const date = new Date(record.start_time * 1000);
    const hour = date.getHours();
    // Keep records from 08:00 to 23:00 (exclude 23:00-08:00)
    return hour >= 8 && hour < 23;
  });
}

// Fetch sport records when date changes
watch(() => dateStore.selectedDate, async (newDate) => {
  if (!newDate) return;

  console.log('[DailySportChart] Loading sport records for date:', newDate);
  
  try {
    const records = await dataStore.fetchSportRecords({
      startDate: newDate,
      endDate: newDate
    });

    console.log('[DailySportChart] Records received:', records);
    
    // Parse the JSON value field and filter night time
    const parsedRecords = records.map(record => {
      try {
        const value = typeof record.value === 'string' ? JSON.parse(record.value) : record.value;
        
        const startTime = value.start_time || record.time;
        const endTime = value.end_time || (startTime + (value.duration || 0));
        const duration = value.duration || 0;
        
        return {
          // Time range
          timeRange: `${formatTime(startTime)} - ${formatTime(endTime)}`,
          
          // Category - use sport_type from value JSON, fallback to category field
          sport_type: value.sport_type,
          category: record.category || 'other',
          categoryName: getCategoryName({ sport_type: value.sport_type, category: record.category }),
          
          // Duration
          duration: duration,
          durationText: formatDuration(duration),
          
          // Basic metrics
          calories: value.calories || 0,
          distance: value.distance || 0,
          distanceKm: ((value.distance || 0) / 1000).toFixed(2),
          steps: value.steps || 0,
          
          // Heart rate
          avgHrm: value.avg_hrm || value.avgHeartRate,
          maxHrm: value.max_hrm || value.maxHeartRate,
          
          // Speed and pace
          avgSpeed: value.avg_speed ? (value.avg_speed * 3.6).toFixed(2) : null, // Convert m/s to km/h
          avgPace: value.avg_pace ? Math.floor(value.avg_pace / 60) : null, // seconds per km
          
          // Raw data for reference
          start_time: startTime,
          end_time: endTime
        };
      } catch (error) {
        console.error('Failed to parse sport record:', error);
        return null;
      }
    }).filter(record => record !== null && record.start_time);

    // Filter out night time records and sort by start time
    sportRecords.value = filterNightRecords(parsedRecords).sort((a, b) => a.start_time - b.start_time);
    
    console.log('[DailySportChart] Filtered records:', sportRecords.value.length);
  } catch (error) {
    console.error('Failed to fetch sport records:', error);
    sportRecords.value = [];
  }
}, { immediate: true });
</script>

<style scoped>
.daily-sport-chart {
  background: var(--card-bg);
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  border: 1px solid var(--card-border);
}

.chart-title {
  margin: 0 0 20px 0;
  font-size: 16px;
  color: var(--text-primary);
  font-weight: 500;
  text-align: left;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: #999;
  background: #fafafa;
  border-radius: 8px;
}

.time-range {
  font-weight: 600;
  color: #1890ff;
  font-size: 14px;
}

.highlight-text {
  color: #ff4d4f;
  font-weight: 600;
}

.details-content {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.detail-item {
  font-size: 12px;
  color: #666;
  background: #f5f5f5;
  padding: 4px 8px;
  border-radius: 4px;
  white-space: nowrap;
}

/* Dark theme adjustments */
:deep(.dark-theme) .empty-state {
  background: #2a2a2a;
  color: #888;
}

:deep(.dark-theme) .detail-item {
  background: #3a3a3a;
  color: #d0d0d0;
}

:deep(.dark-theme .el-table) {
  --el-table-tr-bg-color: #2a2a2a;
  --el-table-header-bg-color: #333;
  --el-table-row-hover-bg-color: #3a3a3a;
  --el-table-border-color: #444;
  --el-table-text-color: #e8e8e8;
  --el-table-header-text-color: #d0d0d0;
}
</style>
