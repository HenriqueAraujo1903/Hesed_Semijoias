// Card de indicador (KPI) reutilizado nos dashboards e na Visão Geral.
export type KpiAccent = 'gold' | 'blue' | 'violet' | 'emerald';

const ACCENT_STYLES: Record<KpiAccent, string> = {
  gold: 'bg-gold-50 dark:bg-gold-900/20 border-gold-200/50 dark:border-gold-800/40',
  blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200/50 dark:border-blue-800/40',
  violet: 'bg-violet-50 dark:bg-violet-900/20 border-violet-200/50 dark:border-violet-800/40',
  emerald: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200/50 dark:border-emerald-800/40',
};

export default function KpiCard({ label, value, sub, accent }: {
  label: string;
  value: string;
  sub?: string;
  accent: KpiAccent;
}) {
  return (
    <div className={`rounded-2xl border p-5 ${ACCENT_STYLES[accent]}`}>
      <p className="text-xs font-medium text-charcoal-500 dark:text-charcoal-400 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-serif font-semibold text-charcoal-800 dark:text-cream-200 mt-2">{value}</p>
      {sub && <p className="text-xs text-charcoal-400 dark:text-charcoal-500 mt-1">{sub}</p>}
    </div>
  );
}
