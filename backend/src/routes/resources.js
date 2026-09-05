import { Router } from 'express';
import { readResources } from '../services/resourceMonitor.js';

const router = Router();

/** One reading of CPU, memory and disk throughput.
 *
 * A plain GET the widget polls, rather than a stream. The reading itself
 * is microseconds -- os.cpus() and freemem() -- and the disk figure is
 * whatever the single background counter last reported, so a request does
 * no work beyond copying three numbers. Streaming would add a connection
 * to manage for no gain.
 *
 * Asking is also what keeps the disk counter alive: it starts on the
 * first request and shuts down when they stop arriving. */
router.get('/', (req, res) => {
  try {
    res.json(readResources());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
