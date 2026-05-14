import { useState, useCallback, useEffect } from 'react';
import Layout from '../components/Layout';
import api from '../api/api';
import ProbabilityGauge from '../components/ProbabilityGauge';
import SHAPChart from '../components/SHAPChart';
import PDFButton from '../components/PDFButton';
import { generateReferralLetter } from '../components/generateReferralLetter';
import { useVoiceWizard } from '../components/useVoiceWizard';
import { getSettings } from '../utils/settings';

const RANGES = {
  mcv: { min:40, max:160, normal:[80,100] },
  mch: { min:10, max:50,  normal:[27,33]  },
  hbg: { min:3,  max:25,  normal:[12,17]  },
  rbc: { min:1,  max:12,  normal:[4,6]    },
};

const SL_DISTRICTS = [
  'Ampara','Anuradhapura','Badulla','Batticaloa','Colombo','Galle',
  'Gampaha','Hambantota','Jaffna','Kalutara','Kandy','Kegalle',
  'Kilinochchi','Kurunegala','Mannar','Matale','Matara','Monaragala',
  'Mullaitivu','Nuwara Eliya','Polonnaruwa','Puttalam','Ratnapura',
  'Trincomalee','Vavuniya',
];

const INIT = { patientId:'', age:'', sex:'Female', mcv:'', mch:'', hbg:'', rbc:'' };

function getRangeStatus(field, val) {
  if (!val) return null;
  const v = parseFloat(val), r = RANGES[field];
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
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = 'en-US'; utt.rate = 0.92;
  window.speechSynthesis.speak(utt);
}

