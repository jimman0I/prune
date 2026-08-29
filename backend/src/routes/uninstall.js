import { Router } from 'express';
import { runUninstaller } from '../services/uninstall.js';

const router = Router();

function sendEvent(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

router.post('/', async (req, res) => {
  const { uninstallString } = req.body || {};
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  try {
    const result = await runUninstaller(uninstallString, (type, data) => sendEvent(res, type, data));
    sendEvent(res, 'done', result);
  } catch (err) {
    sendEvent(res, 'error', { message: err.message });
  } finally {
    res.end();
  }
});

export default router;