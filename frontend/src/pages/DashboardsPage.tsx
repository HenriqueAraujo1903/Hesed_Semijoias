import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';

// ─────────────────────────────────────────────────────────────────────────────
// Catálogo de dashboards.
// Para adicionar um novo dashboard, basta incluir uma entrada aqui e criar
// a página/rota correspondente. `available: false` mostra o card como "em breve".
// ─────────────────────────────────────────────────────────────────────────────
interface DashboardItem {
  key: string;
  title: string;
  description: string;
  to: string;
  accent: 'gold' | 'emerald' | 'blue' | 'violet';
  icon: (props: { className?: string }) => ReactElement;
  available: boolean;
}

const DASHBOARDS: DashboardItem[] = [
  {
    key: 'vendas',
    title: 'Vendas',
    description: 'Receita, ticket médio e evolução das vendas ao longo do tempo.',
    to: '/dashboards/vendas',
    accent: 'gold',
    icon: ChartLineIcon,
    available: true,
  },
  {
    key: 'engajamento',
    title: 'Engajamento do Catálogo',
    description: 'Visitas, produtos mais desejados e o funil do acesso até a venda.',
    to: '/dashboards/engajamento',
    accent: 'blue',
    icon: EyeIcon,
    available: true,
  },
  {
    key: 'estoque',
    title: 'Estoque',
    description: 'Distribuição por categoria, itens em baixa e valor imobilizado.',
    to: '/dashboards/estoque',
    accent: 'emerald',
    icon: BoxIcon,
    available: true,
  },
  {
    key: 'revendedoras',
    title: 'Revendedoras',
    description: 'Desempenho por revendedora, comissões e consignações ativas.',
    to: '/dashboards/revendedoras',
    accent: 'blue',
    icon: PeopleIcon,
    available: true,
  },
  {
    key: 'promocoes',
    title: 'Promoções',
    description: 'Impacto das promoções ativas e produtos mais promovidos.',
    to: '/dashboards/promocoes',
    accent: 'violet',
    icon: SparkleIcon,
    available: true,
  },
];

const ACCENTS = {
  gold: {
    card: 'hover:border-gold-300/70 dark:hover:border-gold-700/60',
    iconBg: 'bg-gold-50 dark:bg-gold-900/20',
    icon: 'text-gold',
  },
  emerald: {
    card: 'hover:border-emerald-300/70 dark:hover:border-emerald-700/60',
    iconBg: 'bg-emerald-50 dark:bg-emerald-900/20',
    icon: 'text-emerald-500',
  },
  blue: {
    card: 'hover:border-blue-300/70 dark:hover:border-blue-700/60',
    iconBg: 'bg-blue-50 dark:bg-blue-900/20',
    icon: 'text-blue-500',
  },
  violet: {
    card: 'hover:border-violet-300/70 dark:hover:border-violet-700/60',
    iconBg: 'bg-violet-50 dark:bg-violet-900/20',
    icon: 'text-violet-500',
  },
} as const;

export default function DashboardsPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-serif text-display text-charcoal-800 dark:text-cream-200">Dashboards</h1>
        <p className="mt-2 text-sm text-charcoal-400 dark:text-charcoal-500">
          Painéis analíticos do negócio. Escolha um dashboard para explorar.
        </p>
      </div>

      {/* Grid de dashboards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {DASHBOARDS.map((d) => {
          const accent = ACCENTS[d.accent];
          const CardInner = (
            <>
              <div className="flex items-start justify-between">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${accent.iconBg}`}>
                  <d.icon className={`h-6 w-6 ${accent.icon}`} />
                </div>
                {!d.available && (
                  <span className="rounded-full bg-charcoal-100 dark:bg-charcoal-700 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-charcoal-400 dark:text-charcoal-500">
                    Em breve
                  </span>
                )}
              </div>
              <div className="mt-4">
                <h3 className="font-serif text-lg font-semibold text-charcoal-800 dark:text-cream-200">{d.title}</h3>
                <p className="mt-1 text-sm text-charcoal-400 dark:text-charcoal-500">{d.description}</p>
              </div>
            </>
          );

          const baseClass =
            'card p-6 flex flex-col min-h-[160px] transition-all duration-200 border border-transparent';

          return d.available ? (
            <Link key={d.key} to={d.to} className={`${baseClass} ${accent.card} hover:shadow-md`}>
              {CardInner}
            </Link>
          ) : (
            <div key={d.key} className={`${baseClass} opacity-70 cursor-default`}>
              {CardInner}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Icons ───────────────────────────────────────────────────────────────────

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function ChartLineIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v16.5A1.5 1.5 0 004.5 21H21M7.5 15l3-3 3 3 4.5-4.5" />
    </svg>
  );
}

function BoxIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
    </svg>
  );
}

function PeopleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  );
}

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
    </svg>
  );
}
