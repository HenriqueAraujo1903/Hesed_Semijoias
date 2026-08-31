import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';

// ─── Tipos do payload de /admin/analytics/sales ─────────────────────────────
interface Kpis {
  revenue: number; cost: number; margin: number; marginPercent: number;
  orders: number; items: number; averageTicket: number;
}
interface TimePoint { period: string; revenue: number; items: number; orders: number; }
interface CategorySlice { category: string; revenue: number; items: number; }
interface ProductRow { sku: string; name: string; category: string; revenue: number; items: number; }
interface PromotionSplit { promoRevenue: number; promoItems: number; regularRevenue: number; regularItems: number; }
interface Conversion { totalOrders: number; confirmedOrders: number; pendingOrders: number; cancelledOrders: number; conversionRate: number; }
interface SalesAnalytics {
  kpis: Kpis; timeSeries: TimePoint[]; byCategory: CategorySlice[];
  topProducts: ProductRow[]; promotionSplit: PromotionSplit; conversion: Conversion;
}

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const NUM = new Intl.NumberFormat('pt-BR');

type Granularity = 'day' | 'month' | 'year';

// Presets de período rápidos
const RANGE_PRESETS: { key: string; label: string; days: number | null }[] = [
  { key: '30d', label: 'Últimos 30 dias', days: 30 },
  { key: '90d', label: 'Últimos 90 dias', days: 90 },
  { key: '12m', label: 'Últimos 12 meses', days: 365 },
  { key: 'all', label: 'Todo período', days: null },
];

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export default function SalesDashboardPage() {
  const [data, setData] = useState<SalesAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [granularity, setGranularity] = useState<Granularity>('day');
  const [rangePreset, setRangePreset] = useState('30d');
  const [category, setCategory] = useState('');
  const [promoOnly, setPromoOnly] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);

  // Carrega categorias uma vez (do catálogo)
  useEffect(() => {
    api.get('/products/catalog').then((res) => {
      const cats = Array.from(new Set(res.data.map((p: any) => p.category))).sort() as string[];
      setCategories(cats);
    }).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const preset = RANGE_PRESETS.find(r => r.key === rangePreset);
      const params: Record<string, string> = { granularity, status: 'CONFIRMADO' };
      if (preset?.days) params.from = isoDaysAgo(preset.days);
      if (category) params.category = category;
      if (promoOnly) params.promoOnly = 'true';

      const res = await api.get('/admin/analytics/sales', { params });
      setData(res.data);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Erro ao carregar os dados de vendas.');
    } finally {
      setLoading(false);
    }
  }, [granularity, rangePreset, category, promoOnly]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      {/* Breadcrumb + Header */}
      <div>
        <Link to="/dashboards" className="text-xs text-charcoal-400 hover:text-gold transition-colors">← Dashboards</Link>
        <h1 className="font-serif text-display text-charcoal-800 dark:text-cream-200 mt-1">Dashboard de Vendas</h1>
        <p className="mt-1 text-sm text-charcoal-400 dark:text-charcoal-500">
          Análise de vendas confirmadas — pedidos enviados pelo catálogo e confirmados.
        </p>
      </div>

      {/* Filtros */}
      <div className="card p-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-[10px] font-medium text-charcoal-400 uppercase tracking-wide mb-1">Período</label>
          <select value={rangePreset} onChange={(e) => setRangePreset(e.target.value)} className="input-field py-1.5 text-sm">
            {RANGE_PRESETS.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-medium text-charcoal-400 uppercase tracking-wide mb-1">Visão</label>
          <div className="flex rounded-lg border border-charcoal-200 dark:border-charcoal-600 overflow-hidden">
            {(['day', 'month', 'year'] as Granularity[]).map(g => (
              <button key={g} onClick={() => setGranularity(g)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  granularity === g ? 'bg-gold text-white' : 'text-charcoal-500 dark:text-charcoal-400 hover:bg-cream-100 dark:hover:bg-charcoal-700'
                }`}>
                {g === 'day' ? 'Dia' : g === 'month' ? 'Mês' : 'Ano'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-medium text-charcoal-400 uppercase tracking-wide mb-1">Categoria</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="input-field py-1.5 text-sm">
            <option value="">Todas</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 cursor-pointer pb-1.5">
          <input type="checkbox" checked={promoOnly} onChange={(e) => setPromoOnly(e.target.checked)}
            className="w-4 h-4 rounded border-charcoal-300 text-gold focus:ring-gold" />
          <span className="text-sm text-charcoal-600 dark:text-charcoal-300">Somente promoções</span>
        </label>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gold border-t-transparent" />
        </div>
      ) : error ? (
        <div className="card p-8 text-center text-sm text-red-500">{error}</div>
      ) : !data || data.kpis.orders === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard label="Receita" value={BRL.format(data.kpis.revenue)} accent="gold" />
            <KpiCard label="Pedidos" value={NUM.format(data.kpis.orders)} sub={`${NUM.format(data.kpis.items)} itens`} accent="blue" />
            <KpiCard label="Ticket Médio" value={BRL.format(data.kpis.averageTicket)} accent="violet" />
            <KpiCard label="Margem" value={BRL.format(data.kpis.margin)} sub={`${data.kpis.marginPercent}% da receita`} accent="emerald" />
          </div>

          {/* Série temporal */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-lg font-semibold text-charcoal-800 dark:text-cream-200">Receita ao longo do tempo</h2>
              <span className="text-xs text-charcoal-400">{granularity === 'day' ? 'por dia' : granularity === 'month' ? 'por mês' : 'por ano'}</span>
            </div>
            <TimeSeriesChart data={data.timeSeries} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Por categoria */}
            <div className="card p-5">
              <h2 className="font-serif text-lg font-semibold text-charcoal-800 dark:text-cream-200 mb-4">Receita por categoria</h2>
              <CategoryBars data={data.byCategory} />
            </div>

            {/* Promoção vs regular */}
            <div className="card p-5">
              <h2 className="font-serif text-lg font-semibold text-charcoal-800 dark:text-cream-200 mb-4">Promoção vs. preço cheio</h2>
              <PromotionDonut split={data.promotionSplit} />
            </div>
          </div>

          {/* Conversão */}
          <div className="card p-5">
            <h2 className="font-serif text-lg font-semibold text-charcoal-800 dark:text-cream-200 mb-1">Conversão de pedidos</h2>
            <p className="text-xs text-charcoal-400 mb-4">Do total de pedidos recebidos no período, quantos viraram venda.</p>
            <ConversionBar conversion={data.conversion} />
          </div>

          {/* Top produtos */}
          <div className="card p-5">
            <h2 className="font-serif text-lg font-semibold text-charcoal-800 dark:text-cream-200 mb-4">Produtos mais vendidos</h2>
            <TopProductsTable rows={data.topProducts} />
          </div>
        </>
      )}
    </div>
  );
}

// ─── KPI Card ────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, accent }: {
  label: string; value: string; sub?: string; accent: 'gold' | 'blue' | 'violet' | 'emerald';
}) {
  const styles = {
    gold: 'bg-gold-50 dark:bg-gold-900/20 border-gold-200/50 dark:border-gold-800/40',
    blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200/50 dark:border-blue-800/40',
    violet: 'bg-violet-50 dark:bg-violet-900/20 border-violet-200/50 dark:border-violet-800/40',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200/50 dark:border-emerald-800/40',
  };
  return (
    <div className={`rounded-2xl border p-5 ${styles[accent]}`}>
      <p className="text-xs font-medium text-charcoal-500 dark:text-charcoal-400 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-serif font-semibold text-charcoal-800 dark:text-cream-200 mt-2">{value}</p>
      {sub && <p className="text-xs text-charcoal-400 dark:text-charcoal-500 mt-1">{sub}</p>}
    </div>
  );
}

// ─── Gráfico de série temporal (barras SVG) ─────────────────────────────────
function TimeSeriesChart({ data }: { data: TimePoint[] }) {
  if (data.length === 0) return <EmptyChart />;
  const max = Math.max(...data.map(d => d.revenue), 1);
  // Com muitos períodos, dá largura mínima por barra e rola horizontalmente
  // para não espremer as barras no celular.
  const scrollable = data.length > 12;

  return (
    <div>
      <div className={scrollable ? 'overflow-x-auto pb-1' : ''}>
        <div style={scrollable ? { minWidth: `${data.length * 28}px` } : undefined}>
          <div className="flex items-end gap-1 h-52">
            {data.map((d) => {
              const h = (d.revenue / max) * 100;
              return (
                <div key={d.period} className="flex-1 flex flex-col items-center justify-end group relative min-w-[20px]">
                  <div className="absolute -top-8 hidden group-hover:block bg-charcoal-800 text-white text-[10px] rounded px-2 py-1 whitespace-nowrap z-10">
                    {BRL.format(d.revenue)} • {d.orders} pedido(s)
                  </div>
                  <div
                    className="w-full max-w-[40px] rounded-t bg-gold/80 hover:bg-gold transition-all"
                    style={{ height: `${Math.max(h, 2)}%` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex gap-1 mt-2">
            {data.map((d) => (
              <div key={d.period} className="flex-1 text-center min-w-[20px]">
                <span className="text-[9px] text-charcoal-400" style={{ writingMode: data.length > 15 ? 'vertical-rl' : undefined }}>
                  {formatPeriodLabel(d.period)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="text-[10px] text-charcoal-300 mt-2 text-right">
        Máx: {BRL.format(max)} • {data.length} período(s)
        {scrollable && <span className="ml-1">· arraste para o lado →</span>}
      </p>
    </div>
  );
}

function formatPeriodLabel(period: string): string {
  // yyyy-MM-dd → dd/MM ; yyyy-MM → MM/yy ; yyyy → yyyy
  const parts = period.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
  if (parts.length === 2) return `${parts[1]}/${parts[0].slice(2)}`;
  return period;
}

// ─── Barras horizontais por categoria ───────────────────────────────────────
function CategoryBars({ data }: { data: CategorySlice[] }) {
  if (data.length === 0) return <EmptyChart />;
  const max = Math.max(...data.map(d => d.revenue), 1);
  return (
    <div className="space-y-3">
      {data.map((c) => (
        <div key={c.category}>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-charcoal-600 dark:text-charcoal-300 font-medium">{c.category}</span>
            <span className="text-charcoal-500 dark:text-charcoal-400">{BRL.format(c.revenue)} • {c.items} itens</span>
          </div>
          <div className="h-2.5 rounded-full bg-charcoal-100 dark:bg-charcoal-700 overflow-hidden">
            <div className="h-full rounded-full bg-gold" style={{ width: `${(c.revenue / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Donut promoção vs regular ──────────────────────────────────────────────
function PromotionDonut({ split }: { split: PromotionSplit }) {
  const total = split.promoRevenue + split.regularRevenue;
  if (total === 0) return <EmptyChart />;
  const promoPct = (split.promoRevenue / total) * 100;
  const circumference = 2 * Math.PI * 40;
  const promoArc = (promoPct / 100) * circumference;

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 100 100" className="w-32 h-32 -rotate-90">
        <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="14" className="text-emerald-400/70" />
        <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="14"
          className="text-gold" strokeDasharray={`${promoArc} ${circumference}`} />
      </svg>
      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-gold" />
          <span className="text-charcoal-600 dark:text-charcoal-300">Promoção</span>
          <span className="text-charcoal-400 ml-auto">{BRL.format(split.promoRevenue)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-emerald-400/70" />
          <span className="text-charcoal-600 dark:text-charcoal-300">Preço cheio</span>
          <span className="text-charcoal-400 ml-auto">{BRL.format(split.regularRevenue)}</span>
        </div>
        <p className="text-xs text-charcoal-400 pt-1">
          {promoPct.toFixed(0)}% da receita veio de promoções
        </p>
      </div>
    </div>
  );
}

// ─── Barra de conversão ──────────────────────────────────────────────────────
function ConversionBar({ conversion }: { conversion: Conversion }) {
  const { totalOrders, confirmedOrders, pendingOrders, cancelledOrders, conversionRate } = conversion;
  if (totalOrders === 0) return <EmptyChart />;
  const pct = (n: number) => (n / totalOrders) * 100;
  return (
    <div>
      <div className="flex h-6 rounded-lg overflow-hidden">
        {confirmedOrders > 0 && <div className="bg-emerald-500 flex items-center justify-center" style={{ width: `${pct(confirmedOrders)}%` }}>
          {pct(confirmedOrders) > 10 && <span className="text-[10px] text-white font-medium">{confirmedOrders}</span>}
        </div>}
        {pendingOrders > 0 && <div className="bg-amber-400 flex items-center justify-center" style={{ width: `${pct(pendingOrders)}%` }}>
          {pct(pendingOrders) > 10 && <span className="text-[10px] text-white font-medium">{pendingOrders}</span>}
        </div>}
        {cancelledOrders > 0 && <div className="bg-red-400 flex items-center justify-center" style={{ width: `${pct(cancelledOrders)}%` }}>
          {pct(cancelledOrders) > 10 && <span className="text-[10px] text-white font-medium">{cancelledOrders}</span>}
        </div>}
      </div>
      <div className="flex flex-wrap gap-4 mt-3 text-xs">
        <Legend color="bg-emerald-500" label="Confirmados" value={confirmedOrders} />
        <Legend color="bg-amber-400" label="Pendentes" value={pendingOrders} />
        <Legend color="bg-red-400" label="Cancelados" value={cancelledOrders} />
        <span className="ml-auto text-charcoal-600 dark:text-charcoal-300 font-medium">
          Taxa de conversão: <span className="text-gold">{conversionRate}%</span>
        </span>
      </div>
    </div>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <span className="flex items-center gap-1.5 text-charcoal-500 dark:text-charcoal-400">
      <span className={`h-2.5 w-2.5 rounded-sm ${color}`} />
      {label}: <span className="font-medium text-charcoal-700 dark:text-charcoal-200">{value}</span>
    </span>
  );
}

// ─── Tabela top produtos ─────────────────────────────────────────────────────
function TopProductsTable({ rows }: { rows: ProductRow[] }) {
  if (rows.length === 0) return <EmptyChart />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-charcoal-400 uppercase tracking-wide border-b border-charcoal-100 dark:border-charcoal-700">
            <th className="pb-2 font-medium">Produto</th>
            <th className="pb-2 font-medium">Categoria</th>
            <th className="pb-2 font-medium text-right">Itens</th>
            <th className="pb-2 font-medium text-right">Receita</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.sku} className="border-b border-charcoal-50 dark:border-charcoal-800 last:border-0">
              <td className="py-2.5">
                <span className="text-charcoal-700 dark:text-charcoal-200">{p.name}</span>
                <span className="text-charcoal-400 text-xs ml-2 font-mono">{p.sku}</span>
              </td>
              <td className="py-2.5 text-charcoal-500 dark:text-charcoal-400">{p.category}</td>
              <td className="py-2.5 text-right text-charcoal-600 dark:text-charcoal-300">{p.items}</td>
              <td className="py-2.5 text-right font-medium text-charcoal-800 dark:text-cream-200">{BRL.format(p.revenue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Estados vazios ──────────────────────────────────────────────────────────
function EmptyChart() {
  return <div className="py-8 text-center text-xs text-charcoal-300 dark:text-charcoal-600">Sem dados no período.</div>;
}

function EmptyState() {
  return (
    <div className="card py-20 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gold-50 dark:bg-gold-900/20 mb-4">
        <svg className="h-7 w-7 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
      </div>
      <h3 className="font-serif text-lg font-semibold text-charcoal-700 dark:text-charcoal-200">Ainda não há vendas confirmadas</h3>
      <p className="mt-2 text-sm text-charcoal-400 dark:text-charcoal-500 max-w-sm mx-auto">
        Assim que pedidos forem confirmados na aba <Link to="/pedidos" className="text-gold hover:underline">Pedidos</Link>, as métricas aparecerão aqui.
      </p>
    </div>
  );
}
