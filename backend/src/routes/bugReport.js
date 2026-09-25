import { Router } from 'express';
import { bugReportInfo, openBugReport } from '../services/bugReport.js';

/** /bug-report -- the "Report a bug" dialog's two calls.
 *
 * Prune sends nothing itself: opening the report means opening a prefilled
 * GitHub issue in the user's browser, where they see all of it before it
 * goes anywhere. */
const router = Router();

/** What the dialog lists under "what will be included" beside the user's
 * own text -- the same values the report's footer is built from. */
router.get('/info', (req, res) => {
  try {
    res.json(bugReportInfo());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Opens the prefilled issue.
 *
 * Takes a title and a description and nothing else. Any `url` in the body
 * is never read: an endpoint that opened whatever address it was sent would
 * be an "open anything in the browser" button for any code that can reach
 * this API, so the address is built here, on Prune's own repository only.
 * Input that cannot make a report is the caller's mistake, a 400. */
router.post('/open', async (req, res) => {
  const { title, description } = req.body ?? {};
  try {
    res.json(await openBugReport({ title, description }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
