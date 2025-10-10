import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { runSupplierSearch } from '../services/searchService.js';
import { getSettings } from '../storage/settingsStore.js';
import { listSearches, getSearch } from '../storage/searchStore.js';
import { validateRequest, searchSchema } from '../middleware/validation.js';
import logger from '../utils/logger.js';

const router = Router();

// Strict rate limiter for expensive search operations
const searchLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 searches per hour (expensive OpenAI + SendGrid operations)
  message: 'Too many searches from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('[Rate Limit] IP exceeded search rate limit', {
      ip: req.ip,
      path: req.path,
      body: req.body
    });
    res.status(429).json({
      error: 'Too many searches',
      message: 'You have exceeded the hourly search limit (10 searches/hour). This protects against accidental loops and abuse.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000),
      limit: 10,
      windowMs: 3600000
    });
  }
});

router.get('/', async (req, res, next) => {
  try {
    const searches = await listSearches();
    res.json(searches.map((search) => ({
      searchId: search.searchId,
      status: search.status,
      startedAt: search.startedAt,
      completedAt: search.completedAt || null,
      productDescription: search.productDescription,
      metrics: search.metrics
    })));
  } catch (error) {
    next(error);
  }
});

router.get('/:searchId', async (req, res, next) => {
  try {
    const search = await getSearch(req.params.searchId);
    if (!search) {
      return res.status(404).json({ message: 'Search not found' });
    }
    res.json(search);
  } catch (error) {
    next(error);
  }
});

router.post('/', searchLimiter, validateRequest(searchSchema), async (req, res, next) => {
  try {
    const settings = await getSettings();
    const result = await runSupplierSearch(req.body, settings, {});
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
