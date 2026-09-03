import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import KpiCard from '../../components/KpiCard';
import { BRL, NUM } from '../../utils/format';

// ─── Tipos do payload de /admin/analytics/stock ─────────────────────────────
interface Kpis {
  skus: number; units: number; costValue: number; saleValue: number;
  available: number; low: number; out: number;
}
interface CategorySlice { category: string; skus: number; units: number; costValue: number; saleValue: number; }
interface CriticalItem { sku: string; name: string; category: string; stockQuantity: number; stockStatus: string; }
interface Movement { sku: string; productName: string; type: string; delta: number; resultingQuantity: number; reason: string | null; at: string | null; }
interface StockAnalytics {
  kpis: Kpis; byCategory: CategorySlice[]; critical: CriticalItem[]; recentMovements: Movement[];
}

export default function StockDashboardPage() {
  const [data, setData] = useState<StockAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/admin/analytics/stock');
      setData(res.data);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Erro ao carregar os dados de estoque.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <Link to="/dashboards" className="text-xs text-charcoal-400 hover:text-gold transition-colors">← Dashboards</Link>
        <h1 className="font-serif text-display text-charcoal-800 dark:text-cream-200 mt-1">Dashboard de Estoque</h1>
        <p className="mt-1 text-sm text-charcoal-400 dark:text-charcoal-500">
          Saúde do estoque próprio: valor imobilizado, distribuição, itens críticos e movimentações. Produtos sob encomenda ficam de fora.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gold border-t-transparent" />
        </div>
      ) : error ? (
        <div className="card p-8 text-center text-sm text-red-500">{error}</div>
      ) : !data || data.kpis.skus === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard label="Produtos" value={NUM.format(data.kpis.skus)} sub={`${NUM.format(data.kpis.units)} unidades em estoque`} accent="emerald" />
            <KpiCard label="Valor a custo" value={BRL.format(data.kpis.costValue)} sub="imobilizado no estoque" accent="gold" />
            <KpiCard label="Valor de venda" value={BRL.format(data.kpis.saleValue)} sub="potencial de receita" accent="blue" />
            <KpiCard label="Itens críticos" value={NUM.format(data.kpis.low + data.kpis.out)} sub={`${NUM.format(data.kpis.low)} baixo · ${NUM.format(data.kpis.out)} esgotado`} accent="violet" />
          </div>

          {/* Situação do estoque */}
          <div className="card p-5">
            <h2 className="font-serif text-lg font-semibold text-charcoal-800 dark:text-cream-200 mb-4">Situação do estoque</h2>
            <StatusBar available={data.kpis.available} low={data.kpis.low} out={data.kpis.out} />
          </div>

          {/* Distribuição por categoria */}
          <div className="card p-5">
            <h2 className="font-serif text-lg font-semibold text-charcoal-800 dark:text-cream-200 mb-1">Valor imobilizado por categoria</h2>
            <p className="text-xs text-charcoal-400 mb-4">Valor a custo por categoria (peso no capital parado em estoque).</p>
            <CategoryBars data={data.byCategory} />
          </div>

          {/* Itens críticos */}
          <div className="card p-5">
            <h2 className="font-serif text-lg font-semibold text-charcoal-800 dark:text-cream-200 mb-1">Itens que precisam de atenção</h2>
            <p className="text-xs text-charcoal-400 mb-4">Produtos em baixa ou esgotados — candidatos a reposição.</p>
            <CriticalTable rows={data.critical} />
          </div>

          {/* Movimentações recentes */}
          <div className="card p-5">
            <h2 className="font-serif text-lg font-semibold text-charcoal-800 dark:text-cream-200 mb-4">Movimentações recentes</h2>
            <MovementsList rows={data.recentMovements} />
          </div>
        </>
      )}
    </div>
  );
}

