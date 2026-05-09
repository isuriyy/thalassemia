import { useState, useCallback } from 'react';
import Layout from '../components/Layout';
import api from '../api/api';
import ProbabilityGauge from '../components/ProbabilityGauge';
import SHAPChart from '../components/SHAPChart';
import PDFButton from '../components/PDFButton';
import { generateReferralLetter } from '../components/generateReferralLetter';
import {
  useVoiceInput,
  parseSpokenValue,
  parseSpokenPatientDetails,
  parseSpokenFlags,
} from '../components/useVoiceInput';

const RANGES = {
  mcv: { min:40,  max:160, normal:[80, 100], unit:'fL' },
  mch: { min:10,  max:50,  normal:[27, 33],  unit:'pg' },
  hbg: { min:3,   max:25,  normal:[12, 17],  unit:'g/dL' },
  rbc: { min:1,   max:12,  normal:[4,  6],   unit:'×10¹²/L' },
};

const SL_DISTRICTS = [
  'Ampara','Anuradhapura','Badulla','Batticaloa',
  'Colombo','Galle','Gampaha','Hambantota',
  'Jaffna','Kalutara','Kandy','Kegalle',
  'Kilinochchi','Kurunegala','Mannar','Matale',
  'Matara','Monaragala','Mullaitivu','Nuwara Eliya',
  'Polonnaruwa','Puttalam','Ratnapura','Trincomalee',
  'Vavuniya'
];

const INIT = { patientId:'', age:'', sex:'Female', mcv:'', mch:'', hbg:'', rbc:'' };

function getRangeStatus(field, val) {
  if (!val) return null;
  const v = parseFloat(val);
  const r = RANGES[field];
  if (!r) return null;
  if (v < r.min || v > r.max) return 'invalid';
  if (v < r.normal[0]) return 'below';
  if (v > r.normal[1]) return 'above';
  return 'normal';
}

function speakResult(result, isCarrier) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const pct  = Math.round((result.carrier_probability || 0) * 100);
  const text = isCarrier
    ? `Carrier detected. Carrier probability ${pct} percent. Confidence ${result.confidence}. Referral is ${result.referral_recommended ? 'recommended' : 'not required'}.`
    : `Non-carrier. Carrier probability ${pct} percent. Confidence ${result.confidence}. No referral required.`;
  const utt   = new SpeechSynthesisUtterance(text);
  utt.lang    = 'en-US';
  utt.rate    = 0.92;
  utt.pitch   = 1;
  utt.volume  = 1;
  window.speechSynthesis.speak(utt);
}

