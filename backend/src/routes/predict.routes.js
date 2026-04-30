const express    = require('express');
const axios      = require('axios');
const protect    = require('../middleware/auth');
const Prediction = require('../models/Prediction');
const router     = express.Router();

// GET /api/predict/health — proxy check to Python ML API
router.get('/health', async (req, res) => {
    try {
        const start = Date.now();
        const { data } = await axios.get(
            `${process.env.PYTHON_API_URL}/health`,
            { timeout: 6000 }
        );
        res.json({ ok: true, latency: Date.now() - start, ...data });
    } catch (error) {
        res.status(503).json({
            ok: false,
            message: 'Python API unreachable — ensure uvicorn is running on port 5001'
        });
    }
});

// POST /api/predict — single patient
router.post('/', protect, async (req, res) => {
    try {
        const { patientId, age, sex, mcv, mch, hbg, rbc } = req.body;

        if (!mcv || !mch || !hbg || !age) {
            return res.status(400).json({
                message: 'Age, MCV, MCH and HBG are required'
            });
        }

        const mlPayload = { age, mcv, mch, hbg };
        if (rbc) mlPayload.rbc = rbc;

        const mlResponse = await axios.post(
            `${process.env.PYTHON_API_URL}/predict`,
            mlPayload,
            { timeout: 10000 }
        );

        const result = mlResponse.data;

        const record = await Prediction.create({
            clinicianId:          req.clinician._id,
            patientId:            patientId || 'Anonymous',
            age, sex,
            cbcParams:            { MCV: mcv, MCH: mch, HBG: hbg, RBC: rbc },
            derivedFeatures:      result.derived_features,
            supplementaryIndices: result.supplementary_indices,
            prediction:           result.prediction,
            label:                result.label,
            carrier_probability:  result.carrier_probability,
            referral_recommended: result.referral_recommended,
            confidence:           result.confidence,
            clinical_note:        result.clinical_note,
        });

        res.json({ ...result, recordId: record._id });

    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            return res.status(503).json({
                message: 'ML service unavailable — ensure Python API is running on port 5001'
            });
        }
        if (error.code === 'ECONNABORTED') {
            return res.status(504).json({ message: 'ML service timeout' });
        }
        res.status(500).json({ message: error.message });
    }
});

// POST /api/predict/batch — multiple patients
router.post('/batch', protect, async (req, res) => {
    try {
        const patients = req.body;

        if (!Array.isArray(patients) || patients.length === 0) {
            return res.status(400).json({ message: 'Array of patients required' });
        }
        if (patients.length > 500) {
            return res.status(400).json({ message: 'Maximum 500 patients per batch' });
        }

        const results = [];
        for (const p of patients) {
            try {
                const mlPayload = { age: p.age, mcv: p.mcv, mch: p.mch, hbg: p.hbg };
                if (p.rbc) mlPayload.rbc = p.rbc;

                const { data } = await axios.post(
                    `${process.env.PYTHON_API_URL}/predict`,
                    mlPayload,
                    { timeout: 10000 }
                );

                await Prediction.create({
                    clinicianId:          req.clinician._id,
                    patientId:            p.patientId || 'Batch',
                    age: p.age,
                    sex: p.sex ? p.sex.charAt(0).toUpperCase() + p.sex.slice(1).toLowerCase() : undefined,
                    cbcParams:            { MCV: p.mcv, MCH: p.mch, HBG: p.hbg, RBC: p.rbc },
                    prediction:           data.prediction,
                    label:                data.label,
                    carrier_probability:  data.carrier_probability,
                    referral_recommended: data.referral_recommended,
                    confidence:           data.confidence,
                    clinical_note:        data.clinical_note,
                });

                results.push({ ...data, patientId: p.patientId || 'Batch', status: 'ok' });

            } catch (innerErr) {
                console.error('Batch patient error:', innerErr.message);
                results.push({
                    patientId: p.patientId || 'Unknown',
                    status: 'error',
                    prediction: null,
                    error: innerErr.message
                });
            }
        }

        res.json({ total: results.length, results });

    } catch (err) {
        console.error('Batch route error:', err.message);
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
