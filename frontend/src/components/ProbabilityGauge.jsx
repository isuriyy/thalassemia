import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

export default function ProbabilityGauge({ probability, isCarrier }) {
  const pct       = Math.round(probability * 100);
  const remaining = 100 - pct;

  const data = [
    { value: pct },
    { value: remaining },
  ];

  const color     = isCarrier ? '#E24B4A' : '#1D9E75';
  const bgColor   = isCarrier ? '#F7C1C1' : '#9FE1CB';
  const textColor = isCarrier ? '#791F1F' : '#085041';
  const label     = isCarrier ? 'Carrier probability' : 'Non-carrier probability';

  // Threshold marker position — 49% of 180 degrees
  const THRESHOLD  = 0.49;
  const thresholdAngle = 180 - (THRESHOLD * 180);

  const toRad = deg => (deg * Math.PI) / 180;
  const cx = 100, cy = 100, r = 70;
  const angle = 180 - (THRESHOLD * 180);
  const markerX = cx + r * Math.cos(toRad(angle));
  const markerY = cy - r * Math.sin(toRad(angle));

  return (
    <div style={s.wrap}>
      <div style={s.chartWrap}>
        <ResponsiveContainer width="100%" height={120}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="90%"
              startAngle={180}
              endAngle={0}
              innerRadius={55}
              outerRadius={75}
              dataKey="value"
              strokeWidth={0}
            >
              <Cell fill={color} />
              <Cell fill={bgColor} />
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        <div style={s.center}>
          <div style={{ ...s.pct, color: textColor }}>{pct}%</div>
          <div style={s.lbl}>{label}</div>
        </div>

        <div style={s.thresholdLabel}>
          <span style={s.thresholdDot}></span>
          Threshold 49%
        </div>
      </div>

      <div style={s.scaleRow}>
        <span style={s.scaleLeft}>0%</span>
        <span style={{ ...s.scaleThresh, left: '49%' }}>|</span>
        <span style={s.scaleRight}>100%</span>
      </div>
    </div>
  );
}

const s = {
  wrap:           { position:'relative', marginBottom:8 },
  chartWrap:      { position:'relative' },
  center:         { position:'absolute', bottom:8, left:0, right:0, textAlign:'center' },
  pct:            { fontSize:26, fontWeight:500, lineHeight:1 },
  lbl:            { fontSize:11, color:'#888', marginTop:3 },
  thresholdLabel: { position:'absolute', bottom:0, right:0, fontSize:10, color:'#aaa', display:'flex', alignItems:'center', gap:4 },
  thresholdDot:   { display:'inline-block', width:6, height:6, borderRadius:'50%', background:'#888' },
  scaleRow:       { position:'relative', display:'flex', justifyContent:'space-between', fontSize:10, color:'#aaa', marginTop:4 },
  scaleLeft:      { },
  scaleRight:     { },
  scaleThresh:    { position:'absolute', color:'#888', transform:'translateX(-50%)' },
};
