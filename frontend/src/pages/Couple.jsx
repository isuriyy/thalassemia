import { useState } from 'react';
import Layout       from '../components/Layout';
import api          from '../api/api';
import { generateCoupleReport } from '../components/generateCoupleReport';

const RANGES = {
  mcv: { min:40,  max:160, normal:[80, 100], unit:'fL'  },
  mch: { min:10,  max:50,  normal:[27, 33],  unit:'pg'  },
  hbg: { min:3,   max:25,  normal:[12, 17],  unit:'g/dL'},
  rbc: { min:1,   max:12,  normal:[4,  6],   unit:'×10¹²/L' },
};

const SL_DISTRICTS = [
  'Ampara','Anuradhapura','Badulla','Batticaloa','Colombo','Galle',
  'Gampaha','Hambantota','Jaffna','Kalutara','Kandy','Kegalle',
  'Kilinochchi','Kurunegala','Mannar','Matale','Matara','Monaragala',
  'Mullaitivu','Nuwara Eliya','Polonnaruwa','Puttalam','Ratnapura',
  'Trincomalee','Vavuniya'
];

const INIT_PARTNER = {
  patientId:'', age:'', sex:'Female',
  mcv:'', mch:'', hbg:'', rbc:'',
  district:'', isPregnant:false, familyHistory:false,
};

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

// Shared input style — uses CSS vars so dark mode works 
const inp = {
  width:'100%', padding:'6px 9px',
  border:'0.5px solid var(--border)',
  borderRadius:7, fontSize:12, boxSizing:'border-box', outline:'none',
  background:'var(--bg-input)',
  color:'var(--text-primary)',
  WebkitTextFillColor:'var(--text-primary)',
};

export default function Couple() {
  const [a,       setA]       = useState({ ...INIT_PARTNER, sex:'Female' });
  const [b,       setB]       = useState({ ...INIT_PARTNER, sex:'Male'   });
  const [result,  setResult]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfDone,    setPdfDone]    = useState(false);

  const setPartner = (who, k, v) => {
    const setter = who === 'a' ? setA : setB;
    setter(p => {
      const next = { ...p, [k]: v };
      if (k === 'sex' && v === 'Male') next.isPregnant = false;
      return next;
    });
  };

  const submit = async e => {
    e.preventDefault();
    setLoading(true); setError(''); setResult(null);
    try {
      const build = p => ({
        patientId:     p.patientId || undefined,
        age:           parseFloat(p.age),
        sex:           p.sex,
        mcv:           parseFloat(p.mcv),
        mch:           parseFloat(p.mch),
        hbg:           parseFloat(p.hbg),
        district:      p.district  || undefined,
        isPregnant:    p.sex === 'Male' ? false : p.isPregnant,
        familyHistory: p.familyHistory,
        ...(p.rbc ? { rbc: parseFloat(p.rbc) } : {}),
      });
      const { data } = await api.post('/predict/couple', {
        partnerA: build(a),
        partnerB: build(b),
      });
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Screening failed');
    } finally { setLoading(false); }
  };

  const handlePDF = async () => {
    if (!result) return;
    setPdfLoading(true); setPdfDone(false);
    try {
      await generateCoupleReport({
        result,
        partnerA: a,
        partnerB: b,
        clinicianName: 'Dr. Isuri',
      });
      setPdfDone(true);
      setTimeout(() => setPdfDone(false), 3000);
    } catch (err) {
      console.error('PDF failed:', err);
      alert('PDF generation failed. Check console.');
    } finally { setPdfLoading(false); }
  };

  return (
    <Layout>
      <div style={s.wrap}>

        <div style={s.pageHead}>
          <div style={s.pageTitle}>Couple Screening</div>
          <div style={s.pageSub}>
            Screen both partners simultaneously to assess offspring thalassaemia risk
          </div>
        </div>

        <form onSubmit={submit}>
          <div style={s.partnerGrid}>
            <PartnerForm label="Partner A" data={a} onChange={(k,v) => setPartner('a',k,v)} accent="#EC4899" />
            <PartnerForm label="Partner B" data={b} onChange={(k,v) => setPartner('b',k,v)} accent="#3B82F6" />
          </div>

          {error && <div style={s.err}>{error}</div>}

          <button style={s.runBtn} disabled={loading}>
            {loading ? 'Analysing both partners…' : 'Run couple screening'}
          </button>
        </form>

        {result && (
          <>
            <CoupleResult result={result} partnerA={a} partnerB={b} />

            {/* PDF Download */}
            <button
              onClick={handlePDF}
              disabled={pdfLoading}
              style={{
                ...s.pdfBtn,
                ...(pdfDone    ? s.pdfDone    : {}),
                ...(pdfLoading ? s.pdfLoading : {}),
              }}
            >
              {pdfLoading ? '⏳ Generating PDF…'
               : pdfDone  ? '✓ PDF Downloaded'
               : '⬇ Download Couple Screening Report (PDF)'}
            </button>
          </>
        )}
      </div>
    </Layout>
  );
}

