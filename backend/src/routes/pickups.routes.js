import express from 'express';
import PickupRequest from '../models/PickupRequest.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
const router = express.Router();
/**
 * POST /api/pickups (resident)
 * body: { wasteType, description?, scheduledDate? }
 */
router.post('/', requireAuth, requireRole('resident', 'admin', 'staff'), async (req, res) => {
  try {
    const { wasteType, description, scheduledDate, clientReference } = req.body;
    if (!wasteType) return res.status(400).json({ message: 'wasteType required' });
    if (clientReference) {
      const existing = await PickupRequest.findOne({ clientReference });
      if (existing) {
        return res.status(200).json(existing);
      }
    }
    const pickup = await PickupRequest.create({
      user: req.user._id,
      wasteType,
      description,
      scheduledDate,
      clientReference
    });
    res.status(201).json(pickup);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});
/**
 * GET /api/pickups
 * - resident: only own
 * - staff/admin: all
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const role = req.user.role;
    const filter = role === 'resident' ? { user: req.user._id } : {};
    const pickups = await PickupRequest.find(filter)
      .populate('user', 'username role')
      .sort({ createdAt: -1 });
    res.json(pickups);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});
router.patch('/bulk', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { ids, status, scheduledDate } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'ids array is required' });
    }
    const update = {};
    if (status) {
      if (!['pending', 'scheduled', 'completed', 'rejected'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
      }
      update.status = status;
    }
    if (scheduledDate) {
      const date = new Date(scheduledDate);
      if (Number.isNaN(date.getTime())) {
        return res.status(400).json({ message: 'Invalid scheduledDate' });
      }
      update.scheduledDate = date;
    }
    if (Object.keys(update).length === 0) {
      return res.status(400).json({ message: 'No updates supplied' });
    }
    const result = await PickupRequest.updateMany({ _id: { $in: ids } }, { $set: update });
    const updated = await PickupRequest.find({ _id: { $in: ids } })
      .populate('user', 'username role')
      .sort({ updatedAt: -1 });
    res.json({ modifiedCount: result.modifiedCount, updated });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});
export default router;