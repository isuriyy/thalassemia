/**
 * useVoiceInput.js
 * Custom hook wrapping the Web Speech API for clinical CBC field dictation.
 * Usage:
 *   const { listening, supported, startListening, stopListening } = useVoiceInput(onResult);
 *   onResult(transcript) — raw string from the mic
 */

import { useState, useRef, useCallback } from 'react';

export function useVoiceInput(onResult) {
  const [listening,  setListening]  = useState(false);
  const [error,      setError]      = useState('');
  const recognizerRef               = useRef(null);

  const supported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const startListening = useCallback((fieldHint = '') => {
    if (!supported) { setError('Speech recognition not supported in this browser.'); return; }
    if (recognizerRef.current) { recognizerRef.current.stop(); }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang            = 'en-US';
    rec.continuous      = false;
    rec.interimResults  = false;
    rec.maxAlternatives = 1;

    rec.onstart  = () => { setListening(true); setError(''); };
    rec.onend    = () => { setListening(false); };
    rec.onerror  = e => {
      setListening(false);
      if (e.error === 'no-speech') setError('No speech detected. Try again.');
      else if (e.error === 'not-allowed') setError('Microphone access denied.');
      else setError(`Error: ${e.error}`);
    };

    rec.onresult = e => {
      const raw = e.results[0][0].transcript.trim();
      onResult(raw, fieldHint);
    };

    recognizerRef.current = rec;
    rec.start();
  }, [supported, onResult]);

  const stopListening = useCallback(() => {
    if (recognizerRef.current) {
      recognizerRef.current.stop();
      recognizerRef.current = null;
    }
    setListening(false);
  }, []);

  return { listening, supported, error, startListening, stopListening };
}

/**
 * parseSpokenValue(transcript, field)
 * Converts spoken strings to numeric CBC values.
 * Handles: "sixty five", "6.5", "MCV sixty five", "eighty point five"
 */
export function parseSpokenValue(raw, field) {
  // Strip field name prefix if spoken (e.g. "MCV sixty five" → "sixty five")
  const fieldNames = {
    mcv: ['mcv','mean corpuscular volume','mean corpuscle volume'],
    mch: ['mch','mean corpuscular hemoglobin','mean corpuscular haemoglobin'],
    hbg: ['hbg','hgb','hemoglobin','haemoglobin','hb'],
    rbc: ['rbc','red blood cells','red blood count','red cells'],
    age: ['age','years'],
    patientId: ['patient id','patient identifier','id'],
  };

  let cleaned = raw.toLowerCase().trim();

  // Remove field name prefix
  const aliases = fieldNames[field] || [];
  for (const alias of aliases) {
    if (cleaned.startsWith(alias)) {
      cleaned = cleaned.slice(alias.length).trim();
      break;
    }
  }

  // Replace spoken "point" / "dot" with decimal
  cleaned = cleaned.replace(/\bpoint\b|\bdot\b/gi, '.');

  // Try direct numeric parse first
  const direct = parseFloat(cleaned.replace(/[^\d.]/g, ''));
  if (!isNaN(direct)) return String(direct);

  // Word-to-number map (covers typical CBC ranges)
  const words = {
    zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,
    eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,
    eighteen:18,nineteen:19,twenty:20,thirty:30,forty:40,fifty:50,sixty:60,
    seventy:70,eighty:80,ninety:90,hundred:100,
  };

  const tokens = cleaned.split(/[\s-]+/);
  let total = 0, current = 0, decimal = null, isDecimal = false;

  for (const token of tokens) {
    if (token === '.' || token === '') { isDecimal = true; decimal = ''; continue; }
    if (isDecimal) { decimal += token.replace(/\D/g,''); continue; }
    const n = words[token];
    if (n === undefined) continue;
    if (n === 100) { current = current === 0 ? 100 : current * 100; }
    else           { current += n; }
    total += current; current = 0;
  }
  total += current;

  if (total === 0) return null; // couldn't parse
  if (decimal !== null && decimal !== '') return String(parseFloat(`${total}.${decimal}`));
  return String(total);
}

/**
 * parseSpokenPatientDetails(transcript)
 * Parses "age thirty five female" or "male forty" etc.
 * Returns { age, sex } or partial.
 */
export function parseSpokenPatientDetails(raw) {
  const lower = raw.toLowerCase();
  const result = {};

  if (lower.includes('female') || lower.includes('woman') || lower.includes('girl')) result.sex = 'Female';
  else if (lower.includes('male') || lower.includes('man') || lower.includes('boy')) result.sex = 'Male';

  // Extract age number
  const ageVal = parseSpokenValue(raw, 'age');
  if (ageVal && !isNaN(parseFloat(ageVal))) result.age = ageVal;

  return result;
}

/**
 * parseSpokenFlags(transcript)
 * Parses "pregnant", "family history yes", etc.
 */
export function parseSpokenFlags(raw) {
  const lower = raw.toLowerCase();
  const result = {};

  if (lower.includes('pregnant') || lower.includes('antenatal') || lower.includes('pregnancy')) {
    result.isPregnant = !lower.includes('not pregnant') && !lower.includes('no pregnant');
  }
  if (lower.includes('family history') || lower.includes('family thalassemia') || lower.includes('thalassaemia')) {
    result.familyHistory = !lower.includes('no family') && !lower.includes('no history');
  }

  return result;
}