export default function Screen() {
  const [form,          setForm]          = useState(INIT);
  const [result,        setResult]        = useState(null);
  const [error,         setError]         = useState('');
  const [loading,       setLoading]       = useState(false);
  const [district,      setDistrict]      = useState('');
  const [isPregnant,    setIsPregnant]    = useState(false);
  const [familyHistory, setFamilyHistory] = useState(false);
  const [refLoading,    setRefLoading]    = useState(false);
  const [refDone,       setRefDone]       = useState(false);
  const [speaking,      setSpeaking]      = useState(false);
  const [activeField,   setActiveField]   = useState(null);
  const [voiceHint,     setVoiceHint]     = useState('');

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    if (k === 'sex' && v === 'Male') setIsPregnant(false);
  };

  const isMale = form.sex === 'Male';

  const handleVoiceResult = useCallback((transcript, fieldHint) => {
    setVoiceHint(`Heard: "${transcript}"`);
    setTimeout(() => setVoiceHint(''), 3000);

    if (fieldHint === 'patient') {
      const d = parseSpokenPatientDetails(transcript);
      if (d.age) set('age', d.age);
      if (d.sex) set('sex', d.sex);
      return;
    }
    if (fieldHint === 'flags') {
      const f = parseSpokenFlags(transcript);
      if (f.isPregnant    !== undefined) setIsPregnant(f.isPregnant);
      if (f.familyHistory !== undefined) setFamilyHistory(f.familyHistory);
      return;
    }
    if (fieldHint === 'patientId') { set('patientId', transcript); return; }

    const parsed = parseSpokenValue(transcript, fieldHint);
    if (parsed !== null && !isNaN(parseFloat(parsed))) {
      set(fieldHint, parsed);
    } else {
      setVoiceHint(`Could not parse "${transcript}" for ${fieldHint.toUpperCase()} — try again`);
      setTimeout(() => setVoiceHint(''), 4000);
    }
  }, []);

  const { listening, supported, error: voiceError, startListening, stopListening } =
    useVoiceInput(handleVoiceResult);

  const startField = field => { setActiveField(field); startListening(field); };
  const stopField  = ()    => { stopListening(); setActiveField(null); };

  const submit = async e => {
    e.preventDefault();
    setLoading(true); setError(''); setResult(null);
    try {
      const payload = {
        patientId:     form.patientId || undefined,
        age:           parseFloat(form.age),
        sex:           form.sex,
        mcv:           parseFloat(form.mcv),
        mch:           parseFloat(form.mch),
        hbg:           parseFloat(form.hbg),
        district:      district || undefined,
        isPregnant:    isMale ? false : isPregnant,
        familyHistory,
      };
      if (form.rbc) payload.rbc = parseFloat(form.rbc);
      const { data } = await api.post('/predict', payload);
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Prediction failed');
    } finally { setLoading(false); }
  };

  const handleReferral = async () => {
    if (!result) return;
    setRefLoading(true); setRefDone(false);
    try {
      await generateReferralLetter({
        result, form, district,
        isPregnant: isMale ? false : isPregnant,
        familyHistory, clinicianName: 'Dr. Isuri',
      });
      setRefDone(true);
      setTimeout(() => setRefDone(false), 3000);
    } catch (err) { console.error('Referral PDF failed:', err); }
    finally { setRefLoading(false); }
  };

  const handleSpeak = () => {
    if (!result) return;
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; }
    setSpeaking(true);
    speakResult(result, isCarrier);
    const poll = setInterval(() => {
      if (!window.speechSynthesis.speaking) { setSpeaking(false); clearInterval(poll); }
    }, 300);
  };

  const isCarrier = result?.prediction === 1;

  return (
    <Layout>

      {/* ── Voice status bar ── */}
      {supported && (listening || voiceHint || voiceError) && (
        <div style={s.voiceBar}>
          {listening && (
            <span style={s.voiceLive}>
              <PulsingDot />
              Listening for {activeField === 'patient' ? 'patient details'
                : activeField === 'flags' ? 'clinical flags'
                : activeField?.toUpperCase() || 'input'}…
            </span>
          )}
          {voiceHint && !listening && <span style={s.voiceHintTxt}>✓ {voiceHint}</span>}
          {voiceError && <span style={s.voiceErrTxt}>⚠ {voiceError}</span>}
          {listening && (
            <button style={s.voiceStopBtn} onClick={stopField}>Stop</button>
          )}
        </div>
      )}

      <div style={s.twoCol}>

        {/* ── LEFT — FORM ── */}
        <div>
          <div style={s.card}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <div style={s.cardTitle}>Patient information</div>
              {supported && (
                <button type="button" style={s.micGroupBtn}
                  onClick={() => listening && activeField==='patient' ? stopField() : startField('patient')}
                  title="Say age and sex, e.g. 'thirty five female'">
                  <MicIcon active={listening && activeField==='patient'} />
                  <span style={{ fontSize:10, marginLeft:5 }}>
                    {listening && activeField==='patient' ? 'Stop' : 'Dictate patient'}
                  </span>
                </button>
              )}
            </div>

            <form onSubmit={submit}>
              <div style={s.grid2}>
                <VoiceField label="Patient ID" hint="optional" value={form.patientId}
                  onChange={v => set('patientId', v)}
                  field="patientId" supported={supported}
                  listening={listening && activeField==='patientId'}
                  onMic={() => listening && activeField==='patientId' ? stopField() : startField('patientId')} />
                <VoiceField label="Age (years)" type="number" value={form.age}
                  onChange={v => set('age', v)} required min="1" max="100"
                  field="age" supported={supported}
                  listening={listening && activeField==='age'}
                  onMic={() => listening && activeField==='age' ? stopField() : startField('age')} />
              </div>

              <div style={{ marginBottom:14 }}>
                <label style={s.label}>Sex *</label>
                <select style={s.select} value={form.sex} onChange={e => set('sex', e.target.value)}>
                  <option>Female</option>
                  <option>Male</option>
                </select>
              </div>

              <div style={{ marginBottom:14 }}>
                <label style={s.label}>District <span style={s.optHint}>(optional)</span></label>
                <select style={s.select} value={district} onChange={e => setDistrict(e.target.value)}>
                  <option value="">Select district</option>
                  {SL_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              {!isMale && (
                <div style={s.checkGroup}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <label style={s.checkLabel}>
                      <input type="checkbox" checked={isPregnant}
                        onChange={e => setIsPregnant(e.target.checked)} style={s.checkbox} />
                      <span style={s.checkText}>Pregnant patient</span>
                    </label>
                    {supported && (
                      <button type="button" style={s.micTiny}
                        onClick={() => listening && activeField==='flags' ? stopField() : startField('flags')}
                        title="Say 'pregnant' or 'family history'">
                        <MicIcon active={listening && activeField==='flags'} size={11} />
                      </button>
                    )}
                  </div>
                  {isPregnant && (
                    <div style={s.clinWarn}>
                      ⚠️ Antenatal patient — referral will be automatic per MOH guidelines
                    </div>
                  )}
                </div>
              )}

              <div style={{ ...s.checkGroup, marginBottom:14 }}>
                <label style={s.checkLabel}>
                  <input type="checkbox" checked={familyHistory}
                    onChange={e => setFamilyHistory(e.target.checked)} style={s.checkbox} />
                  <span style={s.checkText}>Family history of thalassemia</span>
                </label>
                {familyHistory && (
                  <div style={s.clinWarn}>
                    ⚠️ Family history is a significant clinical risk factor
                  </div>
                )}
              </div>

              <div style={{ ...s.cardTitle, marginTop:8, borderTop:'0.5px solid var(--border)', paddingTop:12 }}>
                CBC parameters <span style={{ fontWeight:400, color:'var(--text-3)', fontSize:11 }}>* required</span>
              </div>

              <div style={s.grid3}>
                {['mcv','mch','hbg'].map(f => (
                  <VoiceRangeField key={f} field={f} value={form[f]} onChange={v => set(f, v)}
                    supported={supported}
                    listening={listening && activeField===f}
                    onMic={() => listening && activeField===f ? stopField() : startField(f)} />
                ))}
              </div>

              <div style={{ fontSize:11, color:'var(--text-3)', margin:'8px 0 6px',
                borderTop:'0.5px solid var(--border)', paddingTop:8 }}>
                RBC (×10¹²/L) — optional · supplementary indices only
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr', gap:8 }}>
                <VoiceField field="rbc" label="RBC" hint="1.0–12.0" type="number"
                  value={form.rbc} onChange={v => set('rbc', v)}
                  supported={supported}
                  listening={listening && activeField==='rbc'}
                  onMic={() => listening && activeField==='rbc' ? stopField() : startField('rbc')}
                  extraStyle={{ border:'0.5px dashed var(--border)' }} />
              </div>

              {!supported && (
                <div style={s.noVoice}>
                  🎤 Voice input requires Chrome or Edge — not available in this browser
                </div>
              )}

              {error && <div style={s.err}>{error}</div>}
              <button style={s.primaryBtn} disabled={loading}>
                {loading ? 'Analysing…' : 'Run carrier screening'}
              </button>
            </form>
          </div>
        </div>

        {/* ── RIGHT — RESULT ── */}
        <div>
          <div style={s.card}>
            <div style={s.cardTitle}>Prediction result</div>
            {!result ? (
              <div style={s.empty}>Enter CBC values and click Run to see the prediction</div>
            ) : (
              <>
                <div style={isCarrier ? s.resultC : s.resultNC}>
                  <div style={isCarrier ? s.rlC : s.rlNC}>
                    {isCarrier ? 'Carrier detected' : 'Non-carrier'}
                  </div>
                  <div style={isCarrier ? s.rsC : s.rsNC}>{result.label}</div>
                  <div style={{ marginTop:6, display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ fontSize:11, color: isCarrier ? '#A32D2D' : '#0F6E56' }}>Confidence</span>
                    <span style={result.confidence==='High' ? s.confH : result.confidence==='Moderate' ? s.confM : s.confL}>
                      {result.confidence}
                    </span>
                  </div>
                </div>

                <ProbabilityGauge probability={result.carrier_probability} isCarrier={isCarrier} />

                <ProbBar label="Carrier probability"     value={result.carrier_probability}     color={isCarrier ? '#E24B4A' : '#d1d5db'} />
                <ProbBar label="Non-carrier probability" value={result.non_carrier_probability} color={!isCarrier ? '#1D9E75' : '#d1d5db'} />

                {result.referral_recommended && (
                  <div style={s.referral}>
                    Referral recommended — confirm with HbA2 via HPLC or
                    electrophoresis (HbA2 ≥ 3.5% = carrier)
                  </div>
                )}

                <div style={s.flagRow}>
                  {isPregnant && !isMale && <span style={s.flagAmber}>🤰 Antenatal — Auto Referral</span>}
                  {familyHistory && <span style={s.flagAmber}>⚠️ Family History</span>}
                  {district && <span style={s.flagNeutral}>📍 {district}</span>}
                </div>

                <div style={s.note}>{result.clinical_note}</div>

                {/* ── Read result aloud ── */}
                <button
                  style={{ ...s.speakBtn, ...(speaking ? s.speakBtnOn : {}) }}
                  onClick={handleSpeak}
                  title="Read prediction aloud"
                >
                  <SpeakerIcon active={speaking} />
                  {speaking ? 'Stop reading' : 'Read result aloud'}
                </button>

                <button style={s.printBtn} onClick={() => window.print()}>Print result</button>

                <PDFButton result={result} form={form} district={district}
                  isPregnant={isMale ? false : isPregnant}
                  familyHistory={familyHistory} clinicianName="Dr. Isuri" />

                {(result.referral_recommended || (isPregnant && !isMale)) && (
                  <button onClick={handleReferral} disabled={refLoading} style={{
                    width:'100%', padding:'9px 14px', marginTop:6,
                    background: refDone ? '#064E3B' : '#FFFBEB',
                    color:      refDone ? '#6EE7B7' : '#92400E',
                    border:     `0.5px solid ${refDone ? '#059669' : '#FAC775'}`,
                    borderRadius:8, fontSize:13,
                    cursor: refLoading ? 'wait' : 'pointer',
                    fontFamily:'inherit', display:'flex',
                    alignItems:'center', justifyContent:'center', gap:6,
                    opacity: refLoading ? 0.6 : 1, transition:'background 0.2s, color 0.2s',
                  }}>
                    {refLoading ? '⏳ Generating Referral…' : refDone ? '✓ Referral Letter Downloaded' : '📋 Download MOH Referral Letter'}
                  </button>
                )}
              </>
            )}
          </div>

          <div style={s.card}>
            <div style={s.cardTitle}>Derived hematological indices</div>
            {!result ? (
              <div style={{ ...s.empty, padding:'12px 0' }}>Awaiting input</div>
            ) : (
              <>
                <div style={s.idxGrid}>
                  {Object.entries(result.derived_features || {}).map(([k,v]) => (
                    <div key={k} style={s.idxCard}>
                      <div style={s.idxName}>{k.replace(/_/g,' ')}</div>
                      <div style={s.idxVal}>{typeof v==='number' ? v.toFixed(2) : v}</div>
                    </div>
                  ))}
                </div>
                {result.supplementary_indices && (
                  <>
                    <div style={{ fontSize:11, color:'var(--text-3)', margin:'8px 0 4px' }}>
                      Supplementary — RBC provided
                    </div>
                    <div style={s.idxGrid}>
                      {Object.entries(result.supplementary_indices).map(([k,v]) => (
                        <div key={k} style={{ ...s.idxCard, border:'0.5px dashed var(--border)' }}>
                          <div style={s.idxName}>{k.replace(/_/g,' ')}</div>
                          <div style={s.idxVal}>{typeof v==='number' ? v.toFixed(2) : v}</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {result && result.shap_contributions &&
            Object.keys(result.shap_contributions).length > 0 && (
            <div style={s.card}>
              <SHAPChart contributions={result.shap_contributions} isCarrier={isCarrier} />
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

// ── Icon components ────────────────────────────────────────────────────────────

function MicIcon({ active=false, size=13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={active ? '#E24B4A' : 'currentColor'} strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign:'middle', flexShrink:0 }}>
      {active && (
        <circle cx="12" cy="12" r="10" stroke="#E24B4A" strokeWidth="1" strokeOpacity="0.4" fill="none">
          <animate attributeName="r" from="8" to="11" dur="0.9s" repeatCount="indefinite" />
          <animate attributeName="stroke-opacity" from="0.6" to="0" dur="0.9s" repeatCount="indefinite" />
        </circle>
      )}
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"
        fill={active ? '#E24B4A' : 'none'} />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8"  y1="23" x2="16" y2="23" />
    </svg>
  );
}

function SpeakerIcon({ active=false }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke={active ? '#0F6E56' : 'currentColor'} strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"
      style={{ marginRight:6, verticalAlign:'middle' }}>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"
        fill={active ? '#1D9E75' : 'none'} stroke={active ? '#0F6E56' : 'currentColor'} />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      {active && <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />}
    </svg>
  );
}

function PulsingDot() {
  return (
    <>
      <style>{`@keyframes vp{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(1.5)}}`}</style>
      <span style={{
        display:'inline-block', width:8, height:8, borderRadius:'50%',
        background:'#E24B4A', marginRight:6, verticalAlign:'middle',
        animation:'vp 0.9s ease-in-out infinite',
      }} />
    </>
  );
}

// ── Field wrappers ─────────────────────────────────────────────────────────────

function VoiceField({ label, hint, value, onChange, type='text', required,
  extraStyle={}, field, supported, listening, onMic, ...rest }) {
  return (
    <div style={{ marginBottom:10 }}>
      <label style={s.label}>
        {label}{hint && <span style={{ color:'var(--text-3)', fontWeight:400 }}> ({hint})</span>}
      </label>
      <div style={{ display:'flex' }}>
        <input
          style={{ ...inp, ...extraStyle, borderRadius: supported ? '8px 0 0 8px' : 8, borderRight: supported ? 'none' : undefined }}
          type={type} value={value}
          onChange={e => onChange(e.target.value)}
          required={required} {...rest}
        />
        {supported && (
          <button type="button"
            style={{ ...s.micBtn, ...(listening ? s.micBtnOn : {}) }}
            onClick={onMic} title={`Dictate ${label}`}>
            <MicIcon active={listening} size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

function VoiceRangeField({ field, value, onChange, supported, listening, onMic }) {
  const r      = RANGES[field];
  const status = getRangeStatus(field, value);
  const labels = { mcv:'MCV (fL)', mch:'MCH (pg)', hbg:'HBG (g/dL)' };
  return (
    <div style={{ marginBottom:10 }}>
      <label style={s.label}>{labels[field]} *</label>
      <div style={{ fontSize:10, color:'var(--text-3)', marginBottom:3 }}>
        normal {r.normal[0]}–{r.normal[1]}
      </div>
      <div style={{ display:'flex' }}>
        <input
          style={{
            ...inp,
            borderRadius: supported ? '8px 0 0 8px' : 8,
            borderRight:  supported ? 'none' : undefined,
            ...(status==='below'||status==='above' ? { background:'#FFFBEB', borderColor:'#FAC775', color:'#1a1a1a', WebkitTextFillColor:'#1a1a1a' } : {}),
            ...(status==='invalid'                 ? { background:'#fef2f2', borderColor:'#fca5a5', color:'#1a1a1a', WebkitTextFillColor:'#1a1a1a' } : {}),
          }}
          type="number" value={value} step="0.1"
          min={r.min} max={r.max}
          onChange={e => onChange(e.target.value)} required
        />
        {supported && (
          <button type="button"
            style={{ ...s.micBtn, ...(listening ? s.micBtnOn : {}) }}
            onClick={onMic} title={`Dictate ${labels[field]}`}>
            <MicIcon active={listening} size={12} />
          </button>
        )}
      </div>
      {status==='below'   && <div style={s.warnTxt}>⚠ below normal range</div>}
      {status==='above'   && <div style={s.warnTxt}>⚠ above normal range</div>}
      {status==='invalid' && <div style={{ ...s.warnTxt, color:'#b91c1c' }}>✗ outside physiological range</div>}
    </div>
  );
}

function ProbBar({ label, value, color }) {
  return (
    <div style={{ marginTop:8 }}>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--text-2)', marginBottom:3 }}>
        <span>{label}</span><span>{Math.round(value*100)}%</span>
      </div>
      <div style={{ height:6, background:'var(--border)', borderRadius:3, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${value*100}%`, background:color, borderRadius:3, transition:'width 0.5s ease' }} />
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const inp = {
  flex:1, padding:'7px 10px', border:'0.5px solid var(--border)',
  borderRadius:8, fontSize:13, boxSizing:'border-box', outline:'none',
  background:'var(--bg-input)', color:'var(--text-primary)',
  WebkitTextFillColor:'var(--text-primary)', minWidth:0,
};

const s = {
  twoCol:       { display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 },
  card:         { background:'var(--bg-card)', border:'0.5px solid var(--border)', borderRadius:12, padding:'14px 16px', marginBottom:12 },
  cardTitle:    { fontSize:13, fontWeight:500, color:'var(--text-1)', marginBottom:0 },
  grid2:        { display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 },
  grid3:        { display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 },
  label:        { fontSize:12, color:'var(--text-2)', display:'block', marginBottom:4, fontWeight:500 },
  optHint:      { color:'var(--text-3)', fontWeight:400 },
  select:       { width:'100%', padding:'7px 10px', border:'0.5px solid var(--border)', borderRadius:8, fontSize:13, boxSizing:'border-box', background:'var(--bg-input)', color:'var(--text-1)' },

  // mic styles
  micBtn:       { padding:'0 9px', background:'var(--bg-input)', border:'0.5px solid var(--border)',
                  borderLeft:'none', borderRadius:'0 8px 8px 0', cursor:'pointer',
                  display:'flex', alignItems:'center', color:'var(--text-2)', flexShrink:0 },
  micBtnOn:     { background:'#FCEBEB', borderColor:'#F7C1C1', color:'#E24B4A' },
  micGroupBtn:  { display:'flex', alignItems:'center', padding:'4px 10px',
                  background:'var(--bg-input)', border:'0.5px solid var(--border)',
                  borderRadius:20, fontSize:11, cursor:'pointer',
                  color:'var(--text-2)', fontFamily:'inherit' },
  micTiny:      { background:'transparent', border:'none', cursor:'pointer',
                  padding:4, color:'var(--text-2)', display:'flex', alignItems:'center' },

  // voice status bar
  voiceBar:     { display:'flex', alignItems:'center', gap:10, padding:'7px 14px',
                  background:'var(--bg-card)', border:'0.5px solid var(--border)',
                  borderRadius:8, marginBottom:10, fontSize:12 },
  voiceLive:    { display:'flex', alignItems:'center', color:'#E24B4A', fontWeight:500 },
  voiceHintTxt: { color:'#0F6E56' },
  voiceErrTxt:  { color:'#A32D2D' },
  voiceStopBtn: { marginLeft:'auto', padding:'3px 10px', background:'#FCEBEB',
                  color:'#A32D2D', border:'0.5px solid #F7C1C1',
                  borderRadius:6, fontSize:11, cursor:'pointer', fontFamily:'inherit' },
  noVoice:      { fontSize:11, color:'var(--text-3)', background:'var(--bg-input)',
                  borderRadius:8, padding:'6px 10px', marginTop:8 },

  err:          { background:'#fef2f2', color:'#b91c1c', borderRadius:8, padding:'8px 12px', fontSize:12, margin:'8px 0' },
  primaryBtn:   { width:'100%', padding:10, background:'#1D9E75', color:'#fff', border:'none', borderRadius:8, fontSize:13, cursor:'pointer', marginTop:8, fontFamily:'inherit' },
  speakBtn:     { width:'100%', padding:'8px 14px', background:'var(--bg-input)',
                  color:'var(--text-2)', border:'0.5px solid var(--border)',
                  borderRadius:8, fontSize:12, cursor:'pointer', marginTop:8,
                  fontFamily:'inherit', display:'flex', alignItems:'center',
                  justifyContent:'center', transition:'background 0.2s' },
  speakBtnOn:   { background:'#E1F5EE', color:'#0F6E56', border:'0.5px solid #9FE1CB' },
  printBtn:     { width:'100%', padding:8, background:'#E1F5EE', color:'#0F6E56', border:'0.5px solid #9FE1CB', borderRadius:8, fontSize:12, cursor:'pointer', marginTop:6, fontFamily:'inherit' },
  empty:        { fontSize:13, color:'var(--text-3)', padding:'20px 0', textAlign:'center' },
  resultC:      { background:'#FCEBEB', border:'0.5px solid #F7C1C1', borderRadius:10, padding:'12px 14px' },
  resultNC:     { background:'#E1F5EE', border:'0.5px solid #9FE1CB', borderRadius:10, padding:'12px 14px' },
  rlC:          { fontSize:10, color:'#A32D2D', textTransform:'uppercase', letterSpacing:'0.06em' },
  rlNC:         { fontSize:10, color:'#0F6E56', textTransform:'uppercase', letterSpacing:'0.06em' },
  rsC:          { fontSize:18, fontWeight:500, color:'#791F1F', marginTop:3 },
  rsNC:         { fontSize:18, fontWeight:500, color:'#085041', marginTop:3 },
  confH:        { fontSize:11, padding:'2px 8px', borderRadius:20, background:'#E1F5EE', color:'#0F6E56' },
  confM:        { fontSize:11, padding:'2px 8px', borderRadius:20, background:'#FAEEDA', color:'#633806' },
  confL:        { fontSize:11, padding:'2px 8px', borderRadius:20, background:'#FCEBEB', color:'#A32D2D' },
  referral:     { background:'#FFFBEB', border:'0.5px solid #FAC775', borderRadius:8, padding:'8px 10px', marginTop:8, fontSize:11, color:'#633806', lineHeight:1.5 },
  note:         { background:'var(--bg-input)', borderRadius:8, padding:'8px 10px', marginTop:8, fontSize:11, color:'var(--text-2)', lineHeight:1.5 },
  flagRow:      { display:'flex', gap:8, flexWrap:'wrap', marginTop:10 },
  flagAmber:    { padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:500, background:'rgba(245,158,11,0.12)', color:'#92400E', border:'0.5px solid rgba(245,158,11,0.35)' },
  flagNeutral:  { padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:500, background:'rgba(99,102,241,0.1)', color:'#6366F1', border:'0.5px solid rgba(99,102,241,0.25)' },
  idxGrid:      { display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 },
  idxCard:      { background:'var(--bg-input)', borderRadius:8, padding:'8px 10px' },
  idxName:      { fontSize:10, color:'var(--text-2)' },
  idxVal:       { fontSize:14, fontWeight:500, color:'var(--text-1)', marginTop:2 },
  warnTxt:      { fontSize:10, color:'#854F0B', marginTop:2 },
  checkGroup:   { marginBottom:10, display:'flex', flexDirection:'column', gap:6 },
  checkLabel:   { display:'flex', alignItems:'center', gap:10, cursor:'pointer' },
  checkbox:     { width:15, height:15, accentColor:'#1D9E75', cursor:'pointer', flexShrink:0 },
  checkText:    { fontSize:13, color:'var(--text-1)' },
  clinWarn:     { fontSize:11, color:'#92400E', background:'rgba(245,158,11,0.1)', borderLeft:'3px solid #F59E0B', padding:'6px 10px', borderRadius:'0 4px 4px 0' },
};
