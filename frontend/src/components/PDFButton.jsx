/**
 * PDFButton.jsx
 * Drop-in button that generates the ThalaPredict PDF report.
 *
 * Props:
 *   result        — the full API response object from /api/predict
 *   form          — the form state object { patientId, age, sex, mcv, mch, hbg, rbc }
 *   district      — string | ''
 *   isPregnant    — boolean
 *   familyHistory — boolean
 *   clinicianName — string (e.g. "Dr. Isuri")
 */

import { useState } from 'react';
import { generateReport } from './generateReport';

export default function PDFButton({
  result,
  form,
  district,
  isPregnant,
  familyHistory,
  clinicianName = 'Clinician',
}) {
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);

  const handleClick = async () => {
    if (!result) return;
    setLoading(true);
    setDone(false);
    try {
      await generateReport({ result, form, district, isPregnant, familyHistory, clinicianName });
      setDone(true);
      setTimeout(() => setDone(false), 3000);
    } catch (err) {
      console.error('PDF generation failed:', err);
      alert('PDF generation failed. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={!result || loading}
      style={{
        ...btnBase,
        ...(done    ? btnDone    : {}),
        ...(loading ? btnLoading : {}),
        ...(!result ? btnDisabled: {}),
      }}
    >
      {loading ? (
        <>
          <Spinner /> Generating PDF…
        </>
      ) : done ? (
        <>✓ PDF Downloaded</>
      ) : (
        <>
          <PDFIcon /> Download PDF Report
        </>
      )}
    </button>
  );
}

// ── Inline SVG icons ───────────────────────────────────────────────────────────

function PDFIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ marginRight: 6, verticalAlign: 'middle' }}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="12" y1="18" x2="12" y2="12"/>
      <line x1="9"  y1="15" x2="15" y2="15"/>
    </svg>
  );
}

function Spinner() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5"
      style={{ marginRight:6, verticalAlign:'middle', animation:'spin 0.8s linear infinite' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle cx="12" cy="12" r="10" strokeOpacity="0.25"/>
      <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/>
    </svg>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const btnBase = {
  width:       '100%',
  padding:     '9px 14px',
  background:  '#1e293b',
  color:       '#e2e8f0',
  border:      '0.5px solid #334155',
  borderRadius: 8,
  fontSize:    13,
  fontFamily:  'inherit',
  cursor:      'pointer',
  marginTop:   8,
  display:     'flex',
  alignItems:  'center',
  justifyContent: 'center',
  transition:  'background 0.2s, color 0.2s',
};

const btnLoading = {
  background: '#0f172a',
  color:      '#64748b',
  cursor:     'wait',
};

const btnDone = {
  background: '#064E3B',
  color:      '#6EE7B7',
  border:     '0.5px solid #059669',
};

const btnDisabled = {
  opacity:    0.4,
  cursor:     'not-allowed',
};
