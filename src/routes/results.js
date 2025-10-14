import { Router } from 'express';
import {
  listSuppliersWithSearch,
  listSuppliersForSearch,
  deleteSupplierById,
  deleteSupplier,
  getSearchHistory,
  deleteSuppliersInBulk,
  getSendHistory,
  queueEmailsForSuppliers
} from '../storage/searchStore.js';
import { queueEmail } from '../queues/emailQueue.js';

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

router.get('/history', async (req, res, next) => {
  try {
    const history = await getSearchHistory();
    res.json(history);
  } catch (error) {
    next(error);
  }
});

router.delete('/suppliers/bulk', async (req, res, next) => {
  const { supplier_ids } = req.body;

  if (!Array.isArray(supplier_ids) || supplier_ids.length === 0) {
    return res.status(400).json({ error: 'supplier_ids array is required' });
  }

  try {
    await deleteSuppliersInBulk(supplier_ids);
    res.json({
      success: true,
      deleted: supplier_ids.length,
      message: `Видалено ${supplier_ids.length} постачальників`
    });
  } catch (error) {
    next(error);
  }
});

router.get('/send-history', async (req, res, next) => {
  try {
    const history = await getSendHistory();
    res.json(history);
  } catch (error) {
    next(error);
  }
});

router.post('/send-emails', async (req, res, next) => {
  const { supplier_ids } = req.body;

  if (!Array.isArray(supplier_ids) || supplier_ids.length === 0) {
    return res.status(400).json({ error: 'supplier_ids array is required' });
  }

  try {
    const queuedCount = await queueEmailsForSuppliers(supplier_ids, queueEmail);
    res.json({
      success: true,
      queued: queuedCount,
      message: `Поставлено в чергу ${queuedCount} листів`
    });
  } catch (error) {
    next(error);
  }
});

export default router;
