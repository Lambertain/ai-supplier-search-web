import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { runMigrations } from './db/migrations.js';
import { getSystemHealth } from './utils/health.js';
import { getMetrics, recordRequest } from './utils/metrics.js';
import logger, { requestLoggingMiddleware } from './utils/logger.js';

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

// CORS configuration - allow requests from Railway deployment and localhost
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    // Allow Railway deployment URLs
    if (origin.includes('.railway.app') || origin.includes('.up.railway.app')) {
      return callback(null, true);
    }

    // Allow localhost for development
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }

    // Block all other origins
    logger.warn('[CORS] Blocked request from unauthorized origin', { origin });
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID']
};

app.use(cors(corsOptions));

// Global rate limiter - prevent abuse
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  handler: (req, res) => {
    logger.warn('[Rate Limit] IP exceeded global rate limit', {
      ip: req.ip,
      path: req.path
    });
    res.status(429).json({
      error: 'Too many requests',
      message: 'You have exceeded the rate limit. Please try again later.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});

app.use(globalLimiter);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware - adds request ID and logs all requests
app.use(requestLoggingMiddleware);

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

// Error handling middleware
app.use((err, req, res, next) => {
  const status = err.status || 500;

  // Log error with request context
  if (req.logger) {
    req.logger.error('Unhandled error', {
      error: err.message,
      stack: err.stack,
      status,
      path: req.path,
      method: req.method
    });
  } else {
    logger.error('Unhandled error', {
      error: err.message,
      stack: err.stack,
      status,
      path: req.path,
      method: req.method
    });
  }

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
  logger.info('Server started', {
    port,
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version
  });
});
