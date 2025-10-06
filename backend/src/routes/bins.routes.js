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
    const { binId, type, location, currentLevel, owner, geoLocation } = req.body;
    const exists = await WasteBin.findOne({ binId });
    if (exists) return res.status(409).json({ message: 'binId already exists' });
    const bin = await WasteBin.create({ binId, type, location, currentLevel, owner, geoLocation });
    res.status(201).json(bin);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});
router.patch('/bulk', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { ids, currentLevel, owner, geoLocation } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'ids array is required' });
    }
    const update = {};
    const unset = {};
    if (typeof currentLevel === 'number') {
      update.currentLevel = Math.min(100, Math.max(0, currentLevel));
    }
    if (owner === null) {
      unset.owner = '';
    } else if (owner) {
      update.owner = owner;
    }
    if (geoLocation && typeof geoLocation === 'object') {
      update.geoLocation = {
        latitude: typeof geoLocation.latitude === 'number' ? geoLocation.latitude : undefined,
        longitude: typeof geoLocation.longitude === 'number' ? geoLocation.longitude : undefined,
        accuracy: typeof geoLocation.accuracy === 'number' ? geoLocation.accuracy : undefined,
        updatedAt: new Date()
      };
    }
    if (Object.keys(update).length === 0 && Object.keys(unset).length === 0) {
      return res.status(400).json({ message: 'No updates supplied' });
    }
    const updatePayload = {};
    if (Object.keys(update).length > 0) updatePayload.$set = update;
    if (Object.keys(unset).length > 0) updatePayload.$unset = unset;
    const result = await WasteBin.updateMany({ _id: { $in: ids } }, updatePayload);
    const updated = await WasteBin.find({ _id: { $in: ids } }).populate('owner', 'username role');
    res.json({ modifiedCount: result.modifiedCount, updated });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});
export default router;
