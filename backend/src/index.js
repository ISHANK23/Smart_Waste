import express from 'express';
import cors from 'cors';
import connectDB from './config/db.js';
import config from './config/env.js';
import authRoutes from './routes/auth.routes.js';
import binsRoutes from './routes/bins.routes.js';
import collectionsRoutes from './routes/collections.routes.js';
import pickupsRoutes from './routes/pickups.routes.js';
import transactionsRoutes from './routes/transactions.routes.js';
import syncRoutes from './routes/sync.routes.js';
const app = express();
await connectDB(config.database.uri, { debug: config.database.debug });
app.use(express.json());
const allowedOrigins = config.server.corsOrigins;
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return cb(null, true);
      }
      return cb(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
  }),
);
app.get('/health', (_req, res) => res.json({ ok: true, env: config.env }));
app.use('/api/auth', authRoutes);
app.use('/api/bins', binsRoutes);
app.use('/api/collections', collectionsRoutes);
app.use('/api/pickups', pickupsRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/sync', syncRoutes);
app.use((req, res) => res.status(404).json({ message: 'Not Found' }));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: err.message || 'Server error' });
});
const PORT = config.server.port;
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT} (${config.env})`));
