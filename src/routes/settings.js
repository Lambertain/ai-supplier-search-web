import { Router } from 'express';
import { getSettings, updateSettings } from '../storage/settingsStore.js';
import { listAvailableModels } from '../services/openaiService.js';

const router = Router();

function presentSettings(settings) {
  const openaiKeySet = Boolean(settings.apiKeys?.openai || process.env.OPENAI_API_KEY);
  const sendgridKeySet = Boolean(settings.apiKeys?.sendgrid || process.env.SENDGRID_API_KEY);
  return {
    ...settings,
    secrets: {
      openai: openaiKeySet,
      sendgrid: sendgridKeySet
    }
  };
}

router.get('/', async (req, res, next) => {
  try {
    const settings = await getSettings();
    res.json(presentSettings(settings));
  } catch (error) {
    next(error);
  }
});

router.put('/', async (req, res, next) => {
  try {
    const settings = await updateSettings(req.body || {});
    res.json(presentSettings(settings));
  } catch (error) {
    next(error);
  }
});

router.get('/openai-models', async (req, res, next) => {
  try {
    const settings = await getSettings();
    const apiKey = settings.apiKeys?.openai || process.env.OPENAI_API_KEY;
    const models = await listAvailableModels(apiKey);
    res.json({ success: true, models });
  } catch (error) {
    res.status(error.status || 500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
