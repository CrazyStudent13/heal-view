<template>
  <div class="daily-sport-chart">
    <h3 class="chart-title">{{ t('chart.dailySportActivities') }}</h3>
    
    <!-- Summary cards -->
    <div v-if="sportRecords.length > 0" class="summary-cards">
      <el-card class="summary-card-item" shadow="hover">
        <div class="card-content">
          <div class="card-icon calories">
            <span class="icon-text">🔥</span>
          </div>
          <div class="card-info">
            <div class="card-label">累计热量</div>
            <div class="card-value">{{ totalCalories }} kcal</div>
          </div>
        </div>
      </el-card>
      
      <el-card class="summary-card-item" shadow="hover">
        <div class="card-content">
          <div class="card-icon duration">
            <span class="icon-text">&#9201;</span>
          </div>
          <div class="card-info">
            <div class="card-label">总时长</div>
            <div class="card-value">{{ formatDuration(totalDuration) }}</div>
          </div>
        </div>
      </el-card>
      
      <el-card class="summary-card-item" shadow="hover">
        <div class="card-content">
          <div class="card-icon steps">
            <span class="icon-text">&#128099;</span>
          </div>
          <div class="card-info">
            <div class="card-label">运动总计步数</div>
            <div class="card-value">{{ totalSteps.toLocaleString() }}</div>
          </div>
        </div>
      </el-card>
    </div>
    
    <!-- Empty state -->
    <el-empty 
      v-if="sportRecords.length === 0" 
      :description="t('chart.noSportRecords')"
      :image-size="120"
    />

    <!-- Sport table -->
    <el-table 
      v-if="sportRecords.length > 0"
      :data="sportRecords" 
      stripe
      highlight-current-row
      @current-change="handleRowSelect"
      height="180"
      style="width: 100%; margin-top: 15px;"
      :header-cell-style="{ background: '#f5f7fa', color: '#606266' }"
    >
      <!-- Time column -->
      <el-table-column 
        prop="timeRange" 
        label="时间区间" 
        min-width="140"
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
        min-width="100"
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
        min-width="90"
        align="center"
      />

      <!-- Calories column -->
      <el-table-column 
        prop="calories" 
        label="热量消耗" 
        min-width="110"
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
        min-width="110"
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
        min-width="110"
        align="center"
      >
        <template #default="{ row }">
          <span v-if="row.maxHrm" class="hr-text"> {{ row.maxHrm }} bpm</span>
          <span v-else>--</span>
        </template>
      </el-table-column>

      <!-- Details column -->
      <el-table-column 
        label="详细信息" 
        min-width="100"
        align="center"
      >
        <template #default="{ row }">
          <el-tooltip placement="top" effect="dark">
            <template #content>
              <div class="detail-tooltip">
                <!-- Walking data -->
                <div v-if="(row.sport_type === 2 || row.sport_type === 22 || row.categoryName === '步行' || row.categoryName === '健走') && row.distanceKm">📍 {{ row.distanceKm }} 公里</div>
                <div v-if="(row.sport_type === 2 || row.sport_type === 22 || row.categoryName === '步行' || row.categoryName === '健走') && row.avgSpeed">平均速度: {{ row.avgSpeed }} km/h</div>
                <div v-if="(row.sport_type === 2 || row.sport_type === 22 || row.categoryName === '步行' || row.categoryName === '健走') && row.avgPace">平均配速: {{ formatPace(row.avgPace) }}</div>
                
                <!-- Elliptical data -->
                <div v-if="row.sport_type === 11 || row.categoryName === '椭圆机'">
                  <div v-if="row.steps">步数: {{ row.steps.toLocaleString() }}</div>
                  <div v-if="row.avgCadence">平均步频: {{ row.avgCadence }} 步/分</div>
                  <div v-if="row.maxCadence">最高步频: {{ row.maxCadence }} 步/分</div>
                </div>
                
                <!-- Rowing machine data -->
                <div v-if="row.sport_type === 13 || row.categoryName === '划船机'">
                  <div v-if="row.strokes">划动次数: {{ row.strokes.toLocaleString() }}</div>
                  <div v-if="row.segmentCount > 0">组数: {{ row.segmentCount }} 组</div>
                  <div v-if="row.avgStrokeRate">平均划频: {{ row.avgStrokeRate }} 次/分</div>
                  <div v-if="row.maxStrokeRate">最高划频: {{ row.maxStrokeRate }} 次/分</div>
                </div>
              </div>
            </template>
            <span class="detail-link">查看详情</span>
          </el-tooltip>
        </template>
      </el-table-column>
    </el-table>

    <!-- Sport Detail Panel -->
    <transition name="slide-fade">
      <div v-if="selectedRecord" class="detail-panel">
        <div class="detail-header">
          <h3 class="detail-title">运动详情 - {{ selectedRecord.categoryName }}</h3>
        </div>

        <!-- Rowing Machine Details -->
        <div v-if="selectedRecord.sport_type === 13 || selectedRecord.categoryName === '划船机'" class="sport-specific">
          <div class="metrics-grid">
            <div class="metric-item">
              <span class="metric-label">划动次数</span>
              <span class="metric-value">{{ selectedRecord.strokes || '--' }}</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">组数及平均时长</span>
              <span class="metric-value">
                {{ selectedRecord.segmentCount || '--' }} 组 * {{ getRowingGroupDuration(selectedRecord) ? formatDuration(getRowingGroupDuration(selectedRecord)) : '--' }}
              </span>
            </div>
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
          <div class="metrics-grid">
            <div class="metric-item">
              <span class="metric-label">平均配速</span>
              <span class="metric-value">{{ formatPace(selectedRecord.avgPaceSeconds) }}</span>
            </div>
            <div v-if="selectedRecord.bestPaceSeconds" class="metric-item">
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
            <div v-if="selectedRecord.maxStride" class="metric-item">
              <span class="metric-label">最大步幅</span>
              <span class="metric-value">{{ selectedRecord.maxStride }} cm</span>
            </div>
            <div v-if="selectedRecord.elevationGain" class="metric-item">
              <span class="metric-label">累计上升</span>
              <span class="metric-value">{{ selectedRecord.elevationGain }} m</span>
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
          <div class="metrics-grid">
            <div class="metric-item" v-if="selectedRecord.distanceKm && selectedRecord.distanceKm !== '0.00'">
              <span class="metric-label">运动距离</span>
              <span class="metric-value">{{ selectedRecord.distanceKm }} km</span>
            </div>
            <div class="metric-item" v-else-if="selectedRecord.steps">
              <span class="metric-label">运动步数</span>
              <span class="metric-value">{{ selectedRecord.steps }}</span>
            </div>
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
          <h4 class="section-title section-title-left">运动心率 (BPM)</h4>
          <div class="chart-container" ref="heartRateChartRef"></div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onMounted, computed } from 'vue';
