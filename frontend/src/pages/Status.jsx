import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import api    from '../api/api';

const CHECK_INTERVAL_MS = 30000; // re-check every 30s

export default function Status() {
  const [checks,    setChecks]    = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [lastCheck, setLastCheck] = useState(null);
  const [errors,    setErrors]    = useState([]);

  const runChecks = async () => {
    setLoading(true);
    const results = { api: null, db: null, ml: null };
    const errs = [];
    const t = Date.now();

    // Check 1 — Node backend
    try {
      const r = await api.get('/health', { timeout: 5000 });
      results.api = { ok: r.status === 200, ms: Date.now()-t, detail: 'Node/Express backend' };
    } catch(e) {
      results.api = { ok: false, ms: null, detail: e.message };
      errs.push({ time: new Date().toLocaleTimeString(), msg: `Backend: ${e.message}` });
    }

    // Check 2 — MongoDB (via backend stats endpoint)
    try {
      const t2 = Date.now();
      const r = await api.get('/history/stats', { timeout: 5000 });
      results.db = { ok: true, ms: Date.now()-t2, detail: 'MongoDB Atlas connection' };
    } catch(e) {
      results.db = { ok: false, ms: null, detail: e.response?.data?.message || e.message };
      errs.push({ time: new Date().toLocaleTimeString(), msg: `Database: ${e.message}` });
    }

    // Check 3 — Python ML API (via backend proxy or direct)
    try {
      const t3 = Date.now();
      const r = await api.get('/predict/health', { timeout: 8000 });
      results.ml = { ok: r.status === 200, ms: Date.now()-t3, detail: 'Python SVM model API (port 5001)' };
    } catch(e) {
      results.ml = { ok: false, ms: null, detail: 'Python API unreachable — ensure uvicorn is running on port 5001' };
      errs.push({ time: new Date().toLocaleTimeString(), msg: `ML API: ${e.message}` });
    }

    setChecks(results);
    setErrors(prev => [...errs, ...prev].slice(0, 10)); // keep last 10
    setLastCheck(new Date().toLocaleTimeString());
    setLoading(false);
  };

  useEffect(() => {
    runChecks();
    const id = setInterval(runChecks, CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const allOk = checks && Object.values(checks).every(c => c?.ok);

  return (
    <Layout>
      <div style={s.wrap}>

        {/* Header */}
        <div style={s.header}>
          <div>
            <div style={s.title}>System Status</div>
            <div style={s.sub}>
              Service health check · auto-refreshes every 30s
              {lastCheck && ` · last checked ${lastCheck}`}
            </div>
          </div>
          <button style={s.refreshBtn} onClick={runChecks} disabled={loading}>
            {loading ? 'Checking…' : 'Refresh now'}
          </button>
        </div>

        {/* Overall status banner */}
        {checks && (
          <div style={{ ...s.banner, background: allOk ? '#E1F5EE' : '#FCEBEB', borderColor: allOk ? '#9FE1CB' : '#F7C1C1' }}>
            <span style={{ ...s.bannerDot, background: allOk ? '#1D9E75' : '#E24B4A' }} />
            <span style={{ fontSize:13, fontWeight:500, color: allOk ? '#085041' : '#791F1F' }}>
              {allOk
                ? 'All systems operational'
                : 'One or more services are not responding — contact technical support'}
            </span>
          </div>
        )}

        {/* Service checks */}
        <div style={s.section}>
          <div style={s.sectionTitle}>Services</div>
          <div style={s.checkList}>
            <ServiceRow
              loading={loading || !checks}
              label="Backend API"
              sublabel="Node.js / Express — port 3001"
              check={checks?.api}
            />
            <ServiceRow
              loading={loading || !checks}
              label="Database"
              sublabel="MongoDB Atlas"
              check={checks?.db}
            />
            <ServiceRow
              loading={loading || !checks}
              label="ML Model API"
              sublabel="Python / uvicorn — port 5001"
              check={checks?.ml}
            />
          </div>
        </div>

        {/* How to fix section */}
        <div style={s.section}>
          <div style={s.sectionTitle}>If something is down</div>
          <div style={s.fixCard}>
            <FixRow
              service="Backend API (port 3001)"
              command="cd C:\Users\Isuri\thalassemia\backend && node src/index.js"
            />
            <FixRow
              service="ML Model API (port 5001)"
              command="cd C:\Users\Isuri\Documents\thalassemia-api && venv\Scripts\activate && python -m uvicorn app.main:app --host 0.0.0.0 --port 5001"
            />
            <FixRow
              service="Frontend (port 5173)"
              command="cd C:\Users\Isuri\thalassemia\frontend && npm run dev"
            />
          </div>
        </div>

        {/* Recent errors */}
        {errors.length > 0 && (
          <div style={s.section}>
            <div style={s.sectionTitle}>Recent errors this session</div>
            <div style={s.errorList}>
              {errors.map((e, i) => (
                <div key={i} style={s.errorRow}>
                  <span style={s.errorTime}>{e.time}</span>
                  <span style={s.errorMsg}>{e.msg}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* System info */}
        <div style={s.section}>
          <div style={s.sectionTitle}>System information</div>
          <div style={s.infoGrid}>
            {[
              ['Application',  'ThalaPredict v1.0'],
              ['ML Model',     'SVM — scikit-learn'],
              ['AUC-ROC',      '0.829'],
              ['Recall',       '75.0%'],
              ['Threshold',    '0.49'],
              ['Features',     '10 CBC-derived features'],
              ['Backend',      'Node.js / Express / MongoDB'],
              ['ML Runtime',   'Python / uvicorn / FastAPI'],
            ].map(([k,v]) => (
              <div key={k} style={s.infoRow}>
                <span style={s.infoKey}>{k}</span>
                <span style={s.infoVal}>{v}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </Layout>
  );
}

// ── ServiceRow ────────────────────────────────────────────────────────────────
function ServiceRow({ loading, label, sublabel, check }) {
  return (
    <div style={sr.row}>
      <div style={sr.left}>
        <div style={sr.label}>{label}</div>
        <div style={sr.sublabel}>{sublabel}</div>
      </div>
      <div style={sr.right}>
        {loading || !check ? (
          <span style={{ ...sr.badge, background:'#f1f5f9', color:'#64748b' }}>Checking…</span>
        ) : check.ok ? (
          <>
            <span style={{ ...sr.badge, background:'#E1F5EE', color:'#085041' }}>Operational</span>
            {check.ms && <span style={sr.ms}>{check.ms}ms</span>}
          </>
        ) : (
          <span style={{ ...sr.badge, background:'#FCEBEB', color:'#791F1F' }}>Down</span>
        )}
      </div>
      {check && !check.ok && (
        <div style={sr.detail}>{check.detail}</div>
      )}
    </div>
  );
}

const sr = {
  row:      { display:'flex', alignItems:'center', flexWrap:'wrap', gap:8, padding:'12px 14px', borderBottom:'0.5px solid var(--border)' },
  left:     { flex:1, minWidth:0 },
  label:    { fontSize:13, fontWeight:500, color:'var(--text-primary)' },
  sublabel: { fontSize:11, color:'var(--text-hint)', marginTop:2 },
  right:    { display:'flex', alignItems:'center', gap:8, flexShrink:0 },
  badge:    { fontSize:11, fontWeight:500, padding:'3px 10px', borderRadius:20 },
  ms:       { fontSize:11, color:'var(--text-hint)' },
  detail:   { width:'100%', fontSize:11, color:'#b91c1c', background:'#fef2f2', padding:'6px 8px', borderRadius:6, marginTop:4 },
};

// ── FixRow ────────────────────────────────────────────────────────────────────
function FixRow({ service, command }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div style={fr.wrap}>
      <div style={fr.service}>{service}</div>
      <div style={fr.cmdRow}>
        <code style={fr.cmd}>{command}</code>
        <button style={fr.copy} onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
      </div>
    </div>
  );
}

const fr = {
  wrap:    { marginBottom:12 },
  service: { fontSize:12, fontWeight:500, color:'var(--text-secondary)', marginBottom:5 },
  cmdRow:  { display:'flex', alignItems:'flex-start', gap:8 },
  cmd:     { flex:1, fontSize:11, fontFamily:'monospace', background:'var(--bg-surface)', border:'0.5px solid var(--border)', borderRadius:6, padding:'8px 10px', color:'var(--text-primary)', wordBreak:'break-all', lineHeight:1.6 },
  copy:    { fontSize:11, background:'var(--brand-light)', color:'var(--brand-dark)', border:'0.5px solid var(--brand-border)', borderRadius:6, padding:'6px 10px', cursor:'pointer', flexShrink:0, fontFamily:'inherit' },
};

// ── Page styles ────────────────────────────────────────────────────────────────
const s = {
  wrap:         { maxWidth:680, margin:'0 auto' },
  header:       { display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20, gap:12 },
  title:        { fontSize:20, fontWeight:600, color:'var(--text-primary)', letterSpacing:'-0.02em' },
  sub:          { fontSize:12, color:'var(--text-hint)', marginTop:3 },
  refreshBtn:   { fontSize:12, background:'var(--bg-card)', border:'0.5px solid var(--border)', borderRadius:8, padding:'7px 14px', cursor:'pointer', color:'var(--text-secondary)', fontFamily:'inherit', flexShrink:0 },
  banner:       { display:'flex', alignItems:'center', gap:10, padding:'12px 16px', borderRadius:10, border:'0.5px solid', marginBottom:20 },
  bannerDot:    { width:8, height:8, borderRadius:'50%', flexShrink:0 },
  section:      { marginBottom:22 },
  sectionTitle: { fontSize:11, fontWeight:600, color:'var(--text-hint)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 },
  checkList:    { background:'var(--bg-card)', border:'0.5px solid var(--border)', borderRadius:10, overflow:'hidden' },
  fixCard:      { background:'var(--bg-card)', border:'0.5px solid var(--border)', borderRadius:10, padding:'14px 16px' },
  errorList:    { background:'var(--bg-card)', border:'0.5px solid #fca5a5', borderRadius:10, overflow:'hidden' },
  errorRow:     { display:'flex', gap:12, padding:'8px 14px', borderBottom:'0.5px solid var(--border)', fontSize:12 },
  errorTime:    { color:'var(--text-hint)', flexShrink:0, fontFamily:'monospace' },
  errorMsg:     { color:'#b91c1c' },
  infoGrid:     { background:'var(--bg-card)', border:'0.5px solid var(--border)', borderRadius:10, overflow:'hidden' },
  infoRow:      { display:'flex', justifyContent:'space-between', padding:'9px 14px', borderBottom:'0.5px solid var(--border)', fontSize:12 },
  infoKey:      { color:'var(--text-hint)' },
  infoVal:      { color:'var(--text-primary)', fontWeight:500 },
};
