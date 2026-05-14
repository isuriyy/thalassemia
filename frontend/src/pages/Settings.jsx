// src/pages/Settings.jsx
import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { getSettings, saveSettings, resetSettings } from '../utils/settings';
import { useTheme } from '../context/ThemeContext';

const SL_DISTRICTS = [
  'Ampara','Anuradhapura','Badulla','Batticaloa','Colombo','Galle',
  'Gampaha','Hambantota','Jaffna','Kalutara','Kandy','Kegalle',
  'Kilinochchi','Kurunegala','Mannar','Matale','Matara','Monaragala',
  'Mullaitivu','Nuwara Eliya','Polonnaruwa','Puttalam','Ratnapura',
  'Trincomalee','Vavuniya',
];

const DESIGNATIONS = [
  'Medical Officer',
  'Senior Medical Officer',
  'Registrar',
  'Consultant Haematologist',
  'Consultant Physician',
  'House Officer',
  'Intern Medical Officer',
  'Nursing Officer',
  'Other',
];

export default function Settings() {
  const [form,     setForm]    = useState(getSettings());
  const [saved,    setSaved]   = useState(false);
  const [didReset, setDidReset]= useState(false);
  const [touched,  setTouched] = useState(false);
  const { setTheme } = useTheme();

  useEffect(() => { setForm(getSettings()); }, []);

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    setTouched(true);
    setSaved(false);
    if (k === 'theme') setTheme(v); // ← apply immediately, live preview
  };

  const handleSave = () => {
    saveSettings(form);
    setSaved(true);
    setTouched(false);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleReset = () => {
    const d = resetSettings();
    setForm(d);
    setTheme(d.theme); // ← reset theme live too
    setDidReset(true);
    setTouched(false);
    setTimeout(() => setDidReset(false), 3000);
  };

  const isComplete = form.clinicianName.trim() && form.clinicName.trim() && form.hospital.trim();

  return (
    <Layout>
      <style>{`
        .sg2{display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start}
        .tg2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
        @media(max-width:860px){.sg2{grid-template-columns:1fr}}
        @media(max-width:520px){.tg2{grid-template-columns:1fr}}
      `}</style>

      {/* Page header */}
      <div style={s.pageHeader}>
        <div>
          <div style={s.pageTitle}>Settings</div>
          <div style={s.pageSubtitle}>
            Unit configuration — saved once, applied to all PDFs and referral letters
          </div>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
          {!isComplete && (
            <span style={s.warnBadge}>⚠ Complete setup before first screening</span>
          )}
          {saved    && <span style={s.savedBadge}>✓ Settings saved</span>}
          {didReset && <span style={s.resetBadge}>↺ Reset to defaults</span>}
        </div>
      </div>

      <div className="sg2">

        {/* ═══ LEFT — Unit Information ═══ */}
        <div style={s.card}>
          <div style={s.cardHead}>
            <span style={s.cardIcon}>🏥</span>
            <div>
              <div style={s.sectionTitle}>Unit Information</div>
              <div style={s.sectionSub}>Printed on all PDF reports and MOH referral letters</div>
            </div>
          </div>
          <div style={s.divider} />

          {/* Clinician block */}
          <div style={s.groupLabel}>Clinician</div>
          <Field label="Full name *" placeholder="e.g. Dr. K. Perera"
            value={form.clinicianName} onChange={v => set('clinicianName', v)} />
          <div style={s.fieldWrap}>
            <label style={s.label}>Designation</label>
            <select style={s.select} value={form.designation}
              onChange={e => set('designation', e.target.value)}>
              <option value="">Select designation</option>
              {DESIGNATIONS.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>

          <div style={s.divider} />

          {/* Facility block */}
          <div style={s.groupLabel}>Facility</div>
          <Field label="Clinic / Unit name *" placeholder="e.g. Thalassemia Screening Unit"
            value={form.clinicName} onChange={v => set('clinicName', v)} />
          <Field label="Hospital *" placeholder="e.g. Teaching Hospital Kandy"
            value={form.hospital} onChange={v => set('hospital', v)} />
          <div className="tg2">
            <Field label="MOH Area" placeholder="e.g. Kandy MOH"
              value={form.mohArea} onChange={v => set('mohArea', v)} />
            <Field label="Ward / Unit" placeholder="e.g. Ward 12"
              value={form.unit} onChange={v => set('unit', v)} />
          </div>

          {/* Live preview */}
          {(form.clinicianName || form.clinicName || form.hospital) && (
            <>
              <div style={s.divider} />
              <div style={s.previewLabel}>PDF header preview</div>
              <div style={s.previewBox}>
                <div style={s.prevHosp}>{form.hospital || '—'}</div>
                {form.clinicName && <div style={s.prevClinic}>{form.clinicName}</div>}
                {form.mohArea    && <div style={s.prevMoh}>{form.mohArea}</div>}
                <div style={s.prevDivider} />
                <div style={s.prevClinician}>
                  {form.clinicianName || '—'}
                  {form.designation ? ` — ${form.designation}` : ''}
                </div>
              </div>
            </>
          )}
        </div>

        {/* ═══ RIGHT — Defaults + Actions ═══ */}
        <div>
          <div style={s.card}>
            <div style={s.cardHead}>
              <span style={s.cardIcon}>⚙️</span>
              <div>
                <div style={s.sectionTitle}>Screening Defaults</div>
                <div style={s.sectionSub}>Pre-filled on every new screening</div>
              </div>
            </div>
            <div style={s.divider} />

            <div style={s.fieldWrap}>
              <label style={s.label}>Default district</label>
              <select style={s.select} value={form.defaultDistrict}
                onChange={e => set('defaultDistrict', e.target.value)}>
                <option value="">None — select each time</option>
                {SL_DISTRICTS.map(d => <option key={d}>{d}</option>)}
              </select>
              <div style={s.hint}>Pre-selects district on New Screening and Couple Screening</div>
            </div>

            <div style={s.divider} />

            {/* Theme */}
            <div style={s.groupLabel}>Appearance</div>
            <div className="tg2">
              <ThemeBtn label="Dark" icon="🌙" desc="Easier on eyes"
                active={form.theme === 'dark'} onClick={() => set('theme', 'dark')} />
              <ThemeBtn label="Light" icon="☀️" desc="High contrast"
                active={form.theme === 'light'} onClick={() => set('theme', 'light')} />
            </div>
          </div>

          {/* Info */}
          <div style={s.infoCard}>
            <div style={s.infoTitle}>ℹ How settings work</div>
            <p style={s.infoText}>
              Settings are saved to this browser's local storage and persist between
              sessions on the same workstation. If browser data is cleared, re-enter them.
            </p>
            <p style={{ ...s.infoText, marginTop:6 }}>
              The clinician name is a <strong style={{ color:'var(--text-1)' }}>default suggestion</strong> —
              it can still be changed per screening when generating a referral letter.
            </p>
          </div>

          {/* Save / Reset */}
          <div style={s.actions}>
            <button
              style={{ ...s.saveBtn, opacity: touched ? 1 : 0.55, cursor: touched ? 'pointer' : 'default' }}
              onClick={handleSave}
              disabled={!touched}
            >
              {saved ? '✓ Saved' : 'Save settings'}
            </button>
            <button style={s.resetBtn} onClick={handleReset}>
              Reset
            </button>
          </div>
        </div>

      </div>
    </Layout>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Field({ label, placeholder, value, onChange }) {
  return (
    <div style={s.fieldWrap}>
      <label style={s.label}>{label}</label>
      <input style={s.input} value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)} />
    </div>
  );
}

function ThemeBtn({ label, icon, desc, active, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{
      ...s.themeBtn,
      border:     active ? '1.5px solid #1D9E75' : '0.5px solid var(--border)',
      background: active ? 'rgba(29,158,117,0.08)' : 'var(--bg-input)',
    }}>
      <div style={{ fontSize:18, marginBottom:4 }}>{icon}</div>
      <div style={{ fontSize:12, fontWeight:600, color: active ? '#1D9E75' : 'var(--text-1)', marginBottom:2 }}>
        {label}
      </div>
      <div style={{ fontSize:10, color:'var(--text-3)' }}>{desc}</div>
      {active && <div style={s.themeCheck}>✓</div>}
    </button>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const s = {
  pageHeader:  { display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:12, marginBottom:16 },
  pageTitle:   { fontSize:18, fontWeight:700, color:'var(--text-1)' },
  pageSubtitle:{ fontSize:12, color:'var(--text-3)', marginTop:3 },

  warnBadge:   { fontSize:11, padding:'5px 12px', borderRadius:20, background:'rgba(245,158,11,0.12)', color:'#92400E', border:'0.5px solid rgba(245,158,11,0.35)', fontWeight:500 },
  savedBadge:  { fontSize:11, padding:'5px 12px', borderRadius:20, background:'rgba(29,158,117,0.12)', color:'#1D9E75', border:'0.5px solid rgba(29,158,117,0.35)', fontWeight:500 },
  resetBadge:  { fontSize:11, padding:'5px 12px', borderRadius:20, background:'rgba(99,102,241,0.1)', color:'#6366F1', border:'0.5px solid rgba(99,102,241,0.25)', fontWeight:500 },

  card:        { background:'var(--bg-card)', border:'0.5px solid var(--border)', borderRadius:12, padding:'18px 20px', marginBottom:12 },
  cardHead:    { display:'flex', alignItems:'flex-start', gap:12, marginBottom:14 },
  cardIcon:    { fontSize:20, lineHeight:1, marginTop:2 },
  sectionTitle:{ fontSize:13, fontWeight:600, color:'var(--text-1)' },
  sectionSub:  { fontSize:11, color:'var(--text-3)', marginTop:2 },
  divider:     { height:'0.5px', background:'var(--border)', margin:'14px 0' },

  groupLabel:  { fontSize:10, fontWeight:600, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 },
  fieldWrap:   { marginBottom:12 },
  label:       { fontSize:12, color:'var(--text-2)', display:'block', marginBottom:4, fontWeight:500 },
  input:       { width:'100%', padding:'8px 10px', border:'0.5px solid var(--border)', borderRadius:8, fontSize:13, boxSizing:'border-box', outline:'none', background:'var(--bg-input)', color:'var(--text-primary)', WebkitTextFillColor:'var(--text-primary)', fontFamily:'inherit' },
  select:      { width:'100%', padding:'8px 10px', border:'0.5px solid var(--border)', borderRadius:8, fontSize:13, boxSizing:'border-box', background:'var(--bg-input)', color:'var(--text-1)', fontFamily:'inherit', cursor:'pointer' },
  hint:        { fontSize:11, color:'var(--text-3)', marginTop:4, lineHeight:1.5 },

  previewLabel:{ fontSize:10, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 },
  previewBox:  { background:'var(--bg-input)', border:'0.5px solid var(--border)', borderRadius:8, padding:'12px 14px' },
  prevHosp:    { fontSize:13, fontWeight:600, color:'var(--text-1)' },
  prevClinic:  { fontSize:12, color:'var(--text-2)', marginTop:2 },
  prevMoh:     { fontSize:11, color:'var(--text-3)', marginTop:1 },
  prevDivider: { height:'0.5px', background:'var(--border)', margin:'8px 0' },
  prevClinician:{ fontSize:12, color:'var(--text-2)' },

  themeBtn:    { width:'100%', padding:'12px', borderRadius:10, cursor:'pointer', textAlign:'left', fontFamily:'inherit', position:'relative', transition:'border-color 0.2s, background 0.2s' },
  themeCheck:  { position:'absolute', top:8, right:10, fontSize:11, color:'#1D9E75', fontWeight:700 },

  infoCard:    { background:'rgba(99,102,241,0.06)', border:'0.5px solid rgba(99,102,241,0.2)', borderRadius:10, padding:'14px 16px', marginBottom:12 },
  infoTitle:   { fontSize:12, fontWeight:600, color:'var(--text-1)', marginBottom:6 },
  infoText:    { fontSize:11, color:'var(--text-2)', lineHeight:1.6, margin:0 },

  actions:     { display:'flex', gap:8 },
  saveBtn:     { flex:1, padding:'10px', background:'#1D9E75', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontFamily:'inherit', fontWeight:500, transition:'opacity 0.2s' },
  resetBtn:    { padding:'10px 16px', background:'transparent', color:'var(--text-3)', border:'0.5px solid var(--border)', borderRadius:8, fontSize:12, cursor:'pointer', fontFamily:'inherit' },
};
