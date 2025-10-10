import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Determine log level based on environment
const logLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

// Create formats
const jsonFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.metadata(),
  winston.format.json()
);

const prettyFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, requestId, context, stack }) => {
    let logMessage = `[${timestamp}] ${level}: ${message}`;
    if (requestId) {
      logMessage += ` [RequestID: ${requestId}]`;
    }
    if (context) {
      logMessage += `\n  Context: ${JSON.stringify(context, null, 2)}`;
    }
    if (stack) {
      logMessage += `\n  Stack: ${stack}`;
    }
    return logMessage;
  })
);

// Choose format based on environment
const logFormat = process.env.NODE_ENV === 'production' ? jsonFormat : prettyFormat;

// Create transports array
const transports = [
  new winston.transports.Console({
    level: logLevel,
    format: logFormat
  })
];

// Add file transports in production
if (process.env.NODE_ENV === 'production') {
  const logsDir = path.join(__dirname, '../../logs');

  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      format: jsonFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      format: jsonFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 5
    })
  );
}

// Create the main logger
const logger = winston.createLogger({
  level: logLevel,
  format: logFormat,
  transports,
  exitOnError: false
});

/**
 * Create a child logger with additional context
 * @param {Object} context - Additional context to include in all logs
 * @returns {winston.Logger} Child logger instance
 */
export function createChildLogger(context) {
  return logger.child(context);
}

/**
 * Log with request context
 * @param {Object} options - Logging options
 * @param {string} options.level - Log level (error, warn, info, debug)
 * @param {string} options.message - Log message
 * @param {string} options.requestId - Request ID for tracing
 * @param {Object} options.context - Additional context data
 */
export function logWithContext({ level = 'info', message, requestId, context }) {
  logger.log({
    level,
    message,
    requestId,
    context
  });
}

/**
 * Express middleware to add request ID to all logs
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export function requestLoggingMiddleware(req, res, next) {
  // Generate or use existing request ID
  const requestId = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Attach request ID to request object
  req.requestId = requestId;

  // Set response header
  res.setHeader('X-Request-ID', requestId);

  // Create child logger for this request
  req.logger = createChildLogger({ requestId });

  // Log incoming request
  req.logger.info('Incoming request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  // Log response when finished
  const startTime = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    req.logger.info('Request completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`
    });
  });

  next();
}

export default logger;
