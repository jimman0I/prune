import { Router } from 'express';
import { runSandboxTest } from '../services/sandboxTest.js';

const router = Router();

// 200 whether the sandbox test's own verdict is pass or fail -- the HTTP
// call succeeding just means the test RAN; `passed` in the body is the
// real verdict. Only a genuine server-side failure (the endpoint itself
// throwing outside runSandboxTest's own try/catch) is a 500.
router.post('/', async (req, res) => {
  try {
    res.json(await runSandboxTest());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
