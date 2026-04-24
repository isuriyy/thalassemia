const express    = require('express');
const protect    = require('../middleware/auth');
const Prediction = require('../models/Prediction');
const router     = express.Router();

// GET /api/history
router.get('/', protect, async (req, res) => {
    try {
        const page  = parseInt(req.query.page)  || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip  = (page - 1) * limit;

        const [records, total] = await Promise.all([
            Prediction.find({ clinicianId: req.clinician._id })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .select('-__v'),
            Prediction.countDocuments({ clinicianId: req.clinician._id })
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

        const [total, carriers, nonCarriers] = await Promise.all([
            Prediction.countDocuments({ clinicianId }),
            Prediction.countDocuments({ clinicianId, prediction: 1 }),
            Prediction.countDocuments({ clinicianId, prediction: 0 })
        ]);

        res.json({
            total,
            carriers,
            nonCarriers,
            carrierRate: total > 0 ? ((carriers / total) * 100).toFixed(1) : 0
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
