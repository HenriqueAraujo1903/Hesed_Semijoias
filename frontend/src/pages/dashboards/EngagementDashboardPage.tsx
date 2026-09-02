import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import KpiCard from '../../components/KpiCard';
import { NUM } from '../../utils/format';

interface Kpis {
  visits: number; uniqueSessions: number; selections: number;
  ordersCreated: number; salesConfirmed: number;
}
interface DayPoint { period: string; visits: number; selections: number; }
interface SelectedProduct { sku: string; name: string; category: string; selections: number; uniqueSessions: number; }
interface Funnel {
  visits: number; selections: number; orders: number; sales: number;
  visitToSelection: number; selectionToOrder: number; orderToSale: number;
}
interface Engagement {
  kpis: Kpis; timeSeries: DayPoint[]; topSelected: SelectedProduct[]; funnel: Funnel;
}

const RANGE_PRESETS = [
  { key: '30d', label: 'Últimos 30 dias', days: 30 },
  { key: '90d', label: 'Últimos 90 dias', days: 90 },
  { key: 'all', label: 'Todo período', days: null as number | null },
];

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export default function EngagementDashboardPage() {
  const [data, setData] = useState<Engagement | null>(null);
  const [sold, setSold] = useState<{ sku: string; items: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rangePreset, setRangePreset] = useState('30d');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const preset = RANGE_PRESETS.find(r => r.key === rangePreset);
      const params: Record<string, string> = {};
      if (preset?.days) params.from = isoDaysAgo(preset.days);

      const [engRes, salesRes] = await Promise.all([
        api.get('/admin/analytics/engagement', { params }),
        api.get('/admin/analytics/sales', { params: { ...params, status: 'CONFIRMADO' } }),
      ]);
      setData(engRes.data);
      setSold((salesRes.data.topProducts ?? []).map((p: any) => ({ sku: p.sku, items: p.items })));
    } catch (e: any) {
      setError(e.response?.data?.error || 'Erro ao carregar os dados de engajamento.');
    } finally {
      setLoading(false);
    }
  }, [rangePreset]);

  useEffect(() => { load(); }, [load]);

  const soldBySku = new Map(sold.map(s => [s.sku, s.items]));

  return (
    <div className="space-y-6">
      <div>
        <Link to="/dashboards" className="text-xs text-charcoal-400 hover:text-gold transition-colors">← Dashboards</Link>
        <h1 className="font-serif text-display text-charcoal-800 dark:text-cream-200 mt-1">Engajamento do Catálogo</h1>
        <p className="mt-1 text-sm text-charcoal-400 dark:text-charcoal-500">
          Visitas, interesse por produto e o funil até a venda — inclusive quem não fez pedido.
        </p>
      </div>

      {/* Filtro de período */}
      <div className="card p-4 flex items-end gap-4">
        <div>
          <label className="block text-[10px] font-medium text-charcoal-400 uppercase tracking-wide mb-1">Período</label>
          <select value={rangePreset} onChange={(e) => setRangePreset(e.target.value)} className="input-field py-1.5 text-sm">
            {RANGE_PRESETS.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gold border-t-transparent" />
        </div>
      ) : error ? (
        <div className="card p-8 text-center text-sm text-red-500">{error}</div>
      ) : !data || (data.kpis.visits === 0 && data.kpis.selections === 0) ? (
        <EmptyState />
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard label="Visitas" value={NUM.format(data.kpis.visits)} sub={`${NUM.format(data.kpis.uniqueSessions)} visitantes únicos`} accent="blue" />
            <KpiCard label="Seleções" value={NUM.format(data.kpis.selections)} sub="itens marcados" accent="violet" />
            <KpiCard label="Pedidos" value={NUM.format(data.kpis.ordersCreated)} accent="gold" />
            <KpiCard label="Vendas" value={NUM.format(data.kpis.salesConfirmed)} accent="emerald" />
          </div>

          {/* Funil */}
          <div className="card p-5">
            <h2 className="font-serif text-lg font-semibold text-charcoal-800 dark:text-cream-200 mb-1">Funil de conversão</h2>
            <p className="text-xs text-charcoal-400 mb-5">Do acesso ao catálogo até a venda confirmada.</p>
            <FunnelChart funnel={data.funnel} />
          </div>

          {/* Série temporal */}
          <div className="card p-5">
            <h2 className="font-serif text-lg font-semibold text-charcoal-800 dark:text-cream-200 mb-4">Visitas e seleções por dia</h2>
            <EngagementTimeSeries data={data.timeSeries} />
          </div>

          {/* Desejados vs vendidos */}
          <div className="card p-5">
            <h2 className="font-serif text-lg font-semibold text-charcoal-800 dark:text-cream-200 mb-1">Mais desejados vs. vendidos</h2>
            <p className="text-xs text-charcoal-400 mb-4">
              Produtos mais selecionados no catálogo e quantos de fato foram vendidos. Alta seleção com baixa venda pode indicar preço ou disponibilidade.
            </p>
            <DesiredVsSoldTable rows={data.topSelected} soldBySku={soldBySku} />
          </div>
        </>
      )}
    </div>
  );
}

