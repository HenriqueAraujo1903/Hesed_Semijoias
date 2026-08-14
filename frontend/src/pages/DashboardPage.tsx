import { useAuth } from '../contexts/AuthContext';

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-serif text-display text-charcoal-800 dark:text-cream-200">Visão Geral</h1>
        <p className="mt-2 text-sm text-charcoal-400 dark:text-charcoal-500">
          Bem-vindo(a), <span className="text-charcoal-600 dark:text-charcoal-300 font-medium">{user?.name}</span>
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          label="Produtos em Estoque"
          value="—"
          sublabel="peças cadastradas"
          accent="gold"
        />
        <MetricCard
          label="Revendedoras Ativas"
          value="—"
          sublabel="parceiras"
          accent="emerald"
        />
        <MetricCard
          label="Vendas do Mês"
          value="—"
          sublabel="receita bruta"
          accent="blue"
        />
      </div>

      {/* Placeholder */}
      <div className="card p-12 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gold-50 dark:bg-gold-900/20 mb-4">
          <svg className="h-7 w-7 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
          </svg>
        </div>
        <h3 className="font-serif text-lg font-semibold text-charcoal-700 dark:text-charcoal-200">Métricas em breve</h3>
        <p className="mt-2 text-sm text-charcoal-400 dark:text-charcoal-500 max-w-sm mx-auto">
          Aqui você verá gráficos de vendas, custo de estoque e performance das revendedoras.
        </p>
      </div>
    </div>
  );
}

function MetricCard({ label, value, sublabel, accent }: {
  label: string; value: string; sublabel: string; accent: 'gold' | 'emerald' | 'blue';
}) {
  const accentStyles = {
    gold: 'bg-gold-50 dark:bg-gold-900/20 border-gold-200/50 dark:border-gold-800/40',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200/50 dark:border-emerald-800/40',
    blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200/50 dark:border-blue-800/40',
  };

  const dotStyles = {
    gold: 'bg-gold',
    emerald: 'bg-emerald-500',
    blue: 'bg-blue-500',
  };

  return (
    <div className={`rounded-2xl border p-6 ${accentStyles[accent]}`}>
      <div className="flex items-center gap-2 mb-3">
        <div className={`h-2 w-2 rounded-full ${dotStyles[accent]}`} />
        <p className="text-xs font-medium text-charcoal-500 dark:text-charcoal-400 uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-3xl font-serif font-semibold text-charcoal-800 dark:text-cream-200">{value}</p>
      <p className="mt-1 text-xs text-charcoal-400 dark:text-charcoal-500">{sublabel}</p>
    </div>
  );
}
