import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import KpiCard from '../components/KpiCard';
import { BRL, NUM, formatPeriodLabel } from '../utils/format';

// ─── Tipos do payload de /admin/overview ─────────────────────────────────────
interface MonthKpis {
  revenue: number; orders: number; items: number;
  averageTicket: number; margin: number; marginPercent: number;
}
interface Goal {
  id?: string; year: number; month: number;
  revenueTarget: number | null; ordersTarget: number | null; inherited: boolean;
}
interface Progress { revenuePercent: number | null; ordersPercent: number | null; }
interface OrdersSummary { pendente: number; confirmado: number; cancelado: number; }
interface Counts { products: number; consignees: number; }
interface Alerts { lowStock: number; warrantyExpired: number; warrantyExpiring: number; }
interface RevenuePoint { period: string; revenue: number; orders: number; }
interface Overview {
  year: number; month: number;
  month_kpis: MonthKpis; goal: Goal; progress: Progress;
  orders: OrdersSummary; counts: Counts; alerts: Alerts;
  revenue6m: RevenuePoint[];
}

const MONTH_NAMES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [goalModalOpen, setGoalModalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/admin/overview');
      setData(res.data);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Erro ao carregar o resumo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const monthLabel = data ? `${MONTH_NAMES[data.month - 1]} de ${data.year}` : '';

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-serif text-display text-charcoal-800 dark:text-cream-200">Visão Geral</h1>
        <p className="mt-2 text-sm text-charcoal-400 dark:text-charcoal-500">
          Bem-vindo(a), <span className="text-charcoal-600 dark:text-charcoal-300 font-medium">{user?.name}</span>
          {data && <span> — resumo de <span className="capitalize">{monthLabel}</span></span>}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gold border-t-transparent" />
        </div>
      ) : error ? (
        <div className="card p-8 text-center space-y-3">
          <p className="text-sm text-red-500">{error}</p>
          <button onClick={load} className="btn-secondary text-sm">Tentar novamente</button>
        </div>
      ) : data ? (
        <>
          {/* ── Metas do mês ── */}
          <GoalsBlock data={data} onConfigure={() => setGoalModalOpen(true)} />

          {/* ── KPIs do mês ── */}
          <div>
            <h2 className="font-serif text-lg font-semibold text-charcoal-800 dark:text-cream-200 mb-3">
              Desempenho do mês
            </h2>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <KpiCard label="Receita" value={BRL.format(data.month_kpis.revenue)} accent="gold" />
              <KpiCard label="Pedidos confirmados" value={NUM.format(data.month_kpis.orders)}
                sub={`${NUM.format(data.month_kpis.items)} itens`} accent="blue" />
              <KpiCard label="Ticket médio" value={BRL.format(data.month_kpis.averageTicket)} accent="violet" />
              <KpiCard label="Margem" value={BRL.format(data.month_kpis.margin)}
                sub={`${data.month_kpis.marginPercent}% da receita`} accent="emerald" />
            </div>
          </div>

          {/* ── Pendências + Alertas ── */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <PendingOrdersCard pending={data.orders.pendente} />
            <AlertsCard alerts={data.alerts} />
          </div>

          {/* ── Atalhos + totais ── */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <ShortcutCard to="/admin/estoque" label="Catálogo" value={NUM.format(data.counts.products)} sub="produtos" />
            <ShortcutCard to="/revendedoras" label="Revendedoras" value={NUM.format(data.counts.consignees)} sub="cadastradas" />
            <ShortcutCard to="/pedidos" label="Confirmados" value={NUM.format(data.orders.confirmado)} sub="pedidos (total)" />
            <ShortcutCard to="/dashboards" label="Análises" value="Ver" sub="dashboards" />
          </div>

          {/* ── Receita 6 meses ── */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-lg font-semibold text-charcoal-800 dark:text-cream-200">
                Receita — últimos 6 meses
              </h2>
              <Link to="/dashboards/vendas" className="text-xs text-gold hover:underline">Ver detalhes →</Link>
            </div>
            <MiniRevenueChart data={data.revenue6m} />
          </div>
        </>
      ) : null}

      {goalModalOpen && data && (
        <GoalModal
          year={data.year}
          month={data.month}
          current={data.goal}
          onClose={() => setGoalModalOpen(false)}
          onSaved={() => { setGoalModalOpen(false); load(); }}
        />
      )}
    </div>
  );
}