//  PartnerForm 
function PartnerForm({ label, data, onChange, accent }) {
  const isMale = data.sex === 'Male';

  return (
    <div style={{ ...s.partnerCard, borderTop: `3px solid ${accent}` }}>
      <div style={{ ...s.partnerLabel, color: accent }}>{label}</div>

      <div style={s.row2}>
        <Field label="Patient ID" hint="optional" value={data.patientId}
          onChange={v => onChange('patientId', v)} />
        <Field label="Age (years)" type="number" value={data.age}
          onChange={v => onChange('age', v)} required min="1" max="100" />
      </div>

      <div style={s.fieldWrap}>
        <label style={s.label}>Sex *</label>
        <select style={inp} value={data.sex}
          onChange={e => onChange('sex', e.target.value)}>
          <option>Female</option>
          <option>Male</option>
        </select>
      </div>

      <div style={s.fieldWrap}>
        <label style={s.label}>District <span style={s.opt}>(optional)</span></label>
        <select style={inp} value={data.district}
          onChange={e => onChange('district', e.target.value)}>
          <option value="">Select district</option>
          {SL_DISTRICTS.map(d => <option key={d}>{d}</option>)}
        </select>
      </div>

      {!isMale && (
        <CheckRow
          checked={data.isPregnant}
          onChange={v => onChange('isPregnant', v)}
          label="Pregnant patient"
          warn="⚠️ Antenatal — auto referral per MOH guidelines"
        />
      )}

      <CheckRow
        checked={data.familyHistory}
        onChange={v => onChange('familyHistory', v)}
        label="Family history of thalassaemia"
        warn="⚠️ Significant clinical risk factor"
      />

      <div style={s.cbcTitle}>CBC parameters <span style={s.req}>* required</span></div>

      <div style={s.row3}>
        {['mcv','mch','hbg'].map(f => (
          <RangeField key={f} field={f} value={data[f]} onChange={v => onChange(f, v)} />
        ))}
      </div>

      <div style={s.rbcHint}>RBC (×10¹²/L) — optional</div>
      <Field label="RBC" type="number" value={data.rbc}
        onChange={v => onChange('rbc', v)} step="0.1" />
    </div>
  );
}

