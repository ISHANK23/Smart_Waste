import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db.js';

import authRoutes from './routes/auth.routes.js';
import binsRoutes from './routes/bins.routes.js';
import collectionsRoutes from './routes/collections.routes.js';
import pickupsRoutes from './routes/pickups.routes.js';
import transactionsRoutes from './routes/transactions.routes.js';

dotenv.config();
const app = express();

// DB
await connectDB();

// Middleware
app.use(express.json());
const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'), false);
  },
  credentials: true
}));

// Health
app.get('/health', (_req, res) => res.json({ ok: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/bins', binsRoutes);
app.use('/api/collections', collectionsRoutes);
app.use('/api/pickups', pickupsRoutes);
app.use('/api/transactions', transactionsRoutes);

// 404
app.use((req, res) => res.status(404).json({ message: 'Not Found' }));

// Error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: err.message || 'Server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