import { ElTable, ElTableColumn, ElTag, ElButton, ElCard } from 'element-plus';
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

// Summary calculations
const totalCalories = computed(() => {
  return sportRecords.value.reduce((sum, record) => sum + (record.calories || 0), 0);
});

const totalDuration = computed(() => {
  return sportRecords.value.reduce((sum, record) => sum + (record.duration || 0), 0);
});

const totalSteps = computed(() => {
  return sportRecords.value.reduce((sum, record) => sum + (record.steps || 0), 0);
});

// Get average duration per group for rowing machine
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

// Format pace from seconds per km to km/h (speed)
function formatPace(paceSeconds) {
  if (!paceSeconds || paceSeconds === 0) return '--';
  // Convert seconds per km to km/h: speed = 3600 / paceSeconds
  const speedKmh = 3600 / paceSeconds;
  return `${speedKmh.toFixed(1)} km/h`;
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
  
  // Calculate dynamic Y-axis range based on actual heart rate data
  const hrValues = hrData.map(item => item[1]);
  const minHR = Math.min(...hrValues);
  const maxHR = Math.max(...hrValues);
  const hrRange = maxHR - minHR;
  const padding = Math.max(hrRange * 0.15, 10); // At least 10 BPM padding
  
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
      left: '60px',
      right: '20px',
      top: '10px',
      bottom: '30px'
    },
    xAxis: {
      type: 'value',
      name: '时间',
      nameLocation: 'end',
      nameTextStyle: {
        fontSize: 12
      },
      axisLabel: {
        fontSize: 11,
        formatter: function(value) {
          return formatDuration(value);
        }
      },
      splitLine: {
        show: true,
        lineStyle: {
          color: 'rgba(200, 200, 200, 0.2)'
        }
      }
    },
    yAxis: {
      type: 'value',
      name: 'BPM',
      nameLocation: 'end',
      nameTextStyle: {
        fontSize: 12
      },
      min: Math.floor(minHR - padding),
      max: Math.ceil(maxHR + padding),
      axisLabel: {
        fontSize: 11
      },
      splitLine: {
        show: true,
        lineStyle: {
          color: 'rgba(200, 200, 200, 0.2)'
        }
      }
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
        
        // Debug: Log segments for rowing machine
        if (value.sport_type === 13 || value.category === 'rowing_machine') {
          console.log('[DailySportChart] Rowing machine raw value:', value);
          console.log('[DailySportChart] Segments:', value.segments);
          console.log('[DailySportChart] All keys in value:', Object.keys(value));
          // Check for any fields that might contain segment/group info
          const possibleSegmentFields = ['segments', 'groups', 'sets', 'intervals', 'laps', 'splits'];
          possibleSegmentFields.forEach(field => {
            if (value[field]) {
              console.log(`[DailySportChart] Found ${field}:`, value[field]);
            }
          });
        }
        
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
          maxStrokeRate: value.max_stroke_rate || value.best_row_freq,
          restTime: value.rest_time || value.rest_between_group_duration || 0,
          segments: value.segments || [],
          segmentCount: value.group_count || 0,
          
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
    
    // Debug: Log rowing machine data
    const rowingRecord = sportRecords.value.find(r => r.sport_type === 13 || r.categoryName === '划船机');
    if (rowingRecord) {
      console.log('[DailySportChart] Parsed rowing record:', rowingRecord);
      console.log('[DailySportChart] Segment count:', rowingRecord.segmentCount);
    }
    
    // Clear selected record when no sport records available
    if (sportRecords.value.length === 0) {
      selectedRecord.value = null;
      if (heartRateChart) {
        heartRateChart.dispose();
        heartRateChart = null;
      }
    } else {
      // Auto-select first record if not already selected
      if (!selectedRecord.value) {
        selectedRecord.value = sportRecords.value[0];
        nextTick(() => {
          initHeartRateChart();
          updateHeartRateZones(sportRecords.value[0]);
        });
      }
    }
  } catch (error) {
    console.error('Failed to fetch sport records:', error);
    sportRecords.value = [];
    selectedRecord.value = null;
    if (heartRateChart) {
      heartRateChart.dispose();
      heartRateChart = null;
    }
  }
}, { immediate: true });
</script>

