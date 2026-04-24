export default function SHAPChart({ contributions, isCarrier }) {
  if (!contributions || Object.keys(contributions).length === 0) return null;

  const entries = Object.entries(contributions);
  const maxAbs  = Math.max(...entries.map(([, v]) => Math.abs(v)));

  const carrierColor    = '#E24B4A';
  const nonCarrierColor = '#1D9E75';
  const neutralColor    = '#9ca3af';

  return (
    <div style={s.wrap}>
      <div style={s.title}>
        Why this prediction?
        <span style={s.sub}>Feature contributions toward carrier status</span>
      </div>

      <div style={s.chart}>
        {entries.map(([name, value], i) => {
          const pct      = maxAbs > 0 ? (Math.abs(value) / maxAbs) * 100 : 0;
          const positive = value > 0;
          const color    = Math.abs(value) < 0.005
            ? neutralColor
            : positive ? carrierColor : nonCarrierColor;
          const direction = positive ? '→ carrier' : '→ non-carrier';

          return (
            <div key={i} style={s.row}>
              <div style={s.label} title={name}>{name}</div>
              <div style={s.barWrap}>
                <div style={{
                  ...s.bar,
                  width: `${pct}%`,
                  background: color,
                  opacity: 0.85 + (pct / 100) * 0.15,
                }} />
              </div>
              <div style={{ ...s.value, color }}>
                {value > 0 ? '+' : ''}{value.toFixed(3)}
              </div>
              <div style={s.direction}>{direction}</div>
            </div>
          );
        })}
      </div>

      <div style={s.legend}>
        <div style={s.legendItem}>
          <div style={{ ...s.legendDot, background: carrierColor }}></div>
          <span>Pushes toward carrier</span>
        </div>
        <div style={s.legendItem}>
          <div style={{ ...s.legendDot, background: nonCarrierColor }}></div>
          <span>Pushes toward non-carrier</span>
        </div>
      </div>

      <div style={s.note}>
        SHAP values show each feature's contribution to this specific prediction.
        Larger bars indicate stronger influence on the result.
      </div>
    </div>
  );
}

const s = {
  wrap:        { marginTop:8 },
  title:       { fontSize:13, fontWeight:500, color:'var(--text-1)', marginBottom:12, display:'flex', flexDirection:'column', gap:3 },
  sub:         { fontSize:11, color:'var(--text-2)', fontWeight:400 },
  chart:       { display:'flex', flexDirection:'column', gap:7 },
  row:         { display:'grid', gridTemplateColumns:'120px 1fr 50px 90px', alignItems:'center', gap:8 },
  label:       { fontSize:11, color:'var(--text-2)', textAlign:'right', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' },
  barWrap:     { background:'var(--bg-input)', borderRadius:4, height:10, overflow:'hidden' },
  bar:         { height:'100%', borderRadius:4, transition:'width 0.4s ease' },
  value:       { fontSize:11, fontWeight:500, textAlign:'right', fontFamily:'monospace' },
  direction:   { fontSize:10, color:'var(--text-3)', whiteSpace:'nowrap' },
  legend:      { display:'flex', gap:16, marginTop:12, flexWrap:'wrap' },
  legendItem:  { display:'flex', alignItems:'center', gap:5, fontSize:11, color:'var(--text-2)' },
  legendDot:   { width:8, height:8, borderRadius:2 },
  note:        { fontSize:10, color:'var(--text-3)', marginTop:8, lineHeight:1.5, fontStyle:'italic' },
};
