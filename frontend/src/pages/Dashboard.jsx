import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import api from '../api/api';

export default function Dashboard() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [stats,   setStats]   = useState(null);
  const [recent,  setRecent]  = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/history/stats'),
      api.get('/history?limit=8')
    ]).then(([s, h]) => {
      setStats(s.data);
      setRecent(h.data.records || []);
    }).finally(() => setLoading(false));
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const metrics = [
    { val: stats?.total ?? '—',                  label:'Total screened', color:'var(--text-1)', size:28, primary:true },
    { val: stats?.carriers ?? '—',               label:'Carriers found', color:'#E24B4A',       size:24 },
    { val: stats?.nonCarriers ?? '—',            label:'Non-carriers',   color:'#1D9E75',       size:24 },
    { val: stats ? `${stats.carrierRate}%` : '—', label:'Carrier rate',  color:'var(--text-1)', size:24,
      sub: stats?.total > 0 ? 'of all screenings' : 'no data yet' },
  ];

  return (
    <Layout>
      <div style={s.greeting}>
        {greeting}, {user?.name}
        <span style={s.greetingSub}>
          {new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long' })}
        </span>
      </div>

      <div style={s.metricRow} className="responsive-grid-4">
        {metrics.map((m, i) => (
          <div key={i} style={{
            ...s.metricCard,
            borderLeft: m.primary ? '3px solid #1D9E75' : '3px solid transparent',
          }}>
            <div style={s.metricLabel}>{m.label}</div>
            <div style={{ fontSize:m.size, fontWeight:600, color:m.color, lineHeight:1 }}>
              {loading ? '—' : m.val}
            </div>
            {m.sub && (
              <div style={{ fontSize:11, color:'var(--text-3)', marginTop:4 }}>{m.sub}</div>
            )}
            {m.primary && !loading && stats?.total > 0 && (
              <div style={{ fontSize:11, color:'#1D9E75', marginTop:6, display:'flex', alignItems:'center', gap:3 }}>
                <span>↑</span><span>{stats.total} total records</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={s.twoCol} className="responsive-grid-2">
        <div style={s.card}>
          <div style={s.cardTitle}>Recent activity</div>
          {loading ? (
            <div style={s.empty}>Loading…</div>
          ) : recent.length === 0 ? (
            <div style={s.emptyState}>
              <div style={s.emptyIcon}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
                  stroke="var(--text-3)" strokeWidth="1.5">
                  <path d="M9 12h6M12 9v6M21 12c0 4.97-4.03 9-9 9S3 16.97 3 12 7.03 3 12 3s9 4.03 9 9z"/>
                </svg>
              </div>
              <div style={{ fontSize:13, color:'var(--text-2)', marginBottom:4 }}>No screenings yet</div>
              <div style={{ fontSize:12, color:'var(--text-3)', marginBottom:12 }}>
                Run your first CBC screening to see results here
              </div>
              <button style={s.primaryBtn} onClick={() => nav('/screen')}>Screen first patient</button>
            </div>
          ) : (
            <>
              <div style={{ maxHeight:280, overflowY:'auto' }}>
                {recent.map((r, i) => (
                  <div key={i} style={s.activityItem}>
                    <div style={s.activityLeft}>
                      <div style={{ ...s.activityDot, background: r.prediction===1 ? '#E24B4A' : '#1D9E75' }}></div>
                      <div>
                        <div style={{ fontSize:13, color:'var(--text-1)', fontWeight:500 }}>
                          {r.patientId} · Age {r.age}
                        </div>
                        <div style={{ fontSize:11, color:'var(--text-2)', marginTop:2 }}>
                          {new Date(r.createdAt).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })}
                          {' · MCV '}{r.cbcParams?.MCV}{' · MCH '}{r.cbcParams?.MCH}
                        </div>
                      </div>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:3 }}>
                      <span style={r.prediction===1 ? s.tagC : s.tagNC}>{r.label}</span>
                      <span style={{ fontSize:10, color:'var(--text-3)' }}>
                        {Math.round(r.carrier_probability * 100)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <button style={{ ...s.outlineBtn, marginTop:10 }} onClick={() => nav('/history')}>
                View full history
              </button>
            </>
          )}
        </div>

        <div>
          <div style={{ ...s.card, marginBottom:12 }}>
            <div style={s.cardTitle}>Carrier distribution</div>
            {loading || !stats?.total ? (
              <div style={{ ...s.empty, padding:'20px 0' }}>No data yet</div>
            ) : (
              <div style={{ display:'flex', alignItems:'center', gap:16 }}>
                <ResponsiveContainer width={120} height={120}>
                  <PieChart>
                    <Pie
                      data={[
                        { name:'Carriers',     value: stats.carriers },
                        { name:'Non-carriers', value: stats.nonCarriers },
                      ]}
                      cx="50%" cy="50%"
                      innerRadius={35} outerRadius={55}
                      dataKey="value" strokeWidth={0}
                    >
                      <Cell fill="#E24B4A" />
                      <Cell fill="#1D9E75" />
                    </Pie>
                    <Tooltip
                      formatter={(v, n) => [`${v} patients`, n]}
                      contentStyle={{ background:'var(--bg-card)', border:'0.5px solid var(--border)', borderRadius:8, fontSize:12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
                    <div style={{ width:10, height:10, borderRadius:2, background:'#E24B4A' }}></div>
                    <span style={{ fontSize:12, color:'var(--text-2)' }}>
                      Carriers — <strong style={{ color:'var(--text-1)' }}>{stats.carriers}</strong>
                      <span style={{ color:'var(--text-3)', marginLeft:4 }}>({stats.carrierRate}%)</span>
                    </span>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <div style={{ width:10, height:10, borderRadius:2, background:'#1D9E75' }}></div>
                    <span style={{ fontSize:12, color:'var(--text-2)' }}>
                      Non-carriers — <strong style={{ color:'var(--text-1)' }}>{stats.nonCarriers}</strong>
                      <span style={{ color:'var(--text-3)', marginLeft:4 }}>
                        ({(100 - parseFloat(stats.carrierRate)).toFixed(1)}%)
                      </span>
                    </span>
                  </div>
                  <div style={{ marginTop:10, fontSize:11, color:'var(--text-3)', lineHeight:1.5 }}>
                    Based on {stats.total} total screenings
                  </div>
                </div>
              </div>
            )}
          </div>

          <div style={{ ...s.card, marginBottom:12 }}>
            <div style={s.cardTitle}>Quick actions</div>
            <button style={s.primaryBtn} onClick={() => nav('/screen')}>Screen single patient</button>
            <button style={{ ...s.outlineBtn, marginTop:8 }} onClick={() => nav('/batch')}>Upload batch CSV</button>
          </div>

          <div style={s.card}>
            <div style={s.cardTitle}>Referrals issued</div>
            <div style={{ display:'flex', alignItems:'baseline', gap:8, marginTop:4 }}>
              <div style={{ fontSize:28, fontWeight:600, color:'#E24B4A' }}>
                {loading ? '—' : stats?.carriers || 0}
              </div>
              <div style={{ fontSize:12, color:'var(--text-2)' }}>patients</div>
            </div>
            <div style={{ fontSize:11, color:'var(--text-3)', marginTop:4 }}>
              recommended for HPLC or electrophoresis confirmation
            </div>
            {!loading && stats?.carriers > 0 && (
              <div style={{ marginTop:10, padding:'8px 10px', background:'#FCEBEB', borderRadius:8 }}>
                <div style={{ fontSize:11, color:'#A32D2D' }}>
                  Each referred patient requires HbA2 ≥ 3.5% confirmation
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

const s = {
  greeting:     { fontSize:15, fontWeight:500, color:'var(--text-1)', marginBottom:16, display:'flex', alignItems:'baseline', gap:12, flexWrap:'wrap' },
  greetingSub:  { fontSize:12, color:'var(--text-2)', fontWeight:400 },
  metricRow:    { display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:16 },
  metricCard:   { background:'var(--bg-card)', border:'0.5px solid var(--border)', borderRadius:12, padding:'14px 16px' },
  metricLabel:  { fontSize:11, color:'var(--text-2)', marginBottom:6, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.05em' },
  twoCol:       { display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 },
  card:         { background:'var(--bg-card)', border:'0.5px solid var(--border)', borderRadius:12, padding:'14px 16px' },
  cardTitle:    { fontSize:13, fontWeight:500, color:'var(--text-1)', marginBottom:12 },
  activityItem: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 0', borderBottom:'0.5px solid var(--border)' },
  activityLeft: { display:'flex', alignItems:'center', gap:10 },
  activityDot:  { width:8, height:8, borderRadius:'50%', flexShrink:0 },
  emptyState:   { padding:'24px 0', textAlign:'center' },
  emptyIcon:    { marginBottom:10 },
  empty:        { fontSize:13, color:'var(--text-2)', padding:'16px 0', textAlign:'center' },
  tagC:         { display:'inline-block', padding:'2px 8px', borderRadius:20, fontSize:11, background:'#FCEBEB', color:'#A32D2D' },
  tagNC:        { display:'inline-block', padding:'2px 8px', borderRadius:20, fontSize:11, background:'#E1F5EE', color:'#0F6E56' },
  primaryBtn:   { width:'100%', padding:'9px 0', background:'#1D9E75', color:'#fff', border:'none', borderRadius:8, fontSize:13, cursor:'pointer', fontFamily:'inherit' },
  outlineBtn:   { width:'100%', padding:'8px 0', background:'transparent', border:'0.5px solid #1D9E75', color:'#1D9E75', borderRadius:8, fontSize:13, cursor:'pointer', fontFamily:'inherit' },
};