<style scoped>
.daily-sport-chart {
  background: var(--card-bg);
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  border: 1px solid var(--card-border);
  height: 100%;
}

.chart-title {
  margin: 0 0 20px 0;
  font-size: 20px;
  color: var(--text-primary);
  font-weight: 600;
  text-align: left;
}

.summary-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 15px;
  margin-bottom: 15px;
}

.summary-card-item {
  cursor: pointer;
  transition: all 0.3s;
  border: 2px solid var(--card-border);
  border-radius: 8px;
  background: var(--card-bg);
  min-height: 90px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.summary-card-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border-color: var(--primary-color);
}

.card-content {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
}

.card-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 28px;
}

.icon-text {
  line-height: 1;
}

.card-icon.calories {
  background: #f6ffed;
  color: #52c41a;
}

.card-icon.duration {
  background: #fff7e6;
  color: #fa8c16;
}

.card-icon.steps {
  background: #e6f7ff;
  color: #1890ff;
}

.card-info {
  flex: 1;
}

.card-label {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.card-value {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
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

.detail-link {
  font-size: 13px;
  color: #1890ff;
  cursor: pointer;
  text-decoration: underline;
}

.detail-link:hover {
  color: #40a9ff;
}

.detail-tooltip {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 4px 0;
}

.detail-tooltip div {
  white-space: nowrap;
}

.hr-text {
  font-weight: 600;
  color: #ff4d4f;
}

.group-duration {
  display: block;
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 4px;
  font-weight: normal;
}

/* Dark theme adjustments */

:deep(.dark-theme) .summary-card-item {
  background: #2a2a2a;
  border-color: #444;
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
  margin-top: 15px;
  padding: 0;
  background: transparent;
  color: var(--text-primary);
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.detail-title {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
  color: var(--text-primary);
}

.info-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}

.info-card {
  background: var(--card-bg);
  padding: 12px;
  border-radius: 8px;
  text-align: center;
  border: 1px solid var(--card-border);
}

.card-value {
  font-size: 22px;
  font-weight: 700;
  margin-bottom: 4px;
  color: var(--text-primary);
}

.card-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.sport-specific {
  background: var(--card-bg);
  padding: 15px;
  border-radius: 8px;
  margin-bottom: 15px;
  border: 1px solid var(--card-border);
}

.section-title {
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.section-title-left {
  text-align: left;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
}

.metric-item {
  background: rgba(0, 0, 0, 0.03);
  padding: 10px;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.metric-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.metric-value {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.segments-section {
  margin-top: 15px;
}

.km-paces-section {
  margin-top: 15px;
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
  margin-bottom: 15px;
}

.hr-stats {
  display: flex;
  gap: 20px;
  margin-bottom: 12px;
}

.hr-stat {
  flex: 1;
  text-align: center;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 4px;
  color: var(--primary-color, #1890ff);
}

.stat-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.chart-container {
  height: 300px; /* Fixed height for heart rate chart in sport details */
  background: transparent;
  border-radius: 8px;
  padding: 10px;
}

.hr-zones-section {
  background: var(--card-bg);
  padding: 15px;
  border-radius: 8px;
  margin-bottom: 15px;
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
