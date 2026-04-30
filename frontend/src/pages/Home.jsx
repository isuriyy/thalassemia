import { useEffect, useState } from 'react';
import { useNavigate }         from 'react-router-dom';
import { useAuth }             from '../context/AuthContext';
import Layout                  from '../components/Layout';
import api                     from '../api/api';

export default function Home() {
  const { user }    = useAuth();
  const nav         = useNavigate();
  const [stats, setStats]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/history/stats')
      .then(r => setStats(r.data))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' :
    hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <Layout>
      <div style={s.wrap}>

        {/* Greeting */}
        <div style={s.greeting}>
          <div style={s.greetText}>{greeting}, {user?.name?.split(' ')[0] || 'Doctor'}</div>
          <div style={s.greetSub}>Here is today's summary</div>
        </div>

        {/* Quick action — most prominent element */}
        <button style={s.primaryAction} onClick={() => nav('/screen')}>
          <span style={s.actionIcon}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </span>
          <div>
            <div style={s.actionTitle}>Screen a Patient</div>
            <div style={s.actionSub}>Enter CBC values and run carrier screening</div>
          </div>
          <span style={s.actionArrow}>→</span>
        </button>

        {/* Today's stats — simple 3 cards */}
        <div style={s.statsRow}>
          <StatCard
            loading={loading}
            label="Total screenings"
            value={stats?.total ?? '—'}
            sub="all time"
            color="var(--brand)"
          />
          <StatCard
            loading={loading}
            label="Carriers detected"
            value={stats?.carriers ?? '—'}
            sub={stats ? `${Math.round((stats.carriers/stats.total)*100) || 0}% of total` : ''}
            color="#E24B4A"
          />
          <StatCard
            loading={loading}
            label="Referrals issued"
            value={stats?.referrals ?? '—'}
            sub="confirmatory testing"
            color="#F59E0B"
          />
        </div>

        {/* Secondary actions */}
        <div style={s.secondaryRow}>
          <SecondaryCard
            title="Batch Upload"
            desc="Screen multiple patients at once from a CSV file"
            onClick={() => nav('/batch')}
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            }
          />
          <SecondaryCard
            title="View History"
            desc="Search and review all past screening results"
            onClick={() => nav('/history')}
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="12 8 12 12 14 14"/>
                <path d="M3.05 11a9 9 0 1 0 .5-4.5"/>
                <polyline points="3 3 3 9 9 9"/>
              </svg>
            }
          />
          <SecondaryCard
            title="Analytics"
            desc="View trends, age distribution, and referral rates"
            onClick={() => nav('/analytics')}
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10"/>
                <line x1="12" y1="20" x2="12" y2="4"/>
                <line x1="6"  y1="20" x2="6"  y2="14"/>
              </svg>
            }
          />
        </div>

        {/* Model info — subtle, at the bottom */}
        <div style={s.modelNote}>
          <span style={s.modelDot} />
          SVM model active · AUC-ROC 0.829 · Recall 75.0% · Threshold 0.49 · 10 features
        </div>

      </div>
    </Layout>
  );
}

function StatCard({ loading, label, value, sub, color }) {
  return (
    <div style={s.statCard}>
      <div style={{ ...s.statValue, color }}>{loading ? '…' : value}</div>
      <div style={s.statLabel}>{label}</div>
      {sub && <div style={s.statSub}>{sub}</div>}
    </div>
  );
}

function SecondaryCard({ title, desc, onClick, icon }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      style={{ ...s.secCard, ...(hover ? s.secCardHover : {}) }}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div style={s.secIcon}>{icon}</div>
      <div style={s.secTitle}>{title}</div>
      <div style={s.secDesc}>{desc}</div>
    </button>
  );
}

const s = {
  wrap:          { maxWidth:700, margin:'0 auto', paddingTop:8 },
  greeting:      { marginBottom:24 },
  greetText:     { fontSize:22, fontWeight:600, color:'var(--text-primary)', letterSpacing:'-0.02em' },
  greetSub:      { fontSize:13, color:'var(--text-secondary)', marginTop:3 },

  primaryAction: {
    width:'100%', display:'flex', alignItems:'center', gap:16,
    background:'var(--brand)', color:'#fff', border:'none',
    borderRadius:12, padding:'18px 22px', cursor:'pointer',
    marginBottom:20, textAlign:'left', fontFamily:'inherit',
    transition:'opacity 0.15s',
  },
  actionIcon:    { display:'flex', alignItems:'center', opacity:0.85, flexShrink:0 },
  actionTitle:   { fontSize:15, fontWeight:600, marginBottom:2 },
  actionSub:     { fontSize:12, opacity:0.8 },
  actionArrow:   { marginLeft:'auto', fontSize:20, opacity:0.7 },

  statsRow:      { display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:20 },
  statCard:      { background:'var(--bg-card)', border:'0.5px solid var(--border)', borderRadius:12, padding:'16px 18px' },
  statValue:     { fontSize:28, fontWeight:700, letterSpacing:'-0.03em', marginBottom:4 },
  statLabel:     { fontSize:12, color:'var(--text-secondary)', fontWeight:500 },
  statSub:       { fontSize:11, color:'var(--text-hint)', marginTop:2 },

  secondaryRow:  { display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:24 },
  secCard:       {
    background:'var(--bg-card)', border:'0.5px solid var(--border)', borderRadius:12,
    padding:'16px', cursor:'pointer', textAlign:'left', fontFamily:'inherit',
    transition:'border-color 0.15s, background 0.15s',
  },
  secCardHover:  { borderColor:'var(--brand)', background:'var(--brand-light)' },
  secIcon:       { color:'var(--brand)', marginBottom:10, display:'flex' },
  secTitle:      { fontSize:13, fontWeight:600, color:'var(--text-primary)', marginBottom:4 },
  secDesc:       { fontSize:11, color:'var(--text-secondary)', lineHeight:1.5 },

  modelNote:     { display:'flex', alignItems:'center', gap:8, fontSize:10.5, color:'var(--text-hint)', padding:'10px 0 4px' },
  modelDot:      { width:5, height:5, borderRadius:'50%', background:'var(--brand)', display:'inline-block', flexShrink:0 },
};
