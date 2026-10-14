export function updateMetricSelection(currentMetrics, metric, checked) {
  const metrics = Array.isArray(currentMetrics) ? currentMetrics : [];
  if (checked) return [...new Set([...metrics, metric])];
  return metrics.filter((item) => item !== metric);
}

export function buildTrainingExercisePayload(form) {
  return {
    name: form.name,
    icon: form.icon,
    category: form.category,
    scene: form.scene,
    verificationMode: form.verificationMode,
    equipmentMode: form.equipmentMode,
    equipment: form.equipmentMode === 'equipment' ? form.equipment : '',
    metrics: Array.isArray(form.metrics) ? [...form.metrics] : [],
    // 手动验证的项目不参与导入数据匹配，类型配置一并清空，避免留下失效配置。
    sportTypes: form.verificationMode === 'manual' || !Array.isArray(form.sportTypes) ? [] : [...form.sportTypes],
    purpose: form.purpose
  };
}
