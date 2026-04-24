import { useState, useRef } from 'react';
import Layout from '../components/Layout';
import api from '../api/api';

export default function Batch() {
  const [results,  setResults]  = useState([]);
  const [stats,    setStats]    = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [fileName, setFileName] = useState('');
  const fileRef = useRef();

  const parseCSV = text => {
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    return lines.slice(1).map(line => {
      const vals = line.split(',');
      const row = {};
      headers.forEach((h, i) => row[h] = vals[i]?.trim());
      return row;
    });
  };

  const handleFile = async e => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setError('');
    setLoading(true);
    setResults([]);

    const text = await file.text();
    const rows = parseCSV(text);

    if (rows.length > 500) {
      setError('Maximum 500 patients per batch');
      setLoading(false);
      return;
    }

    const payloads = rows.map(r => ({
      age:       parseFloat(r.age),
      sex:       r.sex || 'Female',
      mcv:       parseFloat(r.mcv),
      mch:       parseFloat(r.mch),
      hbg:       parseFloat(r.hgb || r.hbg),
      patientId: r.patient_id || r.patientid || r.id || undefined,
      rbc:       r.rbc ? parseFloat(r.rbc) : undefined,
    })).filter(p =>
      !isNaN(p.age) && !isNaN(p.mcv) &&
      !isNaN(p.mch) && !isNaN(p.hbg)
    );

    if (payloads.length === 0) {
      setError('No valid rows found — check your CSV column names');
      setLoading(false);
      return;
    }

    try {
      const { data } = await api.post('/predict/batch', payloads);
      const res = data.results || [];
      setResults(res);
      const carriers = res.filter(r => r.prediction === 1).length;
      setStats({
        total: res.length,
        carriers,
        nonCarriers: res.length - carriers
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Batch processing failed');
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    const headers = 'patient_id,prediction,label,carrier_probability,referral_recommended,confidence\n';
    const rows = results.map(r =>
      `${r.patientId||''},${r.prediction},${r.label},${r.carrier_probability},${r.referral_recommended},${r.confidence}`
    ).join('\n');
    const blob = new Blob([headers + rows], { type:'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = 'batch_results.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Layout>
      <div style={s.card}>
        <div style={s.cardTitle}>Upload CSV file</div>
        <div style={s.dropZone} onClick={() => fileRef.current.click()}>
          <div style={s.uploadIcon}></div>
          <div style={{ fontSize:13, color:'#666', marginBottom:4 }}>
            {fileName || 'Drag and drop CSV file here'}
          </div>
          <div style={{ fontSize:11, color:'#aaa', marginBottom:10 }}>
            or click to browse · max 500 patients
          </div>
          <span style={s.browseBtn}>Choose file</span>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            style={{ display:'none' }}
            onChange={handleFile}
          />
        </div>
        <div style={{ marginTop:10, fontSize:11, color:'#888' }}>
          Required columns: <code style={s.code}>age, sex, mcv, mch, hgb</code>
          {' · '}Optional: <code style={s.code}>patient_id, rbc</code>
        </div>
        {error && <div style={s.err}>{error}</div>}
      </div>

      {loading && (
        <div style={s.card}>
          <div style={{ fontSize:13, color:'#888', textAlign:'center', padding:20 }}>
            Processing patients…
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div style={s.card}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <div style={s.cardTitle}>
              Batch results · <span style={{ fontWeight:400, color:'#aaa' }}>{stats?.total} patients</span>
            </div>
            <button style={s.exportBtn} onClick={exportCSV}>Export CSV</button>
          </div>

          <div style={s.statRow}>
            <div style={s.statCard}>
              <div style={{ fontSize:18, fontWeight:500 }}>{stats?.total}</div>
              <div style={{ fontSize:11, color:'#888' }}>Processed</div>
            </div>
            <div style={{ ...s.statCard, background:'#FCEBEB' }}>
              <div style={{ fontSize:18, fontWeight:500, color:'#A32D2D' }}>{stats?.carriers}</div>
              <div style={{ fontSize:11, color:'#A32D2D' }}>Carriers</div>
            </div>
            <div style={{ ...s.statCard, background:'#E1F5EE' }}>
              <div style={{ fontSize:18, fontWeight:500, color:'#0F6E56' }}>{stats?.nonCarriers}</div>
              <div style={{ fontSize:11, color:'#0F6E56' }}>Non-carriers</div>
            </div>
          </div>

          <div style={{ overflowX:'auto' }}>
            <table style={s.tbl}>
              <thead>
                <tr>
                  {['Patient ID','Prediction','Probability','Confidence','Referral'].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i}>
                    <td style={s.td}>{r.patientId || `Row ${i+1}`}</td>
                    <td style={s.td}>
                      {r.status === 'error' || r.prediction === null
                        ? <span style={{ color:'#aaa' }}>Error</span>
                        : <span style={r.prediction === 1 ? s.tagC : s.tagNC}>{r.label}</span>
                      }
                    </td>
                    <td style={s.td}>
                      {r.carrier_probability != null
                        ? `${Math.round(r.carrier_probability * 100)}%`
                        : '—'
                      }
                    </td>
                    <td style={s.td}>
                      {r.confidence
                        ? <span style={
                            r.confidence === 'High'     ? s.confH :
                            r.confidence === 'Moderate' ? s.confM : s.confL
                          }>
                            {r.confidence}
                          </span>
                        : '—'
                      }
                    </td>
                    <td style={{ ...s.td, color: r.referral_recommended ? '#A32D2D' : '#aaa' }}>
                      {r.referral_recommended != null
                        ? (r.referral_recommended ? 'Yes' : 'No')
                        : '—'
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Layout>
  );
}

const s = {
  card:      { background:'#fff', border:'0.5px solid #e5e5e5', borderRadius:12, padding:'14px 16px', marginBottom:12 },
  cardTitle: { fontSize:13, fontWeight:500, color:'#1a1a1a', marginBottom:0 },
  dropZone:  { border:'0.5px dashed #ccc', borderRadius:10, padding:28, textAlign:'center', background:'#fafafa', cursor:'pointer', marginTop:10 },
  uploadIcon:{ width:32, height:32, border:'0.5px solid #ddd', borderRadius:8, margin:'0 auto 10px' },
  browseBtn: { padding:'5px 14px', border:'0.5px solid #ddd', borderRadius:8, fontSize:12, color:'#666', background:'#fff' },
  code:      { fontFamily:'monospace', background:'#f5f5f3', padding:'1px 5px', borderRadius:4, fontSize:11 },
  err:       { background:'#fef2f2', color:'#b91c1c', borderRadius:8, padding:'8px 12px', fontSize:12, marginTop:10 },
  statRow:   { display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:12 },
  statCard:  { background:'#f5f5f3', borderRadius:8, padding:'10px 12px' },
  exportBtn: { fontSize:12, color:'#0F6E56', border:'0.5px solid #9FE1CB', borderRadius:20, padding:'4px 12px', background:'#E1F5EE', cursor:'pointer' },
  tbl:       { width:'100%', borderCollapse:'collapse', fontSize:12 },
  th:        { textAlign:'left', fontSize:11, color:'#888', fontWeight:500, padding:'6px 10px', borderBottom:'0.5px solid #f0f0f0' },
  td:        { padding:'8px 10px', borderBottom:'0.5px solid #f0f0f0', color:'#1a1a1a' },
  tagC:      { display:'inline-block', padding:'2px 8px', borderRadius:20, fontSize:11, background:'#FCEBEB', color:'#A32D2D' },
  tagNC:     { display:'inline-block', padding:'2px 8px', borderRadius:20, fontSize:11, background:'#E1F5EE', color:'#0F6E56' },
  confH:     { fontSize:11, padding:'2px 7px', borderRadius:20, background:'#E1F5EE', color:'#0F6E56' },
  confM:     { fontSize:11, padding:'2px 7px', borderRadius:20, background:'#FAEEDA', color:'#633806' },
  confL:     { fontSize:11, padding:'2px 7px', borderRadius:20, background:'#FCEBEB', color:'#A32D2D' },
};
