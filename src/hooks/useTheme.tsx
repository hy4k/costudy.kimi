import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

type ThemeCtx = { dark: boolean; toggle: () => void };

const Ctx = createContext<ThemeCtx>({ dark: false, toggle: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    // Light is the house default — only a saved explicit choice restores dark.
    return localStorage.getItem('costudy-theme') === 'dark';
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
