export const defaultTrainingExercises = [
  {
    name: '骑行',
    icon: 'mdi:bike',
    category: 'aerobic',
    scene: 'outdoor',
    equipmentMode: 'equipment',
    equipment: '自行车',
    verificationMode: 'auto',
    metrics: ['distance'],
    purpose: '提升心肺耐力和下肢持续发力能力'
  },
  {
    name: '跑步',
    icon: 'mdi:run',
    category: 'aerobic',
    scene: 'outdoor',
    equipmentMode: 'bodyweight',
    equipment: '',
    verificationMode: 'auto',
    metrics: ['duration', 'distance'],
    purpose: '提升心肺能力、耐力和下肢力量'
  },
  {
    name: '室内步行',
    icon: 'mdi:walk',
    category: 'aerobic',
    scene: 'indoor',
    equipmentMode: 'equipment',
    equipment: '跑步机',
    verificationMode: 'auto',
    metrics: ['duration', 'distance'],
    purpose: '进行低冲击有氧活动，维持日常活动量和心肺状态'
  },
  {
    name: '椭圆机',
    icon: 'mdi:fitness-center',
    category: 'aerobic',
    scene: 'indoor',
    equipmentMode: 'equipment',
    equipment: '椭圆机',
    verificationMode: 'manual',
    metrics: ['duration', 'resistance'],
    purpose: '进行低冲击全身有氧训练，锻炼心肺和下肢耐力'
  },
  {
    name: '划船机',
    icon: 'mdi:human-rowing',
    category: 'aerobic',
    scene: 'indoor',
    equipmentMode: 'equipment',
    equipment: '划船机',
    verificationMode: 'auto',
    metrics: ['duration'],
    purpose: '综合锻炼背部、腿部和核心肌群，同时提升心肺耐力'
  },
  {
    name: '肩膊推举器',
    icon: 'mdi:weight-lifter',
    category: 'strength',
    scene: 'indoor',
    equipmentMode: 'equipment',
    equipment: '肩膊推举器',
    verificationMode: 'manual',
    metrics: ['weight', 'sets'],
    purpose: '主要锻炼三角肌和肱三头肌，增强肩部推举力量'
  },
  {
    name: '蝶式拉背器',
    icon: 'mdi:arm-flex',
    category: 'strength',
    scene: 'indoor',
    equipmentMode: 'equipment',
    equipment: '蝶式拉背器',
    verificationMode: 'manual',
    metrics: ['weight', 'sets'],
    purpose: '主要锻炼上背部和三角肌后束，改善肩背稳定性'
  },
  {
    name: '高拉背器',
    icon: 'mdi:dumbbell',
    category: 'strength',
    scene: 'indoor',
    equipmentMode: 'equipment',
    equipment: '高拉背器',
    verificationMode: 'manual',
    metrics: ['weight', 'sets'],
    purpose: '主要锻炼背阔肌、斜方肌和肱二头肌，增强上肢拉力'
  },
  {
    name: '大腿内外侧肌训练器',
    icon: 'mdi:human-barbell',
    category: 'strength',
    scene: 'indoor',
    equipmentMode: 'equipment',
    equipment: '大腿内外侧肌训练器',
    verificationMode: 'manual',
    metrics: ['weight', 'repetitions', 'sets'],
    purpose: '主要锻炼大腿内收肌和外展肌，增强髋部稳定性与下肢力量'
  },
  {
    name: '平板支撑',
    icon: 'mdi:yoga',
    category: 'strength',
    scene: 'indoor',
    equipmentMode: 'bodyweight',
    equipment: '',
    verificationMode: 'manual',
    // 平板支撑既按组数统计，也支持按目标时长倒计时记录。
    metrics: ['sets', 'duration'],
    purpose: '增强核心肌群耐力和躯干稳定性'
  },
  {
    name: '俯卧撑',
    icon: 'mdi:arm-flex',
    category: 'strength',
    scene: 'indoor',
    equipmentMode: 'bodyweight',
    equipment: '',
    verificationMode: 'manual',
    metrics: ['sets', 'repetitions'],
    purpose: '主要锻炼胸肌、肱三头肌和肩部，同时强化核心稳定性'
  },
  {
    name: '仰卧起坐',
    icon: 'mdi:fitness-center',
    category: 'strength',
    scene: 'indoor',
    equipmentMode: 'bodyweight',
    equipment: '',
    verificationMode: 'manual',
    metrics: ['sets', 'repetitions'],
    purpose: '主要锻炼腹部肌群，提升躯干屈曲力量和核心耐力'
  }
];