export default function Screen() {
  const _settings = getSettings();

  const [form,          setForm]          = useState(INIT);
  const [result,        setResult]        = useState(null);
  const [error,         setError]         = useState('');
  const [loading,       setLoading]       = useState(false);
  const [district,      setDistrict]      = useState(_settings.defaultDistrict || '');
  const [isPregnant,    setIsPregnant]    = useState(false);
  const [familyHistory, setFamilyHistory] = useState(false);
  const [refLoading,    setRefLoading]    = useState(false);
  const [refDone,       setRefDone]       = useState(false);
  const [speaking,      setSpeaking]      = useState(false);

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    if (k === 'sex' && v === 'Male') setIsPregnant(false);
  };
  const isMale = form.sex === 'Male';

  // ── Wizard complete callback ──────────────────────────────────────────────
  const handleWizardComplete = useCallback((vals) => {
    if (vals.patientId !== undefined) set('patientId', vals.patientId);
    if (vals.age       !== undefined) set('age',       vals.age);
    if (vals.sex       !== undefined) set('sex',       vals.sex);
    if (vals.mcv       !== undefined) set('mcv',       vals.mcv);
    if (vals.mch       !== undefined) set('mch',       vals.mch);
    if (vals.hbg       !== undefined) set('hbg',       vals.hbg);
    if (vals.rbc       !== undefined) set('rbc',       vals.rbc);
    if (vals.isPregnant    !== undefined) setIsPregnant(vals.isPregnant);
    if (vals.familyHistory !== undefined) setFamilyHistory(vals.familyHistory);
  }, []);

  const wizard = useVoiceWizard({ onComplete: handleWizardComplete, isMale });

  // ── Submit ────────────────────────────────────────────────────────────────
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
        familyHistory,
        clinicianName: _settings.clinicianName || 'Medical Officer',
        designation:   _settings.designation   || '',
        clinicName:    _settings.clinicName     || '',
        hospital:      _settings.hospital       || '',
        mohArea:       _settings.mohArea        || '',
        unit:          _settings.unit           || '',
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

  const statusLabel = {
    idle:       '',
    prompting:  'Speaking…',
    listening:  'Listening…',
    confirming: 'Confirmed ✓',
    done:       'Done ✓',
    error:      'Error',
  }[wizard.status] || '';

  return (
    <Layout>
      <style>{`
        .sg { display:grid; grid-template-columns:1fr 1fr; gap:14px; align-items:start; }
        @media(max-width:959px){ .sg { grid-template-columns:1fr; } }
        .cg { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }
        @media(max-width:600px){ .cg { grid-template-columns:1fr 1fr; } }
        .pg { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
        @media(max-width:480px){ .pg { grid-template-columns:1fr; } }
        .ig { display:grid; grid-template-columns:1fr 1fr; gap:6px; }
        @media(max-width:480px){ .ig { grid-template-columns:1fr; } }
        .ra { display:flex; flex-direction:column; gap:6px; margin-top:6px; }
        @keyframes vp{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.3;transform:scale(1.6)}}
        @keyframes ripple{0%{box-shadow:0 0 0 0 rgba(226,75,74,.5)}100%{box-shadow:0 0 0 12px rgba(226,75,74,0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>

      {/* ══ VOICE WIZARD OVERLAY ══ */}
      {wizard.isActive && (
        <div style={s.wizardOverlay}>
          <div style={s.wizardCard}>

            <div style={s.wizardHeader}>
              <div style={s.wizardTitle}>Voice Entry</div>
              <button style={s.wizardClose} onClick={wizard.cancel} title="Cancel">✕</button>
            </div>

            <div style={s.progressTrack}>
              <div style={{ ...s.progressFill, width:`${wizard.progress}%` }} />
            </div>
            <div style={s.progressLabel}>
              Step {wizard.stepIndex + 1} of {wizard.stepCount} — {wizard.step?.label}
            </div>

            <div style={s.micVisual}>
              <div style={{
                ...s.micRing,
                animation: wizard.status === 'listening' ? 'ripple 1s ease-out infinite' : 'none',
                borderColor: wizard.status === 'listening' ? '#E24B4A'
                           : wizard.status === 'confirming' ? '#1D9E75' : '#334155',
              }}>
                <div style={{
                  ...s.micCore,
                  background: wizard.status === 'listening' ? '#E24B4A'
                             : wizard.status === 'confirming' ? '#1D9E75' : '#334155',
                }}>
                  {wizard.status === 'prompting'  && <SpeakerSVG />}
                  {wizard.status === 'listening'  && <MicSVG />}
                  {wizard.status === 'confirming' && <CheckSVG />}
                </div>
              </div>
            </div>

            <div style={s.wizardStatus}>
              <span style={{
                color: wizard.status === 'listening'  ? '#E24B4A'
                     : wizard.status === 'confirming' ? '#1D9E75' : 'var(--text-2)',
                fontWeight: 600, fontSize:13,
              }}>
                {statusLabel}
              </span>
            </div>

            <div style={s.wizardPrompt}>
              {wizard.status === 'prompting'  && `"${wizard.step?.prompt}"`}
              {wizard.status === 'listening'  && 'Speak now…'}
              {wizard.status === 'confirming' && wizard.transcript && `Heard: "${wizard.transcript}"`}
            </div>

            <div style={s.wizardValues}>
              {Object.entries(wizard.values).map(([k, v]) => (
                <div key={k} style={s.wizardVal}>
                  <span style={s.wizardValKey}>{k}</span>
                  <span style={s.wizardValV}>{String(v) || '—'}</span>
                </div>
              ))}
            </div>

            <button style={s.wizardCancelBtn} onClick={wizard.cancel}>
              Cancel voice entry
            </button>
          </div>
        </div>
      )}

      <div className="sg">

        {/* ════ LEFT — FORM ════ */}
        <div>
          <div style={s.card}>

            <div style={s.cardHead}>
              <span style={s.sectionTitle}>Patient information</span>
              {wizard.supported ? (
                <button
                  type="button"
                  style={s.voiceStartBtn}
                  onClick={wizard.isActive ? wizard.cancel : wizard.start}
                  title="Start guided voice entry"
                >
                  <MicSVG size={14} color="#fff" />
                  <span style={{ marginLeft:6 }}>
                    {wizard.isActive ? 'Cancel voice' : 'Voice entry'}
                  </span>
                </button>
              ) : (
                <span style={s.voiceUnsupported}>Chrome/Edge only</span>
              )}
            </div>

            {wizard.status === 'error' && (
              <div style={s.voiceErr}>⚠ {wizard.errorMsg}</div>
            )}
            {wizard.status === 'done' && (
              <div style={s.voiceDone}>
                ✓ Voice entry complete — review values below and click Run
              </div>
            )}

            <form onSubmit={submit}>
              <div className="pg">
                <Field label="Patient ID" hint="optional" value={form.patientId}
                  onChange={v => set('patientId', v)} />
                <Field label="Age (years)" type="number" value={form.age}
                  onChange={v => set('age', v)} required min="1" max="100" />
              </div>

              <div style={s.fieldWrap}>
                <label style={s.label}>Sex *</label>
                <select style={s.select} value={form.sex} onChange={e => set('sex', e.target.value)}>
                  <option>Female</option>
                  <option>Male</option>
                </select>
              </div>

              <div style={s.fieldWrap}>
                <label style={s.label}>District <span style={s.optHint}>(optional)</span></label>
                <select style={s.select} value={district} onChange={e => setDistrict(e.target.value)}>
                  <option value="">Select district</option>
                  {SL_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              {!isMale && (
                <div style={s.checkGroup}>
                  <label style={s.checkLabel}>
                    <input type="checkbox" checked={isPregnant}
                      onChange={e => setIsPregnant(e.target.checked)} style={s.checkbox} />
                    <span style={s.checkText}>Pregnant patient</span>
                  </label>
                  {isPregnant && <div style={s.clinWarn}>⚠️ Antenatal — referral automatic per MOH guidelines</div>}
                </div>
              )}

              <div style={{ ...s.checkGroup, marginBottom:14 }}>
                <label style={s.checkLabel}>
                  <input type="checkbox" checked={familyHistory}
                    onChange={e => setFamilyHistory(e.target.checked)} style={s.checkbox} />
                  <span style={s.checkText}>Family history of thalassemia</span>
                </label>
                {familyHistory && <div style={s.clinWarn}>⚠️ Significant clinical risk factor</div>}
              </div>

              <div style={s.cbcHead}>
                CBC parameters
                <span style={{ fontWeight:400, color:'var(--text-3)', fontSize:11, marginLeft:6 }}>* required</span>
              </div>

              <div className="cg">
                {['mcv','mch','hbg'].map(f => (
                  <RangeField key={f} field={f} value={form[f]} onChange={v => set(f, v)} />
                ))}
              </div>

              <div style={s.rbcHint}>RBC (×10¹²/L) — optional · supplementary indices only</div>
              <div style={{ maxWidth:160 }}>
                <Field label="RBC" hint="1.0–12.0" type="number" value={form.rbc}
                  onChange={v => set('rbc', v)}
                  extraStyle={{ border:'0.5px dashed var(--border)' }} />
              </div>

              {error && <div style={s.err}>{error}</div>}
              <button style={s.primaryBtn} disabled={loading}>
                {loading ? 'Analysing…' : 'Run carrier screening'}
              </button>
            </form>
          </div>
        </div>

        {/* ════ RIGHT — RESULT ════ */}
        <div>
          <div style={s.card}>
            <div style={{ ...s.sectionTitle, marginBottom:12 }}>Prediction result</div>
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

                <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:10 }}>
                  {isPregnant && !isMale && <span style={s.flagA}>🤰 Antenatal — Auto Referral</span>}
                  {familyHistory          && <span style={s.flagA}>⚠️ Family History</span>}
                  {district               && <span style={s.flagN}>📍 {district}</span>}
                </div>

                <div style={s.note}>{result.clinical_note}</div>

                <div className="ra">
                  <button style={{ ...s.speakBtn, ...(speaking ? s.speakBtnOn : {}) }} onClick={handleSpeak}>
                    <SpeakerSVG size={13} color={speaking ? '#0F6E56' : 'currentColor'} />
                    <span style={{ marginLeft:6 }}>{speaking ? 'Stop reading' : 'Read result aloud'}</span>
                  </button>

                  <button style={s.printBtn} onClick={() => window.print()}>Print result</button>

                  <PDFButton result={result} form={form} district={district}
                    isPregnant={isMale ? false : isPregnant}
                    familyHistory={familyHistory}
                    clinicianName={_settings.clinicianName || 'Medical Officer'} />

                  {(result.referral_recommended || (isPregnant && !isMale)) && (
                    <button onClick={handleReferral} disabled={refLoading} style={{
                      width:'100%', padding:'9px 14px',
                      background: refDone ? '#064E3B' : '#FFFBEB',
                      color:      refDone ? '#6EE7B7' : '#92400E',
                      border:     `0.5px solid ${refDone ? '#059669' : '#FAC775'}`,
                      borderRadius:8, fontSize:13, cursor: refLoading ? 'wait' : 'pointer',
                      fontFamily:'inherit', display:'flex', alignItems:'center',
                      justifyContent:'center', gap:6,
                      opacity: refLoading ? 0.6 : 1, transition:'background 0.2s',
                    }}>
                      {refLoading ? '⏳ Generating…' : refDone ? '✓ Downloaded' : '📋 Download MOH Referral Letter'}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          <div style={s.card}>
            <div style={{ ...s.sectionTitle, marginBottom:10 }}>Derived hematological indices</div>
            {!result ? (
              <div style={{ ...s.empty, padding:'12px 0' }}>Awaiting input</div>
            ) : (
              <>
                <div className="ig">
                  {Object.entries(result.derived_features || {}).map(([k,v]) => (
                    <div key={k} style={s.idxCard}>
                      <div style={s.idxName}>{k.replace(/_/g,' ')}</div>
                      <div style={s.idxVal}>{typeof v==='number' ? v.toFixed(2) : v}</div>
                    </div>
                  ))}
                </div>
                {result.supplementary_indices && Object.keys(result.supplementary_indices).length > 0 && (
                  <>
                    <div style={{ fontSize:11, color:'var(--text-3)', margin:'8px 0 4px' }}>
                      Supplementary — RBC provided
                    </div>
                    <div className="ig">
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

          {result?.shap_contributions && Object.keys(result.shap_contributions).length > 0 && (
            <div style={s.card}>
              <SHAPChart contributions={result.shap_contributions} isCarrier={isCarrier} />
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

// ── SVG icons ──────────────────────────────────────────────────────────────────

function MicSVG({ size=16, color='currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ verticalAlign:'middle', flexShrink:0 }}>
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" fill={color} fillOpacity="0.15" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8"  y1="23" x2="16" y2="23" />
    </svg>
  );
}

function SpeakerSVG({ size=16, color='currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ verticalAlign:'middle', flexShrink:0 }}>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill={color} fillOpacity="0.15" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

function CheckSVG({ size=20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// ── Field components ───────────────────────────────────────────────────────────

function Field({ label, hint, value, onChange, type='text', required, extraStyle={}, ...rest }) {
  return (
    <div style={{ marginBottom:10 }}>
      <label style={s.label}>
        {label}{hint && <span style={{ color:'var(--text-3)', fontWeight:400 }}> ({hint})</span>}
      </label>
      <input style={{ ...inp, ...extraStyle }} type={type} value={value}
        onChange={e => onChange(e.target.value)} required={required} {...rest} />
    </div>
  );
}

function RangeField({ field, value, onChange }) {
  const r      = RANGES[field];
  const status = getRangeStatus(field, value);
  const labels = { mcv:'MCV (fL)', mch:'MCH (pg)', hbg:'HBG (g/dL)' };
  return (
    <div style={{ marginBottom:10 }}>
      <label style={s.label}>{labels[field]} *</label>
      <div style={{ fontSize:10, color:'var(--text-3)', marginBottom:3 }}>
        normal {r.normal[0]}–{r.normal[1]}
      </div>
      <input
        style={{
          ...inp,
          ...(status==='below'||status==='above' ? { background:'#FFFBEB', borderColor:'#FAC775', color:'#1a1a1a', WebkitTextFillColor:'#1a1a1a' } : {}),
          ...(status==='invalid'                 ? { background:'#fef2f2', borderColor:'#fca5a5', color:'#1a1a1a', WebkitTextFillColor:'#1a1a1a' } : {}),
        }}
        type="number" value={value} step="0.1" min={r.min} max={r.max}
        onChange={e => onChange(e.target.value)} required
      />
      {status==='below'   && <div style={s.warnTxt}>⚠ below normal range</div>}
      {status==='above'   && <div style={s.warnTxt}>⚠ above normal range</div>}
      {status==='invalid' && <div style={{ ...s.warnTxt, color:'#b91c1c' }}>✗ outside physiological range</div>}
    </div>
  );
}

function ProbBar({ label, value, color }) {
  return (
    <div style={{ marginTop:8 }}>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:11,
        color:'var(--text-2)', marginBottom:3 }}>
        <span>{label}</span><span>{Math.round(value*100)}%</span>
      </div>
      <div style={{ height:6, background:'var(--border)', borderRadius:3, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${value*100}%`, background:color,
          borderRadius:3, transition:'width 0.5s ease' }} />
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const inp = {
  width:'100%', padding:'8px 10px', border:'0.5px solid var(--border)',
  borderRadius:8, fontSize:13, boxSizing:'border-box', outline:'none',
  background:'var(--bg-input)', color:'var(--text-primary)',
  WebkitTextFillColor:'var(--text-primary)',
};