// ─── Barra de situação (disponível/baixo/esgotado) ───────────────────────────
function StatusBar({ available, low, out }: { available: number; low: number; out: number }) {
  const total = available + low + out;
  if (total === 0) return <EmptyChart />;
  const pct = (n: number) => (n / total) * 100;
  return (
    <div>
      <div className="flex h-6 rounded-lg overflow-hidden">
        {available > 0 && <div className="bg-emerald-500 flex items-center justify-center" style={{ width: `${pct(available)}%` }}>
          {pct(available) > 10 && <span className="text-[10px] text-white font-medium">{available}</span>}
        </div>}
        {low > 0 && <div className="bg-amber-400 flex items-center justify-center" style={{ width: `${pct(low)}%` }}>
          {pct(low) > 10 && <span className="text-[10px] text-white font-medium">{low}</span>}
        </div>}
        {out > 0 && <div className="bg-red-400 flex items-center justify-center" style={{ width: `${pct(out)}%` }}>
          {pct(out) > 10 && <span className="text-[10px] text-white font-medium">{out}</span>}
        </div>}
      </div>
      <div className="flex flex-wrap gap-4 mt-3 text-xs">
        <Legend color="bg-emerald-500" label="Disponível" value={available} />
        <Legend color="bg-amber-400" label="Baixo" value={low} />
        <Legend color="bg-red-400" label="Esgotado" value={out} />
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

// ─── Barras horizontais por categoria (valor a custo) ────────────────────────
function CategoryBars({ data }: { data: CategorySlice[] }) {
  if (data.length === 0) return <EmptyChart />;
  const max = Math.max(...data.map(d => d.costValue), 1);
  return (
    <div className="space-y-3">
      {data.map((c) => (
        <div key={c.category}>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-charcoal-600 dark:text-charcoal-300 font-medium">{c.category}</span>
            <span className="text-charcoal-500 dark:text-charcoal-400">{BRL.format(c.costValue)} • {c.units} un · {c.skus} SKUs</span>
          </div>
          <div className="h-2.5 rounded-full bg-charcoal-100 dark:bg-charcoal-700 overflow-hidden">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(c.costValue / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Tabela de itens críticos ────────────────────────────────────────────────
function CriticalTable({ rows }: { rows: CriticalItem[] }) {
  if (rows.length === 0) {
    return <div className="py-8 text-center text-xs text-emerald-500">Nenhum item crítico. Estoque saudável. ✓</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-charcoal-400 uppercase tracking-wide border-b border-charcoal-100 dark:border-charcoal-700">
            <th className="pb-2 font-medium">Produto</th>
            <th className="pb-2 font-medium">Categoria</th>
            <th className="pb-2 font-medium text-right">Qtd</th>
            <th className="pb-2 font-medium text-right">Situação</th>
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
              <td className="py-2.5 text-right text-charcoal-600 dark:text-charcoal-300">{p.stockQuantity}</td>
              <td className="py-2.5 text-right">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  p.stockStatus === 'ESGOTADO' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                  : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                }`}>{p.stockStatus}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Lista de movimentações recentes ─────────────────────────────────────────
const MOV_STYLE: Record<string, { label: string; color: string }> = {
  ENTRADA: { label: 'Entrada', color: 'text-emerald-600 dark:text-emerald-400' },
  SAIDA: { label: 'Saída', color: 'text-red-500 dark:text-red-400' },
  ESTORNO: { label: 'Estorno', color: 'text-blue-500 dark:text-blue-400' },
  AJUSTE: { label: 'Ajuste', color: 'text-charcoal-500 dark:text-charcoal-400' },
};

function MovementsList({ rows }: { rows: Movement[] }) {
  if (rows.length === 0) return <EmptyChart />;
  return (
    <div className="divide-y divide-charcoal-50 dark:divide-charcoal-800">
      {rows.map((m, i) => {
        const style = MOV_STYLE[m.type] ?? { label: m.type, color: 'text-charcoal-500' };
        return (
          <div key={i} className="flex items-center justify-between py-2.5 gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-charcoal-700 dark:text-charcoal-200 truncate">{m.productName ?? '—'}</p>
              <p className="text-[11px] text-charcoal-400 truncate">
                <span className="font-mono">{m.sku ?? ''}</span>
                {m.reason ? ` · ${m.reason}` : ''}
                {m.at ? ` · ${formatDateTime(m.at)}` : ''}
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className={`text-sm font-medium ${style.color}`}>
                {m.delta > 0 ? `+${m.delta}` : m.delta} <span className="text-[10px] font-normal">{style.label}</span>
              </span>
              <p className="text-[10px] text-charcoal-400">resta {m.resultingQuantity}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// ─── Estados vazios ──────────────────────────────────────────────────────────
function EmptyChart() {
  return <div className="py-8 text-center text-xs text-charcoal-300 dark:text-charcoal-600">Sem dados.</div>;
}

function EmptyState() {
  return (
    <div className="card py-20 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-900/20 mb-4">
        <svg className="h-7 w-7 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
        </svg>
      </div>
      <h3 className="font-serif text-lg font-semibold text-charcoal-700 dark:text-charcoal-200">Ainda não há produtos em estoque</h3>
      <p className="mt-2 text-sm text-charcoal-400 dark:text-charcoal-500 max-w-sm mx-auto">
        Cadastre produtos com estoque na aba <Link to="/admin/estoque" className="text-gold hover:underline">Estoque</Link> para ver as métricas aqui.
      </p>
    </div>
  );
}
