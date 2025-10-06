import express from 'express';
import WasteBin from '../models/WasteBin.js';
import PickupRequest from '../models/PickupRequest.js';
import Transaction from '../models/Transaction.js';
import CollectionRecord from '../models/CollectionRecord.js';
import { requireAuth } from '../middleware/auth.js';
const router = express.Router();
router.get('/updates', requireAuth, async (req, res) => {
  try {
    const sinceParam = req.query.since;
    const since = sinceParam ? new Date(sinceParam) : null;
    const baseFilter = since ? { updatedAt: { $gt: since } } : {};
    const binFilter = { ...baseFilter };
    const pickupFilter = { ...baseFilter };
    const transactionFilter = { ...baseFilter };
    const collectionFilter = since ? { $or: [{ updatedAt: { $gt: since } }, { createdAt: { $gt: since } }] } : {};
    if (req.user.role === 'resident') {
      binFilter.owner = req.user._id;
      pickupFilter.user = req.user._id;
      transactionFilter.user = req.user._id;
    }
    const [bins, pickups, transactions, collections] = await Promise.all([
      WasteBin.find(binFilter).lean(),
      PickupRequest.find(pickupFilter).lean(),
      Transaction.find(transactionFilter).lean(),
      CollectionRecord.find(collectionFilter).populate('bin collectedBy', 'binId username role').lean()
    ]);
    res.json({
      serverTime: new Date().toISOString(),
      bins,
      pickups,
      transactions,
      collections,
      since: sinceParam || null
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
export default router;