// ─── Bloco de metas com progresso ────────────────────────────────────────────
function GoalsBlock({ data, onConfigure }: { data: Overview; onConfigure: () => void }) {
  const { goal, progress, month_kpis } = data;
  const hasRevenueTarget = goal.revenueTarget != null && goal.revenueTarget > 0;
  const hasOrdersTarget = goal.ordersTarget != null && goal.ordersTarget > 0;
  const noGoal = !hasRevenueTarget && !hasOrdersTarget;

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="font-serif text-lg font-semibold text-charcoal-800 dark:text-cream-200">
            Metas do mês
          </h2>
          <p className="text-xs text-charcoal-400 dark:text-charcoal-500 mt-0.5">
            {noGoal
              ? 'Nenhuma meta definida ainda. Configure para acompanhar o progresso.'
              : goal.inherited
                ? 'Herdada do último mês com meta definida.'
                : 'Definida para este mês.'}
          </p>
        </div>
        <button onClick={onConfigure} className="btn-secondary text-xs flex items-center gap-1.5">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Configurar
        </button>
      </div>

      {noGoal ? (
        <div className="py-6 text-center text-sm text-charcoal-400 dark:text-charcoal-500">
          Defina uma meta de receita e/ou pedidos para acompanhar o progresso aqui.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {hasRevenueTarget && (
            <ProgressBar
              label="Receita"
              current={BRL.format(month_kpis.revenue)}
              target={BRL.format(goal.revenueTarget!)}
              percent={progress.revenuePercent ?? 0}
            />
          )}
          {hasOrdersTarget && (
            <ProgressBar
              label="Pedidos confirmados"
              current={NUM.format(month_kpis.orders)}
              target={NUM.format(goal.ordersTarget!)}
              percent={progress.ordersPercent ?? 0}
            />
          )}
        </div>
      )}
    </div>
  );
}

function ProgressBar({ label, current, target, percent }: {
  label: string; current: string; target: string; percent: number;
}) {
  const clamped = Math.min(percent, 100);
  const reached = percent >= 100;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-sm font-medium text-charcoal-600 dark:text-charcoal-300">{label}</span>
        <span className={`text-sm font-semibold ${reached ? 'text-emerald-500' : 'text-gold'}`}>
          {percent.toFixed(0)}%
        </span>
      </div>
      <div className="h-3 rounded-full bg-charcoal-100 dark:bg-charcoal-700 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${reached ? 'bg-emerald-500' : 'bg-gold'}`}
          style={{ width: `${Math.max(clamped, 2)}%` }}
        />
      </div>
      <p className="text-xs text-charcoal-400 dark:text-charcoal-500 mt-1.5">
        {current} <span className="text-charcoal-300 dark:text-charcoal-600">de</span> {target}
      </p>
    </div>
  );
}

// ─── Pedidos pendentes ────────────────────────────────────────────────────────
function PendingOrdersCard({ pending }: { pending: number }) {
  return (
    <Link
      to="/pedidos"
      className={`card p-5 flex items-center justify-between transition-colors hover:border-gold/40 ${
        pending > 0 ? 'border-amber-300/60 dark:border-amber-700/40' : ''
      }`}
    >
      <div>
        <p className="text-xs font-medium text-charcoal-500 dark:text-charcoal-400 uppercase tracking-wide">
          Pedidos pendentes
        </p>
        <p className="text-3xl font-serif font-semibold text-charcoal-800 dark:text-cream-200 mt-2">
          {NUM.format(pending)}
        </p>
        <p className="text-xs text-charcoal-400 dark:text-charcoal-500 mt-1">
          {pending > 0 ? 'aguardando confirmação' : 'tudo em dia'}
        </p>
      </div>
      <span className={`flex h-12 w-12 items-center justify-center rounded-full ${
        pending > 0 ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-emerald-50 dark:bg-emerald-900/20'
      }`}>
        <svg className={`h-6 w-6 ${pending > 0 ? 'text-amber-500' : 'text-emerald-500'}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </span>
    </Link>
  );
}

// ─── Alertas de estoque/garantia ──────────────────────────────────────────────
function AlertsCard({ alerts }: { alerts: Alerts }) {
  const total = alerts.lowStock + alerts.warrantyExpired + alerts.warrantyExpiring;
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-charcoal-500 dark:text-charcoal-400 uppercase tracking-wide">
          Alertas de estoque
        </p>
        <Link to="/admin/estoque" className="text-xs text-gold hover:underline">Abrir estoque →</Link>
      </div>
      {total === 0 ? (
        <p className="py-4 text-sm text-charcoal-400 dark:text-charcoal-500">Sem alertas no momento.</p>
      ) : (
        <div className="space-y-2">
          <AlertRow label="Estoque baixo ou esgotado" count={alerts.lowStock} tone="amber" />
          <AlertRow label="Garantias vencidas" count={alerts.warrantyExpired} tone="red" />
          <AlertRow label="Garantias vencendo (60 dias)" count={alerts.warrantyExpiring} tone="amber" />
        </div>
      )}
    </div>
  );
}

function AlertRow({ label, count, tone }: { label: string; count: number; tone: 'amber' | 'red' }) {
  if (count === 0) return null;
  const toneStyles = tone === 'red'
    ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
    : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400';
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-charcoal-600 dark:text-charcoal-300">{label}</span>
      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${toneStyles}`}>{count}</span>
    </div>
  );
}

