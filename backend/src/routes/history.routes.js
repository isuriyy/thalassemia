const express    = require('express');
const protect    = require('../middleware/auth');
const Prediction = require('../models/Prediction');
const router     = express.Router();

const VALID_OUTCOMES = ['Pending', 'Confirmed Carrier', 'Not Confirmed', 'Lost to Follow-up'];

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

        res.json({ total, carriers, nonCarriers, referrals,
            carrierRate: total > 0 ? parseFloat(((carriers / total) * 100).toFixed(1)) : 0,
            trend
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET /api/history/analytics/age
router.get('/analytics/age', protect, async (req, res) => {
    try {
        const clinicianId = req.clinician._id;
        const data = await Prediction.aggregate([
            { $match: { clinicianId, age: { $exists: true, $ne: null } } },
            { $bucket: {
                groupBy: '$age',
                boundaries: [0, 10, 20, 30, 40, 50, 60, 70, 100],
                default: 'Other',
                output: {
                    total:    { $sum: 1 },
                    carriers: { $sum: { $cond: [{ $eq: ['$prediction', 1] }, 1, 0] } }
                }
            }},
            { $project: {
                range: { $switch: { branches: [
                    { case: { $eq: ['$_id', 0]  }, then: '<10'   },
                    { case: { $eq: ['$_id', 10] }, then: '10–19' },
                    { case: { $eq: ['$_id', 20] }, then: '20–29' },
                    { case: { $eq: ['$_id', 30] }, then: '30–39' },
                    { case: { $eq: ['$_id', 40] }, then: '40–49' },
                    { case: { $eq: ['$_id', 50] }, then: '50–59' },
                    { case: { $eq: ['$_id', 60] }, then: '60–69' },
                    { case: { $eq: ['$_id', 70] }, then: '70+'   },
                ], default: 'Other' }},
                total: 1, carriers: 1
            }}
        ]);
        res.json(data);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET /api/history/analytics/sex
router.get('/analytics/sex', protect, async (req, res) => {
    try {
        const clinicianId = req.clinician._id;
        const data = await Prediction.aggregate([
            { $match: { clinicianId } },
            { $group: {
                _id:      '$sex',
                total:    { $sum: 1 },
                carriers: { $sum: { $cond: [{ $eq: ['$prediction', 1] }, 1, 0] } }
            }},
            { $project: { sex: { $ifNull: ['$_id', 'Unknown'] }, total: 1, carriers: 1 } }
        ]);
        res.json(data);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// PATCH /api/history/:id/outcome — update follow-up outcome
router.patch('/:id/outcome', protect, async (req, res) => {
    try {
        const { outcome, outcomeNote } = req.body;

        if (!VALID_OUTCOMES.includes(outcome)) {
            return res.status(400).json({
                message: `Invalid outcome. Must be one of: ${VALID_OUTCOMES.join(', ')}`
            });
        }

        const record = await Prediction.findOneAndUpdate(
            { _id: req.params.id, clinicianId: req.clinician._id },
            {
                outcome,
                outcomeNote:   outcomeNote || '',
                outcomeUpdatedAt: new Date(),
            },
            { new: true }
        );

        if (!record) {
            return res.status(404).json({ message: 'Record not found' });
        }

        res.json({ success: true, outcome: record.outcome, outcomeNote: record.outcomeNote });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
