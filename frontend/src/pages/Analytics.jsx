import Layout from '../components/Layout';

/**
 * Analytics.jsx — Overview page
 *
 * Phase 2 charts will be added here:
 *  - Age distribution (bar chart)
 *  - Sex breakdown (donut chart)
 *  - Weekly/monthly trend toggle (line chart)
 *  - Referral completion rate (stat + bar)
 *
 * Currently shows a placeholder so the route works immediately.
 * Replace the placeholder sections below with real chart components.
 */

export default function Analytics() {
  return (
    <Layout>
      <div style={s.wrap}>

        <div style={s.header}>
          <div style={s.title}>Analytics Overview</div>
          <div style={s.sub}>Trends and statistics across all screenings</div>
        </div>

        {/* Placeholder grid — each card = one Phase 2 chart */}
        <div style={s.grid}>

          <PlaceholderCard
            title="Age Distribution"
            desc="Carrier detections grouped by patient age range"
            phase="Phase 2 · Coming next"
          />
          <PlaceholderCard
            title="Sex Breakdown"
            desc="Male vs Female carrier rates"
            phase="Phase 2 · Coming next"
          />
          <PlaceholderCard
            title="Screening Trend"
            desc="Weekly and monthly screening volumes over time"
            phase="Phase 2 · Coming next"
          />
          <PlaceholderCard
            title="Referral Rate"
            desc="How many screenings resulted in referrals"
            phase="Phase 2 · Coming next"
          />

        </div>

        <div style={s.note}>
          Charts will be populated as Phase 2 is built.
          All data is already being collected in the database.
        </div>

      </div>
    </Layout>
  );
}

function PlaceholderCard({ title, desc, phase }) {
  return (
    <div style={s.card}>
      <div style={s.cardTitle}>{title}</div>
      <div style={s.cardDesc}>{desc}</div>
      {/* Chart area placeholder */}
      <div style={s.chartArea}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
          stroke="var(--brand)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ opacity:0.35 }}>
          <line x1="18" y1="20" x2="18" y2="10"/>
          <line x1="12" y1="20" x2="12" y2="4"/>
          <line x1="6"  y1="20" x2="6"  y2="14"/>
        </svg>
        <div style={s.chartNote}>Chart renders here</div>
      </div>
      <div style={s.phase}>{phase}</div>
    </div>
  );
}

const s = {
  wrap:      { maxWidth:780 },
  header:    { marginBottom:22 },
  title:     { fontSize:20, fontWeight:600, color:'var(--text-primary)', letterSpacing:'-0.02em' },
  sub:       { fontSize:13, color:'var(--text-secondary)', marginTop:3 },
  grid:      { display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:18 },
  card:      { background:'var(--bg-card)', border:'0.5px solid var(--border)', borderRadius:12, padding:'16px 18px' },
  cardTitle: { fontSize:13, fontWeight:500, color:'var(--text-primary)', marginBottom:4 },
  cardDesc:  { fontSize:11, color:'var(--text-secondary)', marginBottom:14, lineHeight:1.5 },
  chartArea: { height:120, background:'var(--bg-page)', borderRadius:8, border:'0.5px dashed var(--border)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:6, marginBottom:10 },
  chartNote: { fontSize:11, color:'var(--text-hint)' },
  phase:     { fontSize:10, color:'var(--brand-dark)', background:'var(--brand-light)', border:'0.5px solid var(--brand-border)', borderRadius:20, padding:'2px 9px', display:'inline-block' },
  note:      { fontSize:12, color:'var(--text-hint)', padding:'10px 0' },
};