// ─── Atalho/total ─────────────────────────────────────────────────────────────
function ShortcutCard({ to, label, value, sub }: {
  to: string; label: string; value: string; sub: string;
}) {
  return (
    <Link to={to} className="card p-4 transition-colors hover:border-gold/40">
      <p className="text-xs font-medium text-charcoal-500 dark:text-charcoal-400 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-serif font-semibold text-charcoal-800 dark:text-cream-200 mt-1.5">{value}</p>
      <p className="text-xs text-charcoal-400 dark:text-charcoal-500 mt-0.5">{sub}</p>
    </Link>
  );
}

// ─── Mini gráfico de receita (6 meses) ───────────────────────────────────────
function MiniRevenueChart({ data }: { data: RevenuePoint[] }) {
  if (data.length === 0 || data.every(d => d.revenue === 0)) {
    return <div className="py-8 text-center text-xs text-charcoal-300 dark:text-charcoal-600">Sem receita registrada nos últimos 6 meses.</div>;
  }
  const max = Math.max(...data.map(d => d.revenue), 1);
  return (
    <div>
      <div className="flex items-end gap-2 h-40">
        {data.map((d) => {
          const h = (d.revenue / max) * 100;
          return (
            <div key={d.period} className="flex-1 flex flex-col items-center justify-end group relative">
              <div className="absolute -top-8 hidden group-hover:block bg-charcoal-800 text-white text-[10px] rounded px-2 py-1 whitespace-nowrap z-10">
                {BRL.format(d.revenue)} • {d.orders} pedido(s)
              </div>
              <div
                className="w-full max-w-[48px] rounded-t bg-gold/80 hover:bg-gold transition-all"
                style={{ height: `${Math.max(h, 2)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-2 mt-2">
        {data.map((d) => (
          <div key={d.period} className="flex-1 text-center">
            <span className="text-[10px] text-charcoal-400">{formatPeriodLabel(d.period)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Modal de configuração de metas ───────────────────────────────────────────
function GoalModal({ year, month, current, onClose, onSaved }: {
  year: number; month: number; current: Goal;
  onClose: () => void; onSaved: () => void;
}) {
  const [revenueTarget, setRevenueTarget] = useState<string>(
    current.revenueTarget != null ? String(current.revenueTarget) : ''
  );
  const [ordersTarget, setOrdersTarget] = useState<string>(
    current.ordersTarget != null ? String(current.ordersTarget) : ''
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const monthLabel = `${MONTH_NAMES[month - 1]} de ${year}`;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        year,
        month,
        revenueTarget: revenueTarget.trim() === '' ? null : Number(revenueTarget),
        ordersTarget: ordersTarget.trim() === '' ? null : Math.round(Number(ordersTarget)),
      };
      if (payload.revenueTarget != null && (isNaN(payload.revenueTarget) || payload.revenueTarget < 0)) {
        setError('Meta de receita inválida.'); setSaving(false); return;
      }
      if (payload.ordersTarget != null && (isNaN(payload.ordersTarget) || payload.ordersTarget < 0)) {
        setError('Meta de pedidos inválida.'); setSaving(false); return;
      }
      await api.put('/admin/goals', payload);
      onSaved();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Erro ao salvar a meta.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal-900/50 backdrop-blur-sm"
      onClick={onClose}>
      <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-serif text-lg font-semibold text-charcoal-800 dark:text-cream-200">
          Configurar metas
        </h3>
        <p className="text-xs text-charcoal-400 dark:text-charcoal-500 mt-0.5 capitalize">{monthLabel}</p>
        {current.inherited && (
          <p className="text-xs text-charcoal-400 dark:text-charcoal-500 mt-2">
            Valores atuais herdados de um mês anterior. Salvar cria uma meta própria para este mês.
          </p>
        )}

        <div className="space-y-4 mt-5">
          <div>
            <label className="block text-xs font-medium text-charcoal-500 dark:text-charcoal-400 uppercase tracking-wide mb-1">
              Meta de receita (R$)
            </label>
            <input
              type="number" min="0" step="0.01" value={revenueTarget}
              onChange={(e) => setRevenueTarget(e.target.value)}
              placeholder="Ex: 5000"
              className="input-field w-full" />
          </div>
          <div>
            <label className="block text-xs font-medium text-charcoal-500 dark:text-charcoal-400 uppercase tracking-wide mb-1">
              Meta de pedidos confirmados
            </label>
            <input
              type="number" min="0" step="1" value={ordersTarget}
              onChange={(e) => setOrdersTarget(e.target.value)}
              placeholder="Ex: 30"
              className="input-field w-full" />
          </div>
          <p className="text-xs text-charcoal-400 dark:text-charcoal-500">
            Deixe um campo vazio para não definir aquela meta.
          </p>
        </div>

        {error && <p className="text-sm text-red-500 mt-3">{error}</p>}

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="btn-secondary text-sm" disabled={saving}>Cancelar</button>
          <button onClick={save} className="btn-primary text-sm" disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar metas'}
          </button>
        </div>
      </div>
    </div>
  );
}
