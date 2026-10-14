export const defaultTrainingExercises = [
  {
    name: '骑行',
    icon: 'mdi:bike',
    category: 'aerobic',
    scene: 'outdoor',
    equipmentMode: 'equipment',
    equipment: '自行车',
    verificationMode: 'auto',
    // 认哪些导入运动类型，决定手表数据能不能自动验证这个项目。
    sportTypes: ['cycling'],
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
    sportTypes: ['running'],
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
    sportTypes: ['walking'],
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
    // 椭圆机目前默认手动记录；改成自动验证时可以直接用这份类型配置。
    sportTypes: ['elliptical'],
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
    sportTypes: ['rowing'],
    metrics: ['duration'],
    purpose: '综合锻炼背部、腿部和核心肌群，同时提升心肺耐力'
  },
  // 同一个器械的握法/方向是不同的训练动作，重量和次数也各自独立，
  // 所以拆成独立项目，器械名继续留在 equipment 字段里。
  {
    name: '肩膊推举器（正手）',
    icon: 'mdi:weight-lifter',
    category: 'strength',
    scene: 'indoor',
    equipmentMode: 'equipment',
    equipment: '肩膊推举器',
    verificationMode: 'manual',
    sportTypes: [],
    metrics: ['weight', 'repetitions', 'sets'],
    purpose: '正手握把推举，主要锻炼三角肌前束和肱三头肌，增强肩部推举力量'
  },
  {
    name: '肩膊推举器（反手）',
    icon: 'mdi:weight-lifter',
    category: 'strength',
    scene: 'indoor',
    equipmentMode: 'equipment',
    equipment: '肩膊推举器',
    verificationMode: 'manual',
    sportTypes: [],
    metrics: ['weight', 'repetitions', 'sets'],
    purpose: '反手握把推举，三角肌前束和上胸参与更多，肩关节前侧压力相对更小'
  },
  {
    name: '蝶式拉背器（正拉）',
    icon: 'mdi:arm-flex',
    category: 'strength',
    scene: 'indoor',
    equipmentMode: 'equipment',
    equipment: '蝶式拉背器',
    verificationMode: 'manual',
    sportTypes: [],
    metrics: ['weight', 'repetitions', 'sets'],
    purpose: '正向坐姿夹胸（蝴蝶机夹胸），主要锻炼胸大肌，改善胸部线条和推的力量'
  },
  {
    name: '蝶式拉背器（反拉）',
    icon: 'mdi:arm-flex',
    category: 'strength',
    scene: 'indoor',
    equipmentMode: 'equipment',
    equipment: '蝶式拉背器',
    verificationMode: 'manual',
    sportTypes: [],
    metrics: ['weight', 'repetitions', 'sets'],
    purpose: '反向飞鸟（反向蝴蝶机飞鸟），主要锻炼上背部和三角肌后束，改善肩背稳定性'
  },
  {
    name: '高拉背器（正手）',
    icon: 'mdi:dumbbell',
    category: 'strength',
    scene: 'indoor',
    equipmentMode: 'equipment',
    equipment: '高拉背器',
    verificationMode: 'manual',
    sportTypes: [],
    metrics: ['weight', 'repetitions', 'sets'],
    purpose: '正握宽距下拉，主要锻炼背阔肌上部和斜方肌，增强上肢拉力和背部宽度'
  },
  {
    name: '高拉背器（反手）',
    icon: 'mdi:dumbbell',
    category: 'strength',
    scene: 'indoor',
    equipmentMode: 'equipment',
    equipment: '高拉背器',
    verificationMode: 'manual',
    sportTypes: [],
    metrics: ['weight', 'repetitions', 'sets'],
    purpose: '反握窄距下拉，背阔肌下部发力更多，肱二头肌参与更明显'
  },
  {
    name: '大腿内外侧肌训练器（内收）',
    icon: 'mdi:human-barbell',
    category: 'strength',
    scene: 'indoor',
    equipmentMode: 'equipment',
    equipment: '大腿内外侧肌训练器',
    verificationMode: 'manual',
    sportTypes: [],
    metrics: ['weight', 'repetitions', 'sets'],
    purpose: '坐姿夹腿（大腿内收 / 髋内收），主要锻炼大腿内收肌群，增强髋部稳定性'
  },
  {
    name: '大腿内外侧肌训练器（外展）',
    icon: 'mdi:human-barbell',
    category: 'strength',
    scene: 'indoor',
    equipmentMode: 'equipment',
    equipment: '大腿内外侧肌训练器',
    verificationMode: 'manual',
    sportTypes: [],
    metrics: ['weight', 'repetitions', 'sets'],
    purpose: '坐姿分腿（大腿外展 / 髋外展），主要锻炼臀中肌和大腿外展肌群，改善下肢力线'
  },
  {
    name: '平板支撑',
    icon: 'mdi:yoga',
    category: 'strength',
    scene: 'indoor',
    equipmentMode: 'bodyweight',
    equipment: '',
    verificationMode: 'manual',
    sportTypes: [],
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
    sportTypes: [],
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
    sportTypes: [],
    metrics: ['sets', 'repetitions'],
    purpose: '主要锻炼腹部肌群，提升躯干屈曲力量和核心耐力'
  }
];

/**
 * 这 4 个器械以前只有一行“纯器械”项目，现在拆成了握法/方向变体。
 * 旧行已经被既有计划和训练记录用 exercise_id 引用，直接新建会让历史断链、目录里也会出现近似重复项，
 * 所以初始化时把旧行按 id 原地改名到最贴近它原有说明文字的变体：
 * - 高拉背器和肩膊推举器的默认握法是正手；
 * - 大腿内外侧肌训练器的旧说明把内收肌写在前面；
 * - 蝶式拉背器的旧说明是“上背部和三角肌后束”，对应反向飞鸟（反拉）。
 */
export const legacyTrainingExerciseNames = {
  肩膊推举器: '肩膊推举器（正手）',
  蝶式拉背器: '蝶式拉背器（反拉）',
  高拉背器: '高拉背器（正手）',
  大腿内外侧肌训练器: '大腿内外侧肌训练器（内收）'
};
