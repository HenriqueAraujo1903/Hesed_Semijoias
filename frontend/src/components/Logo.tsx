import { useTheme } from '../contexts/ThemeContext';

interface LogoProps {
  className?: string;
  alt?: string;
}

export default function Logo({ className = 'h-24', alt = 'HESED Semijoias' }: LogoProps) {
  const { isDark } = useTheme();

  return (
    <img
      src={isDark ? '/logo-dark.png' : '/logo.png'}
      alt={alt}
      className={className}
    />
  );
}
