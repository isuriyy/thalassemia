/**
 * generateReport.js — ThalaPredict v5
 *
 * Key fixes over v4:
 *  - SHAP bars: draw bars FIRST, then text labels on top (z-order fix)
 *  - SHAP background box uses 'F' not 'FD' to avoid stroke overwriting bars
 *  - Axis line drawn AFTER bars so it sits on top cleanly
 *  - CBC arrows: use doc.lines() instead of doc.triangle() for browser compat
 *  - ß symbol confirmed working via \xDF in WinAnsiEncoding
 *  - Page break logic: SHAP+recommendation estimated together, one newPage if needed
 *  - England-Fraser label standardised (no em-dash)
 */

import jsPDF from 'jspdf';

// ─── Colours ─────────────────────────────────────────────────────────────────
const C = {
  green:'#1D9E75',  greenLight:'#E1F5EE', greenDark:'#085041',
  red:'#E24B4A',    redLight:'#FCEBEB',   redDark:'#791F1F',
  amber:'#F59E0B',  amberLight:'#FFFBEB', amberDark:'#92400E',
  indigo:'#6366F1', indigoLight:'#EEF2FF',
  bg:'#F8FAFC', border:'#E2E8F0',
  text1:'#0F172A', text2:'#475569', text3:'#94A3B8', white:'#FFFFFF',
};

const hex2rgb   = h => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
const setFill   = (d,h) => { const [r,g,b]=hex2rgb(h); d.setFillColor(r,g,b); };
const setStroke = (d,h) => { const [r,g,b]=hex2rgb(h); d.setDrawColor(r,g,b); };
const setColor  = (d,h) => { const [r,g,b]=hex2rgb(h); d.setTextColor(r,g,b); };

// Filled rounded rect — use 'F' only when no border needed to avoid stroke side-effects
const fRect = (doc, x, y, w, h, r, fill, stroke) => {
  setFill(doc, fill);
  if (stroke) { setStroke(doc, stroke); doc.roundedRect(x,y,w,h,r,r,'FD'); }
  else        { doc.roundedRect(x,y,w,h,r,r,'F'); }
};

const rule = (doc, x, y, w, hex=C.border) => {
  setStroke(doc, hex); doc.setLineWidth(0.2); doc.line(x,y,x+w,y);
};

// Safe text for jsPDF WinAnsiEncoding (helvetica)
const safe = str => {
  if (typeof str !== 'string') return String(str ?? '');
  return str
    .replace(/β/g,  '\xDF')   // β → ß (closest in WinAnsi, acceptable in clinical context)
    .replace(/≥/g,  '>=')
    .replace(/≤/g,  '<=')
    .replace(/→/g,  '->')
    .replace(/[^\x00-\xFF]/g, '?');
};

// Draw up-arrow using lines (browser-safe, no doc.triangle dependency)
const drawArrowUp = (doc, cx, cy, hex) => {
  setFill(doc, hex);
  // Triangle pointing up: apex at top
  doc.lines([[2,-3],[-4,0],[2,3]], cx-2, cy+1.5, [1,1], 'F');
};

// Draw down-arrow using lines
const drawArrowDown = (doc, cx, cy, hex) => {
  setFill(doc, hex);
  // Triangle pointing down
  doc.lines([[2,3],[-4,0],[2,-3]], cx-2, cy-1.5, [1,1], 'F');
};

// ─── Reference ranges ────────────────────────────────────────────────────────
const REF = {
  MCV:{min:80,max:100}, MCH:{min:27,max:33},
  HBG:{min:12,max:17},  RBC:{min:4, max:6 },
};
const rangeStatus = (key, val) => {
  if (val==null) return {flag:0, color:C.text3};
  const r=REF[key]; if(!r) return {flag:0, color:C.text3};
  if (val<r.min) return {flag:-1, color:C.amber};
  if (val>r.max) return {flag:1,  color:C.amber};
  return               {flag:0,  color:C.green};
};

