// useVoiceWizard.js — matches Screen.jsx API exactly
// Fixes: lang en-IN, continuous+interim, TTS gap, keepAlive, spoken decimals

import { useState, useRef, useCallback, useEffect } from 'react';

// ── Timing constants ──────────────────────────────────────────────────────────
const TTS_GAP_MS  = 700;   // wait after TTS ends before mic opens
const LISTEN_MS   = 12000; // max listen window per attempt
const MAX_RETRIES = 3;     // retries per field before stalling

// ── Field definitions (keys must match Screen.jsx form keys) ──────────────────
function buildSteps(isMale) {
  return [
    {
      key:      'mcv',
      label:    'MCV',
      unit:     'fL',
      prompt:   'Please say the MCV value in femtolitres.',
      optional: false,
    },
    {
      key:      'mch',
      label:    'MCH',
      unit:     'pg',
      prompt:   'Please say the MCH value in picograms.',
      optional: false,
    },
    {
      key:      'hbg',
      label:    'Haemoglobin',
      unit:     'g/dL',
      prompt:   'Please say the Haemoglobin value in grams per decilitre.',
      optional: false,
    },
    {
      key:      'rbc',
      label:    'RBC',
      unit:     '×10¹²/L',
      prompt:   'Please say the Red Blood Cell count. Say skip to skip.',
      optional: true,
    },
    {
      key:      'age',
      label:    'Age',
      unit:     'years',
      prompt:   'Please say the patient age in years.',
      optional: false,
    },
    ...(!isMale ? [{
      key:      'isPregnant',
      label:    'Pregnant',
      unit:     '',
      prompt:   'Is the patient pregnant? Say yes or no.',
      optional: false,
      isBool:   true,
    }] : []),
    {
      key:      'familyHistory',
      label:    'Family history',
      unit:     '',
      prompt:   'Is there a family history of thalassemia? Say yes or no.',
      optional: false,
      isBool:   true,
    },
  ];
}

// ── Speak helper — resolves after TTS ends ────────────────────────────────────
function speak(text) {
  return new Promise((resolve) => {
    window.speechSynthesis.cancel();
    const u    = new SpeechSynthesisUtterance(text);
    u.lang     = 'en-IN';   // ★ closest Chrome model to Sri Lankan English
    u.rate     = 0.90;
    u.pitch    = 1;

    // Chrome bug: long utterances silently stall — keep alive
    const keepAlive = setInterval(() => {
      window.speechSynthesis.pause();
      window.speechSynthesis.resume();
    }, 4500);

    const done = () => { clearInterval(keepAlive); resolve(); };
    u.onend    = done;
    u.onerror  = done;
    window.speechSynthesis.speak(u);
  });
}

// ── Extract number from spoken text ──────────────────────────────────────────
function extractNumber(raw) {
  const t = raw.toLowerCase()
    .replace(/\bpoint\b/g, '.')
    .replace(/\bdot\b/g,   '.')
    .replace(/\band\b/g,   '')
    .trim();
  const m = t.match(/(\d+\.?\d*)/);
  return m ? parseFloat(m[1]) : null;
}

// ── Extract boolean from spoken text ─────────────────────────────────────────
function extractBool(raw) {
  const t = raw.toLowerCase();
  if (/\b(yes|yeah|yep|yup|correct|right|confirm|okay|ok)\b/.test(t)) return true;
  if (/\b(no|nope|nah|wrong|false|negative)\b/.test(t))               return false;
  return null;
}

// ── Browser support check ─────────────────────────────────────────────────────
const SpeechRecognitionAPI =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

