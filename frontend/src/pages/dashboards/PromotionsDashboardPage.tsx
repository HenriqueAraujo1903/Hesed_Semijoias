import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import KpiCard from '../../components/KpiCard';
import { BRL, NUM } from '../../utils/format';

// ─── Tipos do payload de /admin/analytics/promotions ────────────────────────
interface Kpis {
  activeCount: number; totalCount: number;
  promoRevenue: number; promoItems: number;
  promoShare: number; discountGranted: number;
}
interface Split { promoRevenue: number; promoItems: number; regularRevenue: number; regularItems: number; }
interface ProductRow { sku: string; name: string; category: string; revenue: number; items: number; }
interface ActivePromotion {
  id: string; productName: string; productSku: string;
  title: string; discountPercent: number | null; promoPrice: number | null;
  originalPrice: number | null; active: boolean; startsAt: string | null; endsAt: string | null;
}
interface PromotionAnalytics {
  kpis: Kpis; split: Split; topPromoProducts: ProductRow[]; activePromotions: ActivePromotion[];
}

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

export default function PromotionsDashboardPage() {
  const [data, setData] = useState<PromotionAnalytics | null>(null);
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
      const res = await api.get('/admin/analytics/promotions', { params });
      setData(res.data);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Erro ao carregar os dados de promoções.');
    } finally {
      setLoading(false);
    }
  }, [rangePreset]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <Link to="/dashboards" className="text-xs text-charcoal-400 hover:text-gold transition-colors">← Dashboards</Link>
        <h1 className="font-serif text-display text-charcoal-800 dark:text-cream-200 mt-1">Dashboard de Promoções</h1>
        <p className="mt-1 text-sm text-charcoal-400 dark:text-charcoal-500">
          Impacto das promoções nas vendas confirmadas. As promoções ativas são as vigentes agora, independente do período.
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
        <p className="text-[10px] text-charcoal-300 dark:text-charcoal-600 pb-1.5 ml-auto max-w-[240px]">
          O período afeta os números de venda. A lista de promoções ativas é sempre a de agora.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gold border-t-transparent" />
        </div>
      ) : error ? (
        <div className="card p-8 text-center text-sm text-red-500">{error}</div>
      ) : !data ? (
        <EmptyState />
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard label="Promoções ativas" value={NUM.format(data.kpis.activeCount)} sub={`${NUM.format(data.kpis.totalCount)} cadastradas`} accent="violet" />
            <KpiCard label="Receita em promoção" value={BRL.format(data.kpis.promoRevenue)} sub={`${NUM.format(data.kpis.promoItems)} itens vendidos`} accent="gold" />
            <KpiCard label="Participação" value={`${data.kpis.promoShare}%`} sub="da receita do período" accent="blue" />
            <KpiCard label="Desconto concedido" value={BRL.format(data.kpis.discountGranted)} sub="preço cheio abdicado" accent="emerald" />
          </div>

          {/* Split promoção vs preço cheio */}
          <div className="card p-5">
            <h2 className="font-serif text-lg font-semibold text-charcoal-800 dark:text-cream-200 mb-4">Promoção vs. preço cheio</h2>
            <PromotionDonut split={data.split} />
          </div>

          {/* Top produtos em promoção */}
          <div className="card p-5">
            <h2 className="font-serif text-lg font-semibold text-charcoal-800 dark:text-cream-200 mb-1">Produtos mais vendidos em promoção</h2>
            <p className="text-xs text-charcoal-400 mb-4">Receita e itens vendidos com promoção ativa no período.</p>
            <TopProductsTable rows={data.topPromoProducts} />
          </div>

          {/* Promoções ativas */}
          <div className="card p-5">
            <h2 className="font-serif text-lg font-semibold text-charcoal-800 dark:text-cream-200 mb-1">Promoções ativas agora</h2>
            <p className="text-xs text-charcoal-400 mb-4">Vigentes neste momento (não dependem do filtro de período).</p>
            <ActivePromotionsTable rows={data.activePromotions} />
          </div>
        </>
      )}
    </div>
  );
}

// ─── Donut promoção vs regular (mesma linguagem visual do dashboard de Vendas) ─
function PromotionDonut({ split }: { split: Split }) {
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
          <span className="text-charcoal-400 ml-auto">{BRL.format(split.promoRevenue)} • {split.promoItems} itens</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-emerald-400/70" />
          <span className="text-charcoal-600 dark:text-charcoal-300">Preço cheio</span>
          <span className="text-charcoal-400 ml-auto">{BRL.format(split.regularRevenue)} • {split.regularItems} itens</span>
        </div>
        <p className="text-xs text-charcoal-400 pt-1">{promoPct.toFixed(0)}% da receita veio de promoções</p>
      </div>
    </div>
  );
}

// ─── Tabela top produtos em promoção ────────────────────────────────────────
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

// ─── Tabela de promoções ativas ──────────────────────────────────────────────
function ActivePromotionsTable({ rows }: { rows: ActivePromotion[] }) {
  if (rows.length === 0) {
    return <div className="py-8 text-center text-xs text-charcoal-300 dark:text-charcoal-600">Nenhuma promoção ativa no momento.</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-charcoal-400 uppercase tracking-wide border-b border-charcoal-100 dark:border-charcoal-700">
            <th className="pb-2 font-medium">Produto</th>
            <th className="pb-2 font-medium">Promoção</th>
            <th className="pb-2 font-medium text-right">Desconto</th>
            <th className="pb-2 font-medium text-right">Vigência</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="border-b border-charcoal-50 dark:border-charcoal-800 last:border-0">
              <td className="py-2.5">
                <span className="text-charcoal-700 dark:text-charcoal-200">{p.productName}</span>
                <span className="text-charcoal-400 text-xs ml-2 font-mono">{p.productSku}</span>
              </td>
              <td className="py-2.5 text-charcoal-500 dark:text-charcoal-400">{p.title}</td>
              <td className="py-2.5 text-right text-gold font-medium">{formatDiscount(p)}</td>
              <td className="py-2.5 text-right text-charcoal-500 dark:text-charcoal-400 text-xs">{formatVigencia(p)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatDiscount(p: ActivePromotion): string {
  if (p.discountPercent != null && p.discountPercent > 0) return `${p.discountPercent}%`;
  if (p.promoPrice != null) return BRL.format(p.promoPrice);
  return '—';
}

function formatVigencia(p: ActivePromotion): string {
  const fmt = (iso: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };
  const start = fmt(p.startsAt);
  const end = fmt(p.endsAt);
  if (!start && !end) return 'Sem prazo';
  if (start && end) return `${start}–${end}`;
  if (end) return `até ${end}`;
  return `desde ${start}`;
}

function EmptyChart() {
  return <div className="py-8 text-center text-xs text-charcoal-300 dark:text-charcoal-600">Sem dados no período.</div>;
}

function EmptyState() {
  return (
    <div className="card py-20 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-violet-50 dark:bg-violet-900/20 mb-4">
        <svg className="h-7 w-7 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
        </svg>
      </div>
      <h3 className="font-serif text-lg font-semibold text-charcoal-700 dark:text-charcoal-200">Ainda não há dados de promoções</h3>
      <p className="mt-2 text-sm text-charcoal-400 dark:text-charcoal-500 max-w-sm mx-auto">
        Crie promoções na aba <Link to="/admin/promocoes" className="text-gold hover:underline">Promoções</Link> e elas aparecerão aqui conforme geram vendas.
      </p>
    </div>
  );
}
