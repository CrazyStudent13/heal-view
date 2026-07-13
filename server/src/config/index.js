import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const config = {
  port: process.env.PORT || 3000,
  dataDir: path.join(__dirname, '../../data'),
  dbPath: path.join(__dirname, '../../health_data.db'),
  cacheTTL: {
    dates: parseInt(process.env.CACHE_TTL_DATES) || 86400, // 24 hours
    summary: parseInt(process.env.CACHE_TTL_SUMMARY) || 3600 // 1 hour
  }
};
