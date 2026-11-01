import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
import express from 'express';
import cors from 'cors';
import { initDb } from './db/db.js';
import { startOverdueCronJob } from './jobs/overdueCheck.js';

// Route imports
import authRoutes from './routes/auth.js';
import patientRoutes from './routes/patients.js';
import checkinRoutes from './routes/checkins.js';
import flagRoutes from './routes/flags.js';
import escalationRoutes from './routes/escalations.js';
import scheduleRoutes from './routes/schedules.js';
import auditRoutes from './routes/audit.js';
import messageRoutes from './routes/messages.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Public health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'Swasthya Sense API',
    disclaimer: 'Prototype only — never diagnoses, prescribes, or gives medical treatment advice.',
    timestamp: new Date().toISOString()
  });
});

// Ensure DB and background jobs are initialized; requests wait if needed
let dbReadyPromise = null;

function ensureDb() {
  if (!dbReadyPromise) {
    dbReadyPromise = initDb()
      .then(() => {
        startOverdueCronJob();
        return true;
      })
      .catch((err) => {
        console.error('Failed to initialize database:', err);
        dbReadyPromise = null; // allow retry on next request
        throw err;
      });
  }
  return dbReadyPromise;
}

// Middleware: ensure database is initialized before serving API routes (except /health)
app.use(async (req, res, next) => {
  if (req.path === '/api/health') return next();
  try {
    await ensureDb();
    next();
  } catch (err) {
    res.status(503).json({ error: 'Database service is initializing. Please retry in a moment.' });
  }
});

// Mount application API modules
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/checkins', checkinRoutes);
app.use('/api/flags', flagRoutes);
app.use('/api/escalations', escalationRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/messages', messageRoutes);

// Serve compiled frontend in production if client/dist exists
const clientDistPath = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDistPath)) {
  console.log(`[Production] Serving static client build from ${clientDistPath}`);
  app.use(express.static(clientDistPath));

  // SPA fallback for all non-API GET requests
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'Endpoint not found' });
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Start listening immediately so port 4000 is open without socket drops
if (process.env.NODE_ENV !== 'test') {
  ensureDb().catch(() => {});

  app.listen(PORT, () => {
    console.log(`Swasthya Sense API listening on port ${PORT}`);
  });
}

export default app;
