import express from 'express';
import cors from 'cors';
import compression from 'compression';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config/index.js';
import { databaseService } from './services/database.js';
import { initializeChinaWorkdayCalendar } from './services/chinaWorkdayCalendar.js';
import apiRoutes from './routes/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.resolve(__dirname, '../../client/dist');

const app = express();

// Middleware
app.use(compression()); // Gzip compression
app.use(cors());
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
app.use(express.static(clientDistPath, { index: 'index.html' }));
app.get(/^(?!\/api(?:\/|$)).*/, (req, res, next) => {
  if (!req.accepts('html')) {
    next();
    return;
  }

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
