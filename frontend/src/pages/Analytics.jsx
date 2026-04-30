import { useEffect, useState, useRef } from 'react';
import Layout from '../components/Layout';
import api    from '../api/api';

// ── Colour tokens (match your CSS vars via JS) ────────────────────────────────
const BRAND      = '#1D9E75';
const BRAND_LITE = '#E1F5EE';
const CARRIER_C  = '#E24B4A';
const NON_C      = '#1D9E75';
const PURPLE     = '#7C3AED';
const AMBER      = '#D97706';

export default function Analytics() {
  const [stats,    setStats]    = useState(null);
  const [ageData,  setAgeData]  = useState([]);
  const [sexData,  setSexData]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [trend,    setTrend]    = useState('30d'); // '30d' | '7d'

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [s, a, x] = await Promise.all([
          api.get('/history/stats'),
          api.get('/history/analytics/age'),
          api.get('/history/analytics/sex'),
        ]);
        setStats(s.data);
        setAgeData(a.data);
        setSexData(x.data);
      } catch (e) {
        setError('Failed to load analytics data.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Filter trend data
  const trendData = (() => {
    if (!stats?.trend) return [];
    if (trend === '7d') return stats.trend.slice(-7);
    return stats.trend;
  })();

  return (
    <Layout>
      <div style={s.wrap}>

        {/* Header */}
        <div style={s.header}>
          <div>
            <div style={s.title}>Analytics Overview</div>
            <div style={s.sub}>Trends and statistics across all screenings</div>
          </div>
        </div>

        {error && <div style={s.error}>{error}</div>}

        {loading ? (
          <div style={s.loadWrap}>
            <div style={s.loadText}>Loading analytics…</div>
          </div>
        ) : (
          <>
            {/* ── Stat summary row ── */}
            <div style={s.statRow}>
              <StatCard label="Total Screenings" value={stats?.total ?? 0} color={BRAND} />
              <StatCard label="Carriers Detected" value={stats?.carriers ?? 0} color={CARRIER_C} />
              <StatCard label="Non-Carriers" value={stats?.nonCarriers ?? 0} color={NON_C} />
              <StatCard label="Referrals Issued" value={stats?.referrals ?? 0} color={AMBER} />
              <StatCard label="Carrier Rate" value={`${stats?.carrierRate ?? 0}%`} color={PURPLE} />
            </div>

            {/* ── Chart grid ── */}
            <div style={s.grid}>

              {/* Age Distribution */}
              <div style={s.card}>
                <div style={s.cardHead}>
                  <div style={s.cardTitle}>Age Distribution</div>
                  <div style={s.cardSub}>Carrier detections by age group</div>
                </div>
                {ageData.length === 0
                  ? <EmptyChart msg="No age data recorded yet" />
                  : <AgeBarChart data={ageData} />
                }
              </div>

              {/* Sex Breakdown */}
              <div style={s.card}>
                <div style={s.cardHead}>
                  <div style={s.cardTitle}>Sex Breakdown</div>
                  <div style={s.cardSub}>Carrier rates by sex</div>
                </div>
                {sexData.length === 0
                  ? <EmptyChart msg="No sex data recorded yet" />
                  : <SexDonut data={sexData} />
                }
              </div>

              {/* Screening Trend — full width */}
              <div style={{ ...s.card, gridColumn: '1 / -1' }}>
                <div style={{ ...s.cardHead, flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <div style={s.cardTitle}>Screening Trend</div>
                    <div style={s.cardSub}>Daily screening volumes and carrier detections</div>
                  </div>
                  <div style={s.toggle}>
                    {['7d','30d'].map(t => (
                      <button key={t} style={{ ...s.toggleBtn, ...(trend===t ? s.toggleActive : {}) }}
                        onClick={() => setTrend(t)}>
                        {t === '7d' ? 'Last 7 days' : 'Last 30 days'}
                      </button>
                    ))}
                  </div>
                </div>
                {trendData.length === 0
                  ? <EmptyChart msg="No trend data in this period" />
                  : <TrendLineChart data={trendData} />
                }
              </div>

              {/* Referral Rate */}
              <div style={{ ...s.card, gridColumn: '1 / -1' }}>
                <div style={s.cardHead}>
                  <div style={s.cardTitle}>Referral Completion Rate</div>
                  <div style={s.cardSub}>Proportion of screenings resulting in a referral</div>
                </div>
                <ReferralRate
                  total={stats?.total ?? 0}
                  referrals={stats?.referrals ?? 0}
                  carriers={stats?.carriers ?? 0}
                />
              </div>

            </div>
          </>
        )}
      </div>
    </Layout>
  );
}

// ── StatCard ──────────────────────────────────────────────────────────────────
function StatCard({ label, value, color }) {
  return (
    <div style={{ ...sc.card, borderTop: `2.5px solid ${color}` }}>
      <div style={{ ...sc.value, color }}>{value}</div>
      <div style={sc.label}>{label}</div>
    </div>
  );
}
const sc = {
  card:  { background:'var(--bg-card)', border:'0.5px solid var(--border)', borderRadius:10, padding:'14px 16px', flex:1, minWidth:100 },
  value: { fontSize:22, fontWeight:700, letterSpacing:'-0.03em' },
  label: { fontSize:11, color:'var(--text-hint)', marginTop:3 },
};

// ── EmptyChart ────────────────────────────────────────────────────────────────
function EmptyChart({ msg }) {
  return (
    <div style={{ height:140, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <span style={{ fontSize:12, color:'var(--text-hint)' }}>{msg}</span>
    </div>
  );
}

// ── AgeBarChart ───────────────────────────────────────────────────────────────
function AgeBarChart({ data }) {
  const W = 420, H = 160, PL = 28, PB = 24, PT = 10, PR = 10;
  const chartW = W - PL - PR;
  const chartH = H - PB - PT;
  const maxVal = Math.max(...data.map(d => d.total), 1);
  const barW   = chartW / data.length;

  return (
    <div style={{ overflowX:'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', maxWidth:W, display:'block' }}>
        {/* Y gridlines */}
        {[0,0.25,0.5,0.75,1].map(f => {
          const y = PT + chartH * (1 - f);
          return <line key={f} x1={PL} x2={W-PR} y1={y} y2={y}
            stroke="var(--border)" strokeWidth="0.5" />;
        })}
        {data.map((d, i) => {
          const x       = PL + i * barW;
          const totalH  = (d.total    / maxVal) * chartH;
          const carrH   = (d.carriers / maxVal) * chartH;
          const bw      = barW * 0.55;
          const bx      = x + (barW - bw) / 2;
          return (
            <g key={i}>
              {/* Total bar */}
              <rect x={bx} y={PT + chartH - totalH} width={bw} height={totalH}
                fill={BRAND_LITE} rx={2} />
              {/* Carrier overlay */}
              <rect x={bx} y={PT + chartH - carrH} width={bw} height={carrH}
                fill={BRAND} rx={2} opacity={0.85} />
              {/* X label */}
              <text x={x + barW/2} y={H - 4} textAnchor="middle"
                fontSize="8" fill="var(--text-hint)">{d.range}</text>
              {/* Value on top */}
              {d.total > 0 && (
                <text x={x + barW/2} y={PT + chartH - totalH - 3}
                  textAnchor="middle" fontSize="8" fill="var(--text-secondary)">{d.total}</text>
              )}
            </g>
          );
        })}
        {/* Y axis */}
        <line x1={PL} x2={PL} y1={PT} y2={PT+chartH} stroke="var(--border)" strokeWidth="0.5" />
      </svg>
      {/* Legend */}
      <div style={leg.row}>
        <LegDot color={BRAND_LITE} border={BRAND} label="Total" />
        <LegDot color={BRAND} label="Carriers" />
      </div>
    </div>
  );
}

// ── SexDonut ──────────────────────────────────────────────────────────────────
function SexDonut({ data }) {
  const SIZE  = 140;
  const CX    = SIZE / 2;
  const CY    = SIZE / 2;
  const R     = 48;
  const INNER = 30;
  const COLORS = { Male:'#3B82F6', Female:'#EC4899', Other:'#8B5CF6', Unknown:'#9CA3AF' };

  const total = data.reduce((a, d) => a + d.total, 0);
  let angle   = -Math.PI / 2;

  const slices = data.map(d => {
    const sweep = (d.total / total) * 2 * Math.PI;
    const start = angle;
    angle += sweep;
    return { ...d, start, sweep };
  });

  const arc = (cx, cy, r, startA, sweepA) => {
    const x1 = cx + r * Math.cos(startA);
    const y1 = cy + r * Math.sin(startA);
    const x2 = cx + r * Math.cos(startA + sweepA);
    const y2 = cy + r * Math.sin(startA + sweepA);
    const lg  = sweepA > Math.PI ? 1 : 0;
    return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${lg} 1 ${x2} ${y2} Z`;
  };

  const donut = (cx, cy, ro, ri, startA, sweepA) => {
    const x1o = cx + ro * Math.cos(startA),          y1o = cy + ro * Math.sin(startA);
    const x2o = cx + ro * Math.cos(startA + sweepA), y2o = cy + ro * Math.sin(startA + sweepA);
    const x1i = cx + ri * Math.cos(startA + sweepA), y1i = cy + ri * Math.sin(startA + sweepA);
    const x2i = cx + ri * Math.cos(startA),          y2i = cy + ri * Math.sin(startA);
    const lg  = sweepA > Math.PI ? 1 : 0;
    return `M ${x1o} ${y1o} A ${ro} ${ro} 0 ${lg} 1 ${x2o} ${y2o} L ${x1i} ${y1i} A ${ri} ${ri} 0 ${lg} 0 ${x2i} ${y2i} Z`;
  };

  return (
    <div style={{ display:'flex', alignItems:'center', gap:20, flexWrap:'wrap' }}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ width:SIZE, height:SIZE, flexShrink:0 }}>
        {slices.map((sl, i) => (
          <path key={i}
            d={donut(CX, CY, R, INNER, sl.start, sl.sweep)}
            fill={COLORS[sl.sex] || '#9CA3AF'}
            stroke="var(--bg-card)" strokeWidth="1.5"
          />
        ))}
        <text x={CX} y={CY - 5} textAnchor="middle" fontSize="14" fontWeight="700"
          fill="var(--text-primary)">{total}</text>
        <text x={CX} y={CY + 9} textAnchor="middle" fontSize="8"
          fill="var(--text-hint)">total</text>
      </svg>
      {/* Breakdown table */}
      <div style={{ flex:1, minWidth:120 }}>
        {data.map((d, i) => {
          const rate = total > 0 ? ((d.carriers / d.total) * 100).toFixed(0) : 0;
          const col  = COLORS[d.sex] || '#9CA3AF';
          return (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ width:8, height:8, borderRadius:'50%', background:col, display:'inline-block' }} />
                <span style={{ fontSize:12, color:'var(--text-primary)' }}>{d.sex || 'Unknown'}</span>
              </div>
              <div style={{ textAlign:'right' }}>
                <span style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)' }}>{d.total}</span>
                <span style={{ fontSize:10, color:'var(--text-hint)', marginLeft:5 }}>{rate}% carriers</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── TrendLineChart ────────────────────────────────────────────────────────────
function TrendLineChart({ data }) {
  const W = 600, H = 160, PL = 32, PB = 28, PT = 12, PR = 16;
  const chartW = W - PL - PR;
  const chartH = H - PB - PT;
  const maxVal = Math.max(...data.map(d => d.total), 1);

  const px = i  => PL + (i / Math.max(data.length - 1, 1)) * chartW;
  const py = v  => PT + chartH - (v / maxVal) * chartH;

  const totalLine    = data.map((d,i) => `${i===0?'M':'L'}${px(i)},${py(d.total)}`).join(' ');
  const carrierLine  = data.map((d,i) => `${i===0?'M':'L'}${px(i)},${py(d.carriers)}`).join(' ');
  const totalFill    = `${totalLine} L${px(data.length-1)},${PT+chartH} L${PL},${PT+chartH} Z`;

  const yTicks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div style={{ overflowX:'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', maxWidth:W, display:'block' }}>
        {/* Gridlines + Y labels */}
        {yTicks.map(f => {
          const y = PT + chartH * (1 - f);
          const v = Math.round(maxVal * f);
          return (
            <g key={f}>
              <line x1={PL} x2={W-PR} y1={y} y2={y}
                stroke="var(--border)" strokeWidth="0.5" strokeDasharray={f===0?'':'3,3'} />
              <text x={PL-4} y={y+3} textAnchor="end" fontSize="8" fill="var(--text-hint)">{v}</text>
            </g>
          );
        })}
        {/* Area fill */}
        <path d={totalFill} fill={BRAND} opacity="0.07" />
        {/* Total line */}
        <path d={totalLine} fill="none" stroke={BRAND} strokeWidth="1.8" strokeLinejoin="round" />
        {/* Carrier line */}
        <path d={carrierLine} fill="none" stroke={CARRIER_C} strokeWidth="1.4"
          strokeDasharray="4,3" strokeLinejoin="round" />
        {/* X axis labels — show every N-th to avoid crowding */}
        {data.map((d, i) => {
          const step = data.length <= 7 ? 1 : Math.ceil(data.length / 7);
          if (i % step !== 0 && i !== data.length - 1) return null;
          const label = d.date?.slice(5); // MM-DD
          return (
            <text key={i} x={px(i)} y={H-6} textAnchor="middle"
              fontSize="8" fill="var(--text-hint)">{label}</text>
          );
        })}
        {/* Axes */}
        <line x1={PL} x2={PL} y1={PT} y2={PT+chartH} stroke="var(--border)" strokeWidth="0.5" />
        <line x1={PL} x2={W-PR} y1={PT+chartH} y2={PT+chartH} stroke="var(--border)" strokeWidth="0.5" />
      </svg>
      <div style={leg.row}>
        <LegDot color={BRAND} label="Total screenings" />
        <LegDot color={CARRIER_C} label="Carriers" dashed />
      </div>
    </div>
  );
}

// ── ReferralRate ──────────────────────────────────────────────────────────────
function ReferralRate({ total, referrals, carriers }) {
  const refRate      = total > 0 ? ((referrals / total) * 100).toFixed(1) : 0;
  const carrierRef   = carriers > 0 ? ((referrals / carriers) * 100).toFixed(1) : 0;
  const nonCarrierRef = (total - carriers) > 0
    ? (((referrals - Math.min(referrals, carriers)) / (total - carriers)) * 100).toFixed(1) : 0;

  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:24, alignItems:'center' }}>
      {/* Big rate */}
      <div style={{ textAlign:'center', minWidth:90 }}>
        <div style={{ fontSize:36, fontWeight:700, color:AMBER, letterSpacing:'-0.03em' }}>
          {refRate}%
        </div>
        <div style={{ fontSize:11, color:'var(--text-hint)', marginTop:2 }}>of all screenings</div>
      </div>

      {/* Bar */}
      <div style={{ flex:1, minWidth:180 }}>
        <div style={{ fontSize:11, color:'var(--text-secondary)', marginBottom:6 }}>
          {referrals} of {total} patients referred
        </div>
        <div style={{ height:14, background:'var(--bg-surface)', borderRadius:7, overflow:'hidden', border:'0.5px solid var(--border)' }}>
          <div style={{ height:'100%', width:`${refRate}%`, background:AMBER, borderRadius:7, transition:'width 0.6s ease' }} />
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:4 }}>
          <span style={{ fontSize:10, color:'var(--text-hint)' }}>0%</span>
          <span style={{ fontSize:10, color:'var(--text-hint)' }}>100%</span>
        </div>
      </div>

      {/* Breakdown */}
      <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
        <MiniStat label="Among carriers" value={`${carrierRef}%`} color={CARRIER_C} />
        <MiniStat label="Among non-carriers" value={`${nonCarrierRef}%`} color={NON_C} />
        <MiniStat label="Total referred" value={referrals} color={AMBER} />
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }) {
  return (
    <div style={{ textAlign:'center' }}>
      <div style={{ fontSize:18, fontWeight:700, color, letterSpacing:'-0.02em' }}>{value}</div>
      <div style={{ fontSize:10, color:'var(--text-hint)', marginTop:1 }}>{label}</div>
    </div>
  );
}

// ── Legend helpers ────────────────────────────────────────────────────────────
function LegDot({ color, border, label, dashed }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:5 }}>
      {dashed
        ? <svg width="16" height="6"><line x1="0" y1="3" x2="16" y2="3"
            stroke={color} strokeWidth="1.5" strokeDasharray="4,2"/></svg>
        : <span style={{ width:10, height:10, borderRadius:2,
            background:color, border: border ? `1.5px solid ${border}` : 'none',
            display:'inline-block' }} />
      }
      <span style={{ fontSize:10, color:'var(--text-hint)' }}>{label}</span>
    </div>
  );
}
const leg = {
  row: { display:'flex', gap:14, marginTop:6, flexWrap:'wrap' }
};

// ── Page styles ───────────────────────────────────────────────────────────────
const s = {
  wrap:        { maxWidth:820 },
  header:      { marginBottom:18, display:'flex', justifyContent:'space-between', alignItems:'flex-start' },
  title:       { fontSize:20, fontWeight:600, color:'var(--text-primary)', letterSpacing:'-0.02em' },
  sub:         { fontSize:13, color:'var(--text-secondary)', marginTop:3 },
  error:       { background:'#fef2f2', border:'0.5px solid #fca5a5', borderRadius:8, padding:'10px 14px', fontSize:12, color:'#b91c1c', marginBottom:16 },
  loadWrap:    { display:'flex', alignItems:'center', justifyContent:'center', height:200 },
  loadText:    { fontSize:13, color:'var(--text-hint)' },
  statRow:     { display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' },
  grid:        { display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 },
  card:        { background:'var(--bg-card)', border:'0.5px solid var(--border)', borderRadius:12, padding:'16px 18px' },
  cardHead:    { marginBottom:14, display:'flex', flexDirection:'column', gap:2 },
  cardTitle:   { fontSize:13, fontWeight:500, color:'var(--text-primary)' },
  cardSub:     { fontSize:11, color:'var(--text-secondary)' },
  toggle:      { display:'flex', border:'0.5px solid var(--border)', borderRadius:8, overflow:'hidden', flexShrink:0 },
  toggleBtn:   { fontSize:11, padding:'5px 12px', background:'transparent', border:'none', cursor:'pointer', color:'var(--text-secondary)', fontFamily:'inherit' },
  toggleActive:{ background:'var(--brand-light)', color:'var(--brand-dark)', fontWeight:500 },
};
