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
    const { wasteType, description, scheduledDate } = req.body;
    if (!wasteType) return res.status(400).json({ message: 'wasteType required' });

    const pickup = await PickupRequest.create({
      user: req.user._id,
      wasteType,
      description,
      scheduledDate
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

export default router;
