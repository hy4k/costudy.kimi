import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

type ThemeCtx = { dark: boolean; toggle: () => void };

const Ctx = createContext<ThemeCtx>({ dark: false, toggle: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    const saved = localStorage.getItem('costudy-theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('costudy-theme', dark ? 'dark' : 'light');
  }, [dark]);

  return (
    <Ctx.Provider value={{ dark, toggle: () => setDark((v) => !v) }}>
      {children}
    </Ctx.Provider>
  );
}

export const useTheme = () => useContext(Ctx);
