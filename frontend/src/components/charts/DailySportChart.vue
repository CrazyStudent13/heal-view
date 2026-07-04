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
      highlight-current-row
      @current-change="handleRowSelect"
      style="width: 100%"
      :header-cell-style="{ background: '#f5f7fa', color: '#606266' }"
    >
      <!-- Time column -->
      <el-table-column 
        prop="timeRange" 
        label="时间区间" 
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
        label="运动类型" 
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
        label="时长" 
        width="120"
        align="center"
      />

      <!-- Calories column -->
      <el-table-column 
        prop="calories" 
        label="热量消耗" 
        width="120"
        align="center"
      >
        <template #default="{ row }">
          <span class="highlight-text">🔥 {{ row.calories }} kcal</span>
        </template>
      </el-table-column>

      <!-- Average Heart Rate column -->
      <el-table-column 
        prop="avgHrm" 
        label="平均心率" 
        width="120"
        align="center"
      >
        <template #default="{ row }">
          <span v-if="row.avgHrm" class="hr-text">❤️ {{ row.avgHrm }} bpm</span>
          <span v-else>--</span>
        </template>
      </el-table-column>

      <!-- Max Heart Rate column -->
      <el-table-column 
        prop="maxHrm" 
        label="最高心率" 
        width="120"
        align="center"
      >
        <template #default="{ row }">
          <span v-if="row.maxHrm" class="hr-text">💓 {{ row.maxHrm }} bpm</span>
          <span v-else>--</span>
        </template>
      </el-table-column>

      <!-- Details column -->
      <el-table-column 
        label="详细信息" 
        min-width="200"
      >
        <template #default="{ row }">
          <div class="details-content">
            <span v-if="(row.sport_type === 2 || row.sport_type === 22 || row.categoryName === '步行' || row.categoryName === '健走') && row.distanceKm" class="detail-item">📍 {{ row.distanceKm }} 公里</span>
            <span v-if="row.avgSpeed" class="detail-item">⚡ 平均速度: {{ row.avgSpeed }} km/h</span>
            <span v-if="row.avgPace" class="detail-item">🏃 平均配速: {{ formatPace(row.avgPace) }}</span>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <!-- Sport Detail Panel -->
    <transition name="slide-fade">
      <div v-if="selectedRecord" class="detail-panel">
        <div class="detail-header">
          <h3 class="detail-title">{{ selectedRecord.categoryName }} - 运动详情</h3>
          <el-button size="small" @click="closeDetail">关闭</el-button>
        </div>

        <!-- Basic Info Cards -->
        <div class="info-cards">
          <div class="info-card" v-if="selectedRecord.sport_type === 13 || selectedRecord.categoryName === '划船机'">
            <div class="card-value">{{ selectedRecord.strokes || '--' }}</div>
            <div class="card-label">划动次数</div>
          </div>
          <div class="info-card" v-else-if="selectedRecord.sport_type === 11 || selectedRecord.categoryName === '椭圆机'">
            <div class="card-value">{{ selectedRecord.steps || '--' }}</div>
            <div class="card-label">步数</div>
          </div>
        </div>

        <!-- Rowing Machine Details -->
        <div v-if="selectedRecord.sport_type === 13 || selectedRecord.categoryName === '划船机'" class="sport-specific">
          <h4 class="section-title">划船数据</h4>
          <div class="metrics-grid">
            <div class="metric-item">
              <span class="metric-label">平均划频</span>
              <span class="metric-value">{{ selectedRecord.avgStrokeRate || '--' }} 次/分</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">最高划频</span>
              <span class="metric-value">{{ selectedRecord.maxStrokeRate || '--' }} 次/分</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">组间休息时长</span>
              <span class="metric-value">{{ formatDuration(selectedRecord.restTime) }}</span>
            </div>
          </div>
          
          <!-- Segments Table -->
          <div v-if="selectedRecord.segments && selectedRecord.segments.length > 0" class="segments-section">
            <h4 class="section-title">分段详情</h4>
            <el-table :data="selectedRecord.segments" size="small" border>
              <el-table-column prop="type" label="类型" width="80" align="center">
                <template #default="{ row }">
                  <el-tag :type="row.type === '训练' ? 'success' : 'info'" size="small">
                    {{ row.type }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="duration" label="时长" width="100" align="center">
                <template #default="{ row }">
                  {{ formatDuration(row.duration) }}
                </template>
              </el-table-column>
              <el-table-column prop="strokes" label="划次" width="80" align="center" />
              <el-table-column prop="avgRate" label="平均划频" width="100" align="center">
                <template #default="{ row }">
                  {{ row.avgRate || '--' }}
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>

        <!-- Walking Details -->
        <div v-else-if="selectedRecord.sport_type === 2 || selectedRecord.sport_type === 22 || selectedRecord.categoryName === '步行' || selectedRecord.categoryName === '健走'" class="sport-specific">
          <h4 class="section-title">步行数据</h4>
          <div class="metrics-grid">
            <div class="metric-item">
              <span class="metric-label">平均配速</span>
              <span class="metric-value">{{ formatPace(selectedRecord.avgPaceSeconds) }}</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">最快配速</span>
              <span class="metric-value">{{ formatPace(selectedRecord.bestPaceSeconds) }}</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">平均步频</span>
              <span class="metric-value">{{ selectedRecord.avgCadence || '--' }} 步/分</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">最高步频</span>
              <span class="metric-value">{{ selectedRecord.maxCadence || '--' }} 步/分</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">平均步幅</span>
              <span class="metric-value">{{ selectedRecord.avgStride || '--' }} cm</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">最大步幅</span>
              <span class="metric-value">{{ selectedRecord.maxStride || '--' }} cm</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">累计上升</span>
              <span class="metric-value">{{ selectedRecord.elevationGain || '--' }} m</span>
            </div>
          </div>

          <!-- Per km pace -->
          <div v-if="selectedRecord.kmPaces && selectedRecord.kmPaces.length > 0" class="km-paces-section">
            <h4 class="section-title">每公里配速</h4>
            <div class="km-paces-list">
              <div v-for="(pace, index) in selectedRecord.kmPaces" :key="index" class="km-pace-item">
                <span class="km-label">{{ index + 1 }} km</span>
                <div class="pace-bar-container">
                  <div class="pace-bar" :style="{ width: getPaceBarWidth(pace.pace) + '%' }"></div>
                  <span class="pace-value">{{ formatPace(pace.pace) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Elliptical Details -->
        <div v-else-if="selectedRecord.sport_type === 11 || selectedRecord.categoryName === '椭圆机'" class="sport-specific">
          <h4 class="section-title">椭圆机数据</h4>
          <div class="metrics-grid">
            <div class="metric-item">
              <span class="metric-label">平均步频</span>
              <span class="metric-value">{{ selectedRecord.avgCadence || '--' }} 步/分</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">最高步频</span>
              <span class="metric-value">{{ selectedRecord.maxCadence || '--' }} 步/分</span>
            </div>
          </div>
        </div>

        <!-- Heart Rate Chart Section -->
        <div class="chart-section">
          <h4 class="section-title">心率 (BPM)</h4>
          <div class="hr-stats">
            <div class="hr-stat">
              <div class="stat-value">{{ selectedRecord.avgHrm || '--' }}</div>
              <div class="stat-label">平均心率</div>
            </div>
            <div class="hr-stat">
              <div class="stat-value">{{ selectedRecord.maxHrm || '--' }}</div>
              <div class="stat-label">最大心率</div>
            </div>
          </div>
          <div class="chart-container" ref="heartRateChartRef"></div>
        </div>

        <!-- Heart Rate Zones -->
        <div v-if="hasHeartRateZones" class="hr-zones-section">
          <h4 class="section-title">心率区间</h4>
          <div class="zones-list">
            <div v-for="zone in heartRateZones" :key="zone.name" class="zone-item">
              <div class="zone-info">
                <span class="zone-name">{{ zone.name }}</span>
                <span class="zone-duration">{{ formatDuration(zone.duration) }}</span>
              </div>
              <div class="zone-bar-container">
                <div 
                  class="zone-bar" 
                  :style="{ 
                    width: getZonePercentage(zone.duration) + '%',
                    backgroundColor: zone.color
                  }"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onMounted, computed } from 'vue';
import { ElTable, ElTableColumn, ElTag, ElButton } from 'element-plus';
import * as echarts from 'echarts';
import { useDateStore } from '../../stores/dateStore.js';
import { useDataStore } from '../../stores/dataStore.js';
import { useLocaleStore } from '../../stores/localeStore.js';

const dateStore = useDateStore();
const dataStore = useDataStore();
const localeStore = useLocaleStore();
const { t } = localeStore;

const sportRecords = ref([]);
const selectedRecord = ref(null);
const heartRateChartRef = ref(null);
let heartRateChart = null;

// Heart rate zones
const heartRateZones = ref([
  { name: '热身', duration: 0, color: '#5470c6' },
  { name: '燃脂', duration: 0, color: '#91cc75' },
  { name: '有氧', duration: 0, color: '#fac858' },
  { name: '无氧', duration: 0, color: '#ee6666' },
  { name: '极限', duration: 0, color: '#73c0de' }
]);

// Check if there are valid heart rate zones data
const hasHeartRateZones = computed(() => {
  if (!selectedRecord.value) return false;
  const totalDuration = heartRateZones.value.reduce((sum, zone) => sum + zone.duration, 0);
  return totalDuration > 0;
});

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

// Handle row selection
function handleRowSelect(row) {
  selectedRecord.value = row;
  
  if (row) {
    nextTick(() => {
      initHeartRateChart();
      updateHeartRateZones(row);
    });
  }
}

// Close detail panel
function closeDetail() {
  selectedRecord.value = null;
  if (heartRateChart) {
    heartRateChart.dispose();
    heartRateChart = null;
  }
}

// Initialize heart rate chart
function initHeartRateChart() {
  if (!heartRateChartRef.value) return;
  
  if (heartRateChart) {
    heartRateChart.dispose();
  }
  
  heartRateChart = echarts.init(heartRateChartRef.value);
  
  // Generate sample heart rate data based on duration
  const duration = selectedRecord.value?.duration || 0;
  const dataPoints = Math.min(Math.floor(duration / 5), 100); // One point per 5 seconds, max 100 points
  
  const hrData = [];
  for (let i = 0; i < dataPoints; i++) {
    const time = Math.floor((i / dataPoints) * duration);
    // Simulate heart rate with some variation around average
    const baseHR = selectedRecord.value?.avgHrm || 120;
    const variation = Math.sin(i * 0.1) * 20 + Math.random() * 10 - 5;
    hrData.push([time, Math.round(baseHR + variation)]);
  }
  
  const option = {
    tooltip: {
      trigger: 'axis',
      formatter: function(params) {
        const time = formatDuration(params[0].value[0]);
        const hr = params[0].value[1];
        return `${time}<br/>心率: ${hr} BPM`;
      }
    },
    grid: {
      left: '50px',
      right: '20px',
      top: '20px',
      bottom: '40px'
    },
    xAxis: {
      type: 'value',
      name: '时间',
      axisLabel: {
        formatter: function(value) {
          return formatDuration(value);
        }
      }
    },
    yAxis: {
      type: 'value',
      name: 'BPM',
      min: 50,
      max: 200
    },
    series: [
      {
        name: '心率',
        type: 'line',
        smooth: true,
        showSymbol: false,
        data: hrData,
        lineStyle: {
          color: '#91cc75',
          width: 2
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(145, 204, 117, 0.3)' },
            { offset: 1, color: 'rgba(145, 204, 117, 0.05)' }
          ])
        }
      }
    ]
  };
  
  heartRateChart.setOption(option);
}

