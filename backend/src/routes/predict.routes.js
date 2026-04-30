const express    = require('express');
const axios      = require('axios');
const { v4: uuidv4 } = require('uuid');
const protect    = require('../middleware/auth');
const Prediction = require('../models/Prediction');
const router     = express.Router();

// GET /api/predict/health
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

// POST /api/predict/couple — screen two partners together
router.post('/couple', protect, async (req, res) => {
    try {
        const { partnerA, partnerB } = req.body;

        if (!partnerA || !partnerB) {
            return res.status(400).json({ message: 'Both partnerA and partnerB are required' });
        }

        const coupleScreeningId = uuidv4();

        // Run both predictions in parallel
        const [resA, resB] = await Promise.all([
            axios.post(`${process.env.PYTHON_API_URL}/predict`, {
                age: partnerA.age, mcv: partnerA.mcv,
                mch: partnerA.mch, hbg: partnerA.hbg,
                ...(partnerA.rbc ? { rbc: partnerA.rbc } : {})
            }, { timeout: 10000 }),
            axios.post(`${process.env.PYTHON_API_URL}/predict`, {
                age: partnerB.age, mcv: partnerB.mcv,
                mch: partnerB.mch, hbg: partnerB.hbg,
                ...(partnerB.rbc ? { rbc: partnerB.rbc } : {})
            }, { timeout: 10000 }),
        ]);

        const resultA = resA.data;
        const resultB = resB.data;

        // Save both records linked by coupleScreeningId
        const [recordA, recordB] = await Promise.all([
            Prediction.create({
                clinicianId:          req.clinician._id,
                patientId:            partnerA.patientId || 'Partner A',
                age: partnerA.age,    sex: partnerA.sex,
                district:             partnerA.district || null,
                isPregnant:           partnerA.isPregnant || false,
                familyHistory:        partnerA.familyHistory || false,
                coupleScreeningId,
                coupleRole:           'Partner A',
                cbcParams:            { MCV: partnerA.mcv, MCH: partnerA.mch, HBG: partnerA.hbg, RBC: partnerA.rbc },
                derivedFeatures:      resultA.derived_features,
                supplementaryIndices: resultA.supplementary_indices,
                prediction:           resultA.prediction,
                label:                resultA.label,
                carrier_probability:  resultA.carrier_probability,
                referral_recommended: resultA.referral_recommended,
                confidence:           resultA.confidence,
                clinical_note:        resultA.clinical_note,
            }),
            Prediction.create({
                clinicianId:          req.clinician._id,
                patientId:            partnerB.patientId || 'Partner B',
                age: partnerB.age,    sex: partnerB.sex,
                district:             partnerB.district || null,
                isPregnant:           partnerB.isPregnant || false,
                familyHistory:        partnerB.familyHistory || false,
                coupleScreeningId,
                coupleRole:           'Partner B',
                cbcParams:            { MCV: partnerB.mcv, MCH: partnerB.mch, HBG: partnerB.hbg, RBC: partnerB.rbc },
                derivedFeatures:      resultB.derived_features,
                supplementaryIndices: resultB.supplementary_indices,
                prediction:           resultB.prediction,
                label:                resultB.label,
                carrier_probability:  resultB.carrier_probability,
                referral_recommended: resultB.referral_recommended,
                confidence:           resultB.confidence,
                clinical_note:        resultB.clinical_note,
            }),
        ]);

        const bothCarriers  = resultA.prediction === 1 && resultB.prediction === 1;
        const oneCarrier    = resultA.prediction === 1 || resultB.prediction === 1;
        const childRisk     = bothCarriers ? 25 : oneCarrier ? 0 : 0;
        const carrierChildRisk = bothCarriers ? 50 : oneCarrier ? 50 : 0;

        res.json({
            coupleScreeningId,
            partnerA: { ...resultA, recordId: recordA._id },
            partnerB: { ...resultB, recordId: recordB._id },
            coupleRisk: {
                bothCarriers,
                oneCarrier,
                affectedChildRisk:  childRisk,
                carrierChildRisk,
                referralRecommended: bothCarriers,
                summary: bothCarriers
                    ? 'Both partners are carriers. Each pregnancy carries a 25% risk of an affected child and 50% risk of a carrier child. Urgent genetic counselling and prenatal diagnosis recommended.'
                    : oneCarrier
                    ? 'One partner is a carrier. Children have a 50% chance of being carriers but are not at risk of the disease. Genetic counselling advised.'
                    : 'Neither partner is identified as a carrier. Routine follow-up applies.',
            }
        });

    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            return res.status(503).json({ message: 'ML service unavailable' });
        }
        res.status(500).json({ message: error.message });
    }
});

// POST /api/predict — single patient
router.post('/', protect, async (req, res) => {
    try {
        const { patientId, age, sex, mcv, mch, hbg, rbc,
                district, isPregnant, familyHistory } = req.body;

        if (!mcv || !mch || !hbg || !age) {
            return res.status(400).json({ message: 'Age, MCV, MCH and HBG are required' });
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
            district:             district      || null,
            isPregnant:           isPregnant    || false,
            familyHistory:        familyHistory || false,
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
            return res.status(503).json({ message: 'ML service unavailable — ensure Python API is running on port 5001' });
        }
        if (error.code === 'ECONNABORTED') {
            return res.status(504).json({ message: 'ML service timeout' });
        }
        res.status(500).json({ message: error.message });
    }
});

// POST /api/predict/batch
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
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;