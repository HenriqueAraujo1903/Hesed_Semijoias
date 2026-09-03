import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import KpiCard from '../../components/KpiCard';
import PeriodFilter from '../../components/PeriodFilter';
import { resolvePreset, isInvalid, type Period, type PresetKey } from '../../utils/period';
import { BRL, NUM } from '../../utils/format';

// ─── Tipos do payload de /admin/analytics/resellers ─────────────────────────
interface Kpis {
  totalSold: number; commissionAmount: number; netAmount: number;
  sellThroughRate: number;
  piecesConsigned: number; piecesSold: number; piecesReturned: number;
  openCount: number; closedCount: number;
}
interface ResellerRow {
  name: string; totalSold: number; commissionAmount: number; netAmount: number;
  batches: number; piecesConsigned: number; piecesSold: number; sellThroughRate: number;
}
interface OpenRow {
  id: string; consigneeName: string; openedAt: string; pieces: number; potentialValue: number;
}
interface ResellersAnalytics {
  kpis: Kpis; ranking: ResellerRow[]; openConsignments: OpenRow[];
}

export default function ResellersDashboardPage() {
  const [data, setData] = useState<ResellersAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preset, setPreset] = useState<PresetKey>('30d');
  const [period, setPeriod] = useState<Period>(resolvePreset('30d'));

  const load = useCallback(async () => {
    if (isInvalid(period)) return;
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (period.from) params.from = period.from;
      if (period.to) params.to = period.to;
      const res = await api.get('/admin/analytics/resellers', { params });
      setData(res.data);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Erro ao carregar os dados de revendedoras.');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <Link to="/dashboards" className="text-xs text-charcoal-400 hover:text-gold transition-colors">← Dashboards</Link>
        <h1 className="font-serif text-display text-charcoal-800 dark:text-cream-200 mt-1">Dashboard de Revendedoras</h1>
        <p className="mt-1 text-sm text-charcoal-400 dark:text-charcoal-500">
          Desempenho da consignação. Os números consideram os lotes fechados no período; as consignações em aberto são as vigentes agora.
        </p>
      </div>

      {/* Período */}
      <PeriodFilter
        preset={preset}
        period={period}
        onPreset={(k) => { setPreset(k); setPeriod(resolvePreset(k)); }}
        onCustom={(p) => { setPreset('custom'); setPeriod(p); }}
      />

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
          {/* KPIs financeiros */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard label="Total vendido" value={BRL.format(data.kpis.totalSold)} sub={`${NUM.format(data.kpis.closedCount)} lote(s) fechado(s)`} accent="gold" />
            <KpiCard label="Comissão paga" value={BRL.format(data.kpis.commissionAmount)} sub="às revendedoras" accent="violet" />
            <KpiCard label="Líquido da loja" value={BRL.format(data.kpis.netAmount)} sub="vendido − comissão" accent="emerald" />
            <KpiCard label="Taxa de venda" value={`${data.kpis.sellThroughRate}%`} sub="peças vendidas / consignadas" accent="blue" />
          </div>

          {/* Peças + lotes abertos */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard label="Peças consignadas" value={NUM.format(data.kpis.piecesConsigned)} sub="no período (fechados)" accent="blue" />
            <KpiCard label="Peças vendidas" value={NUM.format(data.kpis.piecesSold)} accent="emerald" />
            <KpiCard label="Peças devolvidas" value={NUM.format(data.kpis.piecesReturned)} accent="gold" />
            <KpiCard label="Consignações abertas" value={NUM.format(data.kpis.openCount)} sub="lotes na rua agora" accent="violet" />
          </div>

          {/* Ranking de revendedoras */}
          <div className="card p-5">
            <h2 className="font-serif text-lg font-semibold text-charcoal-800 dark:text-cream-200 mb-1">Ranking de revendedoras</h2>
            <p className="text-xs text-charcoal-400 mb-4">Lotes fechados no período, ordenados por total vendido.</p>
            <RankingTable rows={data.ranking} />
          </div>

          {/* Consignações em aberto */}
          <div className="card p-5">
            <h2 className="font-serif text-lg font-semibold text-charcoal-800 dark:text-cream-200 mb-1">Consignações em aberto</h2>
            <p className="text-xs text-charcoal-400 mb-4">Lotes vigentes neste momento (não dependem do filtro de período). Valor potencial = peças × preço de venda.</p>
            <OpenTable rows={data.openConsignments} />
          </div>
        </>
      )}
    </div>
  );
}

// ─── Ranking ─────────────────────────────────────────────────────────────────
function RankingTable({ rows }: { rows: ResellerRow[] }) {
  if (rows.length === 0) return <EmptyChart label="Nenhum lote fechado no período." />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-charcoal-400 uppercase tracking-wide border-b border-charcoal-100 dark:border-charcoal-700">
            <th className="pb-2 font-medium">Revendedora</th>
            <th className="pb-2 font-medium text-right">Lotes</th>
            <th className="pb-2 font-medium text-right">Vendidas / Consig.</th>
            <th className="pb-2 font-medium text-right">Taxa</th>
            <th className="pb-2 font-medium text-right">Comissão</th>
            <th className="pb-2 font-medium text-right">Vendido</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-b border-charcoal-50 dark:border-charcoal-800 last:border-0">
              <td className="py-2.5 text-charcoal-700 dark:text-charcoal-200">{r.name}</td>
              <td className="py-2.5 text-right text-charcoal-600 dark:text-charcoal-300">{NUM.format(r.batches)}</td>
              <td className="py-2.5 text-right text-charcoal-600 dark:text-charcoal-300">{NUM.format(r.piecesSold)} / {NUM.format(r.piecesConsigned)}</td>
              <td className="py-2.5 text-right text-charcoal-600 dark:text-charcoal-300">{r.sellThroughRate}%</td>
              <td className="py-2.5 text-right text-charcoal-600 dark:text-charcoal-300">{BRL.format(r.commissionAmount)}</td>
              <td className="py-2.5 text-right font-medium text-charcoal-800 dark:text-cream-200">{BRL.format(r.totalSold)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Consignações em aberto ──────────────────────────────────────────────────
function OpenTable({ rows }: { rows: OpenRow[] }) {
  if (rows.length === 0) return <EmptyChart label="Nenhuma consignação em aberto." />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-charcoal-400 uppercase tracking-wide border-b border-charcoal-100 dark:border-charcoal-700">
            <th className="pb-2 font-medium">Revendedora</th>
            <th className="pb-2 font-medium">Aberto em</th>
            <th className="pb-2 font-medium text-right">Peças</th>
            <th className="pb-2 font-medium text-right">Valor potencial</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => (
            <tr key={o.id} className="border-b border-charcoal-50 dark:border-charcoal-800 last:border-0">
              <td className="py-2.5 text-charcoal-700 dark:text-charcoal-200">{o.consigneeName}</td>
              <td className="py-2.5 text-charcoal-500 dark:text-charcoal-400">{new Date(o.openedAt).toLocaleDateString('pt-BR')}</td>
              <td className="py-2.5 text-right text-charcoal-600 dark:text-charcoal-300">{NUM.format(o.pieces)}</td>
              <td className="py-2.5 text-right font-medium text-charcoal-800 dark:text-cream-200">{BRL.format(o.potentialValue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return <div className="py-10 text-center text-sm text-charcoal-300 dark:text-charcoal-600">{label}</div>;
}

function EmptyState() {
  return (
    <div className="card p-12 text-center">
      <p className="text-sm text-charcoal-400">Sem dados de consignação para exibir.</p>
    </div>
  );
}
