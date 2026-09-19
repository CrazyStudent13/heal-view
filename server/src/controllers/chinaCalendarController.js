import { getChinaCalendarRange } from '../services/chinaWorkdayCalendar.js';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 732;

export async function getChinaWorkdayCalendar(req, res) {
  const { startDate, endDate } = req.query;
  if (!DATE_PATTERN.test(startDate || '') || !DATE_PATTERN.test(endDate || '') || startDate > endDate) {
    return res.status(400).json({ error: 'A valid startDate and endDate are required' });
  }

  const rangeDays = (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86400000;
  if (rangeDays > MAX_RANGE_DAYS) return res.status(400).json({ error: 'Calendar range is too large' });

  try {
    return res.json(await getChinaCalendarRange(startDate, endDate));
  } catch (error) {
    console.error('Error reading China workday calendar:', error);
    return res.status(500).json({ error: 'Failed to fetch China workday calendar' });
  }
}
