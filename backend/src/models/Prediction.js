const mongoose = require('mongoose');

const PredictionSchema = new mongoose.Schema({
    clinicianId: {
        type:     mongoose.Schema.Types.ObjectId,
        ref:      'User',
        required: true
    },
    patientId: { type: String, default: 'Anonymous' },
    age:       { type: Number },
    sex:       { type: String, enum: ['Male', 'Female', 'Other'] },

    cbcParams: {
        MCV: Number,
        MCH: Number,
        HBG: Number,
        RBC: Number
    },

    derivedFeatures: {
        england_fraser: Number,
        green_king:     Number,
        hbg_mcv_ratio:  Number,
        hbg_mch_ratio:  Number,
        srivastava:     Number,
        flag_gk:        Number
    },

    supplementaryIndices: {
        mentzer:       Number,
        shine_lal:     Number,
        hbg_rbc_ratio: Number
    },

    prediction:           { type: Number, enum: [0, 1] },
    label:                { type: String },
    carrier_probability:  { type: Number },
    referral_recommended: { type: Boolean },
    confidence:           { type: String },
    clinical_note:        { type: String },

    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Prediction', PredictionSchema);
