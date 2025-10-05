import express from 'express';
import Transaction from '../models/Transaction.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

/**
 * POST /api/transactions/pay
 * body: { type: 'payment'|'payback', amount }
 * NOTE: Mock payment processor — marks as 'paid' immediately.
 */
router.post('/pay', requireAuth, async (req, res) => {
  try {
    const { type, amount } = req.body;
    if (!['payment', 'payback'].includes(type)) {
      return res.status(400).json({ message: 'Invalid type' });
    }
    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ message: 'amount must be a positive number' });
    }

    const tx = await Transaction.create({
      user: req.user._id,
      type,
      amount,
      status: 'paid' // pretend success
    });

    res.status(201).json({ message: 'Payment processed (mock)', transaction: tx });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

/**
 * GET /api/transactions
 * - resident: only own
 * - staff/admin: all (optionally filter by user later)
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const role = req.user.role;
    const filter = role === 'resident' ? { user: req.user._id } : {};
    const txs = await Transaction.find(filter)
      .populate('user', 'username role')
      .sort({ createdAt: -1 });
    res.json(txs);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

export default router;
