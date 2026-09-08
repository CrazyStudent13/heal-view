const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeDateParam(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return ISO_DATE_PATTERN.test(normalized) ? normalized : null;
}

export function normalizeCategoryParam(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

export function validateDateParam(res, value, label = 'date') {
  const normalized = normalizeDateParam(value);
  if (!normalized) {
    res.status(400).json({ error: `Invalid ${label}` });
    return null;
  }
  return normalized;
}

export function validateDateRange(startDate, endDate) {
  if (startDate && endDate && startDate > endDate) {
    return null;
  }
  return { startDate: startDate || null, endDate: endDate || null };
}

export function validateMetric(metric) {
  return ['steps', 'calories', 'heart_rate', 'stress', 'blood_pressure'].includes(metric)
    ? metric
    : null;
}
