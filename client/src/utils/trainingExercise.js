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
    purpose: form.purpose
  };
}
