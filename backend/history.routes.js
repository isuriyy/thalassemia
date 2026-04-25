const express    = require('express');
const protect    = require('../middleware/auth');
const Prediction = require('../models/Prediction');
const router     = express.Router();

// GET /api/history
router.get('/', protect, async (req, res) => {
    try {
        const page   = parseInt(req.query.page)   || 1;
        const limit  = parseInt(req.query.limit)  || 20;
        const skip   = (page - 1) * limit;
        const filter = { clinicianId: req.clinician._id };

        if (req.query.search) {
            filter.patientId = { $regex: req.query.search, $options: 'i' };
        }
        if (req.query.result === 'carriers')     filter.prediction = 1;
        if (req.query.result === 'non-carriers') filter.prediction = 0;
        if (req.query.result === 'referrals')    filter.referral_recommended = true;

        const [records, total] = await Promise.all([
            Prediction.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .select('-__v'),
            Prediction.countDocuments(filter)
        ]);

        res.json({
            records,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET /api/history/stats
router.get('/stats', protect, async (req, res) => {
    try {
        const clinicianId = req.clinician._id;

        const [total, carriers, nonCarriers, referrals] = await Promise.all([
            Prediction.countDocuments({ clinicianId }),
            Prediction.countDocuments({ clinicianId, prediction: 1 }),
            Prediction.countDocuments({ clinicianId, prediction: 0 }),
            Prediction.countDocuments({ clinicianId, referral_recommended: true })
        ]);

        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const trend = await Prediction.aggregate([
            { $match: { clinicianId, createdAt: { $gte: thirtyDaysAgo } } },
            { $group: {
                _id:      { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                total:    { $sum: 1 },
                carriers: { $sum: { $cond: [{ $eq: ['$prediction', 1] }, 1, 0] } }
            }},
            { $sort: { _id: 1 } },
            { $project: {
                date:        '$_id',
                total:       1,
                carriers:    1,
                carrierRate: { $cond: [{ $eq: ['$total', 0] }, 0,
                    { $multiply: [{ $divide: ['$carriers', '$total'] }, 100] }
                ]}
            }}
        ]);

        res.json({
            total,
            carriers,
            nonCarriers,
            referrals,
            carrierRate: total > 0 ? parseFloat(((carriers / total) * 100).toFixed(1)) : 0,
            trend
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
