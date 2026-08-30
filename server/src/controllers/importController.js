import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import {
  clearImportedData,
  deleteImportHistory,
  importParsedArchive,
  listImportHistory,
  parseArchiveFile
} from '../services/archiveImportService.js';
import { resetUserProfileCache } from './weightController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.resolve(__dirname, '../../uploads');

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^\w.\-\u4e00-\u9fa5]/g, '_');
    cb(null, `${Date.now()}-${Math.random().toString(16).slice(2)}-${safeName}`);
  }
});

export const uploadArchive = multer({
  storage,
  limits: {
    fileSize: 200 * 1024 * 1024,
    files: 1
  },
  fileFilter: (req, file, cb) => {
    if (!/\.zip$/i.test(file.originalname)) {
      cb(new Error('请上传 ZIP 压缩包'));
      return;
    }
    cb(null, true);
  }
});

async function cleanupFile(file) {
  if (!file?.path) return;
  try {
    await fs.unlink(file.path);
  } catch {
    // Temporary upload cleanup is best effort.
  }
}

export async function parseImportArchive(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ code: 'NO_ARCHIVE', message: '请先选择压缩包' });
    }

    const result = await parseArchiveFile(req.file, req.body.platform || 'xiaomi');
    res.json(result);
  } catch (error) {
    console.error('Archive parse failed:', error);
    res.status(error.status || 400).json({
      code: error.code || 'IMPORT_PARSE_FAILED',
      message: error.message || '解析健康数据压缩包失败',
      details: error.details || null
    });
  } finally {
    await cleanupFile(req.file);
  }
}

export function commitImportArchive(req, res) {
  try {
    const result = importParsedArchive(req.params.importId);
    resetUserProfileCache();
    res.json(result);
  } catch (error) {
    console.error('Archive import failed:', error);
    res.status(error.status || 500).json({
      code: error.code || 'IMPORT_COMMIT_FAILED',
      message: error.message || '导入健康数据失败'
    });
  }
}

export function getImportHistory(req, res) {
  res.json({ records: listImportHistory() });
}

export function removeImportHistory(req, res) {
  deleteImportHistory(req.params.importId);
  res.json({ ok: true });
}

export function removeImportedData(req, res) {
  try {
    clearImportedData();
    resetUserProfileCache();
    res.json({ ok: true });
  } catch (error) {
    console.error('Clear imported data failed:', error);
    res.status(500).json({
      code: 'IMPORT_CLEAR_FAILED',
      message: error.message || '清空导入数据失败'
    });
  }
}
