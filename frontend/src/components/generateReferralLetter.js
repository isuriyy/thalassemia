import jsPDF from 'jspdf';

const C = {
  black:  '#000000',
  dark:   '#1a1a1a',
  mid:    '#444444',
  light:  '#666666',
  hint:   '#999999',
  border: '#cccccc',
  bg:     '#f8f8f8',
  green:  '#1D9E75',
  red:    '#E24B4A',
  amber:  '#D97706',
  white:  '#ffffff',
};

const hex2rgb   = h => [parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
const setFill   = (d,h) => { const [r,g,b]=hex2rgb(h); d.setFillColor(r,g,b); };
const setStroke = (d,h) => { const [r,g,b]=hex2rgb(h); d.setDrawColor(r,g,b); };
const setColor  = (d,h) => { const [r,g,b]=hex2rgb(h); d.setTextColor(r,g,b); };

const safe = str => {
  if (typeof str !== 'string') return String(str ?? '');
  return str
    .replace(/β/g,'\xDF').replace(/≥/g,'>=').replace(/≤/g,'<=')
    .replace(/→/g,'->').replace(/[^\x00-\xFF]/g,'?');
};

const refId = () => {
  const n=new Date(), p=x=>String(x).padStart(2,'0');
  return `TP/REF/${n.getFullYear()}/${p(n.getMonth()+1)}${p(n.getDate())}/${Math.random().toString(36).slice(2,5).toUpperCase()}`;
};

const fmt = v => typeof v==='number' ? v.toFixed(1) : (v ?? '—');
const pct  = v => typeof v==='number' ? `${Math.round(v*100)}%` : '—';

const rule = (doc, x, y, w, hex=C.border, lw=0.3) => {
  setStroke(doc,hex); doc.setLineWidth(lw); doc.line(x,y,x+w,y);
};

const dottedLine = (doc, x, y, w) => {
  setStroke(doc,C.border); doc.setLineWidth(0.2);
  doc.setLineDash([1,2]);
  doc.line(x,y,x+w,y);
  doc.setLineDash([]);
};

// ── Single patient referral ───────────────────────────────────────────────────
export const generateReferralLetter = async ({
  result,
  form,
  district,
  isPregnant,
  familyHistory,
  clinicianName = 'Medical Officer',
  designation   = '',
  clinicName    = 'Thalassemia Screening Unit',
  hospital      = '',
  mohArea       = '',
  unit          = '',
}) => {
  const doc  = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
  const PW=210, ML=20, MR=20, CW=PW-ML-MR;
  const now  = new Date();
  const dStr = now.toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'});
  const rid  = refId();

  const isCarrier = result?.prediction === 1;

  let y = 0;

  // ── Government Header ──
  setFill(doc, C.dark); doc.rect(0,0,PW,3,'F');

  setFill(doc,C.bg); setStroke(doc,C.border);
  doc.setLineWidth(0.3);
  doc.rect(ML, 8, 22, 22, 'FD');
  doc.setFont('helvetica','normal'); doc.setFontSize(5.5); setColor(doc,C.hint);
  doc.text('Official', ML+11, 16, {align:'center'});
  doc.text('Crest',    ML+11, 20, {align:'center'});
  doc.text('Here',     ML+11, 24, {align:'center'});

  doc.setFont('helvetica','bold'); doc.setFontSize(10); setColor(doc,C.dark);
  doc.text('MINISTRY OF HEALTH', PW/2, 12, {align:'center'});
  doc.setFont('helvetica','normal'); doc.setFontSize(8); setColor(doc,C.mid);
  doc.text('Democratic Socialist Republic of Sri Lanka', PW/2, 17, {align:'center'});
  doc.setFont('helvetica','bold'); doc.setFontSize(8.5); setColor(doc,C.dark);
  doc.text('SPECIALIST REFERRAL LETTER', PW/2, 23, {align:'center'});
  doc.text('Thalassaemia Carrier Screening Programme', PW/2, 28, {align:'center'});

  doc.setFont('helvetica','normal'); doc.setFontSize(7); setColor(doc,C.light);
  doc.text(`Ref: ${rid}`, PW-MR, 12, {align:'right'});
  doc.text(`Date: ${dStr}`, PW-MR, 17, {align:'right'});

  rule(doc, ML, 34, CW, C.dark, 0.5);
  rule(doc, ML, 35.5, CW, C.dark, 0.1);
  y = 41;

  // ── FROM / TO ──
  const colW = (CW-6)/2;

  setFill(doc,C.bg); setStroke(doc,C.border);
  doc.roundedRect(ML, y, colW, 34, 2,2,'FD');
  doc.setFont('helvetica','bold'); doc.setFontSize(7); setColor(doc,C.light);
  doc.text('FROM', ML+4, y+6);
  rule(doc, ML+3, y+8, colW-6, C.border);

  // Name + designation
  doc.setFont('helvetica','bold'); doc.setFontSize(8); setColor(doc,C.dark);
  const nameDesig = safe(clinicianName) + (designation ? `, ${safe(designation)}` : '');
  doc.text(nameDesig, ML+4, y+14);

  // Clinic / hospital lines
  doc.setFont('helvetica','normal'); doc.setFontSize(7); setColor(doc,C.light);
  doc.text(safe(clinicName), ML+4, y+19);
  let fromLineY = y+24;
  if (hospital) { doc.text(safe(hospital), ML+4, fromLineY); fromLineY += 5; }
  if (mohArea)  { doc.text(safe(mohArea),  ML+4, fromLineY); }

  doc.text('Facility:', ML+4, y+30);
  dottedLine(doc, ML+20, y+30, colW-24);

  const toX = ML+colW+6;
  setFill(doc,C.bg); setStroke(doc,C.border);
  doc.roundedRect(toX, y, colW, 34, 2,2,'FD');
  doc.setFont('helvetica','bold'); doc.setFontSize(7); setColor(doc,C.light);
  doc.text('TO', toX+4, y+6);
  rule(doc, toX+3, y+8, colW-6, C.border);
  doc.setFont('helvetica','normal'); doc.setFontSize(7); setColor(doc,C.dark);
  doc.text('The Consultant Haematologist /', toX+4, y+14);
  doc.text('Genetic Counselling Unit', toX+4, y+19);
  doc.setFontSize(7); setColor(doc,C.light);
  doc.text('Hospital:', toX+4, y+26);
  dottedLine(doc, toX+22, y+26, colW-26);
  doc.text('Unit/Ward:', toX+4, y+32);
  dottedLine(doc, toX+24, y+32, colW-28);

  y += 40;

  // ── Urgency Banner ──
  const urgColor = isPregnant ? C.red : isCarrier ? C.amber : C.green;
  const urgBg    = isPregnant ? '#FCEBEB' : isCarrier ? '#FFFBEB' : '#E1F5EE';
  const urgText  = isPregnant
    ? 'URGENT - ANTENATAL PATIENT: Immediate specialist review required'
    : isCarrier
    ? 'PRIORITY - Probable thalassaemia carrier: Confirmatory testing required'
    : 'ROUTINE - Borderline CBC findings: Specialist review advised';

  setFill(doc,urgBg); setStroke(doc,urgColor);
  doc.setLineWidth(0.4);
  doc.roundedRect(ML,y,CW,8,2,2,'FD');
  setFill(doc,urgColor); doc.roundedRect(ML,y,3,8,1,1,'F');
  doc.setFont('helvetica','bold'); doc.setFontSize(7.5); setColor(doc,urgColor);
  doc.text(safe(urgText), ML+7, y+5.2);
  y += 13;

  // ── Patient Details ──
  doc.setFont('helvetica','bold'); doc.setFontSize(8); setColor(doc,C.dark);
  doc.text('PATIENT DETAILS', ML, y);
  rule(doc, ML, y+2, CW, C.dark, 0.3);
  y += 7;

  const detailRows = [
    ['Patient ID / Name', form.patientId||'Not provided',      'Age',            form.age ? `${form.age} years` : '—'],
    ['Sex',               form.sex||'—',                        'District',       district||'Not specified'],
    ['Pregnant',          isPregnant ? 'Yes (Antenatal)' : 'No','Family History', familyHistory ? 'Yes - thalassaemia in family' : 'No'],
  ];

  detailRows.forEach(([l1,v1,l2,v2]) => {
    doc.setFont('helvetica','normal'); doc.setFontSize(7); setColor(doc,C.light);
    doc.text(l1+':', ML, y);
    doc.setFont('helvetica','bold');
    const hi1 = (l1==='Pregnant'&&isPregnant)||(l1==='Family History'&&familyHistory);
    setColor(doc, hi1 ? C.amber : C.dark);
    doc.text(safe(String(v1)), ML+38, y);

    doc.setFont('helvetica','normal'); setColor(doc,C.light);
    doc.text(l2+':', ML+CW/2, y);
    doc.setFont('helvetica','bold'); setColor(doc,C.dark);
    doc.text(safe(String(v2)), ML+CW/2+32, y);
    y += 7;
  });

  y += 2;
  rule(doc, ML, y, CW, C.border, 0.2);
  y += 6;

  // ── CBC Findings ──
  doc.setFont('helvetica','bold'); doc.setFontSize(8); setColor(doc,C.dark);
  doc.text('CBC FINDINGS', ML, y);
  rule(doc, ML, y+2, CW, C.dark, 0.3);
  y += 7;

  setFill(doc,C.dark); doc.rect(ML,y,CW,6,'F');
  doc.setFont('helvetica','bold'); doc.setFontSize(6.5); setColor(doc,C.white);
  ['Parameter','Value','Reference Range','Status'].forEach((h,i) => {
    const xs = [ML+3, ML+50, ML+90, ML+140];
    doc.text(h, xs[i], y+4.2);
  });
  y += 6;

  const cbcRows = [
    ['MCV - Mean Corpuscular Volume',      form.mcv, 'fL',      '80-100 fL',  form.mcv&&parseFloat(form.mcv)<80],
    ['MCH - Mean Corpuscular Haemoglobin', form.mch, 'pg',      '27-33 pg',   form.mch&&parseFloat(form.mch)<27],
    ['HBG - Haemoglobin',                  form.hbg, 'g/dL',    '12-17 g/dL', form.hbg&&parseFloat(form.hbg)<12],
    ['RBC - Red Blood Cells',              form.rbc, 'x10^12/L','4.0-6.0',    false],
  ];

  cbcRows.forEach(([label,val,cbcUnit,range,isLow],i) => {
    const rowBg = i%2===0 ? C.white : C.bg;
    setFill(doc,rowBg); doc.rect(ML,y,CW,6.5,'F');
    doc.setFont('helvetica','normal'); doc.setFontSize(7); setColor(doc,C.dark);
    doc.text(safe(label), ML+3, y+4.5);
    doc.setFont('helvetica','bold');
    const dispVal = val ? `${parseFloat(val).toFixed(1)} ${cbcUnit}` : 'Not provided';
    setColor(doc, isLow ? C.red : C.dark);
    doc.text(dispVal, ML+50, y+4.5);
    doc.setFont('helvetica','normal'); setColor(doc,C.light);
    doc.text(range, ML+90, y+4.5);
    doc.setFont('helvetica','bold');
    setColor(doc, isLow ? C.red : C.green);
    doc.text(isLow ? 'Below normal' : (val ? 'Normal' : 'Not provided'), ML+140, y+4.5);
    y += 6.5;
  });

  setStroke(doc,C.border); doc.setLineWidth(0.2);
  doc.rect(ML, y-cbcRows.length*6.5, CW, cbcRows.length*6.5, 'S');
  y += 6;

  // ── Screening Result ──
  doc.setFont('helvetica','bold'); doc.setFontSize(8); setColor(doc,C.dark);
  doc.text('SCREENING RESULT', ML, y);
  rule(doc, ML, y+2, CW, C.dark, 0.3);
  y += 7;

  const resColor = isCarrier ? C.red : C.green;
  const resBg    = isCarrier ? '#FCEBEB' : '#E1F5EE';

  setFill(doc,resBg); setStroke(doc,resColor);
  doc.setLineWidth(0.4);
  doc.roundedRect(ML, y, CW, 20, 2,2,'FD');

  doc.setFont('helvetica','bold'); doc.setFontSize(11); setColor(doc,resColor);
  doc.text(isCarrier ? 'PROBABLE CARRIER DETECTED' : 'NON-CARRIER', ML+6, y+8);

  doc.setFont('helvetica','normal'); doc.setFontSize(7); setColor(doc,C.mid);
  doc.text(`Carrier Probability: ${pct(result?.carrier_probability)}`, ML+6, y+14);
  doc.text(`Confidence: ${result?.confidence||'—'}`, ML+60, y+14);
  doc.text('Model: SVM  |  AUC-ROC: 0.829  |  Recall: 75%', ML+100, y+14);

  doc.setFont('helvetica','bold'); doc.setFontSize(20); setColor(doc,resColor);
  doc.text(pct(result?.carrier_probability), PW-MR-6, y+12, {align:'right'});
  doc.setFont('helvetica','normal'); doc.setFontSize(6); setColor(doc,resColor);
  doc.text('carrier probability', PW-MR-6, y+17, {align:'right'});

  y += 26;

  // ── Haematological Indices ──
  const df    = result?.derived_features || {};
  const si    = result?.supplementary_indices || {};
  const hasDF = Object.keys(df).length > 0;

  if (hasDF) {
    doc.setFont('helvetica','bold'); doc.setFontSize(8); setColor(doc,C.dark);
    doc.text('HAEMATOLOGICAL INDICES', ML, y);
    rule(doc, ML, y+2, CW, C.dark, 0.3);
    y += 7;

    const indices = [
      ['England-Fraser', df.england_fraser, '>0 = carrier'],
      ['Green-King',     df.green_king,     '<65 = carrier'],
      ['Srivastava',     df.srivastava,     '<31 = carrier'],
      ['HBG/MCV Ratio',  df.hbg_mcv_ratio,  'Diagnostic index'],
      ['HBG/MCH Ratio',  df.hbg_mch_ratio,  'Diagnostic index'],
      ['Flag GK',        df.flag_gk,        '1 = carrier signal'],
    ];

    const iCW = (CW-4)/3;
    indices.forEach(([label,val,interp],i) => {
      const col = i%3, row = Math.floor(i/3);
      const ix  = ML + col*(iCW+2);
      const iy  = y  + row*12;
      setFill(doc,C.bg); setStroke(doc,C.border);
      doc.setLineWidth(0.2);
      doc.roundedRect(ix,iy,iCW,10,1,1,'FD');
      doc.setFont('helvetica','normal'); doc.setFontSize(6.5); setColor(doc,C.light);
      doc.text(label, ix+3, iy+4.5);
      doc.setFont('helvetica','bold'); doc.setFontSize(9); setColor(doc,C.dark);
      doc.text(val!=null ? Number(val).toFixed(2) : '—', ix+3, iy+9);
      doc.setFont('helvetica','normal'); doc.setFontSize(5.5); setColor(doc,C.hint);
      doc.text(interp, ix+iCW-2, iy+9, {align:'right'});
    });

    y += Math.ceil(indices.length/3)*12 + 4;

    if (Object.keys(si).length > 0) {
      const suppRows = [
        ['Mentzer Index',  si.mentzer,       '<13 = carrier'],
        ['Shine & Lal',    si.shine_lal,     '<1530 = carrier'],
        ['HBG/RBC Ratio',  si.hbg_rbc_ratio, '<3.8 = carrier'],
      ];
      const sCW = (CW-8)/3;
      suppRows.forEach(([label,val,interp],i) => {
        const sx = ML + i*(sCW+4);
        setFill(doc,'#EEF2FF'); setStroke(doc,'#6366F1');
        doc.setLineWidth(0.2);
        doc.roundedRect(sx,y,sCW,10,1,1,'FD');
        doc.setFont('helvetica','normal'); doc.setFontSize(6.5); setColor(doc,'#6366F1');
        doc.text(label, sx+3, y+4.5);
        doc.setFont('helvetica','bold'); doc.setFontSize(9); setColor(doc,C.dark);
        doc.text(val!=null ? Number(val).toFixed(2) : '—', sx+3, y+9);
        doc.setFont('helvetica','normal'); doc.setFontSize(5.5); setColor(doc,C.hint);
        doc.text(interp, sx+sCW-2, y+9, {align:'right'});
      });
      y += 14;
    }
  }

  // ── Reason for Referral ──
  doc.setFont('helvetica','bold'); doc.setFontSize(8); setColor(doc,C.dark);
  doc.text('REASON FOR REFERRAL', ML, y);
  rule(doc, ML, y+2, CW, C.dark, 0.3);
  y += 7;

  const reasons = [];
  if (isCarrier)                    reasons.push('CBC indices consistent with probable beta-thalassaemia carrier status (SVM model, AUC-ROC 0.829).');
  if (isPregnant)                   reasons.push('Patient is pregnant - urgent antenatal haematology review required per MOH guidelines.');
  if (familyHistory)                reasons.push('Positive family history of thalassaemia - increased clinical risk.');
  if (result?.referral_recommended) reasons.push('Confirmatory testing recommended: HbA2 quantification by HPLC or haemoglobin electrophoresis (HbA2 >= 3.5% confirms carrier status).');
  if (district)                     reasons.push(`Patient from ${district} district.`);

  reasons.forEach(r => {
    doc.setFont('helvetica','normal'); doc.setFontSize(7.5); setColor(doc,C.dark);
    const lines = doc.splitTextToSize(`• ${safe(r)}`, CW-4);
    doc.text(lines, ML+2, y);
    y += lines.length * 5 + 2;
  });

  y += 4;

  // Clinical note
  const noteText = safe(result?.clinical_note || '');
  if (noteText) {
    const noteLines = doc.splitTextToSize(`Clinical note: ${noteText}`, CW-8);
    setFill(doc,C.bg); doc.roundedRect(ML,y-2,CW,noteLines.length*4.5+6,2,2,'F');
    doc.setFont('helvetica','italic'); doc.setFontSize(7); setColor(doc,C.mid);
    doc.text(noteLines, ML+4, y+2);
    y += noteLines.length*4.5+10;
  }

  // ── Recommended Investigations ──
  doc.setFont('helvetica','bold'); doc.setFontSize(8); setColor(doc,C.dark);
  doc.text('RECOMMENDED INVESTIGATIONS', ML, y);
  rule(doc, ML, y+2, CW, C.dark, 0.3);
  y += 7;

  const investigations = [
    'HbA2 quantification by High Performance Liquid Chromatography (HPLC)',
    'Haemoglobin electrophoresis (if HPLC unavailable)',
    'Serum ferritin and iron studies to exclude iron deficiency',
    'Peripheral blood film examination',
    ...(isPregnant    ? ['Partner CBC and HbA2 - urgent for prenatal risk assessment'] : []),
    ...(familyHistory ? ['Family member cascade screening recommended'] : []),
  ];

  investigations.forEach((inv,i) => {
    doc.setFont('helvetica','normal'); doc.setFontSize(7.5); setColor(doc,C.dark);
    doc.text(`${i+1}.  ${safe(inv)}`, ML+3, y);
    y += 6;
  });

  y += 6;

  // ── Signature Block ──
  if (y > 240) { doc.addPage(); y = 20; }

  rule(doc, ML, y, CW, C.border, 0.2);
  y += 8;

  const sigColW = (CW-10)/2;

  doc.setFont('helvetica','bold'); doc.setFontSize(7.5); setColor(doc,C.dark);
  doc.text('Referring Medical Officer', ML, y);
  y += 5;

  doc.setFont('helvetica','normal'); doc.setFontSize(7); setColor(doc,C.dark);
  doc.text(safe(clinicianName), ML, y);
  y += 4;

  doc.setFont('helvetica','normal'); doc.setFontSize(6.5); setColor(doc,C.light);
  if (designation) { doc.text(safe(designation), ML, y); y += 4; }
  doc.text(safe(clinicName), ML, y); y += 4;
  if (hospital) { doc.text(safe(hospital), ML, y); y += 4; }
  if (mohArea)  { doc.text(safe(mohArea),  ML, y); y += 4; }

  dottedLine(doc, ML, y, sigColW);
  doc.setFontSize(6); setColor(doc,C.hint);
  doc.text('Signature & Date', ML, y+4);
  y += 10;

  setFill(doc,C.bg); setStroke(doc,C.border);
  doc.setLineWidth(0.2);
  doc.roundedRect(ML+sigColW+10, y-38, sigColW, 32, 2,2,'FD');
  doc.setFont('helvetica','normal'); doc.setFontSize(6.5); setColor(doc,C.hint);
  doc.text('Official Stamp / Seal', ML+sigColW+10+sigColW/2, y-38+10, {align:'center'});
  doc.text('of Referring Institution', ML+sigColW+10+sigColW/2, y-38+15, {align:'center'});

  y += 4;

  // ── Disclaimer footer ──
  rule(doc, ML, y, CW, C.dark, 0.4);
  y += 5;
  setFill(doc,C.dark); doc.rect(0,y,PW,18,'F');
  doc.setFont('helvetica','normal'); doc.setFontSize(6); setColor(doc,'#9ca3af');
  doc.text(safe('This referral is generated by ThalaPredict - an AI-assisted thalassaemia carrier screening tool.'), ML, y+5);
  doc.text(safe('The SVM model result is a screening aid only and does not constitute a clinical diagnosis.'), ML, y+9);
  doc.text(safe('Confirmatory diagnosis requires HPLC or haemoglobin electrophoresis by a qualified haematologist.'), ML, y+13);
  doc.setFont('helvetica','bold'); setColor(doc,'#6b7280');
  doc.text(`ThalaPredict v1.0  |  Ref: ${rid}  |  ${dStr}`, PW-MR, y+9, {align:'right'});

  // ── Save ──
  const fname = `Referral_${form.patientId||'Patient'}_${now.toISOString().slice(0,10)}.pdf`;
  doc.save(fname);
};


// ── Couple referral ───────────────────────────────────────────────────────────
export const generateCoupleReferralLetter = async ({
  result,
  partnerA,
  partnerB,
  clinicianName = 'Medical Officer',
  designation   = '',
  clinicName    = 'Thalassemia Screening Unit',
  hospital      = '',
  mohArea       = '',
  unit          = '',
}) => {
  const doc  = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
  const PW=210, ML=20, MR=20, CW=PW-ML-MR;
  const now  = new Date();
  const dStr = now.toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'});
  const rid  = refId();

  const { coupleRisk } = result;
  const rA = result.partnerA;
  const rB = result.partnerB;
  const bothCarriers = coupleRisk.bothCarriers;
  const oneCarrier   = coupleRisk.oneCarrier;

  let y = 0;

  // ── Header ──
  setFill(doc,C.dark); doc.rect(0,0,PW,3,'F');

  setFill(doc,C.bg); setStroke(doc,C.border);
  doc.setLineWidth(0.3);
  doc.rect(ML,8,22,22,'FD');
  doc.setFont('helvetica','normal'); doc.setFontSize(5.5); setColor(doc,C.hint);
  doc.text('Official', ML+11, 16, {align:'center'});
  doc.text('Crest',    ML+11, 20, {align:'center'});
  doc.text('Here',     ML+11, 24, {align:'center'});

  doc.setFont('helvetica','bold'); doc.setFontSize(10); setColor(doc,C.dark);
  doc.text('MINISTRY OF HEALTH', PW/2, 12, {align:'center'});
  doc.setFont('helvetica','normal'); doc.setFontSize(8); setColor(doc,C.mid);
  doc.text('Democratic Socialist Republic of Sri Lanka', PW/2, 17, {align:'center'});
  doc.setFont('helvetica','bold'); doc.setFontSize(8.5); setColor(doc,C.dark);
  doc.text('SPECIALIST REFERRAL LETTER - COUPLE SCREENING', PW/2, 23, {align:'center'});
  doc.text('Thalassaemia Carrier Screening Programme', PW/2, 28, {align:'center'});

  doc.setFont('helvetica','normal'); doc.setFontSize(7); setColor(doc,C.light);
  doc.text(`Ref: ${rid}`, PW-MR, 12, {align:'right'});
  doc.text(`Date: ${dStr}`, PW-MR, 17, {align:'right'});

  rule(doc, ML, 34, CW, C.dark, 0.5);
  rule(doc, ML, 35.5, CW, C.dark, 0.1);
  y = 41;

  // ── FROM / TO ──
  const colW = (CW-6)/2;

  setFill(doc,C.bg); setStroke(doc,C.border);
  doc.roundedRect(ML,y,colW,34,2,2,'FD');
  doc.setFont('helvetica','bold'); doc.setFontSize(7); setColor(doc,C.light);
  doc.text('FROM', ML+4, y+6);
  rule(doc, ML+3, y+8, colW-6, C.border);

  // Name + designation
  doc.setFont('helvetica','bold'); doc.setFontSize(8); setColor(doc,C.dark);
  const cNameDesig = safe(clinicianName) + (designation ? `, ${safe(designation)}` : '');
  doc.text(cNameDesig, ML+4, y+14);

  doc.setFont('helvetica','normal'); doc.setFontSize(7); setColor(doc,C.light);
  doc.text(safe(clinicName), ML+4, y+19);
  let cFromY = y+24;
  if (hospital) { doc.text(safe(hospital), ML+4, cFromY); cFromY += 5; }
  if (mohArea)  { doc.text(safe(mohArea),  ML+4, cFromY); }

  doc.text('Facility:', ML+4, y+30);
  dottedLine(doc, ML+20, y+30, colW-24);

  const toX = ML+colW+6;
  setFill(doc,C.bg); setStroke(doc,C.border);
  doc.roundedRect(toX,y,colW,34,2,2,'FD');
  doc.setFont('helvetica','bold'); doc.setFontSize(7); setColor(doc,C.light);
  doc.text('TO', toX+4, y+6);
  rule(doc, toX+3, y+8, colW-6, C.border);
  doc.setFont('helvetica','normal'); doc.setFontSize(7); setColor(doc,C.dark);
  doc.text('The Consultant Haematologist /', toX+4, y+14);
  doc.text('Genetic Counselling Unit', toX+4, y+19);
  doc.text('Hospital:', toX+4, y+26);
  dottedLine(doc, toX+22, y+26, colW-26);
  doc.text('Unit/Ward:', toX+4, y+32);
  dottedLine(doc, toX+24, y+32, colW-28);

  y += 40;

  // ── Urgency Banner ──
  const urgColor = bothCarriers ? C.red : oneCarrier ? C.amber : C.green;
  const urgBg    = bothCarriers ? '#FCEBEB' : oneCarrier ? '#FFFBEB' : '#E1F5EE';
  const urgText  = bothCarriers
    ? 'URGENT - BOTH PARTNERS CARRIERS: Immediate genetic counselling required'
    : oneCarrier
    ? 'PRIORITY - One partner carrier: Genetic counselling advised'
    : 'ROUTINE - No carrier identified: Specialist review for borderline findings';

  setFill(doc,urgBg); setStroke(doc,urgColor);
  doc.setLineWidth(0.4);
  doc.roundedRect(ML,y,CW,8,2,2,'FD');
  setFill(doc,urgColor); doc.roundedRect(ML,y,3,8,1,1,'F');
  doc.setFont('helvetica','bold'); doc.setFontSize(7.5); setColor(doc,urgColor);
  doc.text(safe(urgText), ML+7, y+5.2);
  y += 13;

  // ── Partner Results ──
  doc.setFont('helvetica','bold'); doc.setFontSize(8); setColor(doc,C.dark);
  doc.text('PARTNER SCREENING RESULTS', ML, y);
  rule(doc, ML, y+2, CW, C.dark, 0.3);
  y += 7;

  const pColW = (CW-4)/2;
  const partners = [
    { label:'PARTNER A', accent:'#EC4899', data:partnerA, res:rA },
    { label:'PARTNER B', accent:'#3B82F6', data:partnerB, res:rB },
  ];

  partners.forEach(({label,accent,data,res},i) => {
    const px     = i===0 ? ML : ML+pColW+4;
    const isC    = res?.prediction === 1;
    const resBg  = isC ? '#FCEBEB' : '#E1F5EE';
    const resCol = isC ? C.red : C.green;

    setFill(doc,C.bg); setStroke(doc,accent);
    doc.setLineWidth(0.4);
    doc.roundedRect(px,y,pColW,52,2,2,'FD');
    setFill(doc,accent); doc.roundedRect(px,y,pColW,5,2,2,'F');
    doc.rect(px,y+3,pColW,2,'F');

    doc.setFont('helvetica','bold'); doc.setFontSize(7); setColor(doc,C.white);
    doc.text(label, px+4, y+4);

    doc.setFont('helvetica','normal'); doc.setFontSize(6.5); setColor(doc,C.light);
    doc.text('Patient ID:', px+3, y+11);
    doc.setFont('helvetica','bold'); setColor(doc,C.dark);
    doc.text(safe(data.patientId||'Anonymous'), px+22, y+11);

    doc.setFont('helvetica','normal'); setColor(doc,C.light);
    doc.text(`Age: ${data.age||'—'} yrs  |  Sex: ${data.sex||'—'}`, px+3, y+17);

    setFill(doc,resBg); setStroke(doc,resCol);
    doc.setLineWidth(0.3);
    doc.roundedRect(px+3,y+20,pColW-6,14,2,2,'FD');
    doc.setFont('helvetica','bold'); doc.setFontSize(6); setColor(doc,resCol);
    doc.text(isC ? 'CARRIER DETECTED' : 'NON-CARRIER', px+6, y+26);
    doc.setFontSize(10); setColor(doc,isC?C.red:C.green);
    doc.text(`${Math.round((res?.carrier_probability||0)*100)}%`, px+pColW-6, y+31, {align:'right'});
    doc.setFont('helvetica','normal'); doc.setFontSize(6.5); setColor(doc,C.mid);
    doc.text(`Confidence: ${res?.confidence||'—'}`, px+6, y+31);

    doc.setFont('helvetica','normal'); doc.setFontSize(6.5); setColor(doc,C.light);
    doc.text(`MCV: ${data.mcv||'—'} fL   MCH: ${data.mch||'—'} pg   HBG: ${data.hbg||'—'} g/dL`, px+3, y+40);

    if (res?.referral_recommended) {
      setFill(doc,'#FFFBEB');
      doc.roundedRect(px+3,y+44,pColW-6,5,1,1,'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(6); setColor(doc,C.amber);
      doc.text('Referral recommended - confirmatory testing required', px+5, y+47.5);
    }
  });

  y += 58;

  // ── Mendelian Risk ──
  doc.setFont('helvetica','bold'); doc.setFontSize(8); setColor(doc,C.dark);
  doc.text('MENDELIAN RISK ASSESSMENT', ML, y);
  rule(doc, ML, y+2, CW, C.dark, 0.3);
  y += 7;

  const riskBg     = bothCarriers ? '#FCEBEB' : oneCarrier ? '#FFFBEB' : '#E1F5EE';
  const riskBorder = bothCarriers ? C.red : oneCarrier ? C.amber : C.green;
  const riskDark   = bothCarriers ? C.red : oneCarrier ? C.amber : C.green;

  const summaryLines = doc.splitTextToSize(safe(coupleRisk.summary), CW-14);
  const summH = Math.max(20, summaryLines.length*4.8+14);

  setFill(doc,riskBg); setStroke(doc,riskBorder);
  doc.setLineWidth(0.4);
  doc.roundedRect(ML,y,CW,summH,2,2,'FD');
  setFill(doc,riskBorder); doc.roundedRect(ML,y,3,summH,1,1,'F');

  doc.setFont('helvetica','bold'); doc.setFontSize(8); setColor(doc,riskDark);
  doc.text(
    bothCarriers ? 'HIGH RISK - BOTH PARTNERS CARRIERS'
  : oneCarrier   ? 'ONE PARTNER IS A CARRIER'
  : 'NO CARRIER RISK IDENTIFIED',
    ML+8, y+7
  );
  doc.setFont('helvetica','normal'); doc.setFontSize(7); setColor(doc,C.dark);
  doc.text(summaryLines, ML+8, y+13);
  y += summH+6;

  // Risk tiles
  if (bothCarriers || oneCarrier) {
    const tiles = bothCarriers
      ? [
          {p:25, l:'Affected child (thalassaemia major)', c:C.red},
          {p:50, l:'Carrier child (thalassaemia minor)',  c:C.amber},
          {p:25, l:'Unaffected child',                    c:C.green},
        ]
      : [
          {p:0,  l:'Affected child risk',  c:C.green},
          {p:50, l:'Carrier child risk',   c:C.amber},
          {p:50, l:'Unaffected child',     c:C.green},
        ];

    const tw = (CW-(tiles.length-1)*4)/tiles.length;
    tiles.forEach(({p,l,c},i) => {
      const tx = ML+i*(tw+4);
      setFill(doc,C.bg); setStroke(doc,C.border);
      doc.setLineWidth(0.2);
      doc.roundedRect(tx,y,tw,18,2,2,'FD');
      doc.setFont('helvetica','bold'); doc.setFontSize(14); setColor(doc,c);
      doc.text(`${p}%`, tx+tw/2, y+11, {align:'center'});
      doc.setFont('helvetica','normal'); doc.setFontSize(6); setColor(doc,C.mid);
      doc.text(l, tx+tw/2, y+16, {align:'center'});
    });
    y += 24;
  }

  // ── Recommended Investigations ──
  doc.setFont('helvetica','bold'); doc.setFontSize(8); setColor(doc,C.dark);
  doc.text('RECOMMENDED INVESTIGATIONS & ACTIONS', ML, y);
  rule(doc, ML, y+2, CW, C.dark, 0.3);
  y += 7;

  const coupleInv = [
    'HbA2 quantification by HPLC for both partners',
    'Haemoglobin electrophoresis if HPLC unavailable',
    'Serum ferritin and iron studies to exclude iron deficiency anaemia',
    ...(bothCarriers ? [
      'Urgent genetic counselling for both partners',
      'Prenatal diagnosis options: chorionic villus sampling (10-13 weeks) or amniocentesis (15-20 weeks)',
      'DNA mutation analysis for specific beta-thalassaemia mutations',
    ] : []),
    ...(oneCarrier ? [
      'Genetic counselling advised',
      'Partner cascade testing if not yet done',
    ] : []),
  ];

  coupleInv.forEach((inv,i) => {
    doc.setFont('helvetica','normal'); doc.setFontSize(7.5); setColor(doc,C.dark);
    doc.text(`${i+1}.  ${safe(inv)}`, ML+3, y);
    y += 6;
  });

  y += 6;

  // ── Signature ──
  if (y > 245) { doc.addPage(); y = 20; }

  rule(doc, ML, y, CW, C.border, 0.2);
  y += 8;

  const sigW = (CW-10)/2;
  doc.setFont('helvetica','bold'); doc.setFontSize(7.5); setColor(doc,C.dark);
  doc.text('Referring Medical Officer', ML, y);
  y += 5;

  doc.setFont('helvetica','normal'); doc.setFontSize(7); setColor(doc,C.dark);
  doc.text(safe(clinicianName), ML, y);
  y += 4;

  doc.setFont('helvetica','normal'); doc.setFontSize(6.5); setColor(doc,C.light);
  if (designation) { doc.text(safe(designation), ML, y); y += 4; }
  doc.text(safe(clinicName), ML, y); y += 4;
  if (hospital) { doc.text(safe(hospital), ML, y); y += 4; }
  if (mohArea)  { doc.text(safe(mohArea),  ML, y); y += 4; }

  dottedLine(doc, ML, y, sigW);
  doc.setFontSize(6); setColor(doc,C.hint);
  doc.text('Signature & Date', ML, y+4);

  setFill(doc,C.bg); setStroke(doc,C.border);
  doc.setLineWidth(0.2);
  doc.roundedRect(ML+sigW+10, y-22, sigW, 28, 2,2,'FD');
  doc.setFont('helvetica','normal'); doc.setFontSize(6.5); setColor(doc,C.hint);
  doc.text('Official Stamp / Seal', ML+sigW+10+sigW/2, y-22+10, {align:'center'});
  doc.text('of Referring Institution', ML+sigW+10+sigW/2, y-22+15, {align:'center'});

  y += 10;

  doc.setFont('helvetica','normal'); doc.setFontSize(6.5); setColor(doc,C.light);
  doc.text(`Couple Screening ID: ${result.coupleScreeningId||'—'}`, ML, y);
  y += 8;

  // ── Disclaimer ──
  rule(doc, ML, y, CW, C.dark, 0.4);
  y += 5;
  setFill(doc,C.dark); doc.rect(0,y,PW,18,'F');
  doc.setFont('helvetica','normal'); doc.setFontSize(6); setColor(doc,'#9ca3af');
  doc.text(safe('This referral is generated by ThalaPredict - an AI-assisted thalassaemia carrier screening tool.'), ML, y+5);
  doc.text(safe('Results are a screening aid only and do not constitute clinical diagnosis. Confirmatory HPLC required.'), ML, y+9);
  doc.text(safe('Genetic counselling by a qualified clinical geneticist is strongly recommended for high-risk couples.'), ML, y+13);
  doc.setFont('helvetica','bold'); setColor(doc,'#6b7280');
  doc.text(`ThalaPredict v1.0  |  Ref: ${rid}  |  ${dStr}`, PW-MR, y+9, {align:'right'});

  // ── Save ──
  const nameA = partnerA.patientId||'PartnerA';
  const nameB = partnerB.patientId||'PartnerB';
  doc.save(`Referral_Couple_${nameA}_${nameB}_${now.toISOString().slice(0,10)}.pdf`);
};
