// Resolução de períodos para os filtros dos dashboards.
// Um período é { from, to } em ISO yyyy-MM-dd (ou null = sem limite).

export interface Period {
  from: string | null;
  to: string | null;
}

export type PresetKey =
  | 'today' | '7d' | '30d' | '90d' | '12m'
  | 'thisMonth' | 'lastMonth' | 'thisYear' | 'all' | 'custom';

export interface PresetDef {
  key: PresetKey;
  label: string;
}

// Atalhos rápidos (ordem de exibição). "custom" é implícito quando o usuário
// escolhe datas manualmente, então não entra nesta lista de botões.
export const PRESETS: PresetDef[] = [
  { key: 'today', label: 'Hoje' },
  { key: '7d', label: '7 dias' },
  { key: '30d', label: '30 dias' },
  { key: '90d', label: '90 dias' },
  { key: '12m', label: '12 meses' },
  { key: 'thisMonth', label: 'Este mês' },
  { key: 'lastMonth', label: 'Mês passado' },
  { key: 'thisYear', label: 'Este ano' },
  { key: 'all', label: 'Tudo' },
];

function iso(d: Date): string {
  // Local date -> yyyy-MM-dd (sem UTC shift).
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Resolve um preset em { from, to }. "to" fica null (até hoje) na maioria. */
export function resolvePreset(key: PresetKey): Period {
  const now = new Date();
  switch (key) {
    case 'today':
      return { from: iso(now), to: iso(now) };
    case '7d': {
      const d = new Date(now); d.setDate(d.getDate() - 6); // inclui hoje
      return { from: iso(d), to: iso(now) };
    }
    case '30d': {
      const d = new Date(now); d.setDate(d.getDate() - 29);
      return { from: iso(d), to: iso(now) };
    }
    case '90d': {
      const d = new Date(now); d.setDate(d.getDate() - 89);
      return { from: iso(d), to: iso(now) };
    }
    case '12m': {
      const d = new Date(now); d.setMonth(d.getMonth() - 12);
      return { from: iso(d), to: iso(now) };
    }
    case 'thisMonth': {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: iso(first), to: iso(now) };
    }
    case 'lastMonth': {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0); // último dia do mês anterior
      return { from: iso(first), to: iso(last) };
    }
    case 'thisYear': {
      const first = new Date(now.getFullYear(), 0, 1);
      return { from: iso(first), to: iso(now) };
    }
    case 'all':
    default:
      return { from: null, to: null };
  }
}

/** Rótulo legível do período efetivo (dd/MM/yyyy). */
export function formatPeriod(p: Period): string {
  const fmt = (s: string | null) => {
    if (!s) return null;
    const [y, m, d] = s.split('-');
    return `${d}/${m}/${y}`;
  };
  const f = fmt(p.from);
  const t = fmt(p.to);
  if (!f && !t) return 'Todo o período';
  if (f && t) return f === t ? f : `${f} – ${t}`;
  if (f) return `desde ${f}`;
  return `até ${t}`;
}

/** Período inválido = from e to definidos com from > to. */
export function isInvalid(p: Period): boolean {
  return !!(p.from && p.to && p.from > p.to);
}
