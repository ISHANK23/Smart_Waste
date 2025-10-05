import express from 'express';
import WasteBin from '../models/WasteBin.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/bins
 * - residents: only their bins
 * - staff/admin: all bins (optional query filters later)
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const role = req.user.role;
    let filter = {};
    if (role === 'resident') {
      filter.owner = req.user._id;
    }
    const bins = await WasteBin.find(filter).populate('owner', 'username role');
    res.json(bins);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

/**
 * (Optional helper for admins to add bins)
 * POST /api/bins  (admin only)
 */
router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { binId, type, location, currentLevel, owner } = req.body;
    const exists = await WasteBin.findOne({ binId });
    if (exists) return res.status(409).json({ message: 'binId already exists' });
    const bin = await WasteBin.create({ binId, type, location, currentLevel, owner });
    res.status(201).json(bin);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

export default router;