//  CoupleResult 
function CoupleResult({ result, partnerA, partnerB }) {
  const { coupleRisk } = result;
  const rA = result.partnerA;
  const rB = result.partnerB;

  const riskColor  = coupleRisk.bothCarriers ? '#E24B4A' : coupleRisk.oneCarrier ? '#D97706' : '#1D9E75';
  const riskBg     = coupleRisk.bothCarriers ? '#FCEBEB' : coupleRisk.oneCarrier ? '#FFFBEB' : '#E1F5EE';
  const riskBorder = coupleRisk.bothCarriers ? '#F7C1C1' : coupleRisk.oneCarrier ? '#FAC775' : '#9FE1CB';

  return (
    <div style={s.resultWrap}>
      <div style={s.partnerResultGrid}>
        <IndividualResult label="Partner A" name={partnerA.patientId || 'Partner A'} result={rA} accent="#EC4899" />
        <IndividualResult label="Partner B" name={partnerB.patientId || 'Partner B'} result={rB} accent="#3B82F6" />
      </div>

      <div style={{ ...s.riskCard, background: riskBg, borderColor: riskBorder }}>
        <div style={s.riskHeader}>
          <div style={{ ...s.riskTitle, color: riskColor }}>
            {coupleRisk.bothCarriers ? '⚠ High Risk Couple'
           : coupleRisk.oneCarrier   ? 'Carrier + Non-carrier'
           : '✓ No carrier risk identified'}
          </div>
          <div style={s.riskSub}>Mendelian inheritance risk assessment</div>
        </div>

        <div style={s.riskSummary}>{coupleRisk.summary}</div>

        {coupleRisk.bothCarriers && (
          <div style={s.riskTiles}>
            <RiskTile pct={25} label="Affected child risk"  color="#E24B4A" />
            <RiskTile pct={50} label="Carrier child risk"   color="#D97706" />
            <RiskTile pct={25} label="Unaffected child"     color="#1D9E75" />
          </div>
        )}

        {coupleRisk.oneCarrier && !coupleRisk.bothCarriers && (
          <div style={s.riskTiles}>
            <RiskTile pct={0}  label="Affected child risk"  color="#1D9E75" />
            <RiskTile pct={50} label="Carrier child risk"   color="#D97706" />
            <RiskTile pct={50} label="Unaffected child"     color="#1D9E75" />
          </div>
        )}

        {coupleRisk.bothCarriers && <PunnettSquare />}

        {coupleRisk.referralRecommended && (
          <div style={s.urgentBox}>
            🔴 Urgent referral required — genetic counselling and prenatal diagnosis
            (chorionic villus sampling or amniocentesis) recommended
          </div>
        )}
      </div>

      <div style={s.idBox}>
        <span style={s.idLabel}>Couple screening ID</span>
        <code style={s.idCode}>{result.coupleScreeningId}</code>
      </div>
    </div>
  );
}

// IndividualResult 
function IndividualResult({ label, name, result, accent }) {
  const isCarrier = result.prediction === 1;
  return (
    <div style={{ ...s.indCard, borderTop: `2.5px solid ${accent}` }}>
      <div style={{ fontSize:11, fontWeight:600, color:accent, marginBottom:6,
        textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</div>
      <div style={{ fontSize:13, color:'var(--text-secondary)', marginBottom:10 }}>{name}</div>

      <div style={{
        background: isCarrier ? '#FCEBEB' : '#E1F5EE',
        border: `0.5px solid ${isCarrier ? '#F7C1C1' : '#9FE1CB'}`,
        borderRadius:8, padding:'10px 12px', marginBottom:8
      }}>
        <div style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'0.06em',
          color: isCarrier ? '#A32D2D' : '#0F6E56' }}>
          {isCarrier ? 'Carrier detected' : 'Non-carrier'}
        </div>
        <div style={{ fontSize:16, fontWeight:600, marginTop:3,
          color: isCarrier ? '#791F1F' : '#085041' }}>
          {result.label}
        </div>
      </div>

      <ProbMini value={result.carrier_probability} isCarrier={isCarrier} />

      <div style={{ display:'flex', justifyContent:'space-between', marginTop:8 }}>
        <span style={{ fontSize:11, color:'var(--text-hint)' }}>Confidence</span>
        <span style={{
          fontSize:11, padding:'2px 8px', borderRadius:20,
          background: result.confidence==='High' ? '#E1F5EE' : result.confidence==='Moderate' ? '#FFFBEB' : '#FCEBEB',
          color:      result.confidence==='High' ? '#0F6E56' : result.confidence==='Moderate' ? '#633806' : '#A32D2D',
        }}>{result.confidence}</span>
      </div>

      {result.referral_recommended && (
        <div style={{ fontSize:11, color:'#633806', background:'#FFFBEB',
          border:'0.5px solid #FAC775', borderRadius:6, padding:'6px 8px', marginTop:8 }}>
          Referral recommended
        </div>
      )}
    </div>
  );
}

