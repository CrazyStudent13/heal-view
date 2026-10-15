import express from 'express';
import cors from 'cors';
import compression from 'compression';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config/index.js';
import { databaseService } from './services/database.js';
import { initializeChinaWorkdayCalendar } from './services/chinaWorkdayCalendar.js';
import { seedTrainingExercises } from './services/trainingExerciseSeed.js';
import apiRoutes from './routes/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.resolve(__dirname, '../../client/dist');

const app = express();

// Middleware
app.disable('x-powered-by'); // 不向外暴露服务端技术栈
app.use(compression()); // Gzip compression

// 默认同源访问即可满足开发与生产两种形态（开发走 Vite 代理、生产由本进程同时
// 提供页面与接口），所以默认不加 CORS 头；仅在配置了 CORS_ORIGIN 时才放开。
if (config.corsOrigin) {
  app.use(cors({ origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',').map((o) => o.trim()) }));
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes
app.use('/api', apiRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// In production the client build is copied into the image and served from the
// same origin as the API. Keeping the SPA fallback here also makes history-mode
// routes (for example /dashboard) work after a browser refresh.
// Vite 产物文件名带内容哈希，内容不会变，可以长期强缓存；index.html 是唯一
// 没有哈希的入口，必须每次回源校验，否则发版后客户端会一直引用旧的分块。
app.use(
  express.static(clientDistPath, {
    index: 'index.html',
    setHeaders(res, filePath) {
      if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache');
        return;
      }
      if (/[\\/]assets[\\/]/.test(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    }
  })
);
app.get(/^(?!\/api(?:\/|$)).*/, (req, res, next) => {
  if (!req.accepts('html')) {
    next();
    return;
  }

  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(clientDistPath, 'index.html'), (error) => {
    if (error) next(error);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
async function startServer() {
  try {
    // Initialize database
    await databaseService.initialize();

    // Keep the built-in exercise catalog available after a fresh deployment
    // and restore missing defaults in an existing database. The seed is
    // idempotent and preserves user-created exercises.
    const exerciseSeed = seedTrainingExercises();
    console.log(
      `Training exercise catalog initialized: ${exerciseSeed.created} created, ${exerciseSeed.updated} updated, ` +
        `${exerciseSeed.renamed} legacy renamed, ${exerciseSeed.retired} legacy retired.`
    );

    // Calendar refreshes are advisory and must never delay the API becoming available.
    void initializeChinaWorkdayCalendar().catch((error) => {
      console.warn(`China calendar initialization failed: ${error.message}`);
    });

    app.listen(config.port, () => {
      console.log(`Server running on http://localhost:${config.port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down...');
  databaseService.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Shutting down...');
  databaseService.close();
  process.exit(0);
});

export default app;
