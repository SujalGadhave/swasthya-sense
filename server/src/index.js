import path from 'path';
import { fileURLToPath } from 'url';
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

// Mount application API modules
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/checkins', checkinRoutes);
app.use('/api/flags', flagRoutes);
app.use('/api/escalations', escalationRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/messages', messageRoutes);

// Server startup with DB initialization & background cron
async function startServer() {
  try {
    await initDb();
    startOverdueCronJob();

    app.listen(PORT, () => {
      console.log(`Swasthya Sense API listening on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to initialize server:', error);
    process.exit(1);
  }
}

// Start if executed directly
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export default app;
