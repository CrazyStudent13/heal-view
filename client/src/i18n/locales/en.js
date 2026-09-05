export default {
  app: { title: 'Daily Fitness Dashboard' },
  common: {
    loading: 'Loading...', empty: 'No data', reset: 'Reset', selectAll: 'Select All', clearAll: 'Clear All', query: 'Query',
    selectedDays: '{count} days selected'
  },
  nav: {
    singleDay: 'Single Day', multiDay: 'Multi-Day', selectDate: 'Select Date',
    selectDatesToCompare: 'Please select dates to compare on the left', selectDateToView: 'Please select a date to view data',
    startDate: 'Start Date', endDate: 'End Date', sportType: 'Sport Type', selectSport: 'Select Sport Type',
    lastWeek: 'Last 7 days', lastMonth: 'Last month', lastThreeMonths: 'Last 3 months'
  },
  settings: { title: 'Settings', language: 'Language', theme: 'Theme', light: 'Light', dark: 'Dark' },
  data: {
    overview: 'Data Overview', weight: 'Weight', avgWeight: 'Avg Weight', steps: 'Steps', avgSteps: 'Avg Steps', maxSteps: 'Max Steps',
    calories: 'Calories', avgCalories: 'Avg Calories', heartRate: 'Avg Heart Rate', avgBloodPressure: 'Avg Blood Pressure', stress: 'Stress Level', avgStress: 'Avg Stress',
    sleep: 'Sleep Duration', avgSleep: 'Avg Sleep', personalInfo: 'Basic Information', viewDetails: 'View Details'
  },
  chart: {
    noData: 'Please select a date above to view data', noSleepData: 'No sleep data for this date', selectDate: 'Please select a date above',
    trend: 'Trend', heartRateMonitor: 'Heart Rate Monitor', bloodPressureTrend: 'Blood Pressure Trend', bloodPressurePeak: 'Peak Blood Pressure',
    bloodPressureRangeTipTitle: 'Blood Pressure Range Tips',
    bloodPressureHighRange: 'High blood pressure',
    bloodPressureHighRangeValue: 'Systolic >= 140 mmHg or diastolic >= 90 mmHg',
    bloodPressureElevatedRange: 'Elevated',
    bloodPressureElevatedRangeValue: 'Systolic 130-139 mmHg or diastolic 85-89 mmHg',
    systolic: 'Systolic', diastolic: 'Diastolic', caloriesBurned: 'Calories Burned', avgCaloriesLine: 'Avg Calories', caloriesEfficiency: 'Calorie Efficiency', caloriesEfficiencyUnit: 'kcal/min', totalSleep: 'Total Sleep', sleepAnalysis: 'Analysis',
    noBloodPressureData: 'No blood pressure data for this date range',
    deepSleep: 'Deep Sleep', lightSleep: 'Light Sleep', awakeSleep: 'Awake', sleepTimeline: 'Sleep Timeline',
    sleepStageAnalysis: 'Sleep Stage Duration Analysis', sleepStageDuration: 'Duration by stage', sleepStageRatio: 'Stage distribution',
    hourShort: 'h', minuteShort: 'min', deep: 'Deep', light: 'Light', rem: 'REM', awake: 'Awake', bedtime: 'Bedtime',
    wakeUpTime: 'Wake Up Time', bedtimeLabel: 'Bedtime', wakeUpLabel: 'Wake up', minutes: 'min', unknown: 'Unknown', hours: 'Hours(h)',
    stepsDistanceTrend: 'Steps & Distance Trend', dailyActivityTrend: 'Daily Activity Trend', dailySportActivities: "Today's Sport Activities",
    noSportRecords: 'No sport records today', timeRange: 'Time Range', sportType: 'Sport Type', duration: 'Duration', calories: 'Calories',
    details: 'Details', avgHeartRate: 'Avg Heart Rate', maxHeartRate: 'Max Heart Rate', avgSpeed: 'Avg Speed', avgPace: 'Avg Pace',
    formula: 'Formula', description: 'Description', avgExerciseDurationFormula: 'Total exercise duration ÷ Days with exercise',
    avgExerciseDurationDesc: 'Average value for days with exercise records only', avgExerciseDistanceFormula: 'Total exercise distance ÷ Days with exercise',
    avgExerciseDistanceDesc: 'Average distance for days with exercise records (unit: km)', avgDailyCaloriesFormula: 'Total calories burned ÷ Days with exercise',
    avgDailyCaloriesDesc: 'Average calculated from calorie data in exercise records', totalExerciseDurationFormula: 'Sum of all exercise session durations',
    totalExerciseDurationDesc: 'Total duration of all exercises in selected period (unit: hours)',
    totalExerciseDistanceFormula: 'Sum of all exercise session distances', totalExerciseDistanceDesc: 'Total distance of all exercises in selected period (unit: km)',
    exerciseFrequencyFormula: 'Days with exercise / Total selected days', exerciseFrequencyDesc: 'Numerator is days with exercise, denominator is total selected dates',
    steps: 'Steps', distance: 'Distance', sportCalories: 'Sport Calories', unitSteps: 'steps', exerciseStats: 'Exercise Stats',
    avgExerciseDuration: 'Avg Exercise Duration', avgExerciseDistance: 'Avg Exercise Distance', avgDailyCalories: 'Avg Daily Calories',
    totalExerciseDuration: 'Total Exercise Duration', totalExerciseDistance: 'Total Exercise Distance', exerciseDays: 'Exercise Days', days: 'days',
    heartRateRange: 'Heart Rate Range', restingHeartRate: 'Resting Heart Rate', unitBpm: 'bpm'
  },
  sleep: {
    totalLabel: 'Total sleep ({bedtime} → {wakeUpTime})', avgHeartRate: 'Average sleep heart rate', interruptions: 'Interruptions',
    interruptionCount: '{count} times', uninterrupted: 'Uninterrupted', slightlyInterrupted: 'Slightly interrupted',
    normalInterruptions: 'Normal range', frequentInterruptions: 'Frequent interruptions'
  },
  sport: {
    totalCalories: 'Total calories', totalDuration: 'Total duration', totalSteps: 'Exercise steps', detailTitle: 'Exercise details - {name}',
    viewDetails: 'View details', distanceValue: '{value} km', avgSpeedValue: 'Avg speed: {value} km/h', avgPaceValue: 'Avg pace: {value}',
    stepsValue: 'Steps: {value}', avgCadenceValue: 'Avg cadence: {value} steps/min', maxCadenceValue: 'Max cadence: {value} steps/min',
    strokesValue: 'Strokes: {value}', setsValue: 'Sets: {value}', avgStrokeRateValue: 'Avg stroke rate: {value}/min',
    maxStrokeRateValue: 'Max stroke rate: {value}/min', cadenceValue: '{value} steps/min', strokeRateValue: '{value}/min',
    strokes: 'Strokes', setsAndDuration: 'Sets and average duration',
    avgStrokeRate: 'Avg stroke rate', maxStrokeRate: 'Max stroke rate', restDuration: 'Rest between sets', segmentDetails: 'Segment details',
    type: 'Type', training: 'Training', rest: 'Rest', strokeCount: 'Strokes', avgPace: 'Avg pace', fastestPace: 'Fastest pace',
    avgCadence: 'Avg cadence', maxCadence: 'Max cadence', avgStride: 'Avg stride', maxStride: 'Max stride', elevationGain: 'Elevation gain',
    perKmPace: 'Pace per kilometer', exerciseDistance: 'Exercise distance', exerciseSteps: 'Exercise steps', exerciseHeartRate: 'Exercise heart rate (BPM)',
    time: 'Time', heartRate: 'Heart rate', zeroMinutes: '0 min', durationHoursMinutes: '{hours}h {minutes}min', durationMinutes: '{minutes}min',
    zone: { warmup: 'Warm-up', fatBurn: 'Fat burn', aerobic: 'Aerobic', anaerobic: 'Anaerobic', extreme: 'Maximum' },
    typeName: {
      other: 'Other', running: 'Running', walking: 'Walking', cycling: 'Cycling', swimming: 'Swimming', hiking: 'Hiking',
      outdoorRiding: 'Outdoor cycling', fitness: 'Fitness', freeTraining: 'Free training', yoga: 'Yoga', jumpRope: 'Jump rope',
      elliptical: 'Elliptical', basketball: 'Basketball', rowing: 'Rowing', badminton: 'Badminton', outdoorHiking: 'Outdoor hiking',
      tennis: 'Tennis', volleyball: 'Volleyball', golf: 'Golf', skiing: 'Skiing', skating: 'Skating', climbing: 'Rock climbing',
      outdoorWalking: 'Outdoor walking', outdoorRunning: 'Outdoor running', football: 'Football', tableTennis: 'Table tennis'
    }
  },
  weight: {
    title: 'Weight Trend', stats: 'Weight Metrics', latestWeight: 'Latest Weight', heightWeight: 'Height / Weight', bmi: 'BMI',
    targetWeight: 'Target Weight', initialWeight: 'Initial Weight', initTargetWeight: 'Initial / Target', highestWeight: 'Highest Weight',
    weightChange: 'Weight Change', avgDailyCalories: 'Avg Daily Calories', kg: 'kg', kcal: 'kcal', lost: 'Lost', gained: 'Gained',
    noTarget: 'Not Set', dailyAvgWeight: 'Daily Avg Weight', bmiFormula: 'BMI = Weight(kg) / Height(m)²',
    bmiDesc: 'Auto-calculated based on height data from user profile', bmiUnderweight: 'Underweight', bmiNormal: 'Normal',
    bmiOverweight: 'Overweight', bmiObese: 'Obese', bmiCategoryCurrent: 'Currently', caloriesFormula: 'Daily Avg = BMR + Sport Calories',
    bmrLabel: 'BMR', sportCalLabel: 'Sport', totalCalLabel: 'Total'
  },
  personal: {
    title: 'Personal Data', basicInfo: 'Basic Information', height: 'Height', weight: 'Weight', age: 'Age', sex: 'Gender', male: 'Male', female: 'Female',
    years: 'years', weightGoals: 'Weight Goals', initialWeight: 'Initial Weight', targetWeight: 'Target Weight', weightToLose: 'Weight to Lose',
    dailyCalGoal: 'Daily Exercise Calorie Goal', healthMetrics: 'Health Metrics', bmi: 'BMI', bmr: 'BMR', vo2Max: 'VO2 Max',
    kcalPerDay: 'kcal/day', bmiReference: 'BMI Reference Range', bmiUnderweight: 'Underweight', bmiNormal: 'Normal', bmiOverweight: 'Overweight',
    bmiObese: 'Obese', notSet: 'Not Set', noData: 'No personal data available', todayOverview: "Today's Health Overview", todaySteps: "Today's Steps",
    todayCalories: "Today's Calories", todayHeartRate: "Today's Heart Rate", todaySleep: "Today's Sleep", todaySport: "Today's Exercise",
    bloodPressureTitle: 'Blood Pressure Today', bloodPressureSummary: '{count} records · heart rate: {heartRate} bpm', bloodPressureRecords: 'Records: {count}',
    bloodPressureHeartRate: 'Heart rate: {heartRate} bpm', bpExpandRecords: 'Show records', bpCollapseRecords: 'Hide records',
    bpNormal: 'Normal', bpElevated: 'Elevated', bpHigh: 'High blood pressure'
  },
  day: { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun' }
};