// Update heart rate zones
function updateHeartRateZones(record) {
  if (!record) return;
  
  // Parse heart rate zones from record if available
  const zones = record.hrZones || {};
  
  heartRateZones.value = [
    { name: '热身', duration: zones.warmup || 0, color: '#5470c6' },
    { name: '燃脂', duration: zones.fatBurn || 0, color: '#91cc75' },
    { name: '有氧', duration: zones.aerobic || 0, color: '#fac858' },
    { name: '无氧', duration: zones.anaerobic || 0, color: '#ee6666' },
    { name: '极限', duration: zones.extreme || 0, color: '#73c0de' }
  ];
}

// Get zone percentage
function getZonePercentage(duration) {
  if (!selectedRecord.value || !selectedRecord.value.duration) return 0;
  return Math.min((duration / selectedRecord.value.duration) * 100, 100);
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
          
          // Rowing specific
          strokes: value.strokes || value.row_count,
          avgStrokeRate: value.avg_stroke_rate || value.avg_row_freq,
          maxStrokeRate: value.max_stroke_rate || value.max_row_freq,
          restTime: value.rest_time || 0,
          segments: value.segments || [],
          
          // Walking specific
          avgPaceSeconds: value.avg_pace_seconds || value.avg_pace,
          bestPaceSeconds: value.best_pace_seconds || value.best_pace,
          avgCadence: value.avg_cadence || value.avg_step_freq,
          maxCadence: value.max_cadence || value.max_step_freq,
          avgStride: value.avg_stride || value.avg_step_length,
          maxStride: value.max_stride || value.max_step_length,
          elevationGain: value.elevation_gain || value.total_ascent,
          kmPaces: value.km_paces || [],
          
          // Heart rate zones
          hrZones: value.hr_zones || {
            warmup: value.warmup_time || 0,
            fatBurn: value.fat_burn_time || 0,
            aerobic: value.aerobic_time || 0,
            anaerobic: value.anaerobic_time || 0,
            extreme: value.extreme_time || 0
          },
          
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

.hr-text {
  font-weight: 600;
  color: #ff4d4f;
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

/* Detail Panel Styles */
.detail-panel {
  margin-top: 20px;
  padding: 0;
  background: transparent;
  color: var(--text-primary);
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 2px solid var(--card-border);
}

.detail-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.info-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 15px;
  margin-bottom: 25px;
}

.info-card {
  background: var(--card-bg);
  padding: 15px;
  border-radius: 8px;
  text-align: center;
  border: 1px solid var(--card-border);
}

.card-value {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 5px;
  color: var(--text-primary);
}

.card-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.sport-specific {
  background: var(--card-bg);
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
  border: 1px solid var(--card-border);
}

.section-title {
  margin: 0 0 15px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
}

.metric-item {
  background: rgba(0, 0, 0, 0.03);
  padding: 12px;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.metric-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.metric-value {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.segments-section {
  margin-top: 20px;
}

.km-paces-section {
  margin-top: 20px;
}

.km-paces-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.km-pace-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.km-label {
  min-width: 60px;
  font-size: 14px;
  font-weight: 500;
}

.pace-bar-container {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(0, 0, 0, 0.03);
  padding: 8px;
  border-radius: 6px;
}

.pace-bar {
  height: 8px;
  background: linear-gradient(90deg, #91cc75, #fac858);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.pace-value {
  min-width: 50px;
  font-size: 14px;
  font-weight: 600;
  text-align: right;
  color: var(--text-primary);
}

.chart-section {
  background: var(--card-bg);
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
  border: 1px solid var(--card-border);
}

.hr-stats {
  display: flex;
  gap: 30px;
  margin-bottom: 15px;
}

.hr-stat {
  flex: 1;
  text-align: center;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 5px;
  color: var(--primary-color, #1890ff);
}

.stat-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.chart-container {
  height: 200px;
  background: transparent;
  border-radius: 8px;
  padding: 10px;
}

.hr-zones-section {
  background: var(--card-bg);
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
  border: 1px solid var(--card-border);
}

.zones-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.zone-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.zone-info {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
}

.zone-name {
  font-weight: 500;
  color: var(--text-primary);
}

.zone-duration {
  color: var(--text-secondary);
}

.zone-bar-container {
  height: 12px;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 6px;
  overflow: hidden;
}

.zone-bar {
  height: 100%;
  border-radius: 6px;
  transition: width 0.3s ease;
}

/* Slide fade animation */
.slide-fade-enter-active {
  transition: all 0.3s ease-out;
}

.slide-fade-leave-active {
  transition: all 0.2s ease-in;
}

.slide-fade-enter-from {
  opacity: 0;
  transform: translateY(-20px);
}

.slide-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