// ─── SHAP labels (no em-dash, consistent naming) ─────────────────────────────
const SHAP_LABELS = {
  england_fraser: 'England-Fraser',
  green_king:     'Green-King',
  green_king_raw: 'Green-King',
  srivastava:     'Srivastava',
  srivastava_raw: 'Srivastava',
  hbg_mcv_ratio:  'HBG/MCV ratio',
  hbg_mch_ratio:  'HBG/MCH ratio',
  flag_gk:        'Flag GK',
  Age:'Age', MCV:'MCV', MCH:'MCH', HBG:'HBG', RBC:'RBC',
};
const shapLabel = k => SHAP_LABELS[k] || k.replace(/_/g,' ');

// ─── Misc ─────────────────────────────────────────────────────────────────────
const reportId = () => {
  const n=new Date(), p=x=>String(x).padStart(2,'0');
  return `TP-${n.getFullYear()}${p(n.getMonth()+1)}${p(n.getDate())}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
};
const fmt = (v,dp=2) => typeof v==='number' ? v.toFixed(dp) : '—';
const pct  = v       => typeof v==='number' ? `${Math.round(v*100)}%` : '—';

// ─── SHAP bar chart — bars drawn FIRST, labels on top ─────────────────────────
const drawSHAPBars = (doc, shap, x, y, w, isCarrier) => {
  const entries = Object.entries(shap)
    .sort((a,b) => Math.abs(b[1])-Math.abs(a[1]))
    .slice(0,5);
  if (!entries.length) return;

  const maxVal  = Math.max(...entries.map(([,v])=>Math.abs(v)));
  const barMaxW = w * 0.38;
  const rowH    = 9;
  const midX    = x + w * 0.40;

  // STEP 1: draw all bars first (no text calls in between)
  entries.forEach(([feat,val],i) => {
    const cy  = y + i*rowH + rowH/2;
    const bw  = maxVal > 0 ? (Math.abs(val)/maxVal)*barMaxW : 2;
    const isP = val > 0;
    const col = isP ? (isCarrier ? C.red : C.green) : C.indigo;
    setFill(doc, col);
    setStroke(doc, col);
    if (isP) doc.roundedRect(midX,     cy-2, bw, 4, 1,1,'F');
    else     doc.roundedRect(midX-bw,  cy-2, bw, 4, 1,1,'F');
  });

  // STEP 2: draw centre axis line on top of bars
  setStroke(doc, C.text3);
  doc.setLineWidth(0.4);
  doc.line(midX, y-3, midX, y+entries.length*rowH+2);

  // STEP 3: draw all text labels on top
  doc.setFont('helvetica','normal');

  // Column headers
  doc.setFontSize(5.5); setColor(doc, C.text3);
  doc.text('<- non-carrier', midX-3, y-5, {align:'right'});
  doc.text('-> carrier',     midX+3, y-5);

  entries.forEach(([feat,val],i) => {
    const cy  = y + i*rowH + rowH/2;
    const bw  = maxVal > 0 ? (Math.abs(val)/maxVal)*barMaxW : 2;
    const isP = val > 0;
    const col = isP ? (isCarrier ? C.red : C.green) : C.indigo;

    // Feature name label (left of axis)
    setColor(doc, C.text2); doc.setFontSize(7);
    doc.text(shapLabel(feat), midX-4, cy+2.5, {align:'right'});

    // Value + direction (right or left of bar)
    setColor(doc, col); doc.setFontSize(6);
    const vLabel = (isP ? '+' : '') + val.toFixed(3);
    const dLabel = isP ? '-> carrier' : '<- non-carrier';
    if (isP) {
      doc.text(vLabel, midX+bw+2, cy+1.5);
      doc.text(dLabel, midX+bw+2, cy+5.5);
    } else {
      doc.text(vLabel, midX-bw-2, cy+1.5, {align:'right'});
      doc.text(dLabel, midX-bw-2, cy+5.5, {align:'right'});
    }
  });
};

// ─── Footer ───────────────────────────────────────────────────────────────────
const drawFooter = (doc, p, total, PW, PH, ML, MR) => {
  const fy = PH-16;
  rule(doc, ML, fy, PW-ML-MR);
  setFill(doc, C.text1); doc.rect(0, fy+0.5, PW, 16, 'F');
  doc.setFont('helvetica','normal'); doc.setFontSize(6); setColor(doc, C.text3);
  doc.text(
    safe('This report is generated by ThalaPredict, an AI-assisted screening tool. Results do not replace clinical judgement.'),
    ML, fy+6
  );
  doc.text('Confirmatory testing (HPLC/electrophoresis) is required before any clinical decision.', ML, fy+10);
  doc.setFont('helvetica','bold'); setColor(doc, C.text3);
  doc.text('ThalaPredict v1.0',      PW-MR, fy+6,  {align:'right'});
  doc.text(`Page ${p} of ${total}`,  PW-MR, fy+10, {align:'right'});
};

// ─── Section heading ──────────────────────────────────────────────────────────
const sHead = (doc, text, ML, y, CW) => {
  doc.setFont('helvetica','bold'); doc.setFontSize(7.5); setColor(doc, C.text2);
  doc.text(text, ML, y+5);
  rule(doc, ML, y+7, CW);
  return y+11;
};

// ═══════════════════════════════════════════════════════════════════════════════
export const generateReport = async ({
  result, form, district, isPregnant, familyHistory, clinicianName='Clinician'
}) => {
  const doc = new jsPDF({orientation:'portrait', unit:'mm', format:'a4'});
  const PW=210, PH=297, ML=14, MR=14, CW=PW-ML-MR;
  const SAFE_BOTTOM = PH-26;
  const rid  = reportId();
  const now  = new Date();
  const dStr = now.toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'});
  const tStr = now.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});

  const isCarrier   = result.prediction===1;
  const resColor    = isCarrier ? C.red      : C.green;
  const resBg       = isCarrier ? C.redLight : C.greenLight;
  const resDark     = isCarrier ? C.redDark  : C.greenDark;

  let curY = 0;
  const space   = () => SAFE_BOTTOM - curY;
  const newPage = () => { doc.addPage(); curY=18; };

  // ── HEADER ─────────────────────────────────────────────────────────────────
  setFill(doc, C.text1); doc.rect(0,0,PW,22,'F');
  setFill(doc, C.green); doc.rect(0,0,5,22,'F');

  doc.setFont('helvetica','bold'); doc.setFontSize(14); setColor(doc, C.white);
  doc.text('ThalaPredict', ML, 10);
  doc.setFont('helvetica','normal'); doc.setFontSize(7.5); setColor(doc, C.text3);
  doc.text(safe('ß-Thalassemia Carrier Screening System'), ML, 15.5);

  doc.setFontSize(7); setColor(doc, C.text3);
  doc.text(`Report ID: ${rid}`,          PW-MR, 8,  {align:'right'});
  doc.text(`${dStr}  ${tStr}`,           PW-MR, 13, {align:'right'});
  doc.text(`Clinician: ${clinicianName}`,PW-MR, 18, {align:'right'});

  curY = 28;

  // ── TITLE ──────────────────────────────────────────────────────────────────
  doc.setFont('helvetica','bold'); doc.setFontSize(11); setColor(doc, C.text1);
  doc.text(safe('ß-Thalassemia Carrier Screening Report'), ML, curY);
  doc.setFont('helvetica','normal'); doc.setFontSize(7.5); setColor(doc, C.text3);
  doc.text('SVM model  |  AUC-ROC 0.829  |  Recall 75.0%  |  Threshold 0.49  |  10 features', ML, curY+5);
  rule(doc, ML, curY+8, CW); curY+=13;

  // ── TWO-COLUMN: PATIENT INFO + RESULT CARD ─────────────────────────────────
  const LW=CW*0.44, RX=ML+LW+4, RW=CW-LW-4;
  const CH=56;

  // Patient info
  fRect(doc, ML, curY, LW, CH, 3, C.bg, C.border);
  doc.setFont('helvetica','bold'); doc.setFontSize(7.5); setColor(doc, C.text2);
  doc.text('PATIENT INFORMATION', ML+5, curY+6);
  rule(doc, ML+3, curY+8, LW-6);

  [
    ['Patient ID',     form.patientId || 'Anonymous'],
    ['Age',            form.age ? `${form.age} years` : '—'],
    ['Sex',            form.sex || '—'],
    ['District',       district || 'Not specified'],
    ['Pregnant',       isPregnant    ? 'Yes (antenatal)' : 'No'],
    ['Family History', familyHistory ? 'Yes'             : 'No'],
  ].forEach(([lbl,val],i) => {
    const ry = curY+14+i*7;
    doc.setFont('helvetica','normal'); doc.setFontSize(7); setColor(doc, C.text3);
    doc.text(lbl, ML+5, ry);
    doc.setFont('helvetica','bold');
    const hi=(lbl==='Pregnant'&&isPregnant)||(lbl==='Family History'&&familyHistory);
    setColor(doc, hi ? C.amber : C.text1);
    doc.text(String(val), ML+LW-5, ry, {align:'right'});
  });

  // Result card
  fRect(doc, RX, curY, RW, CH, 3, resBg, resColor);
  doc.setFont('helvetica','bold'); doc.setFontSize(6.5); setColor(doc, resColor);
  doc.text(isCarrier?'CARRIER DETECTED':'NON-CARRIER', RX+5, curY+7);
  doc.setFontSize(15); setColor(doc, resDark);
  doc.text(isCarrier?'Carrier':'Non-Carrier', RX+5, curY+15);
  doc.setFontSize(20); setColor(doc, resColor);
  doc.text(pct(result.carrier_probability), RX+RW-6, curY+15, {align:'right'});
  doc.setFont('helvetica','normal'); doc.setFontSize(6); setColor(doc, resColor);
  doc.text('carrier probability', RX+RW-6, curY+19, {align:'right'});

  rule(doc, RX+3, curY+22, RW-6, resColor);

  const confC = result.confidence==='High'?C.green : result.confidence==='Moderate'?C.amber : C.red;
  doc.setFont('helvetica','normal'); doc.setFontSize(7); setColor(doc, C.text2);
  doc.text('Confidence', RX+5, curY+28);
  fRect(doc, RX+24, curY+24.5, 22, 5, 2, confC, '');
  doc.setFont('helvetica','bold'); doc.setFontSize(6.5); setColor(doc, C.white);
  doc.text(result.confidence||'—', RX+35, curY+28, {align:'center'});

  fRect(doc, RX+3, curY+32, RW-6, 7, 2, result.referral_recommended?C.amberLight:C.greenLight, '');
  doc.setFont('helvetica','bold'); doc.setFontSize(7);
  setColor(doc, result.referral_recommended?C.amberDark:C.greenDark);
  doc.text(
    result.referral_recommended?'Referral Recommended':'No Referral Required',
    RX+RW/2, curY+36.5, {align:'center'}
  );

  // Clinical flags row
  let fx=RX+3; const flagY=curY+42;
  const flags=[];
  if (isPregnant)    flags.push({t:'Antenatal Auto-Referral', c:C.amberDark,  bg:C.amberLight,  w:44});
  if (familyHistory) flags.push({t:'Family History',          c:C.amberDark,  bg:C.amberLight,  w:30});
  if (district)      flags.push({t:district,                  c:C.indigo,     bg:C.indigoLight, w:Math.min(district.length*2.1+8,38)});
  flags.forEach(({t,c,bg,w}) => {
    fRect(doc, fx, flagY, w, 5, 2, bg, '');
    doc.setFont('helvetica','bold'); doc.setFontSize(5.8); setColor(doc, c);
    doc.text(t, fx+w/2, flagY+3.5, {align:'center'});
    fx+=w+2;
  });

  curY+=CH+5;

  // ── PROBABILITY BARS ────────────────────────────────────────────────────────
  fRect(doc, ML, curY, CW, 22, 3, C.white, C.border);
  doc.setFont('helvetica','bold'); doc.setFontSize(7.5); setColor(doc, C.text2);
  doc.text('PROBABILITY', ML+5, curY+6);

  const bx=ML+52, bw2=CW-66;
  [
    [result.carrier_probability,     'Carrier probability',     isCarrier ?C.red  :C.border],
    [result.non_carrier_probability, 'Non-carrier probability', !isCarrier?C.green:C.border],
  ].forEach(([val,lbl,col],i) => {
    const by=curY+10+i*7;
    doc.setFont('helvetica','normal'); doc.setFontSize(6.5); setColor(doc, C.text2);
    doc.text(lbl, ML+5, by+2.5);
    setFill(doc, C.border); doc.roundedRect(bx,by,bw2,3.5,1,1,'F');
    setFill(doc, col);      doc.roundedRect(bx,by,bw2*(val||0),3.5,1,1,'F');
    doc.setFont('helvetica','bold'); doc.setFontSize(6.5); setColor(doc, C.text1);
    doc.text(pct(val), bx+bw2+3, by+3);
  });
  const tx=bx+bw2*0.49;
  setStroke(doc, C.text3); doc.setLineWidth(0.3); doc.setLineDash([1,1]);
  doc.line(tx, curY+9, tx, curY+20); doc.setLineDash([]);
  doc.setFontSize(5.5); setColor(doc, C.text3);
  doc.text('Threshold 49%', tx, curY+8.2, {align:'center'});

  curY+=27;

  // ── CLINICAL NOTE — full dynamic height ─────────────────────────────────────
  const rawNote = safe(result.clinical_note || '—');
  doc.setFontSize(7);
  const noteSplit  = doc.splitTextToSize(rawNote, CW-12);
  const noteH      = Math.max(22, noteSplit.length*4.8+12);

  if (space() < noteH+4) newPage();
  fRect(doc, ML, curY, CW, noteH, 3, C.bg, C.border);
  doc.setFont('helvetica','bold'); doc.setFontSize(7.5); setColor(doc, C.text2);
  doc.text('CLINICAL NOTE', ML+5, curY+6);
  doc.setFont('helvetica','normal'); doc.setFontSize(7); setColor(doc, C.text1);
  doc.text(noteSplit, ML+5, curY+12);
  curY+=noteH+5;

  // ── CBC TABLE ───────────────────────────────────────────────────────────────
  if (space() < 46) newPage();
  curY = sHead(doc, 'CBC PARAMETERS', ML, curY, CW);

  fRect(doc, ML, curY, CW, 6, 0, C.text1, '');
  ['Parameter','Value','Reference Range','Status'].forEach((h,i) => {
    const xs=[ML+3, ML+68, ML+103, ML+155];
    doc.setFont('helvetica','bold'); doc.setFontSize(6.5); setColor(doc, C.white);
    doc.text(h, xs[i], curY+4);
  });
  curY+=6;

  const mcvV=form.mcv?parseFloat(form.mcv):null;
  const mchV=form.mch?parseFloat(form.mch):null;
  const hbgV=form.hbg?parseFloat(form.hbg):null;
  const rbcV=form.rbc?parseFloat(form.rbc):null;

  [
    ['MCV — Mean Corpuscular Volume',      mcvV,'fL',       '80–100 fL',       'MCV'],
    ['MCH — Mean Corpuscular Haemoglobin', mchV,'pg',       '27–33 pg',        'MCH'],
    ['HBG — Haemoglobin',                  hbgV,'g/dL',     '12–17 g/dL',      'HBG'],
    ['RBC — Red Blood Cells',              rbcV,'x10^12/L', '4.0–6.0 x10^12/L','RBC'],
  ].forEach(([label,val,unit,range,key],i) => {
    const ry=curY+i*7;
    fRect(doc, ML, ry, CW, 7, 0, i%2===0?C.white:C.bg, '');
    doc.setFont('helvetica','normal'); doc.setFontSize(7); setColor(doc, C.text1);
    doc.text(label, ML+3, ry+4.5);
    doc.setFont('helvetica','bold');
    doc.text(val!=null ? `${val.toFixed(1)} ${unit}` : 'Not provided', ML+68, ry+4.5);
    doc.setFont('helvetica','normal'); setColor(doc, C.text3);
    doc.text(range, ML+103, ry+4.5);
    if (val!=null) {
      const {flag,color}=rangeStatus(key,val);
      if (flag===1)       drawArrowUp  (doc, ML+158, ry+3.5, color);
      else if (flag===-1) drawArrowDown(doc, ML+158, ry+4.5, color);
      else {
        doc.setFont('helvetica','bold'); doc.setFontSize(7); setColor(doc, C.green);
        doc.text('OK', ML+157, ry+4.5);
      }
    }
  });
  curY+=4*7+5; rule(doc, ML, curY, CW); curY+=6;

  // ── DERIVED HAEMATOLOGICAL INDICES ──────────────────────────────────────────
  if (space() < 44) newPage();
  curY=sHead(doc, 'DERIVED HAEMATOLOGICAL INDICES', ML, curY, CW);

  const df=result.derived_features||{};
  const getDF=(...keys) => { for (const k of keys) if (df[k]!=null) return df[k]; return null; };

  const derivedRows=[
    ['England-Fraser', getDF('england_fraser'),              '>0 suggests carrier'],
    ['Green-King',     getDF('green_king','green_king_raw'), '<65 suggests carrier'],
    ['Srivastava',     getDF('srivastava','srivastava_raw'), '<31 suggests carrier'],
    ['HBG/MCV Ratio',  getDF('hbg_mcv_ratio'),              'Diagnostic index'],
    ['HBG/MCH Ratio',  getDF('hbg_mch_ratio'),              'Diagnostic index'],
    ['Flag GK',        getDF('flag_gk'),                    '1 = carrier signal'],
  ];
  const dCW=CW/2-2;
  derivedRows.forEach(([lbl,val,interp],i) => {
    const col=i%2===0?ML:ML+dCW+4, row=Math.floor(i/2), ry=curY+row*11;
    fRect(doc, col, ry, dCW, 10, 2, C.bg, C.border);
    doc.setFont('helvetica','normal'); doc.setFontSize(6.5); setColor(doc, C.text3);
    doc.text(lbl, col+4, ry+4.5);
    doc.setFont('helvetica','bold'); doc.setFontSize(10); setColor(doc, C.text1);
    doc.text(val!=null ? fmt(val) : '—', col+4, ry+9.2);
    doc.setFont('helvetica','normal'); doc.setFontSize(6); setColor(doc, C.text3);
    doc.text(interp, col+dCW-3, ry+9.2, {align:'right'});
  });
  curY+=Math.ceil(derivedRows.length/2)*11+5;

  // ── SUPPLEMENTARY INDICES ───────────────────────────────────────────────────
  const supp=result.supplementary_indices;
  if (supp && Object.keys(supp).length>0) {
    if (space()<18) newPage();
    doc.setFont('helvetica','italic'); doc.setFontSize(7); setColor(doc, C.text3);
    doc.text('Supplementary indices (RBC-based)', ML, curY+4); curY+=8;
    const sCW=(CW-8)/3;
    [
      ['Mentzer Index', supp.mentzer,       '<13 suggests carrier'],
      ['Shine & Lal',   supp.shine_lal,     '<1530 suggests carrier'],
      ['HBG/RBC Ratio', supp.hbg_rbc_ratio, '<3.8 suggests carrier'],
    ].forEach(([lbl,val,interp],i) => {
      const cx=ML+i*(sCW+4);
      fRect(doc, cx, curY, sCW, 10, 2, C.indigoLight, C.border);
      doc.setFont('helvetica','normal'); doc.setFontSize(6.5); setColor(doc, C.indigo);
      doc.text(lbl, cx+4, curY+4.5);
      doc.setFont('helvetica','bold'); doc.setFontSize(10); setColor(doc, C.text1);
      doc.text(val!=null ? fmt(val) : '—', cx+4, curY+9.2);
      doc.setFont('helvetica','normal'); doc.setFontSize(5.5); setColor(doc, C.text3);
      doc.text(interp, cx+sCW-3, curY+9.2, {align:'right'});
    });
    curY+=14;
  }

  // ── SHAP + RECOMMENDATION — kept together ────────────────────────────────────
  const shap    = result.shap_contributions;
  const hasShap = shap && Object.keys(shap).length>0;
  const shapH   = hasShap ? 62 : 0;

  doc.setFontSize(7);
  const recBody=safe(
    result.referral_recommended
      ? 'Patient should be referred for confirmatory Hb electrophoresis and genetic counselling before family planning decisions. HbA2 >= 3.5% by HPLC or electrophoresis confirms carrier status.'
      : safe('CBC indices do not suggest ß-thalassemia carrier status at the current screening threshold. Routine clinical follow-up as indicated.')
  );
  const recLines = doc.splitTextToSize(recBody, CW-14);
  const recH     = Math.max(24, recLines.length*4.8+14);
  const needed   = (hasShap ? shapH+30 : 0) + recH + 8;

  if (space() < needed) newPage();
  else { rule(doc, ML, curY+2, CW); curY+=8; }

  // SHAP section
  if (hasShap) {
    curY=sHead(doc, 'FEATURE CONTRIBUTIONS (SHAP)', ML, curY, CW);
    doc.setFont('helvetica','normal'); doc.setFontSize(6.5); setColor(doc, C.text3);
    doc.text(
      'Top 5 features driving this prediction. Positive (+) = toward carrier, Negative (-) = toward non-carrier.',
      ML, curY
    );
    curY+=7;

    // Draw background with NO stroke (avoids overwriting bars)
    fRect(doc, ML, curY, CW, shapH, 3, C.bg, '');
    drawSHAPBars(doc, shap, ML+4, curY+10, CW-8, isCarrier);
    curY+=shapH+5;
  }

  // Recommendation box
  const recBord = result.referral_recommended ? C.amber : C.green;
  const recBg2  = result.referral_recommended ? C.amberLight : C.greenLight;
  fRect(doc, ML, curY, CW, recH, 3, recBg2, recBord);
  setFill(doc, recBord); doc.roundedRect(ML, curY, 3, recH, 1,1,'F');
  doc.setFont('helvetica','bold'); doc.setFontSize(8);
  setColor(doc, result.referral_recommended ? C.amberDark : C.greenDark);
  doc.text(
    result.referral_recommended ? 'REFERRAL RECOMMENDED' : 'NO REFERRAL REQUIRED',
    ML+7, curY+7
  );
  doc.setFont('helvetica','normal'); doc.setFontSize(7); setColor(doc, C.text1);
  doc.text(recLines, ML+7, curY+13);

  // ── FOOTERS — all pages ──────────────────────────────────────────────────────
  const total = doc.internal.getNumberOfPages();
  for (let p=1; p<=total; p++) {
    doc.setPage(p);
    drawFooter(doc, p, total, PW, PH, ML, MR);
  }

  // ── SAVE ─────────────────────────────────────────────────────────────────────
  doc.save(`ThalaPredict_${form.patientId||'Anonymous'}_${now.toISOString().slice(0,10)}.pdf`);
};
