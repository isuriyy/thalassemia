// ThalaPredict — Seed Script (matches exact Prediction.js model)
// Run from: C:\Users\Isuri\thalassemia\backend
// Command:   node seed.js

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name: String, email: { type: String, unique: true },
  password: String, role: { type: String, default: 'clinician' },
  createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', UserSchema);

const PredictionSchema = new mongoose.Schema({
  clinicianId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  patientId:   { type: String, default: 'Anonymous' },
  age: { type: Number }, sex: { type: String, enum: ['Male', 'Female', 'Other'] },
  cbcParams: { MCV: Number, MCH: Number, HBG: Number, RBC: Number },
  derivedFeatures: { england_fraser: Number, green_king: Number, hbg_mcv_ratio: Number, hbg_mch_ratio: Number, srivastava: Number, flag_gk: Number },
  supplementaryIndices: { mentzer: Number, shine_lal: Number, hbg_rbc_ratio: Number },
  prediction: { type: Number, enum: [0, 1] },
  label: { type: String },
  carrier_probability: { type: Number },
  referral_recommended: { type: Boolean },
  confidence: { type: String },
  clinical_note: { type: String },
  createdAt: { type: Date, default: Date.now }
});
const Prediction = mongoose.model('Prediction', PredictionSchema);

function rand(min, max, dp = 1) { return parseFloat((Math.random() * (max - min) + min).toFixed(dp)); }

function carrierRecord(clinicianId, patientId, daysAgo) {
  const MCV = rand(55, 72), MCH = rand(17, 24), HBG = rand(9.5, 13.0), RBC = rand(3.2, 4.8, 2);
  const prob = rand(0.52, 0.94, 2);
  const green_king = parseFloat((MCV * MCV * MCH / 100).toFixed(2));
  return {
    clinicianId, patientId,
    age: Math.floor(rand(18, 55)), sex: Math.random() > 0.5 ? 'Male' : 'Female',
    cbcParams: { MCV, MCH, HBG, RBC },
    derivedFeatures: { england_fraser: parseFloat((MCV - MCH - 3.4 * HBG).toFixed(2)), green_king, hbg_mcv_ratio: parseFloat((HBG/MCV).toFixed(3)), hbg_mch_ratio: parseFloat((HBG/MCH).toFixed(3)), srivastava: parseFloat((MCH/MCV*100).toFixed(2)), flag_gk: green_king < 65 ? 1 : 0 },
    supplementaryIndices: { mentzer: parseFloat((MCV/RBC).toFixed(2)), shine_lal: parseFloat((MCV*MCV*MCH/100).toFixed(2)), hbg_rbc_ratio: parseFloat((HBG/RBC).toFixed(2)) },
    prediction: 1, label: 'Carrier', carrier_probability: prob,
    referral_recommended: true, confidence: prob > 0.80 ? 'High' : 'Moderate',
    clinical_note: 'Haematological indices suggest β-thalassemia carrier status. Recommend Hb electrophoresis and genetic counselling.',
    createdAt: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)
  };
}

function nonCarrierRecord(clinicianId, patientId, daysAgo) {
  const MCV = rand(78, 98), MCH = rand(26, 34), HBG = rand(12.5, 16.5), RBC = rand(4.2, 5.8, 2);
  const prob = rand(0.08, 0.46, 2);
  const green_king = parseFloat((MCV * MCV * MCH / 100).toFixed(2));
  return {
    clinicianId, patientId,
    age: Math.floor(rand(18, 65)), sex: Math.random() > 0.5 ? 'Male' : 'Female',
    cbcParams: { MCV, MCH, HBG, RBC },
    derivedFeatures: { england_fraser: parseFloat((MCV - MCH - 3.4 * HBG).toFixed(2)), green_king, hbg_mcv_ratio: parseFloat((HBG/MCV).toFixed(3)), hbg_mch_ratio: parseFloat((HBG/MCH).toFixed(3)), srivastava: parseFloat((MCH/MCV*100).toFixed(2)), flag_gk: green_king < 65 ? 1 : 0 },
    supplementaryIndices: { mentzer: parseFloat((MCV/RBC).toFixed(2)), shine_lal: parseFloat((MCV*MCV*MCH/100).toFixed(2)), hbg_rbc_ratio: parseFloat((HBG/RBC).toFixed(2)) },
    prediction: 0, label: 'Non-Carrier', carrier_probability: prob,
    referral_recommended: false, confidence: prob < 0.20 ? 'High' : 'Moderate',
    clinical_note: 'CBC indices within normal range. No evidence of thalassemia carrier status.',
    createdAt: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)
  };
}

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ MongoDB connected');
  const email = 'test@thalademo.com', password = 'Test1234!';
  await User.deleteOne({ email });
  const user = await User.create({ name: 'Dr. Isuri (Demo)', email, password: await bcrypt.hash(password, 10) });
  console.log(`✅ Demo user  →  ${email}  /  ${password}`);
  await Prediction.deleteMany({ clinicianId: user._id });
  const records = [];
  let n = 1;
  const carrierDays    = [1,3,5,7,10,13,16,20,24,28,33,40,50,58];
  const nonCarrierDays = [2,4,6,8,9,11,12,14,15,17,18,19,21,22,23,25,26,27,29,30,35,38,42,45,52,56];
  for (const d of carrierDays)    records.push(carrierRecord(user._id,    `PT-${String(n++).padStart(3,'0')}`, d));
  for (const d of nonCarrierDays) records.push(nonCarrierRecord(user._id, `PT-${String(n++).padStart(3,'0')}`, d));
  await Prediction.insertMany(records);
  console.log(`✅ ${records.length} predictions inserted (${carrierDays.length} carriers, ${nonCarrierDays.length} non-carriers)`);
  console.log('\n Email    : test@thalademo.com');
  console.log(' Password : Test1234!\n');
  await mongoose.disconnect();
  console.log('✅ Done');
}
seed().catch(e => { console.error(e); process.exit(1); });
