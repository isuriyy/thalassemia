import { createContext, useContext, useState, useEffect } from 'react';
import { getSettings, saveSettings } from '../utils/settings';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(() => {
    // Read from unified settings store first, fallback to OS preference
    const settings = getSettings();
    if (settings.theme) return settings.theme === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    // Keep unified settings store in sync
    saveSettings({ theme: dark ? 'dark' : 'light' });
  }, [dark]);

  const toggle  = () => setDark(d => !d);
  const setTheme = (t) => setDark(t === 'dark');   // ← new: set by name

  return (
    <ThemeContext.Provider value={{ dark, toggle, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);