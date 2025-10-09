import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { runMigrations } from './db/migrations.js';
import { getSystemHealth } from './utils/health.js';
import { getMetrics, recordRequest } from './utils/metrics.js';

import searchRoutes from './routes/search.js';
import settingsRoutes from './routes/settings.js';
import resultsRoutes from './routes/results.js';
import webhookRoutes from './routes/webhooks.js';

dotenv.config();
await runMigrations();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '../public');

const app = express();

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Metrics middleware - track all requests
app.use((req, res, next) => {
  const originalSend = res.send;
  res.send = function (data) {
    recordRequest(req.path, res.statusCode);
    return originalSend.call(this, data);
  };
  next();
});

// Health check endpoint - checks DB, Redis, and system status
app.get('/api/health', async (req, res) => {
  try {
    const health = await getSystemHealth();
    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Metrics endpoint - application performance metrics
app.get('/api/metrics', async (req, res) => {
  try {
    const metrics = await getMetrics();
    res.json(metrics);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve metrics',
      message: error.message
    });
  }
});

app.use('/api/search', searchRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/results', resultsRoutes);
app.use('/api/webhooks', webhookRoutes);

app.use(express.static(publicDir));

app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  const status = err.status || 500;
  const response = {
    message: err.message || 'Internal Server Error'
  };
  if (err.details) {
    response.details = err.details;
  }
  res.status(status).json(response);
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Supplier search app listening on port ${port}`);
});
