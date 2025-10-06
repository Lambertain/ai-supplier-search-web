import { Router } from 'express';
import {
  listSuppliersWithSearch,
  listSuppliersForSearch,
  deleteSupplierById,
  deleteSupplier
} from '../storage/searchStore.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { searchId, limit } = req.query;
    if (searchId) {
      const rows = await listSuppliersForSearch(searchId);
      return res.json(rows);
    }
    const max = Math.min(Number(limit) || 200, 500);
    const rows = await listSuppliersWithSearch(max);
    return res.json(rows);
  } catch (error) {
    next(error);
  }
});

router.delete('/:supplierId', async (req, res, next) => {
  try {
    await deleteSupplierById(req.params.supplierId);
    res.json({ status: 'deleted' });
  } catch (error) {
    next(error);
  }
});

router.delete('/:searchId/:supplierId', async (req, res, next) => {
  try {
    await deleteSupplier(req.params.searchId, req.params.supplierId);
    res.json({ status: 'deleted' });
  } catch (error) {
    next(error);
  }
});

export default router;
