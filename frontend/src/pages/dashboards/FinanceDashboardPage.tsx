import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import KpiCard from '../../components/KpiCard';
import { BRL } from '../../utils/format';
import { formatPeriodLabel } from '../../utils/format';

// ─── Tipos do payload de /admin/finance/forecast ────────────────────────────
interface MonthPoint {
  period: string;   // yyyy-MM
  inflow: number;
  outflow: number;
  net: number;
}
interface ForecastPoint {
  period: string;   // yyyy-MM
  expectedReceivables: number;
  expectedPayables: number;
  net: number;
  cumulativeNet: number;
}
interface Forecast {
  currentMonthNet: number;
  currentMonthInflow: number;
  currentMonthOutflow: number;
  receivablesOpen: number;
  payablesOpen: number;
  openBalance: number;
  overduePayables: number;
  currentMonthResult: number;
  history: MonthPoint[];
  forecast: ForecastPoint[];
}

const HORIZONS = [3, 6, 12] as const;
type Horizon = (typeof HORIZONS)[number];

export default function FinanceDashboardPage() {
  const [data, setData] = useState<Forecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [months, setMonths] = useState<Horizon>(6);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/admin/finance/forecast', { params: { months } });
      setData(res.data);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Erro ao carregar a projeção financeira.');
    } finally {
      setLoading(false);
    }
  }, [months]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      {/* Breadcrumb + Header */}
      <div>
        <Link to="/dashboards" className="text-xs text-charcoal-400 hover:text-gold transition-colors">← Dashboards</Link>
        <h1 className="font-serif text-display text-charcoal-800 dark:text-cream-200 mt-1">Dashboard Financeiro</h1>
        <p className="mt-1 text-sm text-charcoal-400 dark:text-charcoal-500">
          A situação de agora e a projeção do que já está lançado — recebíveis a repassar e contas a pagar a vencer.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gold border-t-transparent" />
        </div>
      ) : error ? (
        <div className="card p-8 text-center text-sm text-red-500">{error}</div>
      ) : !data ? null : (
        <>
          {/* ─── PRESENTE ─────────────────────────────────────────────── */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="font-serif text-lg font-semibold text-charcoal-800 dark:text-cream-200">Agora</h2>
              <span className="text-xs text-charcoal-400">mês corrente e valores em aberto</span>
            </div>

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <KpiCard
                label="Saldo do mês"
                value={BRL.format(data.currentMonthNet)}
                sub={`Entradas ${BRL.format(data.currentMonthInflow)} · Saídas ${BRL.format(data.currentMonthOutflow)}`}
                accent={data.currentMonthNet >= 0 ? 'emerald' : 'gold'}
              />
              <KpiCard
                label="Resultado do mês (DRE)"
                value={BRL.format(data.currentMonthResult)}
                sub="Competência — receita − custos e despesas"
                accent="violet"
              />
              <KpiCard
                label="A receber em aberto"
                value={BRL.format(data.receivablesOpen)}
                sub="Repasses de cartão ainda a cair"
                accent="blue"
              />
              <KpiCard
                label="A pagar em aberto"
                value={BRL.format(data.payablesOpen)}
                sub={data.overduePayables > 0 ? `${BRL.format(data.overduePayables)} em atraso` : 'Nenhuma parcela em atraso'}
                accent="gold"
              />
            </div>

            {/* Posição líquida em aberto */}
            <div className="card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-charcoal-700 dark:text-cream-200">Posição em aberto</h3>
                  <p className="text-xs text-charcoal-400 mt-0.5">Quanto ainda vai entrar menos quanto ainda vai sair (tudo já lançado).</p>
                </div>
                <span className={`text-2xl font-serif font-semibold ${data.openBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                  {BRL.format(data.openBalance)}
                </span>
              </div>
              <OpenPositionBar receivables={data.receivablesOpen} payables={data.payablesOpen} />
            </div>
          </section>

          {/* ─── HISTÓRICO (tendência de caixa) ───────────────────────── */}
          <section className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-lg font-semibold text-charcoal-800 dark:text-cream-200">Caixa realizado</h2>
              <span className="text-xs text-charcoal-400">últimos 6 meses</span>
            </div>
            <CashHistoryChart data={data.history} />
          </section>

          {/* ─── FUTURO (projeção) ────────────────────────────────────── */}
          <section className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="font-serif text-lg font-semibold text-charcoal-800 dark:text-cream-200">Projeção do que está lançado</h2>
                <p className="text-xs text-charcoal-400 mt-0.5">Recebíveis a repassar vs. contas a pagar a vencer, e o saldo projetado acumulado.</p>
              </div>
              <div className="flex rounded-lg border border-charcoal-200 dark:border-charcoal-600 overflow-hidden">
                {HORIZONS.map((h) => (
                  <button key={h} onClick={() => setMonths(h)}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                      months === h ? 'bg-gold text-white' : 'text-charcoal-500 dark:text-charcoal-400 hover:bg-cream-100 dark:hover:bg-charcoal-700'
                    }`}>
                    {h} meses
                  </button>
                ))}
              </div>
            </div>
            <ForecastChart data={data.forecast} />
            <ForecastTable data={data.forecast} />
          </section>
        </>
      )}
    </div>
  );
}

