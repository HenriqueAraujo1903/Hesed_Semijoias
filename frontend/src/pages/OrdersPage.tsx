import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../services/api';

interface OrderItem {
  id: string;
  productSku: string;
  productName: string;
  productCategory: string;
  unitPrice: number;
  effectivePrice: number;
  quantity: number;
  wasPromotion: boolean;
  discountPercent: number | null;
}

interface Order {
  id: string;
  orderNumber: string;
  status: 'PENDENTE' | 'CONFIRMADO' | 'CANCELADO';
  channel: string;
  totalAmount: number;
  orderedAt: string;
  resolvedAt: string | null;
  notes: string | null;
  items: OrderItem[];
}

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const STATUS_META: Record<string, { label: string; badge: string }> = {
  PENDENTE: {
    label: 'Pendente',
    badge: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  },
  CONFIRMADO: {
    label: 'Confirmado',
    badge: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  },
  CANCELADO: {
    label: 'Cancelado',
    badge: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
  },
};

const FILTERS = [
  { key: 'PENDENTE', label: 'Pendentes' },
  { key: 'CONFIRMADO', label: 'Confirmados' },
  { key: 'CANCELADO', label: 'Cancelados' },
  { key: 'ALL', label: 'Todos' },
];

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [summary, setSummary] = useState({ pendente: 0, confirmado: 0, cancelado: 0 });
  const [filter, setFilter] = useState<string>('PENDENTE');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const statusParam = filter === 'ALL' ? '' : `?status=${filter}`;
      const [ordersRes, summaryRes] = await Promise.all([
        api.get(`/admin/orders${statusParam}`),
        api.get('/admin/orders/summary'),
      ]);
      setOrders(ordersRes.data);
      setSummary(summaryRes.data);
    } catch (e) {
      console.error('Erro ao carregar pedidos:', e);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  async function changeStatus(id: string, status: string) {
    setActioningId(id);
    try {
      await api.patch(`/admin/orders/${id}/status`, { status });
      await load();
    } catch (e: any) {
      alert(e.response?.data?.error || 'Erro ao atualizar o pedido');
    } finally {
      setActioningId(null);
    }
  }

  const totalConfirmedValue = useMemo(
    () => orders.filter(o => o.status === 'CONFIRMADO').reduce((s, o) => s + o.totalAmount, 0),
    [orders]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="font-serif text-display text-charcoal-800 dark:text-cream-200">Pedidos</h1>
        <p className="text-sm text-charcoal-400 dark:text-charcoal-500">
          Pedidos recebidos pelo catálogo via WhatsApp. Confirme os que viraram venda.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <SummaryCard label="Pendentes" value={summary.pendente} accent="amber" />
        <SummaryCard label="Confirmados" value={summary.confirmado} accent="emerald" />
        <SummaryCard label="Cancelados" value={summary.cancelado} accent="red" />
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
              filter === f.key
                ? 'bg-gold text-white shadow-sm'
                : 'bg-white dark:bg-charcoal-800 text-charcoal-500 dark:text-charcoal-400 border border-charcoal-100 dark:border-charcoal-700 hover:border-gold hover:text-gold'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gold border-t-transparent" />
        </div>
      ) : orders.length === 0 ? (
        <div className="card py-16 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gold-50 dark:bg-gold-900/20 mb-4">
            <svg className="w-6 h-6 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z" />
            </svg>
          </div>
          <p className="text-sm text-charcoal-500 dark:text-charcoal-400">Nenhum pedido {filter !== 'ALL' ? STATUS_META[filter]?.label.toLowerCase() : ''}.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const isOpen = expanded === order.id;
            const meta = STATUS_META[order.status];
            return (
              <div key={order.id} className="card overflow-hidden">
                {/* Order header row */}
                <button
                  onClick={() => setExpanded(isOpen ? null : order.id)}
                  className="w-full flex items-center gap-4 p-4 text-left hover:bg-cream-100/50 dark:hover:bg-charcoal-700/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-charcoal-700 dark:text-cream-200">{order.orderNumber}</span>
                      <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-medium ${meta.badge}`}>
                        {meta.label}
                      </span>
                    </div>
                    <p className="text-xs text-charcoal-400 dark:text-charcoal-500 mt-0.5">
                      {formatDateTime(order.orderedAt)} • {order.items.length} {order.items.length === 1 ? 'item' : 'itens'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-charcoal-800 dark:text-cream-200">{BRL.format(order.totalAmount)}</p>
                    {order.items.some(i => i.wasPromotion) && (
                      <span className="text-[10px] text-gold">contém promoção</span>
                    )}
                  </div>
                  <svg className={`h-4 w-4 text-charcoal-300 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="border-t border-charcoal-100/60 dark:border-charcoal-700/60 px-4 py-3 bg-cream-50/40 dark:bg-charcoal-900/20">
                    <div className="space-y-2">
                      {order.items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between text-sm">
                          <div className="min-w-0 flex-1">
                            <span className="text-charcoal-700 dark:text-charcoal-200">{item.productName}</span>
                            <span className="text-charcoal-400 dark:text-charcoal-500 text-xs ml-2 font-mono">{item.productSku}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {item.wasPromotion ? (
                              <>
                                <span className="text-xs text-charcoal-400 line-through">{BRL.format(item.unitPrice)}</span>
                                <span className="text-sm font-medium text-gold">{BRL.format(item.effectivePrice)}</span>
                                {item.discountPercent && (
                                  <span className="text-[10px] bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded-full">
                                    -{item.discountPercent}%
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="text-sm font-medium text-charcoal-700 dark:text-charcoal-200">{BRL.format(item.effectivePrice)}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-charcoal-100/60 dark:border-charcoal-700/60">
                      {order.status === 'PENDENTE' && (
                        <>
                          <button
                            disabled={actioningId === order.id}
                            onClick={() => changeStatus(order.id, 'CONFIRMADO')}
                            className="rounded-lg bg-emerald-500 hover:bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white transition-colors disabled:opacity-50"
                          >
                            ✓ Confirmar venda
                          </button>
                          <button
                            disabled={actioningId === order.id}
                            onClick={() => changeStatus(order.id, 'CANCELADO')}
                            className="rounded-lg border border-charcoal-200 dark:border-charcoal-600 px-4 py-1.5 text-xs font-medium text-charcoal-500 dark:text-charcoal-400 hover:border-red-400 hover:text-red-500 transition-all disabled:opacity-50"
                          >
                            ✕ Cancelar
                          </button>
                        </>
                      )}
                      {order.status === 'CONFIRMADO' && (
                        <>
                          <span className="text-xs text-emerald-600 dark:text-emerald-400">
                            Venda confirmada{order.resolvedAt ? ` em ${formatDateTime(order.resolvedAt)}` : ''}
                          </span>
                          <button
                            disabled={actioningId === order.id}
                            onClick={() => changeStatus(order.id, 'PENDENTE')}
                            className="ml-auto text-xs text-charcoal-400 hover:text-gold transition-colors disabled:opacity-50"
                          >
                            Reabrir
                          </button>
                        </>
                      )}
                      {order.status === 'CANCELADO' && (
                        <>
                          <span className="text-xs text-red-500">
                            Cancelado{order.resolvedAt ? ` em ${formatDateTime(order.resolvedAt)}` : ''}
                          </span>
                          <button
                            disabled={actioningId === order.id}
                            onClick={() => changeStatus(order.id, 'PENDENTE')}
                            className="ml-auto text-xs text-charcoal-400 hover:text-gold transition-colors disabled:opacity-50"
                          >
                            Reabrir
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Footer total for confirmed in current view */}
          {filter === 'CONFIRMADO' && orders.length > 0 && (
            <div className="flex justify-end pt-2">
              <p className="text-sm text-charcoal-500 dark:text-charcoal-400">
                Total confirmado nesta lista: <span className="font-semibold text-charcoal-800 dark:text-cream-200">{BRL.format(totalConfirmedValue)}</span>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: number; accent: 'amber' | 'emerald' | 'red' }) {
  const styles = {
    amber: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200/50 dark:border-amber-800/40',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200/50 dark:border-emerald-800/40',
    red: 'bg-red-50 dark:bg-red-900/20 border-red-200/50 dark:border-red-800/40',
  };
  const dot = {
    amber: 'bg-amber-500',
    emerald: 'bg-emerald-500',
    red: 'bg-red-500',
  };
  return (
    <div className={`rounded-2xl border p-4 ${styles[accent]}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`h-2 w-2 rounded-full ${dot[accent]}`} />
        <p className="text-xs font-medium text-charcoal-500 dark:text-charcoal-400 uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-2xl font-serif font-semibold text-charcoal-800 dark:text-cream-200">{value}</p>
    </div>
  );
}
