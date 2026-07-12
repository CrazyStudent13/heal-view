import express from 'express';
import cors from 'cors';
import compression from 'compression';
import { config } from './config/index.js';
import { databaseService } from './services/database.js';
import apiRoutes from './routes/api.js';

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
