import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import programsRoutes from './routes/programs.js';
import uninstallRoutes from './routes/uninstall.js';
import leftoversRoutes from './routes/leftovers.js';

const PORT = process.env.UNREVO_BACKEND_PORT || 3101;

// A rejection escaping every route's own try/catch would otherwise crash
// the whole process — this is loaded in-process inside Electron's main
// process (see electron/main.cjs), so a crash here takes the whole app
// down, not just a request.
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/programs', programsRoutes);
app.use('/api/uninstall', uninstallRoutes);
app.use('/api/leftovers', leftoversRoutes);

const server = createServer(app);
server.listen(PORT, '127.0.0.1', () => {
  console.log(`unrevo backend listening on http://127.0.0.1:${PORT}`);
});