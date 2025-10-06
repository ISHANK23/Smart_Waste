import express from 'express';
import Transaction from '../models/Transaction.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
const router = express.Router();
/**
 * POST /api/transactions/pay
 * body: { type: 'payment'|'payback', amount }
 * NOTE: Mock payment processor — marks as 'paid' immediately.
 */
router.post('/pay', requireAuth, async (req, res) => {
  try {
    const { type = 'payment', amount, clientReference } = req.body;
    if (!['payment', 'payback'].includes(type)) {
      return res.status(400).json({ message: 'Invalid type' });
    }
    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ message: 'amount must be a positive number' });
    }
    if (clientReference) {
      const existing = await Transaction.findOne({ clientReference });
      if (existing) {
        return res.status(200).json({ message: 'Payment already processed', transaction: existing });
      }
    }
    const tx = await Transaction.create({
      user: req.user._id,
      type,
      amount,
      status: 'paid', // pretend success
      clientReference
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
router.patch('/bulk', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { ids, status } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'ids array is required' });
    }
    if (!['pending', 'paid', 'failed'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    const result = await Transaction.updateMany({ _id: { $in: ids } }, { $set: { status } });
    const updated = await Transaction.find({ _id: { $in: ids } })
      .populate('user', 'username role')
      .sort({ updatedAt: -1 });
    res.json({ modifiedCount: result.modifiedCount, updated });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});
export default router;