const s = {
  card:         { background:'var(--bg-card)', border:'0.5px solid var(--border)', borderRadius:12, padding:'16px 18px', marginBottom:12 },
  cardHead:     { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, flexWrap:'wrap', gap:8 },
  sectionTitle: { fontSize:13, fontWeight:600, color:'var(--text-1)' },
  cbcHead:      { fontSize:12, fontWeight:600, color:'var(--text-1)', margin:'10px 0 8px', borderTop:'0.5px solid var(--border)', paddingTop:12 },
  rbcHint:      { fontSize:11, color:'var(--text-3)', margin:'6px 0 4px', borderTop:'0.5px solid var(--border)', paddingTop:8 },
  fieldWrap:    { marginBottom:14 },
  label:        { fontSize:12, color:'var(--text-2)', display:'block', marginBottom:4, fontWeight:500 },
  optHint:      { color:'var(--text-3)', fontWeight:400 },
  select:       { width:'100%', padding:'8px 10px', border:'0.5px solid var(--border)', borderRadius:8, fontSize:13, boxSizing:'border-box', background:'var(--bg-input)', color:'var(--text-1)' },

  voiceStartBtn:{ display:'flex', alignItems:'center', padding:'7px 14px',
                  background:'#1D9E75', color:'#fff', border:'none',
                  borderRadius:20, fontSize:12, cursor:'pointer',
                  fontFamily:'inherit', fontWeight:500, whiteSpace:'nowrap',
                  transition:'background 0.2s' },
  voiceUnsupported: { fontSize:11, color:'var(--text-3)' },
  voiceErr:     { background:'#fef2f2', color:'#b91c1c', borderRadius:8, padding:'8px 12px', fontSize:12, marginBottom:10 },
  voiceDone:    { background:'#E1F5EE', color:'#0F6E56', border:'0.5px solid #9FE1CB', borderRadius:8, padding:'8px 12px', fontSize:12, marginBottom:10 },

  wizardOverlay:{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  zIndex:1000, padding:20 },
  wizardCard:   { background:'var(--bg-card)', borderRadius:16, padding:'28px 28px 24px',
                  width:'100%', maxWidth:420, boxShadow:'0 24px 60px rgba(0,0,0,0.4)' },
  wizardHeader: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 },
  wizardTitle:  { fontSize:16, fontWeight:700, color:'var(--text-1)' },
  wizardClose:  { background:'transparent', border:'none', fontSize:18,
                  color:'var(--text-3)', cursor:'pointer', padding:'0 4px', lineHeight:1 },

  progressTrack:{ height:4, background:'var(--border)', borderRadius:4, marginBottom:6, overflow:'hidden' },
  progressFill: { height:'100%', background:'#1D9E75', borderRadius:4, transition:'width 0.4s ease' },
  progressLabel:{ fontSize:11, color:'var(--text-3)', marginBottom:24, textAlign:'center' },

  micVisual:    { display:'flex', justifyContent:'center', marginBottom:16 },
  micRing:      { width:80, height:80, borderRadius:'50%', border:'2px solid',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  transition:'border-color 0.3s' },
  micCore:      { width:56, height:56, borderRadius:'50%', display:'flex',
                  alignItems:'center', justifyContent:'center', transition:'background 0.3s' },

  wizardStatus: { textAlign:'center', marginBottom:8, minHeight:20 },
  wizardPrompt: { textAlign:'center', fontSize:13, color:'var(--text-2)',
                  minHeight:40, lineHeight:1.6, padding:'0 8px', marginBottom:16 },

  wizardValues: { display:'flex', flexWrap:'wrap', gap:6, marginBottom:20, minHeight:28 },
  wizardVal:    { display:'flex', gap:4, alignItems:'center', padding:'3px 10px',
                  background:'var(--bg-input)', border:'0.5px solid var(--border)',
                  borderRadius:20, fontSize:11 },
  wizardValKey: { color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.04em', fontSize:10 },
  wizardValV:   { color:'var(--text-1)', fontWeight:600 },

  wizardCancelBtn:{ width:'100%', padding:'9px', background:'transparent',
                    color:'var(--text-3)', border:'0.5px solid var(--border)',
                    borderRadius:8, fontSize:12, cursor:'pointer', fontFamily:'inherit' },

  err:          { background:'#fef2f2', color:'#b91c1c', borderRadius:8, padding:'8px 12px', fontSize:12, margin:'8px 0' },
  primaryBtn:   { width:'100%', padding:'11px', background:'#1D9E75', color:'#fff',
                  border:'none', borderRadius:8, fontSize:13, cursor:'pointer',
                  marginTop:10, fontFamily:'inherit', fontWeight:500 },
  speakBtn:     { width:'100%', padding:'8px 14px', background:'var(--bg-input)',
                  color:'var(--text-2)', border:'0.5px solid var(--border)',
                  borderRadius:8, fontSize:12, cursor:'pointer', fontFamily:'inherit',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  transition:'background 0.2s' },
  speakBtnOn:   { background:'#E1F5EE', color:'#0F6E56', border:'0.5px solid #9FE1CB' },
  printBtn:     { width:'100%', padding:'8px 14px', background:'#E1F5EE', color:'#0F6E56',
                  border:'0.5px solid #9FE1CB', borderRadius:8, fontSize:12,
                  cursor:'pointer', fontFamily:'inherit' },

  empty:        { fontSize:13, color:'var(--text-3)', padding:'24px 0', textAlign:'center' },
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
  note:         { background:'var(--bg-input)', borderRadius:8, padding:'8px 10px', marginTop:8, fontSize:11, color:'var(--text-2)', lineHeight:1.6 },
  flagA:        { padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:500, background:'rgba(245,158,11,0.12)', color:'#92400E', border:'0.5px solid rgba(245,158,11,0.35)' },
  flagN:        { padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:500, background:'rgba(99,102,241,0.1)', color:'#6366F1', border:'0.5px solid rgba(99,102,241,0.25)' },
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
