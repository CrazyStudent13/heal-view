/**
 * Convert Unix timestamp (seconds) to date string
 * @param {number} timestamp - Unix timestamp in seconds
 * @param {string} format - Output format ('YYYY-MM-DD' | 'YYYY-MM-DD HH:mm:ss')
 * @returns {string} Formatted date string
 */
export function timestampToDate(timestamp, format = 'YYYY-MM-DD') {
  const date = new Date(timestamp * 1000);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  if (format === 'YYYY-MM-DD') {
    return `${year}-${month}-${day}`;
  }

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Get start and end timestamps for a given date
 * @param {string} dateStr - Date string in 'YYYY-MM-DD' format
 * @returns {object} Object with start and end timestamps
 */
export function getDateRange(dateStr) {
  const date = new Date(dateStr);
  const start = new Date(date.setHours(0, 0, 0, 0));
  const end = new Date(date.setHours(23, 59, 59, 999));

  return {
    start: Math.floor(start.getTime() / 1000),
    end: Math.floor(end.getTime() / 1000)
  };
}
