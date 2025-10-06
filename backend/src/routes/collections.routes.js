import express from 'express';
import WasteBin from '../models/WasteBin.js';
import CollectionRecord from '../models/CollectionRecord.js';
import PickupRequest from '../models/PickupRequest.js';
import Transaction from '../models/Transaction.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
const haversineDistanceMeters = (a, b) => {
  if (!a || !b || typeof a.latitude !== 'number' || typeof a.longitude !== 'number' || typeof b.latitude !== 'number' || typeof b.longitude !== 'number') {
    return null;
  }
  const toRad = (value) => (value * Math.PI) / 180;
  const R = 6371000; // meters
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const aCalc = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  const c = 2 * Math.atan2(Math.sqrt(aCalc), Math.sqrt(1 - aCalc));
  return Math.round(R * c);
};
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
    const { binId, weight, clientReference, timestamp, location } = req.body;
    if (!binId || typeof weight !== 'number') {
      return res.status(400).json({ message: 'binId and numeric weight are required' });
    }
    const bin = await WasteBin.findOne({ binId });
    if (!bin) return res.status(404).json({ message: 'Bin not found' });
    if (clientReference) {
      const existing = await CollectionRecord.findOne({ clientReference });
      if (existing) {
        return res.status(200).json({ message: 'Collection already synced', record: existing, duplicate: true });
      }
    }
    let distanceFromBin = null;
    const sanitizedLocation = location && typeof location === 'object'
      ? {
          latitude: typeof location.latitude === 'number' ? location.latitude : undefined,
          longitude: typeof location.longitude === 'number' ? location.longitude : undefined,
          accuracy: typeof location.accuracy === 'number' ? location.accuracy : undefined,
          capturedAt: location.capturedAt ? new Date(location.capturedAt) : new Date()
        }
      : null;
    const hasCoordinates = Boolean(
      sanitizedLocation &&
        sanitizedLocation.latitude != null &&
        sanitizedLocation.longitude != null
    );
    if (hasCoordinates) {
      const binCoords = bin.geoLocation?.latitude != null && bin.geoLocation?.longitude != null
        ? { latitude: bin.geoLocation.latitude, longitude: bin.geoLocation.longitude }
        : null;
      if (binCoords) {
        distanceFromBin = haversineDistanceMeters(sanitizedLocation, binCoords);
        const threshold = Math.max(50, (sanitizedLocation.accuracy || 0) * 2);
        if (distanceFromBin != null && distanceFromBin > threshold) {
          return res.status(422).json({
            message: 'Device location does not match the bin coordinates. Please verify before submitting.',
            distanceFromBin
          });
        }
      } else if (sanitizedLocation.accuracy && sanitizedLocation.accuracy <= 75) {
        bin.geoLocation = {
          latitude: sanitizedLocation.latitude,
          longitude: sanitizedLocation.longitude,
          accuracy: sanitizedLocation.accuracy,
          updatedAt: new Date()
        };
      }
    }
    const record = await CollectionRecord.create({
      bin: bin._id,
      collectedBy: req.user._id,
      weight,
      timestamp: timestamp ? new Date(timestamp) : undefined,
      location: hasCoordinates ? sanitizedLocation : undefined,
      distanceFromBin: distanceFromBin || undefined,
      clientReference
    });
    // reset fill level (simplified)
    bin.currentLevel = 0;
    if (bin.isModified('geoLocation')) {
      bin.geoLocation.updatedAt = bin.geoLocation.updatedAt || new Date();
      bin.markModified('geoLocation');
    }
    await bin.save();
    res.status(201).json({ message: 'Collection recorded', record, distanceFromBin });
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
    const [results, totals, typeBreakdown, collectorBreakdown, binHotspots, pickupSummary, transactionSummary] = await Promise.all([
      CollectionRecord.aggregate(pipeline),
      CollectionRecord.aggregate([
        { $match: { timestamp: { $gte: since } } },
        {
          $group: {
            _id: null,
            totalWeight: { $sum: '$weight' },
            totalCollections: { $sum: 1 }
          }
        }
      ]),
      CollectionRecord.aggregate([
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
            _id: '$bin.type',
            totalWeight: { $sum: '$weight' },
            count: { $sum: 1 }
          }
        },
        { $sort: { totalWeight: -1 } }
      ]),
      CollectionRecord.aggregate([
        { $match: { timestamp: { $gte: since } } },
        {
          $group: {
            _id: '$collectedBy',
            totalWeight: { $sum: '$weight' },
            count: { $sum: 1 },
            lastCollection: { $max: '$timestamp' }
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user'
          }
        },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            userId: '$_id',
            username: '$user.username',
            role: '$user.role',
            totalWeight: 1,
            count: 1,
            lastCollection: 1
          }
        },
        { $sort: { totalWeight: -1 } }
      ]),
      CollectionRecord.aggregate([
        { $match: { timestamp: { $gte: since } } },
        {
          $group: {
            _id: '$bin',
            totalWeight: { $sum: '$weight' },
            count: { $sum: 1 },
            lastCollection: { $max: '$timestamp' },
            avgDistance: { $avg: '$distanceFromBin' }
          }
        },
        {
          $lookup: {
            from: 'wastebins',
            localField: '_id',
            foreignField: '_id',
            as: 'bin'
          }
        },
        { $unwind: { path: '$bin', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            binId: '$bin.binId',
            location: '$bin.location',
            geoLocation: '$bin.geoLocation',
            totalWeight: 1,
            count: 1,
            lastCollection: 1,
            avgDistance: 1
          }
        },
        { $sort: { totalWeight: -1 } },
        { $limit: 12 }
      ]),
      PickupRequest.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),
      Transaction.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: '$status',
            totalAmount: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        }
      ])
    ]);
    const bins = await WasteBin.find({}).lean();
    const fillLevelInsights = {
      averageFill: bins.length ? Number((bins.reduce((sum, binDoc) => sum + (binDoc.currentLevel || 0), 0) / bins.length).toFixed(1)) : 0,
      criticalBins: bins.filter((binDoc) => (binDoc.currentLevel || 0) >= 80).map((binDoc) => ({
        binId: binDoc.binId,
        location: binDoc.location,
        currentLevel: binDoc.currentLevel,
        geoLocation: binDoc.geoLocation
      }))
    };
    res.json({
      since: since.toISOString().slice(0, 10),
      days,
      totals: totals[0] || { totalWeight: 0, totalCollections: 0 },
      series: results,
      breakdown: {
        byType: typeBreakdown,
        byCollector: collectorBreakdown,
        byBin: binHotspots
      },
      pickups: pickupSummary,
      transactions: transactionSummary,
      fillLevelInsights
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});
export default router;