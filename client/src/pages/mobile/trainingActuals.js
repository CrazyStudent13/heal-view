/**
 * 移动端打卡页的「实际值」纯函数。
 *
 * 这三个函数决定"完成本项"写入哪些指标、以及取消完成时把哪些指标清空。它们原本内联在
 * TrainingPage.vue 里，只能在手机页面上点着试；而服务端会按动作声明的指标严格校验
 * actuals，多写一个键就会让整次保存被判 400（椭圆机等纯时长动作就不接受 sets）。
 * 单独放出来之后可以直接断言，不必挂载页面。
 *
 * 它们不依赖响应式状态、也不做翻译，所以是普通具名导出，不需要工厂。
 */
function targetDurationSeconds(targets) {
  if (Number(targets.durationSeconds) > 0) return Math.round(Number(targets.durationSeconds));
  if (Number(targets.duration) > 0) {
    return Math.round(Number(targets.duration) * (targets.durationUnit === 'seconds' ? 1 : 60));
  }
  return 0;
}

function targetActuals(item) {
  const targets = item?.targets || {};
  const supportedMetrics = new Set(item?.exercise?.metrics || []);
  // 时长统一按秒记录：动作声明 duration 时，目标里的 duration 分钟数换算后存 durationSeconds。
  if (supportedMetrics.has('duration')) supportedMetrics.add('durationSeconds');
  const actuals = {};

  for (const [metric, rawValue] of Object.entries(targets)) {
    if (metric === 'duration' || metric === 'durationSeconds') continue;
    if (!supportedMetrics.has(metric)) continue;
    const value = Number(rawValue);
    if (Number.isFinite(value) && value > 0) actuals[metric] = value;
  }

  // 组数只对声明了 sets 指标的动作有意义；椭圆机等纯时长/阻力动作提交 sets
  // 会被服务端按「不支持的指标」拒绝整次保存，所以这里必须先过同一道过滤。
  if (supportedMetrics.has('sets')) {
    const targetSets = Number(targets.sets);
    actuals.sets = Number.isFinite(targetSets) && targetSets > 0 ? Math.round(targetSets) : 1;
  }

  // 动作支持的指标未必都写在计划 targets 里（椭圆机的目标只给了阻力等级和时长），
  // 这里按目标补全，避免「完成本项」对这些动作写不出任何值而无法保存。
  if (supportedMetrics.has('durationSeconds') && actuals.durationSeconds == null) {
    const seconds = targetDurationSeconds(targets);
    if (seconds > 0) actuals.durationSeconds = seconds;
  }

  return actuals;
}

function emptyActuals(item, currentActuals = {}) {
  const keys = new Set([
    ...Object.keys(currentActuals),
    ...Object.keys(item?.targets || {}),
    'sets',
    'durationSeconds'
  ]);
  keys.delete('duration');
  return Object.fromEntries([...keys].map((metric) => [metric, null]));
}

export { emptyActuals, targetActuals, targetDurationSeconds };
