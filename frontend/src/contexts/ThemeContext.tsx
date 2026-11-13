import { createContext, useCallback, useContext, useLayoutEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

type Theme = 'light' | 'dark';

/**
 * Campanha (Black Friday): fixa o catálogo público (/catalogo) no modo escuro.
 * Não altera nem grava a preferência de tema salva — o painel admin continua
 * usando a escolha de cada usuário.
 *
 * O interruptor fica em UM só lugar: public/theme-init.js (FORCE_DARK_CATALOG),
 * que também aplica o tema antes da primeira pintura. Para encerrar a campanha,
 * mude para false lá. Se o script não carregar, o padrão é manter o escuro.
 */
export const FORCE_DARK_CATALOG =
  typeof window === 'undefined' || (window as unknown as { __FORCE_DARK_CATALOG__?: boolean }).__FORCE_DARK_CATALOG__ !== false;

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  isDark: boolean;
  /** true quando o tema está travado pela campanha (o botão de alternar deve ser ocultado). */
  themeLocked: boolean;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem('hesed-theme');
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {}
  // Default to light regardless of system preference (brand is light-first)
  return 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const { pathname } = useLocation();

  const themeLocked = FORCE_DARK_CATALOG && pathname.startsWith('/catalogo');
  const effectiveTheme: Theme = themeLocked ? 'dark' : theme;

  // useLayoutEffect: aplica a classe antes da primeira pintura (evita piscar claro→escuro).
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(effectiveTheme);
    // Com o tema travado não gravamos nada: a preferência do usuário é preservada.
    if (!themeLocked) localStorage.setItem('hesed-theme', theme);
  }, [effectiveTheme, themeLocked, theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme: effectiveTheme, toggleTheme, isDark: effectiveTheme === 'dark', themeLocked }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
