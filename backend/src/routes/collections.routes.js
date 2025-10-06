import express from 'express';
import WasteBin from '../models/WasteBin.js';
import CollectionRecord from '../models/CollectionRecord.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

/**
 * POST /api/collections/scan (staff only)
 * body: { binId, weight }
 * - Find bin by binId
 * - Create collection record with collectedBy=req.user
 * - Set bin.currentLevel = 0 (reset after collection) or decrease if you want
 */
router.post('/scan', requireAuth, requireRole('staff', 'admin'), async (req, res) => {
  try {
    const { binId, weight } = req.body;
    if (!binId || typeof weight !== 'number') {
      return res.status(400).json({ message: 'binId and numeric weight are required' });
    }
    const bin = await WasteBin.findOne({ binId });
    if (!bin) return res.status(404).json({ message: 'Bin not found' });

    const record = await CollectionRecord.create({
      bin: bin._id,
      collectedBy: req.user._id,
      weight
    });

    // reset fill level (simplified)
    bin.currentLevel = 0;
    await bin.save();

    res.status(201).json({ message: 'Collection recorded', record });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

/**
 * GET /api/collections/stats
 * - Optional query: ?days=7
 * Returns totals and simple timeseries aggregation
 */
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const days = Math.max(1, Math.min(90, parseInt(req.query.days || '7', 10)));
    const since = new Date();
    since.setDate(since.getDate() - days + 1);

    const pipeline = [
      { $match: { timestamp: { $gte: since } } },
      {
        $lookup: {
          from: 'wastebins',
          localField: 'bin',
          foreignField: '_id',
          as: 'bin'
        }
      },
      { $unwind: '$bin' },
      {
        $group: {
          _id: {
            day: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
            type: '$bin.type'
          },
          totalWeight: { $sum: '$weight' },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.day',
          byType: {
            $push: { type: '$_id.type', totalWeight: '$totalWeight', count: '$count' }
          },
          dayTotalWeight: { $sum: '$totalWeight' },
          dayCount: { $sum: '$count' }
        }
      },
      { $sort: { _id: 1 } }
    ];

    const results = await CollectionRecord.aggregate(pipeline);

    const totals = await CollectionRecord.aggregate([
      { $match: { timestamp: { $gte: since } } },
      {
        $group: {
          _id: null,
          totalWeight: { $sum: '$weight' },
          totalCollections: { $sum: 1 }
        }
      }
    ]);

    res.json({
      since: since.toISOString().slice(0, 10),
      days,
      totals: totals[0] || { totalWeight: 0, totalCollections: 0 },
      series: results
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

export default router;
