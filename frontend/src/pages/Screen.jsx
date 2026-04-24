import { useState } from 'react';
import Layout from '../components/Layout';
import api from '../api/api';
import ProbabilityGauge from '../components/ProbabilityGauge';
import SHAPChart from '../components/SHAPChart';

const RANGES = {
  mcv: { min:40,  max:160, normal:[80, 100], unit:'fL' },
  mch: { min:10,  max:50,  normal:[27, 33],  unit:'pg' },
  hbg: { min:3,   max:25,  normal:[12, 17],  unit:'g/dL' },
  rbc: { min:1,   max:12,  normal:[4,  6],   unit:'×10¹²/L' },
};

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

export default function Screen() {
  const [form,    setForm]    = useState(INIT);
  const [result,  setResult]  = useState(null);
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async e => {
    e.preventDefault();
    setLoading(true); setError(''); setResult(null);
    try {
      const payload = {
        patientId: form.patientId || undefined,
        age:  parseFloat(form.age),
        sex:  form.sex,
        mcv:  parseFloat(form.mcv),
        mch:  parseFloat(form.mch),
        hbg:  parseFloat(form.hbg),
      };
      if (form.rbc) payload.rbc = parseFloat(form.rbc);
      const { data } = await api.post('/predict', payload);
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Prediction failed');
    } finally { setLoading(false); }
  };

  const isCarrier = result?.prediction === 1;

  return (
    <Layout>
      <div style={s.twoCol}>
        <div>
          <div style={s.card}>
            <div style={s.cardTitle}>Patient information</div>
            <form onSubmit={submit}>
              <div style={s.grid2}>
                <CbcField label="Patient ID" hint="optional" value={form.patientId}
                  onChange={v => set('patientId', v)} />
                <CbcField label="Age (years)" type="number" value={form.age}
                  onChange={v => set('age', v)} required min="1" max="100" />
              </div>
              <div style={{ marginBottom:14 }}>
                <label style={s.label}>Sex *</label>
                <select style={s.input} value={form.sex}
                  onChange={e => set('sex', e.target.value)}>
                  <option>Female</option>
                  <option>Male</option>
                </select>
              </div>

              <div style={{ ...s.cardTitle, marginTop:8, borderTop:'0.5px solid var(--border)', paddingTop:12 }}>
                CBC parameters <span style={{ fontWeight:400, color:'var(--text-3)', fontSize:11 }}>* required</span>
              </div>

              <div style={s.grid3}>
                {['mcv','mch','hbg'].map(f => (
                  <RangeField key={f} field={f} value={form[f]} onChange={v => set(f, v)} />
                ))}
              </div>

              <div style={{ fontSize:11, color:'var(--text-3)', margin:'8px 0 6px', borderTop:'0.5px solid var(--border)', paddingTop:8 }}>
                RBC (×10¹²/L) — optional · supplementary indices only
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr', gap:8 }}>
                <CbcField field="rbc" label="RBC" hint="1.0–12.0" type="number"
                  value={form.rbc} onChange={v => set('rbc', v)}
                  style={{ border:'0.5px dashed var(--border)', background:'var(--bg-input)', color:'var(--text-1)' }} />
              </div>

              {error && <div style={s.err}>{error}</div>}
              <button style={s.primaryBtn} disabled={loading}>
                {loading ? 'Analysing…' : 'Run carrier screening'}
              </button>
            </form>
          </div>
        </div>

        <div>
          <div style={s.card}>
            <div style={s.cardTitle}>Prediction result</div>
            {!result ? (
              <div style={s.empty}>
                Enter CBC values and click Run to see the prediction
              </div>
            ) : (
              <>
                <div style={isCarrier ? s.resultC : s.resultNC}>
                  <div style={isCarrier ? s.rlC : s.rlNC}>
                    {isCarrier ? 'Carrier detected' : 'Non-carrier'}
                  </div>
                  <div style={isCarrier ? s.rsC : s.rsNC}>
                    {result.label}
                  </div>
                  <div style={{ marginTop:6, display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ fontSize:11, color: isCarrier ? '#A32D2D' : '#0F6E56' }}>
                      Confidence
                    </span>
                    <span style={
                      result.confidence === 'High'     ? s.confH :
                      result.confidence === 'Moderate' ? s.confM : s.confL
                    }>
                      {result.confidence}
                    </span>
                  </div>
                </div>

                <ProbabilityGauge
                  probability={result.carrier_probability}
                  isCarrier={isCarrier}
                />

                <ProbBar
                  label="Carrier probability"
                  value={result.carrier_probability}
                  color={isCarrier ? '#E24B4A' : '#d1d5db'}
                />
                <ProbBar
                  label="Non-carrier probability"
                  value={result.non_carrier_probability}
                  color={!isCarrier ? '#1D9E75' : '#d1d5db'}
                />

                {result.referral_recommended && (
                  <div style={s.referral}>
                    Referral recommended — confirm with HbA2 via HPLC or
                    electrophoresis (HbA2 ≥ 3.5% = carrier)
                  </div>
                )}
                <div style={s.note}>{result.clinical_note}</div>
                <button style={s.printBtn} onClick={() => window.print()}>
                  Print result
                </button>
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
                  {Object.entries(result.derived_features || {}).map(([k, v]) => (
                    <div key={k} style={s.idxCard}>
                      <div style={s.idxName}>{k.replace(/_/g, ' ')}</div>
                      <div style={s.idxVal}>
                        {typeof v === 'number' ? v.toFixed(2) : v}
                      </div>
                    </div>
                  ))}
                </div>
                {result.supplementary_indices && (
                  <>
                    <div style={{ fontSize:11, color:'var(--text-3)', margin:'8px 0 4px' }}>
                      Supplementary — RBC provided
                    </div>
                    <div style={s.idxGrid}>
                      {Object.entries(result.supplementary_indices).map(([k, v]) => (
                        <div key={k} style={{ ...s.idxCard, border:'0.5px dashed var(--border)' }}>
                          <div style={s.idxName}>{k.replace(/_/g, ' ')}</div>
                          <div style={s.idxVal}>
                            {typeof v === 'number' ? v.toFixed(2) : v}
                          </div>
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
              <SHAPChart
                contributions={result.shap_contributions}
                isCarrier={isCarrier}
              />
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

function RangeField({ field, value, onChange }) {
  const r      = RANGES[field];
  const status = getRangeStatus(field, value);
  const labels = { mcv:'MCV (fL)', mch:'MCH (pg)', hbg:'HBG (g/dL)' };
  const inputStyle = {
    ...inp,
    ...(status === 'below' || status === 'above'
      ? { background:'#FFFBEB', borderColor:'#FAC775', color:'#1a1a1a' } : {}),
    ...(status === 'invalid'
      ? { background:'#fef2f2', borderColor:'#fca5a5', color:'#1a1a1a' } : {}),
  };
  return (
    <div style={{ marginBottom:10 }}>
      <label style={s.label}>{labels[field]} *</label>
      <div style={{ fontSize:10, color:'var(--text-3)', marginBottom:3 }}>
        normal {r.normal[0]}–{r.normal[1]}
      </div>
      <input style={inputStyle} type="number" value={value} step="0.1"
        min={r.min} max={r.max}
        onChange={e => onChange(e.target.value)} required />
      {status === 'below'   && <div style={s.warnText}>⚠ below normal range</div>}
      {status === 'above'   && <div style={s.warnText}>⚠ above normal range</div>}
      {status === 'invalid' && (
        <div style={{ ...s.warnText, color:'#b91c1c' }}>✗ outside physiological range</div>
      )}
    </div>
  );
}

function CbcField({ label, hint, value, onChange, type='text', required, style:extra, ...rest }) {
  return (
    <div style={{ marginBottom:10 }}>
      <label style={s.label}>
        {label}{hint && <span style={{ color:'var(--text-3)', fontWeight:400 }}> ({hint})</span>}
      </label>
      <input style={{ ...inp, ...extra }} type={type} value={value}
        onChange={e => onChange(e.target.value)} required={required} {...rest} />
    </div>
  );
}

function ProbBar({ label, value, color }) {
  return (
    <div style={{ marginTop:8 }}>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--text-2)', marginBottom:3 }}>
        <span>{label}</span><span>{Math.round(value * 100)}%</span>
      </div>
      <div style={{ height:6, background:'var(--border)', borderRadius:3, overflow:'hidden' }}>
        <div style={{
          height:'100%', width:`${value*100}%`,
          background:color, borderRadius:3,
          transition:'width 0.5s ease'
        }} />
      </div>
    </div>
  );
}

const inp = {
  width:'100%', padding:'7px 10px',
  border:'0.5px solid var(--border)',
  borderRadius:8, fontSize:13,
  boxSizing:'border-box', outline:'none',
  background:'var(--bg-input)',
  color:'var(--text-1)',
};

const s = {
  twoCol:    { display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 },
  card:      { background:'var(--bg-card)', border:'0.5px solid var(--border)', borderRadius:12, padding:'14px 16px', marginBottom:12 },
  cardTitle: { fontSize:13, fontWeight:500, color:'var(--text-1)', marginBottom:12 },
  grid2:     { display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 },
  grid3:     { display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 },
  label:     { fontSize:12, color:'var(--text-2)', display:'block', marginBottom:4, fontWeight:500 },
  input:     { width:'100%', padding:'7px 10px', border:'0.5px solid var(--border)', borderRadius:8, fontSize:13, boxSizing:'border-box', background:'var(--bg-input)', color:'var(--text-1)' },
  err:       { background:'#fef2f2', color:'#b91c1c', borderRadius:8, padding:'8px 12px', fontSize:12, margin:'8px 0' },
  primaryBtn:{ width:'100%', padding:10, background:'#1D9E75', color:'#fff', border:'none', borderRadius:8, fontSize:13, cursor:'pointer', marginTop:8, fontFamily:'inherit' },
  printBtn:  { width:'100%', padding:8, background:'#E1F5EE', color:'#0F6E56', border:'0.5px solid #9FE1CB', borderRadius:8, fontSize:12, cursor:'pointer', marginTop:8, fontFamily:'inherit' },
  empty:     { fontSize:13, color:'var(--text-3)', padding:'20px 0', textAlign:'center' },
  resultC:   { background:'#FCEBEB', border:'0.5px solid #F7C1C1', borderRadius:10, padding:'12px 14px' },
  resultNC:  { background:'#E1F5EE', border:'0.5px solid #9FE1CB', borderRadius:10, padding:'12px 14px' },
  rlC:       { fontSize:10, color:'#A32D2D', textTransform:'uppercase', letterSpacing:'0.06em' },
  rlNC:      { fontSize:10, color:'#0F6E56', textTransform:'uppercase', letterSpacing:'0.06em' },
  rsC:       { fontSize:18, fontWeight:500, color:'#791F1F', marginTop:3 },
  rsNC:      { fontSize:18, fontWeight:500, color:'#085041', marginTop:3 },
  confH:     { fontSize:11, padding:'2px 8px', borderRadius:20, background:'#E1F5EE', color:'#0F6E56' },
  confM:     { fontSize:11, padding:'2px 8px', borderRadius:20, background:'#FAEEDA', color:'#633806' },
  confL:     { fontSize:11, padding:'2px 8px', borderRadius:20, background:'#FCEBEB', color:'#A32D2D' },
  referral:  { background:'#FFFBEB', border:'0.5px solid #FAC775', borderRadius:8, padding:'8px 10px', marginTop:8, fontSize:11, color:'#633806', lineHeight:1.5 },
  note:      { background:'var(--bg-input)', borderRadius:8, padding:'8px 10px', marginTop:8, fontSize:11, color:'var(--text-2)', lineHeight:1.5 },
  idxGrid:   { display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 },
  idxCard:   { background:'var(--bg-input)', borderRadius:8, padding:'8px 10px' },
  idxName:   { fontSize:10, color:'var(--text-2)' },
  idxVal:    { fontSize:14, fontWeight:500, color:'var(--text-1)', marginTop:2 },
  warnText:  { fontSize:10, color:'#854F0B', marginTop:2 },
};
