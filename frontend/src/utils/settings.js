// src/utils/settings.js
// Central settings store — read/write to localStorage
// Import getSettings() anywhere to use current values

const KEY = 'thalapredict_settings';

export const DEFAULTS = {
  // Unit Information
  clinicianName:   '',
  designation:     '',
  clinicName:      '',
  hospital:        '',
  mohArea:         '',
  unit:            '',
  // Screening Defaults
  defaultDistrict: '',
  theme:           'dark',
};

export function getSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(patch) {
  const next = { ...getSettings(), ...patch };
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function resetSettings() {
  localStorage.removeItem(KEY);
  return { ...DEFAULTS };
}