// ─── Funil (barras decrescentes com taxa entre etapas) ───────────────────────
function FunnelChart({ funnel }: { funnel: Funnel }) {
  const steps = [
    { label: 'Visitas', value: funnel.visits, color: 'bg-blue-400' },
    { label: 'Seleções', value: funnel.selections, color: 'bg-violet-400', rate: funnel.visitToSelection, rateLabel: 'das visitas' },
    { label: 'Pedidos', value: funnel.orders, color: 'bg-gold', rate: funnel.selectionToOrder, rateLabel: 'das seleções' },
    { label: 'Vendas', value: funnel.sales, color: 'bg-emerald-500', rate: funnel.orderToSale, rateLabel: 'dos pedidos' },
  ];
  const max = Math.max(...steps.map(s => s.value), 1);

  return (
    <div className="space-y-3">
      {steps.map((s) => (
        <div key={s.label}>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-charcoal-600 dark:text-charcoal-300 font-medium">{s.label}</span>
            <span className="text-charcoal-500 dark:text-charcoal-400">
              {NUM.format(s.value)}
              {'rate' in s && s.rate !== undefined && (
                <span className="text-charcoal-400 ml-2">({s.rate}% {s.rateLabel})</span>
              )}
            </span>
          </div>
          <div className="h-6 rounded-lg bg-charcoal-100 dark:bg-charcoal-700 overflow-hidden">
            <div className={`h-full rounded-lg ${s.color} transition-all`} style={{ width: `${Math.max((s.value / max) * 100, 2)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Série temporal: visitas (barra) + seleções (barra) ──────────────────────
function EngagementTimeSeries({ data }: { data: DayPoint[] }) {
  if (data.length === 0) return <EmptyChart />;
  const max = Math.max(...data.map(d => Math.max(d.visits, d.selections)), 1);
  // Muitos períodos: rola horizontalmente com largura mínima para não espremer.
  const scrollable = data.length > 12;
  return (
    <div>
      <div className={scrollable ? 'overflow-x-auto pb-1' : ''}>
        <div style={scrollable ? { minWidth: `${data.length * 34}px` } : undefined}>
          <div className="flex items-end gap-2 h-52">
            {data.map((d) => (
              <div key={d.period} className="flex-1 h-full flex flex-col items-center justify-end gap-0.5 group relative min-w-[24px]">
                <div className="absolute -top-10 hidden group-hover:block bg-charcoal-800 text-white text-[10px] rounded px-2 py-1 whitespace-nowrap z-10">
                  {d.visits} visitas • {d.selections} seleções
                </div>
                <div className="w-full flex items-end justify-center gap-0.5 h-full">
                  <div className="w-1/2 max-w-[16px] rounded-t bg-blue-400/80" style={{ height: `${(d.visits / max) * 100}%` }} />
                  <div className="w-1/2 max-w-[16px] rounded-t bg-violet-400/80" style={{ height: `${(d.selections / max) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            {data.map((d) => (
              <div key={d.period} className="flex-1 text-center min-w-[24px]">
                <span className="text-[9px] text-charcoal-400">{formatDay(d.period)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex gap-4 mt-3 text-xs">
        <span className="flex items-center gap-1.5 text-charcoal-500"><span className="h-2.5 w-2.5 rounded-sm bg-blue-400/80" /> Visitas</span>
        <span className="flex items-center gap-1.5 text-charcoal-500"><span className="h-2.5 w-2.5 rounded-sm bg-violet-400/80" /> Seleções</span>
        {scrollable && <span className="ml-auto text-charcoal-300">arraste para o lado →</span>}
      </div>
    </div>
  );
}

function formatDay(period: string): string {
  const parts = period.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}` : period;
}

// ─── Tabela desejados vs vendidos ────────────────────────────────────────────
function DesiredVsSoldTable({ rows, soldBySku }: { rows: SelectedProduct[]; soldBySku: Map<string, number> }) {
  if (rows.length === 0) return <EmptyChart />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-charcoal-400 uppercase tracking-wide border-b border-charcoal-100 dark:border-charcoal-700">
            <th className="pb-2 font-medium">Produto</th>
            <th className="pb-2 font-medium text-right">Seleções</th>
            <th className="pb-2 font-medium text-right">Sessões</th>
            <th className="pb-2 font-medium text-right">Vendidos</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const soldQty = soldBySku.get(p.sku) ?? 0;
            const lowConversion = p.selections >= 3 && soldQty === 0;
            return (
              <tr key={p.sku} className="border-b border-charcoal-50 dark:border-charcoal-800 last:border-0">
                <td className="py-2.5">
                  <span className="text-charcoal-700 dark:text-charcoal-200">{p.name}</span>
                  <span className="text-charcoal-400 text-xs ml-2 font-mono">{p.sku}</span>
                  {lowConversion && (
                    <span className="ml-2 text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded-full">
                      muito desejado, sem venda
                    </span>
                  )}
                </td>
                <td className="py-2.5 text-right text-violet-500 font-medium">{p.selections}</td>
                <td className="py-2.5 text-right text-charcoal-500 dark:text-charcoal-400">{p.uniqueSessions}</td>
                <td className="py-2.5 text-right text-emerald-600 dark:text-emerald-400 font-medium">{soldQty}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function EmptyChart() {
  return <div className="py-8 text-center text-xs text-charcoal-300 dark:text-charcoal-600">Sem dados no período.</div>;
}

function EmptyState() {
  return (
    <div className="card py-20 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-900/20 mb-4">
        <svg className="h-7 w-7 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </div>
      <h3 className="font-serif text-lg font-semibold text-charcoal-700 dark:text-charcoal-200">Ainda não há dados de engajamento</h3>
      <p className="mt-2 text-sm text-charcoal-400 dark:text-charcoal-500 max-w-sm mx-auto">
        Conforme visitantes acessam o <Link to="/catalogo" className="text-gold hover:underline">catálogo</Link> e selecionam peças, as métricas aparecerão aqui.
      </p>
    </div>
  );
}
