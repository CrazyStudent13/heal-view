import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const config = {
  port: parseInt(process.env.PORT, 10) || 43128,
  dataDir: path.resolve(process.env.DATA_DIR || path.join(__dirname, '../../data')),
  dbPath: path.resolve(process.env.DB_PATH || path.join(__dirname, '../../health_data.db')),
  uploadDir: path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads')),
  auth: {
    sessionTtl: parseInt(process.env.AUTH_SESSION_TTL, 10) || 604800,
    cookieName: process.env.AUTH_COOKIE_NAME || 'heal_view_session',
    cookieSecure:
      process.env.AUTH_COOKIE_SECURE !== undefined
        ? process.env.AUTH_COOKIE_SECURE === 'true'
        : process.env.NODE_ENV === 'production'
  },
  cacheTTL: {
    dates: parseInt(process.env.CACHE_TTL_DATES) || 86400, // 24 hours
    summary: parseInt(process.env.CACHE_TTL_SUMMARY) || 3600 // 1 hour
  },
  chinaCalendar: {
    source: 'holiday-calendar',
    urlTemplate: process.env.CHINA_CALENDAR_URL_TEMPLATE || 'https://unpkg.com/holiday-calendar/data/CN/{year}.json',
    syncIntervalMs: parseInt(process.env.CHINA_CALENDAR_SYNC_INTERVAL_MS, 10) || 30 * 24 * 60 * 60 * 1000,
    requestTimeoutMs: parseInt(process.env.CHINA_CALENDAR_REQUEST_TIMEOUT_MS, 10) || 8000
  }
};
