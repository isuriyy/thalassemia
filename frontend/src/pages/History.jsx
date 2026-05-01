import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Layout from '../components/Layout';
import api from '../api/api';

const OUTCOMES = ['Pending', 'Confirmed Carrier', 'Not Confirmed', 'Lost to Follow-up'];

const OUTCOME_STYLE = {
  'Pending':           { bg:'#F1F5F9', color:'#64748B', border:'#CBD5E1' },
  'Confirmed Carrier': { bg:'#FCEBEB', color:'#A32D2D', border:'#F7C1C1' },
  'Not Confirmed':     { bg:'#E1F5EE', color:'#085041', border:'#9FE1CB' },
  'Lost to Follow-up': { bg:'#FFFBEB', color:'#633806', border:'#FAC775' },
};

export default function History() {
  const [records,  setRecords]  = useState([]);
  const [stats,    setStats]    = useState(null);
  const [search,   setSearch]   = useState('');
  const [filter,   setFilter]   = useState('all');
  const [page,     setPage]     = useState(1);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [expanded, setExpanded] = useState(null);   // record _id with open outcome panel
  const [saving,   setSaving]   = useState(null);   // record _id currently saving
  const [draftOutcome, setDraftOutcome] = useState({});  // { [_id]: { outcome, note } }
  const LIMIT = 20;

  const fetchData = async () => {
    setLoading(true);
    try {
      const [h, s] = await Promise.all([
        api.get(`/history?page=${page}&limit=${LIMIT}`),
        api.get('/history/stats'),
      ]);
      setRecords(h.data.records || []);
      setTotal(h.data.pagination?.total || 0);
      setStats(s.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [page]);

  const filters = [
    { key:'all',        label:'All'          },
    { key:'carrier',    label:'Carriers'     },
    { key:'noncarrier', label:'Non-carriers' },
    { key:'referral',   label:'Referrals'    },
    { key:'pending',    label:'Pending follow-up' },
  ];

  const filtered = records.filter(r => {
    const matchSearch = !search ||
      r.patientId?.toLowerCase().includes(search.toLowerCase()) ||
      r.label?.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === 'all'        ? true :
      filter === 'carrier'    ? r.prediction === 1 :
      filter === 'noncarrier' ? r.prediction === 0 :
      filter === 'referral'   ? r.referral_recommended :
      filter === 'pending'    ? (!r.outcome || r.outcome === 'Pending') : true;
    return matchSearch && matchFilter;
  });

  const toggleExpand = (id) => {
    setExpanded(e => e === id ? null : id);
  };

  const getDraft = (r) => draftOutcome[r._id] || {
    outcome:  r.outcome      || 'Pending',
    note:     r.outcomeNote  || '',
  };

  const setDraft = (id, key, val) => {
    setDraftOutcome(d => ({
      ...d,
      [id]: { ...getDraft({ _id: id }), [key]: val }
    }));
  };

  const saveOutcome = async (r) => {
    const draft = getDraft(r);
    setSaving(r._id);
    try {
      await api.patch(`/history/${r._id}/outcome`, {
        outcome:     draft.outcome,
        outcomeNote: draft.note,
      });
      // Update local records so badge reflects immediately
      setRecords(prev => prev.map(rec =>
        rec._id === r._id
          ? { ...rec, outcome: draft.outcome, outcomeNote: draft.note, outcomeUpdatedAt: new Date().toISOString() }
          : rec
      ));
      setExpanded(null);
    } catch (err) {
      alert(err.response?.data?.message || 'Save failed');
    } finally { setSaving(null); }
  };

  const exportCSV = () => {
    const hdr = 'date,patient_id,age,mcv,mch,hgb,prediction,probability,confidence,referral,outcome\n';
    const rows = filtered.map(r =>
      `${new Date(r.createdAt).toLocaleDateString()},${r.patientId},${r.age},${r.cbcParams?.MCV},${r.cbcParams?.MCH},${r.cbcParams?.HBG},${r.label},${Math.round(r.carrier_probability*100)}%,${r.confidence},${r.referral_recommended?'Yes':'No'},${r.outcome||'Pending'}`
    ).join('\n');
    const blob = new Blob([hdr+rows], {type:'text/csv'});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href=url; a.download='screening_history.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const pages = Math.ceil(total / LIMIT);

  // Pending follow-up count (carriers with Pending outcome)
  const pendingCount = records.filter(r =>
    r.prediction === 1 && (!r.outcome || r.outcome === 'Pending')
  ).length;

  return (
    <Layout>

      {/* ── Stat row ── */}
      <div style={s.metricRow}>
        {[
          { val: stats?.total,                   label:'Total screened', color:'var(--text-primary)' },
          { val: stats?.carriers,                label:'Carriers',       color:'#A32D2D' },
          { val: stats?.nonCarriers,             label:'Non-carriers',   color:'#0F6E56' },
          { val: `${stats?.carrierRate || 0}%`,  label:'Carrier rate',   color:'var(--text-primary)' },
          { val: pendingCount,                   label:'Pending follow-up', color:'#633806' },
        ].map((m, i) => (
          <div key={i} style={s.metricCard}>
            <div style={{ fontSize:22, fontWeight:500, color:m.color }}>{loading ? '—' : m.val}</div>
            <div style={{ fontSize:11, color:'var(--text-hint)', marginTop:3 }}>{m.label}</div>
          </div>
        ))}
      </div>

      {/* ── Table card ── */}
      <div style={s.card}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <div style={s.cardTitle}>Prediction records</div>
          <button style={s.exportBtn} onClick={exportCSV}>Export CSV</button>
        </div>

        <input
          style={s.searchBar}
          placeholder="Search by patient ID or result…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        <div style={s.filterRow}>
          {filters.map(f => (
            <button key={f.key}
              style={filter===f.key ? s.filterSel : s.filterBtn}
              onClick={() => setFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={s.empty}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={s.empty}>No records found</div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={s.tbl}>
              <thead>
                <tr>
                  {['Date/Time','Patient ID','Age','MCV','MCH','HBG',
                    'Prediction','Probability','Confidence','Referral',
                    'Outcome',''].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const isOpen    = expanded === r._id;
                  const isSaving  = saving   === r._id;
                  const draft     = getDraft(r);
                  const outcome   = r.outcome || 'Pending';
                  const os        = OUTCOME_STYLE[outcome] || OUTCOME_STYLE['Pending'];
                  const showPanel = r.prediction === 1 || r.referral_recommended;

                  return (
                    <>
                      <tr key={r._id}
                        style={{ background: i%2===0 ? 'var(--bg-page)' : 'var(--bg-card)' }}>
                        <td style={{ ...s.td, color:'var(--text-hint)' }}>
                          {new Date(r.createdAt).toLocaleDateString('en-GB',{day:'2-digit',month:'short'})}
                          {' '}
                          {new Date(r.createdAt).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}
                        </td>
                        <td style={s.td}>{r.patientId || '—'}</td>
                        <td style={s.td}>{r.age}</td>
                        <td style={s.td}>{r.cbcParams?.MCV}</td>
                        <td style={s.td}>{r.cbcParams?.MCH}</td>
                        <td style={s.td}>{r.cbcParams?.HBG}</td>
                        <td style={s.td}>
                          <span style={r.prediction===1 ? s.tagC : s.tagNC}>{r.label}</span>
                        </td>
                        <td style={s.td}>{Math.round(r.carrier_probability*100)}%</td>
                        <td style={s.td}>
                          <span style={r.confidence==='High'?s.confH:r.confidence==='Moderate'?s.confM:s.confL}>
                            {r.confidence}
                          </span>
                        </td>
                        <td style={{ ...s.td, color: r.referral_recommended?'#A32D2D':'var(--text-hint)' }}>
                          {r.referral_recommended ? 'Yes' : 'No'}
                        </td>

                        {/* Outcome badge */}
                        <td style={s.td}>
                          <span style={{
                            ...s.outcomeBadge,
                            background: os.bg,
                            color:      os.color,
                            border:     `0.5px solid ${os.border}`,
                          }}>
                            {outcome}
                          </span>
                        </td>

                        {/* Expand toggle — only for carriers / referrals */}
                        <td style={{ ...s.td, textAlign:'center' }}>
                          {showPanel && (
                            <button
                              style={s.editBtn}
                              onClick={() => toggleExpand(r._id)}
                              title="Update follow-up outcome"
                            >
                              {isOpen ? '✕' : '✎'}
                            </button>
                          )}
                        </td>
                      </tr>

                      {/* ── Inline outcome panel ── */}
                      {isOpen && (
                        <tr key={`${r._id}-panel`}>
                          <td colSpan={12} style={s.panelCell}>
                            <div style={s.panel}>
                              <div style={s.panelTitle}>
                                Follow-up outcome
                                <span style={s.panelSub}>
                                  {r.patientId || 'Anonymous'} ·{' '}
                                  {r.outcomeUpdatedAt
                                    ? `Last updated ${new Date(r.outcomeUpdatedAt).toLocaleDateString('en-GB')}`
                                    : 'Not yet recorded'}
                                </span>
                              </div>

                              <div style={s.panelBody}>
                                {/* Outcome selector */}
                                <div style={s.panelField}>
                                  <label style={s.panelLabel}>Outcome</label>
                                  <div style={s.outcomeOptions}>
                                    {OUTCOMES.map(o => {
                                      const os2 = OUTCOME_STYLE[o];
                                      const sel  = draft.outcome === o;
                                      return (
                                        <button key={o}
                                          onClick={() => setDraft(r._id, 'outcome', o)}
                                          style={{
                                            ...s.outcomeOpt,
                                            background:  sel ? os2.bg     : 'var(--bg-card)',
                                            color:       sel ? os2.color  : 'var(--text-secondary)',
                                            border:      sel ? `1.5px solid ${os2.border}` : '0.5px solid var(--border)',
                                            fontWeight:  sel ? 600 : 400,
                                          }}>
                                          {o}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* Note */}
                                <div style={s.panelField}>
                                  <label style={s.panelLabel}>Clinical note <span style={{ fontWeight:400, color:'var(--text-hint)' }}>(optional)</span></label>
                                  <textarea
                                    style={s.noteArea}
                                    rows={2}
                                    placeholder="e.g. HbA2 confirmed 4.2% by HPLC — thalassaemia minor"
                                    value={draft.note}
                                    onChange={e => setDraft(r._id, 'note', e.target.value)}
                                  />
                                </div>

                                {/* Save */}
                                <button
                                  style={{ ...s.saveBtn, ...(isSaving ? { opacity:0.6, cursor:'wait' } : {}) }}
                                  disabled={isSaving}
                                  onClick={() => saveOutcome(r)}>
                                  {isSaving ? 'Saving…' : 'Save outcome'}
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
          marginTop:12, fontSize:12, color:'var(--text-hint)' }}>
          <span>Showing {filtered.length} of {total}</span>
          {pages > 1 && (
            <div style={{ display:'flex', gap:4 }}>
              <button style={s.pageBtn} disabled={page===1} onClick={() => setPage(p=>p-1)}>Prev</button>
              {Array.from({length:Math.min(pages,5)},(_,i)=>i+1).map(p => (
                <button key={p} style={p===page?s.pageBtnActive:s.pageBtn} onClick={() => setPage(p)}>{p}</button>
              ))}
              <button style={s.pageBtn} disabled={page===pages} onClick={() => setPage(p=>p+1)}>Next</button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = {
  metricRow:    { display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10, marginBottom:16 },
  metricCard:   { background:'var(--bg-card)', border:'0.5px solid var(--border)', borderRadius:12, padding:'12px 14px' },
  card:         { background:'var(--bg-card)', border:'0.5px solid var(--border)', borderRadius:12, padding:'14px 16px' },
  cardTitle:    { fontSize:13, fontWeight:500, color:'var(--text-primary)' },
  searchBar:    { width:'100%', padding:'8px 12px', border:'0.5px solid var(--border)', borderRadius:8,
                  fontSize:13, boxSizing:'border-box', marginBottom:10,
                  background:'var(--bg-input)', color:'var(--text-primary)', outline:'none',
                  WebkitTextFillColor:'var(--text-primary)' },
  filterRow:    { display:'flex', gap:6, flexWrap:'wrap', marginBottom:12 },
  filterBtn:    { padding:'4px 12px', borderRadius:20, fontSize:12, border:'0.5px solid var(--border)',
                  color:'var(--text-secondary)', background:'transparent', cursor:'pointer' },
  filterSel:    { padding:'4px 12px', borderRadius:20, fontSize:12, border:'0.5px solid #9FE1CB',
                  color:'#0F6E56', background:'#E1F5EE', cursor:'pointer' },
  exportBtn:    { fontSize:12, color:'#0F6E56', border:'0.5px solid #9FE1CB', borderRadius:20,
                  padding:'4px 12px', background:'#E1F5EE', cursor:'pointer' },
  empty:        { fontSize:13, color:'var(--text-hint)', padding:'24px 0', textAlign:'center' },
  tbl:          { width:'100%', borderCollapse:'collapse', fontSize:12 },
  th:           { textAlign:'left', fontSize:11, color:'var(--text-hint)', fontWeight:500,
                  padding:'6px 10px', borderBottom:'0.5px solid var(--border)', whiteSpace:'nowrap' },
  td:           { padding:'8px 10px', borderBottom:'0.5px solid var(--border)',
                  color:'var(--text-primary)', whiteSpace:'nowrap', verticalAlign:'middle' },
  tagC:         { display:'inline-block', padding:'2px 8px', borderRadius:20, fontSize:11, background:'#FCEBEB', color:'#A32D2D' },
  tagNC:        { display:'inline-block', padding:'2px 8px', borderRadius:20, fontSize:11, background:'#E1F5EE', color:'#0F6E56' },
  confH:        { fontSize:11, padding:'2px 7px', borderRadius:20, background:'#E1F5EE', color:'#0F6E56' },
  confM:        { fontSize:11, padding:'2px 7px', borderRadius:20, background:'#FAEEDA', color:'#633806' },
  confL:        { fontSize:11, padding:'2px 7px', borderRadius:20, background:'#FCEBEB', color:'#A32D2D' },
  outcomeBadge: { display:'inline-block', padding:'2px 9px', borderRadius:20, fontSize:11, fontWeight:500 },
  editBtn:      { fontSize:13, background:'transparent', border:'0.5px solid var(--border)',
                  borderRadius:6, padding:'2px 8px', cursor:'pointer', color:'var(--text-secondary)' },
  pageBtn:      { padding:'3px 10px', border:'0.5px solid var(--border)', borderRadius:6,
                  fontSize:12, cursor:'pointer', background:'transparent', color:'var(--text-secondary)' },
  pageBtnActive:{ padding:'3px 10px', border:'0.5px solid #1D9E75', borderRadius:6,
                  fontSize:12, cursor:'pointer', background:'transparent', color:'#0F6E56' },

  // Outcome panel
  panelCell:    { padding:0, background:'var(--bg-surface)', borderBottom:'0.5px solid var(--border)' },
  panel:        { padding:'14px 16px', borderLeft:'3px solid #1D9E75' },
  panelTitle:   { fontSize:13, fontWeight:600, color:'var(--text-primary)', marginBottom:10,
                  display:'flex', alignItems:'baseline', gap:10 },
  panelSub:     { fontSize:11, color:'var(--text-hint)', fontWeight:400 },
  panelBody:    { display:'flex', gap:16, alignItems:'flex-start', flexWrap:'wrap' },
  panelField:   { display:'flex', flexDirection:'column', gap:5 },
  panelLabel:   { fontSize:11, fontWeight:600, color:'var(--text-secondary)',
                  textTransform:'uppercase', letterSpacing:'0.05em' },
  outcomeOptions:{ display:'flex', gap:6, flexWrap:'wrap' },
  outcomeOpt:   { fontSize:12, padding:'4px 12px', borderRadius:20, cursor:'pointer',
                  fontFamily:'inherit', transition:'all 0.15s' },
  noteArea:     { fontSize:12, padding:'7px 10px', border:'0.5px solid var(--border)',
                  borderRadius:8, background:'var(--bg-input)', color:'var(--text-primary)',
                  fontFamily:'inherit', outline:'none', resize:'vertical', minWidth:260,
                  WebkitTextFillColor:'var(--text-primary)' },
  saveBtn:      { padding:'7px 18px', background:'#1D9E75', color:'#fff', border:'none',
                  borderRadius:8, fontSize:12, cursor:'pointer', fontFamily:'inherit',
                  alignSelf:'flex-end', marginTop:18 },
};