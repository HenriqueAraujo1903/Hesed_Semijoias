import { useTheme } from '../contexts/ThemeContext';

interface LogoProps {
  className?: string;
  alt?: string;
  /**
   * Qual variante da logo usar:
   * - 'auto' (padrão): segue o tema (claro/escuro)
   * - 'light': força a arte para fundos claros
   * - 'dark': força a arte tratada para fundos escuros (highlights atenuados)
   * Útil em áreas com fundo fixo (ex.: painel escuro do login) que não
   * acompanham o tema global.
   */
  variant?: 'auto' | 'light' | 'dark';
}

export default function Logo({ className = 'h-24', alt = 'HESED Semijoias', variant = 'auto' }: LogoProps) {
  const { isDark } = useTheme();
  const useDark = variant === 'dark' || (variant === 'auto' && isDark);

  return (
    <img
      src={useDark ? '/logo-dark.png' : '/logo.png'}
      alt={alt}
      className={className}
    />
  );
}
