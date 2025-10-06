import { Router } from 'express';
import { handleInboundEmail } from '../services/responseService.js';
import { getSettings } from '../storage/settingsStore.js';
import { appendLog } from '../storage/searchStore.js';

const router = Router();

router.post('/inbound', async (req, res, next) => {
  try {
    const settings = await getSettings();
    const result = await handleInboundEmail(req.body, settings);
    res.json({ status: 'ok', result });
  } catch (error) {
    next(error);
  }
});

router.post('/sendgrid-events', async (req, res, next) => {
  try {
    const events = Array.isArray(req.body) ? req.body : [req.body];
    for (const event of events) {
      const searchId = event?.custom_args?.search_id;
      if (searchId) {
        await appendLog(searchId, {
          message: 'SendGrid event received',
          context: event
        });
      }
    }
    res.json({ status: 'received' });
  } catch (error) {
    next(error);
  }
});

export default router;
