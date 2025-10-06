import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { runMigrations } from './db/migrations.js';

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

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
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
