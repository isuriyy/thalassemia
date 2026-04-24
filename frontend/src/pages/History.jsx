import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Layout from '../components/Layout';
import api from '../api/api';

export default function History() {
  const [records,  setRecords]  = useState([]);
  const [stats,    setStats]    = useState(null);
  const [search,   setSearch]   = useState('');
  const [filter,   setFilter]   = useState('all');
  const [page,     setPage]     = useState(1);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [allRecs,  setAllRecs]  = useState([]);
  const LIMIT = 20;

  const fetchData = async () => {
    setLoading(true);
    try {
      const [h, s, all] = await Promise.all([
        api.get(`/history?page=${page}&limit=${LIMIT}`),
        api.get('/history/stats'),
        api.get('/history?limit=200'),
      ]);
      setRecords(h.data.records || []);
      setTotal(h.data.pagination?.total || 0);
      setStats(s.data);
      setAllRecs(all.data.records || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [page]);

  // Build daily carrier rate chart data from all records
  const chartData = (() => {
    if (!allRecs.length) return [];
    const byDay = {};
    allRecs.forEach(r => {
      const day = new Date(r.createdAt).toLocaleDateString('en-GB', { day:'2-digit', month:'short' });
      if (!byDay[day]) byDay[day] = { day, total:0, carriers:0 };
      byDay[day].total++;
      if (r.prediction === 1) byDay[day].carriers++;
    });
    return Object.values(byDay).map(d => ({
      day: d.day,
      rate: d.total > 0 ? Math.round((d.carriers / d.total) * 100) : 0,
      total: d.total,
      carriers: d.carriers,
    })).slice(-14); // last 14 days
  })();

  const filters = [
    { key:'all',        label:'All' },
    { key:'carrier',    label:'Carriers only' },
    { key:'noncarrier', label:'Non-carriers' },
    { key:'referral',   label:'Referrals' },
  ];

  const filtered = records.filter(r => {
    const matchSearch = !search ||
      r.patientId?.toLowerCase().includes(search.toLowerCase()) ||
      r.label?.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === 'all'        ? true :
      filter === 'carrier'    ? r.prediction === 1 :
      filter === 'noncarrier' ? r.prediction === 0 :
      filter === 'referral'   ? r.referral_recommended : true;
    return matchSearch && matchFilter;
  });

  const exportCSV = () => {
    const hdr = 'date,patient_id,age,mcv,mch,hgb,prediction,probability,confidence,referral\n';
    const rows = filtered.map(r =>
      `${new Date(r.createdAt).toLocaleDateString()},${r.patientId},${r.age},${r.cbcParams?.MCV},${r.cbcParams?.MCH},${r.cbcParams?.HBG},${r.label},${Math.round(r.carrier_probability*100)}%,${r.confidence},${r.referral_recommended?'Yes':'No'}`
    ).join('\n');
    const blob = new Blob([hdr + rows], { type:'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'screening_history.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const pages = Math.ceil(total / LIMIT);

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background:'#fff', border:'0.5px solid #e5e5e5', borderRadius:8, padding:'8px 12px', fontSize:12 }}>
        <div style={{ fontWeight:500, marginBottom:4 }}>{label}</div>
        <div style={{ color:'#A32D2D' }}>Carrier rate: {payload[0]?.value}%</div>
        <div style={{ color:'#888' }}>Screened: {payload[0]?.payload?.total}</div>
        <div style={{ color:'#A32D2D' }}>Carriers: {payload[0]?.payload?.carriers}</div>
      </div>
    );
  };

  return (
    <Layout>
      <div style={s.metricRow}>
        {[
          { val: stats?.total,                    label:'Total screened', color:'#1a1a1a' },
          { val: stats?.carriers,                 label:'Carriers',       color:'#A32D2D' },
          { val: stats?.nonCarriers,              label:'Non-carriers',   color:'#0F6E56' },
          { val: `${stats?.carrierRate || 0}%`,   label:'Carrier rate',   color:'#1a1a1a' },
        ].map((m, i) => (
          <div key={i} style={s.metricCard}>
            <div style={{ fontSize:22, fontWeight:500, color:m.color }}>{loading ? '—' : m.val}</div>
            <div style={{ fontSize:11, color:'#888', marginTop:3 }}>{m.label}</div>
          </div>
        ))}
      </div>

      {chartData.length > 1 && (
        <div style={{ ...s.card, marginBottom:12 }}>
          <div style={{ ...s.cardTitle, marginBottom:12 }}>
            Carrier rate over time
            <span style={{ fontWeight:400, color:'#aaa', fontSize:11, marginLeft:8 }}>
              last {chartData.length} days
            </span>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={chartData} margin={{ top:5, right:20, left:0, bottom:5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="day"
                tick={{ fontSize:11, fill:'#aaa' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                unit="%"
                tick={{ fontSize:11, fill:'#aaa' }}
                axisLine={false}
                tickLine={false}
                domain={[0, 100]}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="rate"
                stroke="#E24B4A"
                strokeWidth={2}
                dot={{ fill:'#E24B4A', r:4, strokeWidth:0 }}
                activeDot={{ r:6, strokeWidth:0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

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
            <button
              key={f.key}
              style={filter === f.key ? s.filterSel : s.filterBtn}
              onClick={() => setFilter(f.key)}
            >
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
                  {['Date/Time','Patient ID','Age','MCV','MCH','HBG','Prediction','Probability','Confidence','Referral'].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={{ ...s.td, color:'#888' }}>
                      {new Date(r.createdAt).toLocaleDateString('en-GB', { day:'2-digit', month:'short' })}
                      {' '}
                      {new Date(r.createdAt).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })}
                    </td>
                    <td style={s.td}>{r.patientId || '—'}</td>
                    <td style={s.td}>{r.age}</td>
                    <td style={s.td}>{r.cbcParams?.MCV}</td>
                    <td style={s.td}>{r.cbcParams?.MCH}</td>
                    <td style={s.td}>{r.cbcParams?.HBG}</td>
                    <td style={s.td}>
                      <span style={r.prediction === 1 ? s.tagC : s.tagNC}>{r.label}</span>
                    </td>
                    <td style={s.td}>{Math.round(r.carrier_probability * 100)}%</td>
                    <td style={s.td}>
                      <span style={r.confidence==='High' ? s.confH : r.confidence==='Moderate' ? s.confM : s.confL}>
                        {r.confidence}
                      </span>
                    </td>
                    <td style={{ ...s.td, color: r.referral_recommended ? '#A32D2D' : '#aaa' }}>
                      {r.referral_recommended ? 'Yes' : 'No'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:12, fontSize:12, color:'#888' }}>
          <span>Showing {filtered.length} of {total}</span>
          {pages > 1 && (
            <div style={{ display:'flex', gap:4 }}>
              <button style={s.pageBtn} disabled={page===1} onClick={() => setPage(p => p-1)}>Prev</button>
              {Array.from({ length:Math.min(pages,5) }, (_,i) => i+1).map(p => (
                <button key={p} style={p===page ? s.pageBtnActive : s.pageBtn} onClick={() => setPage(p)}>{p}</button>
              ))}
              <button style={s.pageBtn} disabled={page===pages} onClick={() => setPage(p => p+1)}>Next</button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

const s = {
  metricRow:    { display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:16 },
  metricCard:   { background:'#fff', border:'0.5px solid #e5e5e5', borderRadius:12, padding:'12px 14px' },
  card:         { background:'#fff', border:'0.5px solid #e5e5e5', borderRadius:12, padding:'14px 16px' },
  cardTitle:    { fontSize:13, fontWeight:500, color:'#1a1a1a', marginBottom:0 },
  searchBar:    { width:'100%', padding:'8px 12px', border:'0.5px solid #ddd', borderRadius:8, fontSize:13, boxSizing:'border-box', marginBottom:10, background:'#fafafa', outline:'none' },
  filterRow:    { display:'flex', gap:6, flexWrap:'wrap', marginBottom:12 },
  filterBtn:    { padding:'4px 12px', borderRadius:20, fontSize:12, border:'0.5px solid #ddd', color:'#666', background:'transparent', cursor:'pointer' },
  filterSel:    { padding:'4px 12px', borderRadius:20, fontSize:12, border:'0.5px solid #9FE1CB', color:'#0F6E56', background:'#E1F5EE', cursor:'pointer' },
  exportBtn:    { fontSize:12, color:'#0F6E56', border:'0.5px solid #9FE1CB', borderRadius:20, padding:'4px 12px', background:'#E1F5EE', cursor:'pointer' },
  empty:        { fontSize:13, color:'#aaa', padding:'24px 0', textAlign:'center' },
  tbl:          { width:'100%', borderCollapse:'collapse', fontSize:12 },
  th:           { textAlign:'left', fontSize:11, color:'#888', fontWeight:500, padding:'6px 10px', borderBottom:'0.5px solid #f0f0f0', whiteSpace:'nowrap' },
  td:           { padding:'8px 10px', borderBottom:'0.5px solid #f0f0f0', color:'#1a1a1a', whiteSpace:'nowrap' },
  tagC:         { display:'inline-block', padding:'2px 8px', borderRadius:20, fontSize:11, background:'#FCEBEB', color:'#A32D2D' },
  tagNC:        { display:'inline-block', padding:'2px 8px', borderRadius:20, fontSize:11, background:'#E1F5EE', color:'#0F6E56' },
  confH:        { fontSize:11, padding:'2px 7px', borderRadius:20, background:'#E1F5EE', color:'#0F6E56' },
  confM:        { fontSize:11, padding:'2px 7px', borderRadius:20, background:'#FAEEDA', color:'#633806' },
  confL:        { fontSize:11, padding:'2px 7px', borderRadius:20, background:'#FCEBEB', color:'#A32D2D' },
  pageBtn:      { padding:'3px 10px', border:'0.5px solid #ddd', borderRadius:6, fontSize:12, cursor:'pointer', background:'transparent' },
  pageBtnActive:{ padding:'3px 10px', border:'0.5px solid #1D9E75', borderRadius:6, fontSize:12, cursor:'pointer', background:'transparent', color:'#0F6E56' },
};