// ─── Barra de posição em aberto (a receber vs a pagar) ───────────────────────
function OpenPositionBar({ receivables, payables }: { receivables: number; payables: number }) {
  const max = Math.max(receivables, payables, 1);
  return (
    <div className="mt-4 space-y-3">
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-charcoal-600 dark:text-charcoal-300 font-medium">A receber</span>
          <span className="text-charcoal-500 dark:text-charcoal-400">{BRL.format(receivables)}</span>
        </div>
        <div className="h-2.5 rounded-full bg-charcoal-100 dark:bg-charcoal-700 overflow-hidden">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(receivables / max) * 100}%` }} />
        </div>
      </div>
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-charcoal-600 dark:text-charcoal-300 font-medium">A pagar</span>
          <span className="text-charcoal-500 dark:text-charcoal-400">{BRL.format(payables)}</span>
        </div>
        <div className="h-2.5 rounded-full bg-charcoal-100 dark:bg-charcoal-700 overflow-hidden">
          <div className="h-full rounded-full bg-red-400" style={{ width: `${(payables / max) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

// ─── Histórico de caixa: barras entradas (verde) vs saídas (vermelho) ────────
function CashHistoryChart({ data }: { data: MonthPoint[] }) {
  const hasMovement = data.some((d) => d.inflow > 0 || d.outflow > 0);
  if (!hasMovement) return <EmptyChart label="Sem movimento de caixa nos últimos meses." />;
  const max = Math.max(...data.map((d) => Math.max(d.inflow, d.outflow)), 1);

  return (
    <div>
      <div className="flex items-end gap-3 h-52">
        {data.map((d) => (
          <div key={d.period} className="flex-1 h-full flex flex-col justify-end min-w-[30px]">
            <div className="flex items-end justify-center gap-1 h-full">
              {/* Entrada */}
              <div className="flex-1 max-w-[18px] h-full flex flex-col justify-end group relative">
                <div className="absolute -top-9 left-1/2 -translate-x-1/2 hidden group-hover:block bg-charcoal-800 text-white text-[10px] rounded px-2 py-1 whitespace-nowrap z-10">
                  Entradas {BRL.format(d.inflow)}
                </div>
                <div className="w-full rounded-t bg-emerald-500/80 hover:bg-emerald-500 transition-all" style={{ height: `${Math.max((d.inflow / max) * 100, d.inflow > 0 ? 2 : 0)}%` }} />
              </div>
              {/* Saída */}
              <div className="flex-1 max-w-[18px] h-full flex flex-col justify-end group relative">
                <div className="absolute -top-9 left-1/2 -translate-x-1/2 hidden group-hover:block bg-charcoal-800 text-white text-[10px] rounded px-2 py-1 whitespace-nowrap z-10">
                  Saídas {BRL.format(d.outflow)}
                </div>
                <div className="w-full rounded-t bg-red-400/80 hover:bg-red-400 transition-all" style={{ height: `${Math.max((d.outflow / max) * 100, d.outflow > 0 ? 2 : 0)}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-3 mt-2">
        {data.map((d) => (
          <div key={d.period} className="flex-1 text-center min-w-[30px]">
            <span className="text-[10px] text-charcoal-400">{formatPeriodLabel(d.period)}</span>
          </div>
        ))}
      </div>
      <Legend items={[{ color: 'bg-emerald-500', label: 'Entradas' }, { color: 'bg-red-400', label: 'Saídas' }]} />
    </div>
  );
}

// ─── Projeção: barras recebíveis vs a pagar + linha de saldo acumulado ───────
function ForecastChart({ data }: { data: ForecastPoint[] }) {
  const hasData = data.some((d) => d.expectedReceivables > 0 || d.expectedPayables > 0);
  if (!hasData) return <EmptyChart label="Nada lançado para os próximos meses." />;
  const max = Math.max(...data.map((d) => Math.max(d.expectedReceivables, d.expectedPayables)), 1);

  return (
    <div>
      <div className="flex items-end gap-3 h-56">
        {data.map((d) => (
          <div key={d.period} className="flex-1 h-full flex flex-col justify-end min-w-[36px]">
            <div className="flex items-end justify-center gap-1 h-full">
              <div className="flex-1 max-w-[20px] h-full flex flex-col justify-end group relative">
                <div className="absolute -top-9 left-1/2 -translate-x-1/2 hidden group-hover:block bg-charcoal-800 text-white text-[10px] rounded px-2 py-1 whitespace-nowrap z-10">
                  A receber {BRL.format(d.expectedReceivables)}
                </div>
                <div className="w-full rounded-t bg-emerald-500/80 hover:bg-emerald-500 transition-all" style={{ height: `${Math.max((d.expectedReceivables / max) * 100, d.expectedReceivables > 0 ? 2 : 0)}%` }} />
              </div>
              <div className="flex-1 max-w-[20px] h-full flex flex-col justify-end group relative">
                <div className="absolute -top-9 left-1/2 -translate-x-1/2 hidden group-hover:block bg-charcoal-800 text-white text-[10px] rounded px-2 py-1 whitespace-nowrap z-10">
                  A pagar {BRL.format(d.expectedPayables)}
                </div>
                <div className="w-full rounded-t bg-red-400/80 hover:bg-red-400 transition-all" style={{ height: `${Math.max((d.expectedPayables / max) * 100, d.expectedPayables > 0 ? 2 : 0)}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-3 mt-2">
        {data.map((d) => (
          <div key={d.period} className="flex-1 text-center min-w-[36px]">
            <span className="text-[10px] text-charcoal-400">{formatPeriodLabel(d.period)}</span>
          </div>
        ))}
      </div>
      <Legend items={[{ color: 'bg-emerald-500', label: 'A receber' }, { color: 'bg-red-400', label: 'A pagar' }]} />
    </div>
  );
}

// ─── Tabela de projeção com saldo acumulado ──────────────────────────────────
function ForecastTable({ data }: { data: ForecastPoint[] }) {
  return (
    <div className="mt-5 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-charcoal-400 border-b border-charcoal-100/60 dark:border-charcoal-700/60">
            <th className="py-2 pr-4 font-medium">Mês</th>
            <th className="py-2 pr-4 font-medium text-right">A receber</th>
            <th className="py-2 pr-4 font-medium text-right">A pagar</th>
            <th className="py-2 pr-4 font-medium text-right">Saldo do mês</th>
            <th className="py-2 font-medium text-right">Saldo acumulado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-charcoal-100/60 dark:divide-charcoal-700/60">
          {data.map((d) => (
            <tr key={d.period} className="text-charcoal-700 dark:text-charcoal-200">
              <td className="py-2 pr-4">{formatPeriodLabel(d.period)}</td>
              <td className="py-2 pr-4 text-right text-emerald-600 dark:text-emerald-400">{BRL.format(d.expectedReceivables)}</td>
              <td className="py-2 pr-4 text-right text-red-500 dark:text-red-400">{BRL.format(d.expectedPayables)}</td>
              <td className={`py-2 pr-4 text-right font-medium ${d.net >= 0 ? 'text-charcoal-700 dark:text-charcoal-200' : 'text-red-500 dark:text-red-400'}`}>{BRL.format(d.net)}</td>
              <td className={`py-2 text-right font-semibold ${d.cumulativeNet >= 0 ? 'text-charcoal-800 dark:text-cream-200' : 'text-red-500 dark:text-red-400'}`}>{BRL.format(d.cumulativeNet)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Auxiliares ──────────────────────────────────────────────────────────────
function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div className="flex items-center gap-4 mt-3">
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-1.5">
          <span className={`h-3 w-3 rounded-sm ${it.color}`} />
          <span className="text-xs text-charcoal-500 dark:text-charcoal-400">{it.label}</span>
        </div>
      ))}
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-16 text-sm text-charcoal-400 dark:text-charcoal-500">
      {label}
    </div>
  );
}
