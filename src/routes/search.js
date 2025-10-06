import { Router } from 'express';
import { runSupplierSearch } from '../services/searchService.js';
import { getSettings } from '../storage/settingsStore.js';
import { listSearches, getSearch } from '../storage/searchStore.js';
import { validateRequest, searchSchema } from '../middleware/validation.js';

const router = Router();

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

router.post('/', validateRequest(searchSchema), async (req, res, next) => {
  try {
    const settings = await getSettings();
    const result = await runSupplierSearch(req.body, settings, {});
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