function ProbMini({ value, isCarrier }) {
  const pct = Math.round(value * 100);
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:11,
        color:'var(--text-hint)', marginBottom:3 }}>
        <span>Carrier probability</span><span>{pct}%</span>
      </div>
      <div style={{ height:5, background:'var(--border)', borderRadius:3, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${pct}%`,
          background: isCarrier ? '#E24B4A' : '#1D9E75',
          borderRadius:3, transition:'width 0.5s ease' }} />
      </div>
    </div>
  );
}

function RiskTile({ pct, label, color }) {
  return (
    <div style={{ textAlign:'center', flex:1, padding:'10px 8px',
      background:'var(--bg-card)', borderRadius:8, border:'0.5px solid var(--border)' }}>
      <div style={{ fontSize:22, fontWeight:700, color, letterSpacing:'-0.03em' }}>{pct}%</div>
      <div style={{ fontSize:10, color:'var(--text-hint)', marginTop:3, lineHeight:1.3 }}>{label}</div>
    </div>
  );
}

function PunnettSquare() {
  const cells = [
    { label:'TT', sub:'Unaffected', bg:'#E1F5EE', color:'#085041' },
    { label:'Tt', sub:'Carrier',    bg:'#FFFBEB', color:'#633806' },
    { label:'Tt', sub:'Carrier',    bg:'#FFFBEB', color:'#633806' },
    { label:'tt', sub:'Affected',   bg:'#FCEBEB', color:'#791F1F' },
  ];
  return (
    <div style={{ marginTop:16 }}>
      <div style={{ fontSize:11, fontWeight:600, color:'var(--text-secondary)',
        marginBottom:8, textTransform:'uppercase', letterSpacing:'0.05em' }}>
        Punnett Square (Tt × Tt)
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, maxWidth:220 }}>
        {cells.map((c, i) => (
          <div key={i} style={{ background:c.bg, borderRadius:6, padding:'8px 10px',
            border:`0.5px solid ${c.color}30` }}>
            <div style={{ fontSize:16, fontWeight:700, color:c.color, fontFamily:'monospace' }}>{c.label}</div>
            <div style={{ fontSize:10, color:c.color, marginTop:1 }}>{c.sub}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize:10, color:'var(--text-hint)', marginTop:6 }}>
        T = normal allele · t = thalassaemia allele
      </div>
    </div>
  );
}

function RangeField({ field, value, onChange }) {
  const r      = RANGES[field];
  const status = getRangeStatus(field, value);
  const labels = { mcv:'MCV (fL)', mch:'MCH (pg)', hbg:'HBG (g/dL)' };
  return (
    <div style={{ marginBottom:8 }}>
      <label style={s.label}>{labels[field]} *</label>
      <div style={{ fontSize:9, color:'var(--text-hint)', marginBottom:2 }}>
        normal {r.normal[0]}–{r.normal[1]}
      </div>
      <input style={{
        ...inp,
        ...(status==='below'||status==='above' ? { background:'#FFFBEB', borderColor:'#FAC775', color:'#1a1a1a', WebkitTextFillColor:'#1a1a1a' } : {}),
        ...(status==='invalid'                 ? { background:'#fef2f2', borderColor:'#fca5a5', color:'#1a1a1a', WebkitTextFillColor:'#1a1a1a' } : {}),
      }} type="number" value={value} step="0.1"
        min={r.min} max={r.max} onChange={e => onChange(e.target.value)} required />
      {status==='below'   && <div style={s.warn}>⚠ below normal</div>}
      {status==='above'   && <div style={s.warn}>⚠ above normal</div>}
      {status==='invalid' && <div style={{ ...s.warn, color:'#b91c1c' }}>✗ out of range</div>}
    </div>
  );
}

function Field({ label, hint, value, onChange, type='text', required, ...rest }) {
  return (
    <div style={{ marginBottom:8 }}>
      <label style={s.label}>
        {label}{hint && <span style={s.opt}> ({hint})</span>}
      </label>
      <input style={inp} type={type} value={value}
        onChange={e => onChange(e.target.value)} required={required} {...rest} />
    </div>
  );
}

function CheckRow({ checked, onChange, label, warn }) {
  return (
    <div style={{ marginBottom:8 }}>
      <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer' }}>
        <input type="checkbox" checked={checked}
          onChange={e => onChange(e.target.checked)}
          style={{ width:14, height:14, accentColor:'#1D9E75', flexShrink:0 }} />
        <span style={{ fontSize:12, color:'var(--text-primary)' }}>{label}</span>
      </label>
      {checked && (
        <div style={{ fontSize:11, color:'#92400E', background:'rgba(245,158,11,0.1)',
          borderLeft:'3px solid #F59E0B', padding:'5px 8px', borderRadius:'0 4px 4px 0', marginTop:4 }}>
          {warn}
        </div>
      )}
    </div>
  );
}

const s = {
  wrap:             { maxWidth:900 },
  pageHead:         { marginBottom:18 },
  pageTitle:        { fontSize:20, fontWeight:600, color:'var(--text-primary)', letterSpacing:'-0.02em' },
  pageSub:          { fontSize:13, color:'var(--text-secondary)', marginTop:3 },
  partnerGrid:      { display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 },
  partnerCard:      { background:'var(--bg-card)', border:'0.5px solid var(--border)', borderRadius:12, padding:'16px 18px' },
  partnerLabel:     { fontSize:12, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:12 },
  row2:             { display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 },
  row3:             { display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 },
  fieldWrap:        { marginBottom:8 },
  label:            { fontSize:12, color:'var(--text-secondary)', display:'block', marginBottom:3, fontWeight:500 },
  opt:              { color:'var(--text-hint)', fontWeight:400 },
  cbcTitle:         { fontSize:12, fontWeight:600, color:'var(--text-primary)', margin:'10px 0 6px', borderTop:'0.5px solid var(--border)', paddingTop:10 },
  req:              { fontWeight:400, color:'var(--text-hint)', fontSize:11 },
  rbcHint:          { fontSize:10, color:'var(--text-hint)', margin:'6px 0 3px' },
  warn:             { fontSize:10, color:'#854F0B', marginTop:2 },
  err:              { background:'#fef2f2', color:'#b91c1c', borderRadius:8, padding:'8px 12px', fontSize:12, margin:'8px 0' },
  runBtn:           { width:'100%', padding:11, background:'#1D9E75', color:'#fff', border:'none', borderRadius:8, fontSize:13, cursor:'pointer', fontFamily:'inherit', marginBottom:20 },
  pdfBtn:           { width:'100%', padding:10, background:'#1e293b', color:'#e2e8f0', border:'0.5px solid #334155', borderRadius:8, fontSize:13, cursor:'pointer', fontFamily:'inherit', marginTop:8, marginBottom:20 },
  pdfDone:          { background:'#064E3B', color:'#6EE7B7', border:'0.5px solid #059669' },
  pdfLoading:       { opacity:0.6, cursor:'wait' },
  resultWrap:       { marginTop:6 },
  partnerResultGrid:{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 },
  indCard:          { background:'var(--bg-card)', border:'0.5px solid var(--border)', borderRadius:12, padding:'16px 18px' },
  riskCard:         { border:'0.5px solid', borderRadius:12, padding:'18px 20px', marginBottom:14 },
  riskHeader:       { marginBottom:12 },
  riskTitle:        { fontSize:16, fontWeight:600, letterSpacing:'-0.01em' },
  riskSub:          { fontSize:11, color:'var(--text-hint)', marginTop:3 },
  riskSummary:      { fontSize:13, color:'var(--text-primary)', lineHeight:1.6, marginBottom:14 },
  riskTiles:        { display:'flex', gap:10, marginBottom:14 },
  urgentBox:        { background:'#FCEBEB', border:'0.5px solid #F7C1C1', borderRadius:8, padding:'10px 12px', fontSize:12, color:'#791F1F', lineHeight:1.5, marginTop:14 },
  idBox:            { display:'flex', alignItems:'center', gap:12, padding:'10px 14px', background:'var(--bg-card)', border:'0.5px solid var(--border)', borderRadius:8, marginBottom:8 },
  idLabel:          { fontSize:11, color:'var(--text-hint)' },
  idCode:           { fontSize:11, fontFamily:'monospace', color:'var(--text-primary)', background:'var(--bg-surface)', padding:'3px 8px', borderRadius:4 },
};