// ═════════════════════════════════════════════════════════════════════════════
export function useVoiceWizard({ onComplete, isMale = false }) {
  const steps = buildSteps(isMale);

  // ── State (property names match what Screen.jsx reads) ───────────────────
  const [isActive,   setIsActive]   = useState(false);
  const [status,     setStatus]     = useState('idle');
  // 'idle' | 'prompting' | 'listening' | 'confirming' | 'done' | 'error'
  const [stepIndex,  setStepIndex]  = useState(0);
  const [values,     setValues]     = useState({});
  const [transcript, setTranscript] = useState('');
  const [errorMsg,   setErrorMsg]   = useState('');
  const [progress,   setProgress]   = useState(0);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const recRef    = useRef(null);
  const timerRef  = useRef(null);
  const abortRef  = useRef(false);
  const retryRef  = useRef(0);
  const valsRef   = useRef({});    // mirror of values safe for closures

  const step      = steps[stepIndex] ?? null;
  const stepCount = steps.length;
  const supported = Boolean(SpeechRecognitionAPI);

  // ── Teardown ──────────────────────────────────────────────────────────────
  const stopRec = useCallback(() => {
    clearTimeout(timerRef.current);
    if (recRef.current) {
      try { recRef.current.abort(); } catch (_) {}
      recRef.current = null;
    }
    setTranscript('');
  }, []);

  // ── Cancel wizard ─────────────────────────────────────────────────────────
  const cancel = useCallback(() => {
    abortRef.current = true;
    stopRec();
    window.speechSynthesis.cancel();
    setIsActive(false);
    setStatus('idle');
    setStepIndex(0);
    setValues({});
    valsRef.current = {};
    setTranscript('');
    setErrorMsg('');
    setProgress(0);
  }, [stopRec]);

  // ── Forward declaration refs so closures can call each other ─────────────
  const listenForStepRef  = useRef(null);
  const listenConfirmRef  = useRef(null);
  const advanceStepRef    = useRef(null);
  const handleNoResultRef = useRef(null);
  const finishWizardRef   = useRef(null);

  // ── Finish wizard ─────────────────────────────────────────────────────────
  finishWizardRef.current = async (finalValues) => {
    setStatus('done');
    setProgress(100);
    await speak('All done. Values recorded. Please review and submit.');
    setIsActive(false);
    if (onComplete) onComplete(finalValues);
  };

  // ── Advance to next step ──────────────────────────────────────────────────
  advanceStepRef.current = (doneIdx, currentValues) => {
    retryRef.current = 0;
    const nextIdx = doneIdx + 1;

    if (nextIdx >= steps.length) {
      finishWizardRef.current(currentValues);
      return;
    }

    const nextStep = steps[nextIdx];
    setStepIndex(nextIdx);
    setStatus('prompting');

    const prompt = nextStep.optional
      ? `Next: ${nextStep.prompt} Say skip to skip this field.`
      : `Next: ${nextStep.prompt}`;

    speak(prompt).then(() => {
      if (!abortRef.current) {
        setTimeout(() => listenForStepRef.current(nextIdx, currentValues), TTS_GAP_MS);
      }
    });
  };

  // ── Handle no result / retry ──────────────────────────────────────────────
  handleNoResultRef.current = async (idx, currentValues) => {
    retryRef.current += 1;
    if (retryRef.current < MAX_RETRIES) {
      const currentStep = steps[idx];
      const hint = currentStep.isBool
        ? 'Please say yes or no.'
        : `Please say just the number in ${currentStep.unit}.`;
      const msg = retryRef.current === 1
        ? `I didn't catch that. ${hint}`
        : `Still didn't hear you. ${hint}`;
      await speak(msg);
      if (!abortRef.current) {
        setTimeout(() => listenForStepRef.current(idx, currentValues), TTS_GAP_MS);
      }
    } else {
      const currentStep = steps[idx];
      setStatus('error');
      setErrorMsg(
        `Couldn't hear "${currentStep.label}" after ${MAX_RETRIES} attempts. ` +
        (currentStep.optional
          ? 'Tap Cancel and type manually, or the field will be skipped.'
          : 'Tap Cancel and enter the value manually.')
      );
    }
  };

  // ── Listen for yes/no confirmation ───────────────────────────────────────
  listenConfirmRef.current = (idx, value, currentValues) => {
    if (abortRef.current) return;
    const currentStep = steps[idx];

    const rec = new SpeechRecognitionAPI();
    recRef.current      = rec;
    rec.lang            = 'en-IN';
    rec.continuous      = false;
    rec.interimResults  = false;
    rec.maxAlternatives = 2;

    setStatus('listening');
    timerRef.current = setTimeout(() => { try { rec.abort(); } catch (_) {} }, 8000);

    let answered = false;

    rec.onresult = (e) => {
      answered = true;
      clearTimeout(timerRef.current);
      const heard = e.results[0][0].transcript.toLowerCase().trim();
      const yes   = /\b(yes|yeah|yep|correct|right|ok|okay|confirm|yup)\b/.test(heard);

      if (yes) {
        const next = { ...currentValues, [currentStep.key]: value };
        valsRef.current = next;
        setValues(next);
        setProgress(Math.round(((idx + 1) / steps.length) * 100));
        speak('Got it.').then(() => {
          if (!abortRef.current) advanceStepRef.current(idx, next);
        });
      } else {
        retryRef.current = 0;
        speak("Let's try that again.").then(() => {
          if (!abortRef.current) {
            setTimeout(() => listenForStepRef.current(idx, currentValues), TTS_GAP_MS);
          }
        });
      }
    };

    rec.onerror = () => {
      if (!answered) {
        speak("Didn't catch that — let me ask again.").then(() => {
          if (!abortRef.current) {
            setTimeout(() => listenForStepRef.current(idx, currentValues), TTS_GAP_MS);
          }
        });
      }
    };

    rec.onend = () => clearTimeout(timerRef.current);

    try { rec.start(); } catch (err) { console.error('confirm rec.start:', err); }
  };

  // ── Core: listen for a field value ───────────────────────────────────────
  listenForStepRef.current = (idx, currentValues) => {
    if (abortRef.current) return;
    const currentStep = steps[idx];

    const rec = new SpeechRecognitionAPI();
    recRef.current      = rec;
    rec.lang            = 'en-IN';   // ★ accent fix
    rec.continuous      = true;      // ★ keep listening through pauses
    rec.interimResults  = true;      // ★ show partial results live
    rec.maxAlternatives = 3;

    let finalText = '';
    let gotResult = false;

    setStatus('listening');

    // Safety net — abort after LISTEN_MS
    timerRef.current = setTimeout(() => {
      if (!gotResult) { try { rec.abort(); } catch (_) {} }
    }, LISTEN_MS);

    rec.onresult = (e) => {
      let interim = '';
      finalText   = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t;
        else                       interim   += t;
      }
      setTranscript(finalText || interim); // live update in modal

      if (finalText.trim()) {
        gotResult = true;
        clearTimeout(timerRef.current);
        try { rec.stop(); } catch (_) {}
      }
    };

    rec.onerror = (e) => {
      // 'no-speech' is expected — handled in onend
      console.warn('rec error:', e.error);
    };

    rec.onend = async () => {
      clearTimeout(timerRef.current);
      if (abortRef.current) return;

      const heard = finalText.trim();

      // Skip command
      if (/\bskip\b/i.test(heard) && currentStep.optional) {
        await speak(`Skipping ${currentStep.label}.`);
        if (!abortRef.current) advanceStepRef.current(idx, currentValues);
        return;
      }

      // Boolean field
      if (currentStep.isBool) {
        const bval = extractBool(heard);
        if (bval === null) {
          await handleNoResultRef.current(idx, currentValues);
          return;
        }
        setTranscript(heard);
        setStatus('confirming');
        await speak(`I heard ${bval ? 'yes' : 'no'}. Is that correct? Say yes or no.`);
        if (!abortRef.current) listenConfirmRef.current(idx, bval, currentValues);
        return;
      }

      // Numeric field
      const value = extractNumber(heard);
      if (value === null) {
        await handleNoResultRef.current(idx, currentValues);
        return;
      }

      setTranscript(heard);
      setStatus('confirming');
      await speak(
        `I heard ${value} ${currentStep.unit} for ${currentStep.label}. ` +
        `Is that correct? Say yes or no.`
      );
      if (!abortRef.current) listenConfirmRef.current(idx, value, currentValues);
    };

    try {
      rec.start();
    } catch (err) {
      console.error('rec.start failed:', err);
      setStatus('error');
      setErrorMsg('Microphone error — check browser permissions and try again.');
    }
  };

  // ── Public: start wizard ──────────────────────────────────────────────────
  const start = useCallback(async () => {
    if (!SpeechRecognitionAPI) return;
    abortRef.current  = false;
    retryRef.current  = 0;
    valsRef.current   = {};
    setIsActive(true);
    setStatus('prompting');
    setStepIndex(0);
    setValues({});
    setTranscript('');
    setErrorMsg('');
    setProgress(0);

    await speak(
      'Voice entry started. I will ask for each CBC value one at a time. ' +
      'Say just the number when prompted. Optional fields can be skipped.'
    );

    if (!abortRef.current) {
      const first = steps[0];
      await speak(first.prompt);
      if (!abortRef.current) {
        setTimeout(() => listenForStepRef.current(0, {}), TTS_GAP_MS);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => () => {
    abortRef.current = true;
    stopRec();
    window.speechSynthesis.cancel();
  }, [stopRec]);

  // ── Return shape exactly matching Screen.jsx ──────────────────────────────
  return {
    isActive,     // used: wizard.isActive  (show overlay)
    status,       // used: wizard.status    ('prompting'|'listening'|'confirming'|'done'|'error')
    stepIndex,    // used: wizard.stepIndex
    stepCount,    // used: wizard.stepCount
    step,         // used: wizard.step.label / wizard.step.prompt
    values,       // used: wizard.values    (chips in modal)
    transcript,   // used: wizard.transcript (shown in modal)
    errorMsg,     // used: wizard.errorMsg
    progress,     // used: wizard.progress  (progress bar width)
    supported,    // used: wizard.supported (show/hide button)
    start,        // used: wizard.start()
    cancel,       // used: wizard.cancel()
  };
}
