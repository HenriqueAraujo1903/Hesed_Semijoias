import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { buildOrderMessage, sendWhatsAppViaWindow } from '../utils/whatsapp';

interface OrderItem {
  id: string;
  productId: string | null;
  productSku: string;
  productName: string;
  productCategory: string;
  unitPrice: number;
  effectivePrice: number;
  subtotal: number;
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
  customerName: string | null;
  customerPhone: string | null;
  notes: string | null;
  items: OrderItem[];
}

interface Product {
  id: string;
  sku: string;
  name: string;
  salePrice: number;
}

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const STATUS_META: Record<string, { label: string; badge: string }> = {
  PENDENTE: { label: 'Pendente', badge: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' },
  CONFIRMADO: { label: 'Confirmado', badge: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' },
  CANCELADO: { label: 'Cancelado', badge: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' },
};

const FILTERS = [
  { key: 'PENDENTE', label: 'Pendentes' },
  { key: 'CONFIRMADO', label: 'Confirmados' },
  { key: 'CANCELADO', label: 'Cancelados' },
  { key: 'ALL', label: 'Todos' },
];

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function formatDateShort(iso: string): string {
  const [y, m, d] = iso.split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

/** Rótulo da 1ª data de repasse do crédito (D+30 a partir de hoje) — só prévia visual. */
function creditFirstSettlementLabel(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [summary, setSummary] = useState({ pendente: 0, confirmado: 0, cancelado: 0 });
  const [filter, setFilter] = useState<string>('PENDENTE');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<Order | null>(null);
  const [creating, setCreating] = useState(false);
  const [payingOrder, setPayingOrder] = useState<Order | null>(null);
  // Templates de mensagem (para o aviso automático via WhatsApp). Chave -> body/ativo.
  const [messageTemplates, setMessageTemplates] = useState<Record<string, { body: string; active: boolean; imageUrl: string | null }>>({});

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

  // Carrega produtos do estoque + templates de mensagem uma vez
  useEffect(() => {
    api.get('/products/catalog').then((res) => setProducts(res.data)).catch(() => {});
    api.get('/admin/settings/messages').then((res) => {
      const map: Record<string, { body: string; active: boolean; imageUrl: string | null }> = {};
      for (const t of res.data) map[t.templateKey] = { body: t.body, active: t.active, imageUrl: t.imageUrl ?? null };
      setMessageTemplates(map);
    }).catch(() => {});
  }, []);

  /**
   * Envia o aviso do template pelo WhatsApp, usando uma aba já aberta no clique
   * (`win`) para não ser bloqueada como popup após as chamadas de API. Se o
   * aviso estiver desligado ou sem telefone, fecha a aba pré-aberta.
   */
  function notifyCustomer(win: Window | null, order: import('../utils/whatsapp').OrderLike, status: string) {
    const key = status === 'CONFIRMADO' ? 'ORDER_CONFIRMED'
      : status === 'CANCELADO' ? 'ORDER_CANCELLED' : null;
    const tpl = key ? messageTemplates[key] : null;
    // Sem template ativo ou sem telefone: não há o que enviar — fecha a aba pré-aberta.
    if (!tpl || !tpl.active || !order.customerPhone) {
      if (win && !win.closed) win.close();
      return;
    }
    const msg = buildOrderMessage(tpl.body, order, tpl.imageUrl);
    sendWhatsAppViaWindow(win, order.customerPhone, msg);
  }

  /**
   * Resolver (confirmar/cancelar) SEMPRE passa pelo editor do pedido: lá a
   * operadora revisa itens, garante nome+telefone e clica em "Salvar e
   * confirmar" ou "Salvar e cancelar". Assim confirmar e cancelar têm o mesmo
   * fluxo ágil (uma tela só). Reabrir (voltar a PENDENTE) é ação direta.
   */
  async function changeStatus(order: Order, status: string) {
    if (status === 'CONFIRMADO' || status === 'CANCELADO') {
      setEditTarget(order);
      return;
    }
    // Reabrir: aplica direto.
    setActioningId(order.id);
    try {
      await api.patch(`/admin/orders/${order.id}/status`, { status });
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="font-serif text-display text-charcoal-800 dark:text-cream-200">Pedidos</h1>
          <p className="text-sm text-charcoal-400 dark:text-charcoal-500">
            Pedidos do catálogo e vendas diretas. Ajuste os itens e informe o cliente antes de confirmar a venda.
          </p>
        </div>
        <button onClick={() => setCreating(true)} className="btn-primary shrink-0">
          + Novo pedido
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <SummaryCard label="Pendentes" value={summary.pendente} accent="amber" />
        <SummaryCard label="Confirmados" value={summary.confirmado} accent="emerald" />
        <SummaryCard label="Cancelados" value={summary.cancelado} accent="red" />
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
              filter === f.key
                ? 'bg-gold text-white shadow-sm'
                : 'bg-white dark:bg-charcoal-800 text-charcoal-500 dark:text-charcoal-400 border border-charcoal-100 dark:border-charcoal-700 hover:border-gold hover:text-gold'
            }`}>
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
          <p className="text-sm text-charcoal-500 dark:text-charcoal-400">
            Nenhum pedido {filter !== 'ALL' ? STATUS_META[filter]?.label.toLowerCase() : ''}.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const isOpen = expanded === order.id;
            const meta = STATUS_META[order.status];
            const editable = order.status === 'PENDENTE';
            return (
              <div key={order.id} className="card overflow-hidden">
                <button
                  onClick={() => setExpanded(isOpen ? null : order.id)}
                  className="w-full flex items-center gap-4 p-4 text-left hover:bg-cream-100/50 dark:hover:bg-charcoal-700/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-semibold text-charcoal-700 dark:text-cream-200">{order.orderNumber}</span>
                      <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-medium ${meta.badge}`}>{meta.label}</span>
                      {order.customerName && (
                        <span className="text-xs text-charcoal-500 dark:text-charcoal-400">• {order.customerName}</span>
                      )}
                    </div>
                    <p className="text-xs text-charcoal-400 dark:text-charcoal-500 mt-0.5">
                      {formatDateTime(order.orderedAt)} • {order.items.length} {order.items.length === 1 ? 'item' : 'itens'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-charcoal-800 dark:text-cream-200">{BRL.format(order.totalAmount)}</p>
                    {order.items.some(i => i.wasPromotion) && <span className="text-[10px] text-gold">contém promoção</span>}
                  </div>
                  <svg className={`h-4 w-4 text-charcoal-300 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>

                {isOpen && (
                  <div className="border-t border-charcoal-100/60 dark:border-charcoal-700/60 px-4 py-3 bg-cream-50/40 dark:bg-charcoal-900/20">
                    {/* Cliente */}
                    {(order.customerName || order.customerPhone) && (
                      <div className="mb-3 text-xs text-charcoal-500 dark:text-charcoal-400">
                        <span className="font-medium text-charcoal-600 dark:text-charcoal-300">Cliente:</span>{' '}
                        {order.customerName || '—'}{order.customerPhone ? ` • ${order.customerPhone}` : ''}
                      </div>
                    )}

                    {/* Itens */}
                    <div className="space-y-2">
                      {order.items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between text-sm">
                          <div className="min-w-0 flex-1">
                            <span className="text-charcoal-700 dark:text-charcoal-200">{item.productName}</span>
                            <span className="text-charcoal-400 dark:text-charcoal-500 text-xs ml-2 font-mono">{item.productSku}</span>
                            {item.quantity > 1 && <span className="text-xs text-charcoal-400 ml-2">× {item.quantity}</span>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {item.wasPromotion && item.effectivePrice < item.unitPrice && (
                              <span className="text-[10px] bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded-full">
                                promo
                              </span>
                            )}
                            <span className="text-sm font-medium text-charcoal-700 dark:text-charcoal-200">{BRL.format(item.subtotal)}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-charcoal-100/60 dark:border-charcoal-700/60">
                      {editable ? (
                        <>
                          <button onClick={() => setEditTarget(order)}
                            className="rounded-lg border border-charcoal-200 dark:border-charcoal-600 px-4 py-1.5 text-xs font-medium text-charcoal-600 dark:text-charcoal-300 hover:border-gold hover:text-gold transition-all">
                            ✎ Editar pedido
                          </button>
                          <button disabled={actioningId === order.id} onClick={() => changeStatus(order, 'CONFIRMADO')}
                            className="rounded-lg bg-emerald-500 hover:bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white transition-colors disabled:opacity-50">
                            ✓ Confirmar venda
                          </button>
                          <button disabled={actioningId === order.id} onClick={() => changeStatus(order, 'CANCELADO')}
                            className="rounded-lg border border-charcoal-200 dark:border-charcoal-600 px-4 py-1.5 text-xs font-medium text-charcoal-500 dark:text-charcoal-400 hover:border-red-400 hover:text-red-500 transition-all disabled:opacity-50">
                            ✕ Cancelar
                          </button>
                        </>
                      ) : order.status === 'CONFIRMADO' ? (
                        <>
                          <span className="text-xs text-emerald-600 dark:text-emerald-400">
                            Venda confirmada{order.resolvedAt ? ` em ${formatDateTime(order.resolvedAt)}` : ''}
                          </span>
                          <button onClick={() => setPayingOrder(order)}
                            className="rounded-lg border border-charcoal-200 dark:border-charcoal-600 px-3 py-1.5 text-xs font-medium text-charcoal-600 dark:text-charcoal-300 hover:border-gold hover:text-gold transition-all">
                            💳 Pagamento
                          </button>
                          <button disabled={actioningId === order.id} onClick={() => changeStatus(order, 'PENDENTE')}
                            className="ml-auto text-xs text-charcoal-400 hover:text-gold transition-colors disabled:opacity-50">
                            Reabrir
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="text-xs text-red-500">
                            Cancelado{order.resolvedAt ? ` em ${formatDateTime(order.resolvedAt)}` : ''}
                          </span>
                          <button disabled={actioningId === order.id} onClick={() => changeStatus(order, 'PENDENTE')}
                            className="ml-auto text-xs text-charcoal-400 hover:text-gold transition-colors disabled:opacity-50">
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

          {filter === 'CONFIRMADO' && orders.length > 0 && (
            <div className="flex justify-end pt-2">
              <p className="text-sm text-charcoal-500 dark:text-charcoal-400">
                Total confirmado nesta lista: <span className="font-semibold text-charcoal-800 dark:text-cream-200">{BRL.format(totalConfirmedValue)}</span>
              </p>
            </div>
          )}
        </div>
      )}

      {(editTarget || creating) && (
        <OrderEditModal
          order={editTarget}
          products={products}
          onClose={() => { setEditTarget(null); setCreating(false); }}
          onSaved={() => { setEditTarget(null); setCreating(false); load(); }}
          onResolved={(status, o, win) => notifyCustomer(win, o, status)}
        />
      )}

      {payingOrder && (
        <PaymentModal order={payingOrder} onClose={() => setPayingOrder(null)} />
      )}
    </div>
  );
}

// ─── Modal de pagamento do pedido ─────────────────────────────────────────────

interface Settlement {
  id: string;
  installmentNumber: number;
  netAmount: number;
  expectedDate: string;
  status: 'PENDENTE' | 'RECEBIDO';
  receivedAt: string | null;
}

interface PaymentEntry {
  id: string;
  method: string;
  grossAmount: number;
  feeAmount: number;
  netAmount: number;
  installments: number;
  paidAt: string;
  settlements: Settlement[];
}

interface PaymentSummary {
  orderId: string;
  orderNumber: string;
  customerName: string | null;
  orderTotal: number;
  paidGross: number;
  remaining: number;
  paymentStatus: 'PENDENTE' | 'PARCIAL' | 'PAGO';
  payments: PaymentEntry[];
}

const PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: 'PIX', label: 'Pix' },
  { value: 'CARTAO_CREDITO', label: 'Cartão de crédito' },
  { value: 'CARTAO_DEBITO', label: 'Cartão de débito' },
  { value: 'DINHEIRO', label: 'Dinheiro' },
  { value: 'BOLETO', label: 'Boleto' },
  { value: 'TRANSFERENCIA', label: 'Transferência' },
];

const PAYMENT_STATUS_META: Record<string, { label: string; badge: string }> = {
  PENDENTE: { label: 'A receber', badge: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' },
  PARCIAL: { label: 'Parcial', badge: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' },
  PAGO: { label: 'Pago', badge: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' },
};

function PaymentModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [method, setMethod] = useState('PIX');
  const [grossAmount, setGrossAmount] = useState('');
  const [feeAmount, setFeeAmount] = useState('');
  const [installments, setInstallments] = useState('1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/admin/finance/orders/${order.id}/payments`);
      setSummary(res.data);
      // Pré-preenche o valor com o restante a receber, agilizando o registro.
      if (res.data.remaining > 0) setGrossAmount(String(res.data.remaining));
    } catch (e) {
      console.error('Erro ao carregar pagamentos:', e);
    }
  }, [order.id]);

  useEffect(() => { load(); }, [load]);

  async function register() {
    setError(null);
    const gross = parseFloat(grossAmount);
    if (isNaN(gross) || gross <= 0) { setError('Informe um valor recebido maior que zero.'); return; }
    const fee = feeAmount ? parseFloat(feeAmount) : 0;
    setLoading(true);
    try {
      const nParc = method === 'CARTAO_CREDITO' ? Math.max(1, parseInt(installments, 10) || 1) : 1;
      const res = await api.post(`/admin/finance/orders/${order.id}/payments`, {
        method, grossAmount: gross, feeAmount: fee || 0, installments: nParc,
      });
      setSummary(res.data);
      setGrossAmount(res.data.remaining > 0 ? String(res.data.remaining) : '');
      setFeeAmount('');
      setInstallments('1');
    } catch (e: any) {
      setError(e.response?.data?.error || 'Erro ao registrar pagamento');
    } finally {
      setLoading(false);
    }
  }

  async function removePayment(id: string) {
    if (!window.confirm('Remover este pagamento?')) return;
    try {
      const res = await api.delete(`/admin/finance/payments/${id}`);
      setSummary(res.data);
    } catch (e: any) {
      alert(e.response?.data?.error || 'Erro ao remover pagamento');
    }
  }

  const meta = summary ? PAYMENT_STATUS_META[summary.paymentStatus] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-charcoal-800 shadow-xl">
        <div className="flex items-center justify-between border-b border-charcoal-100 dark:border-charcoal-700 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-charcoal-800 dark:text-cream-200">Pagamento do pedido</h2>
            <p className="text-xs text-charcoal-400 font-mono">{order.orderNumber}</p>
          </div>
          <button onClick={onClose} className="text-charcoal-400 hover:text-charcoal-600 dark:hover:text-charcoal-200">✕</button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {summary && (
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-cream-100/60 dark:bg-charcoal-900/30 p-3 text-center">
                <p className="text-[10px] uppercase tracking-wide text-charcoal-400">Total</p>
                <p className="text-sm font-semibold text-charcoal-800 dark:text-cream-200">{BRL.format(summary.orderTotal)}</p>
              </div>
              <div className="rounded-lg bg-cream-100/60 dark:bg-charcoal-900/30 p-3 text-center">
                <p className="text-[10px] uppercase tracking-wide text-charcoal-400">Recebido</p>
                <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{BRL.format(summary.paidGross)}</p>
              </div>
              <div className="rounded-lg bg-cream-100/60 dark:bg-charcoal-900/30 p-3 text-center">
                <p className="text-[10px] uppercase tracking-wide text-charcoal-400">Falta</p>
                <p className="text-sm font-semibold text-red-500">{BRL.format(summary.remaining)}</p>
              </div>
            </div>
          )}
          {meta && (
            <div className="flex justify-center">
              <span className={`text-[11px] px-3 py-1 rounded-full font-medium ${meta.badge}`}>{meta.label}</span>
            </div>
          )}

          {/* Pagamentos já registrados */}
          {summary && summary.payments.length > 0 && (
            <div className="space-y-2">
              {summary.payments.map((p) => (
                <div key={p.id} className="rounded-lg border border-charcoal-100 dark:border-charcoal-700 px-3 py-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-charcoal-600 dark:text-charcoal-300">
                      {PAYMENT_METHODS.find((m) => m.value === p.method)?.label ?? p.method}
                      {p.installments > 1 ? ` ${p.installments}x` : ''}
                    </span>
                    <span className="ml-auto text-charcoal-700 dark:text-charcoal-200 font-medium">{BRL.format(p.grossAmount)}</span>
                    {p.feeAmount > 0 && <span className="text-[10px] text-charcoal-400">taxa {BRL.format(p.feeAmount)}</span>}
                    <button onClick={() => removePayment(p.id)} className="text-charcoal-300 hover:text-red-500 transition-colors" title="Remover">✕</button>
                  </div>
                  {/* Repasses previstos (quando o dinheiro entra no caixa) */}
                  {p.settlements && p.settlements.length > 0 && (
                    <div className="mt-1.5 space-y-0.5 border-t border-charcoal-100/60 dark:border-charcoal-700/60 pt-1.5">
                      {p.settlements.map((s) => (
                        <div key={s.id} className="flex items-center gap-2 text-[11px] text-charcoal-400">
                          <span>Repasse{p.installments > 1 ? ` ${s.installmentNumber}/${p.installments}` : ''}</span>
                          <span>{formatDateShort(s.expectedDate)}</span>
                          <span className="ml-auto">{BRL.format(s.netAmount)}</span>
                          <span className={s.status === 'RECEBIDO' ? 'text-emerald-500' : 'text-amber-500'}>
                            {s.status === 'RECEBIDO' ? 'recebido' : 'previsto'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Novo pagamento */}
          {(!summary || summary.remaining > 0) && (
            <div className="space-y-3 rounded-lg border border-charcoal-100 dark:border-charcoal-700 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-charcoal-400">Registrar pagamento</p>
              <div>
                <label className="block text-xs font-medium text-charcoal-600 dark:text-charcoal-400 mb-1 uppercase tracking-wide">Forma</label>
                <select value={method} onChange={(e) => setMethod(e.target.value)} className="input-field">
                  {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-charcoal-600 dark:text-charcoal-400 mb-1 uppercase tracking-wide">Valor (R$)</label>
                  <input type="number" step="0.01" min="0" value={grossAmount} onChange={(e) => setGrossAmount(e.target.value)} className="input-field" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-charcoal-600 dark:text-charcoal-400 mb-1 uppercase tracking-wide">Taxa (R$)</label>
                  <input type="number" step="0.01" min="0" value={feeAmount} onChange={(e) => setFeeAmount(e.target.value)} className="input-field" placeholder="0,00" />
                </div>
              </div>
              {method === 'CARTAO_CREDITO' && (
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-charcoal-600 dark:text-charcoal-400 uppercase tracking-wide">Parcelas</label>
                  <input type="number" min="1" max="24" value={installments} onChange={(e) => setInstallments(e.target.value)}
                    className="w-20 rounded border border-charcoal-200 dark:border-charcoal-600 bg-white dark:bg-charcoal-900 px-2 py-1.5 text-sm text-center" />
                  <span className="text-[11px] text-charcoal-400">crédito: repasse a cada 30 dias (1ª em D+30)</span>
                </div>
              )}
              {error && <p className="text-sm text-red-500">{error}</p>}
              <div className="flex justify-end">
                <button onClick={register} disabled={loading} className="btn-primary disabled:opacity-50">
                  {loading ? 'Salvando...' : 'Registrar'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-charcoal-100 dark:border-charcoal-700 px-6 py-4">
          <button onClick={onClose} className="btn-ghost">Fechar</button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal de edição do pedido ───────────────────────────────────────────────
interface EditItem {
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  effectivePrice: number;
}

// Linha de pagamento no formulário de confirmação (valores como string do input).
interface PayLine {
  method: string;
  amount: string;
  fee: string;
  installments: string;  // nº de parcelas (só usado no cartão de crédito)
}

function OrderEditModal({ order, products, onClose, onSaved, onResolved }: {
  order: Order | null; products: Product[]; onClose: () => void; onSaved: () => void;
  onResolved: (status: 'CONFIRMADO' | 'CANCELADO', order: import('../utils/whatsapp').OrderLike, win: Window | null) => void;
}) {
  const isCreate = order === null;
  const [items, setItems] = useState<EditItem[]>(
    (order?.items ?? []).map((i) => ({
      productId: i.productId ?? '',
      productName: i.productName,
      productSku: i.productSku,
      quantity: i.quantity,
      effectivePrice: i.effectivePrice,
    }))
  );
  const [customerId, setCustomerId] = useState<string>((order as any)?.customerId ?? '');
  const [customerName, setCustomerName] = useState(order?.customerName ?? '');
  const [customerPhone, setCustomerPhone] = useState(order?.customerPhone ?? '');
  const [customers, setCustomers] = useState<{ id: string; name: string; phone: string | null }[]>([]);
  const [notes, setNotes] = useState(order?.notes ?? '');
  const [addProductId, setAddProductId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pagamento(s) (opcional) informado(s) já na confirmação da venda. Um pedido
  // pode ter mais de uma forma (ex.: parte no Pix, parte no cartão). Cada linha
  // preenchida vira um Payment ao confirmar; linhas em branco são ignoradas.
  const [payments, setPayments] = useState<PayLine[]>([{ method: 'PIX', amount: '', fee: '', installments: '1' }]);

  function updatePayLine(idx: number, patch: Partial<PayLine>) {
    setPayments((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }
  function addPayLine() {
    setPayments((prev) => [...prev, { method: 'PIX', amount: '', fee: '', installments: '1' }]);
  }
  function removePayLine(idx: number) {
    setPayments((prev) => (prev.length === 1 ? [{ method: 'PIX', amount: '', fee: '', installments: '1' }] : prev.filter((_, i) => i !== idx)));
  }

  // Soma dos pagamentos preenchidos (para o resumo e o atalho "pago integralmente").
  const payTotal = useMemo(
    () => payments.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0),
    [payments]
  );

  // Carrega clientes cadastrados para o seletor (opcional).
  useEffect(() => {
    api.get('/admin/customers').then((res) => setCustomers(res.data)).catch(() => {});
  }, []);

  // Ao escolher um cliente cadastrado, preenche nome e telefone a partir dele.
  function selectCustomer(id: string) {
    setCustomerId(id);
    if (!id) return;
    const c = customers.find((x) => x.id === id);
    if (c) {
      setCustomerName(c.name);
      setCustomerPhone(c.phone ?? '');
    }
  }

  const total = useMemo(
    () => items.reduce((s, i) => s + i.effectivePrice * i.quantity, 0),
    [items]
  );

  // Produtos ainda não adicionados
  const availableProducts = useMemo(
    () => products.filter((p) => !items.some((i) => i.productId === p.id)),
    [products, items]
  );

  function updateItem(idx: number, patch: Partial<EditItem>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }
  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }
  function addItem() {
    const p = products.find((x) => x.id === addProductId);
    if (!p) return;
    setItems((prev) => [...prev, {
      productId: p.id, productName: p.name, productSku: p.sku, quantity: 1, effectivePrice: p.salePrice,
    }]);
    setAddProductId('');
  }

  async function handleSave(resolve: 'CONFIRMADO' | 'CANCELADO' | null) {
    setError(null);
    if (items.length === 0) { setError('O pedido precisa ter ao menos um item.'); return; }

    // resolve = ação de resolução: CONFIRMADO, CANCELADO ou null (apenas salvar).
    // Confirmar e cancelar exigem nome + telefone (usados no aviso via WhatsApp).
    if (resolve) {
      const verbo = resolve === 'CONFIRMADO' ? 'confirmar' : 'cancelar';
      if (!customerName.trim()) { setError(`Informe o nome do cliente para ${verbo} o pedido.`); return; }
      if (!customerPhone.trim()) { setError(`Informe o telefone do cliente para ${verbo} o pedido.`); return; }
    }

    // Valida os pagamentos informados (se houver) antes de prosseguir.
    // Só coletamos pagamento no fluxo de confirmação da venda.
    const payLines = resolve === 'CONFIRMADO'
      ? payments
          .map((l) => ({
            method: l.method,
            amount: parseFloat(l.amount),
            fee: l.fee.trim() ? parseFloat(l.fee) : 0,
            installments: l.method === 'CARTAO_CREDITO' ? Math.max(1, parseInt(l.installments, 10) || 1) : 1,
          }))
          .filter((l) => l.amount || l.fee)  // ignora linhas totalmente em branco
      : [];
    for (const l of payLines) {
      if (isNaN(l.amount) || l.amount <= 0) {
        setError('Cada forma de pagamento precisa de um valor maior que zero (ou deixe a linha em branco).');
        return;
      }
      if (isNaN(l.fee) || l.fee < 0) {
        setError('A taxa não pode ser negativa.');
        return;
      }
      if (l.fee > l.amount) {
        setError('A taxa não pode ser maior que o valor recebido.');
        return;
      }
    }
    const hasPayment = payLines.length > 0;

    // Aviso (opcional) de pagamento ao confirmar: só alerta se a operadora NÃO
    // informou nenhum pagamento aqui. Registrar não é obrigatório — pode ser
    // feito depois pelo botão "Pagamento" do pedido.
    if (resolve === 'CONFIRMADO' && !hasPayment) {
      const ok = window.confirm(
        'Confirmar a venda sem registrar o pagamento?\n\n' +
        'Você pode informar uma ou mais formas de pagamento nos campos "Pagamento" acima, ' +
        'ou registrar depois pelo botão "Pagamento" do pedido.\n\n' +
        'Clique em OK para confirmar mesmo assim, ou Cancelar para voltar.'
      );
      if (!ok) return;
    }

    const payloadItems = items.map((i) => ({
      productId: i.productId,
      quantity: i.quantity,
      effectivePrice: i.effectivePrice,
    }));

    // Abre a aba do WhatsApp AGORA, ainda dentro do gesto de clique, para não
    // ser bloqueada como popup depois dos await das chamadas de API. Só abre
    // quando é uma resolução (confirmar/cancelar). A URL final é definida em
    // notifyCustomer (via onResolved); se não houver o que enviar, a aba é
    // fechada lá.
    const waWindow = resolve ? window.open('about:blank', '_blank') : null;

    setLoading(true);
    try {
      let orderNumber = order?.orderNumber ?? '';
      let resolvedOrderId = order?.id ?? '';
      if (isCreate) {
        // Venda direta: cria já com o status desejado (confirm=true nasce CONFIRMADO).
        // Cancelar não faz sentido numa venda direta nova — só confirma ou fica pendente.
        const res = await api.post('/admin/orders', {
          items: payloadItems,
          customerId: customerId || null,
          customerName: customerName.trim() || null,
          customerPhone: customerPhone.trim() || null,
          notes: notes.trim() || null,
          confirm: resolve === 'CONFIRMADO',
        });
        orderNumber = res.data?.orderNumber ?? orderNumber;
        resolvedOrderId = res.data?.id ?? resolvedOrderId;
      } else {
        await api.put(`/admin/orders/${order!.id}`, {
          items: payloadItems,
          customerId: customerId || null,
          customerName: customerName.trim() || null,
          customerPhone: customerPhone.trim() || null,
          notes: notes.trim() || null,
        });
        if (resolve) {
          await api.patch(`/admin/orders/${order!.id}/status`, { status: resolve });
        }
      }

      // Registra o(s) pagamento(s) informado(s) na confirmação (opcional). Falha
      // aqui não desfaz a venda já confirmada — apenas avisa quais formas não
      // entraram, para a operadora tentar de novo pelo botão "Pagamento".
      if (hasPayment && resolvedOrderId) {
        const failed: string[] = [];
        for (const l of payLines) {
          try {
            await api.post(`/admin/finance/orders/${resolvedOrderId}/payments`, {
              method: l.method,
              grossAmount: l.amount,
              feeAmount: l.fee || 0,
              installments: l.installments,
            });
          } catch (payErr: any) {
            const label = PAYMENT_METHODS.find((m) => m.value === l.method)?.label ?? l.method;
            failed.push(`${label}: ${payErr.response?.data?.error || 'erro ao registrar'}`);
          }
        }
        if (failed.length > 0) {
          alert(
            'A venda foi confirmada, mas algumas formas de pagamento não puderam ser registradas:\n\n' +
            failed.join('\n') +
            '\n\nRegistre as pendentes pelo botão "Pagamento" do pedido.'
          );
        }
      }
      // Aviso automático ao resolver (confirmar/cancelar) pela tela de edição.
      if (resolve) {
        onResolved(resolve, {
          orderNumber,
          customerName: customerName.trim() || null,
          customerPhone: customerPhone.trim() || null,
          totalAmount: total,
          items: items.map((i) => ({
            productName: i.productName, quantity: i.quantity, effectivePrice: i.effectivePrice,
          })),
        }, waWindow);
      }
      onSaved();
    } catch (e: any) {
      // Falhou o salvamento: fecha a aba pré-aberta para não deixar aba órfã.
      if (waWindow && !waWindow.closed) waWindow.close();
      setError(e.response?.data?.error || 'Erro ao salvar o pedido');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-charcoal-800 shadow-xl">
        <div className="flex items-center justify-between border-b border-charcoal-100 dark:border-charcoal-700 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-charcoal-800 dark:text-cream-200">
              {isCreate ? 'Nova Venda Direta' : 'Editar Pedido'}
            </h2>
            <p className="text-xs text-charcoal-400 font-mono">
              {isCreate ? 'Venda fora do catálogo' : order!.orderNumber}
            </p>
          </div>
          <button onClick={onClose} className="text-charcoal-400 hover:text-charcoal-600 dark:hover:text-charcoal-200">✕</button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Cliente cadastrado (opcional): preenche nome + telefone */}
          {customers.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-charcoal-600 dark:text-charcoal-400 mb-1 uppercase tracking-wide">
                Cliente cadastrado
              </label>
              <select value={customerId} onChange={(e) => selectCustomer(e.target.value)} className="input-field">
                <option value="">— Selecionar cliente cadastrado (ou digitar abaixo) —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}{c.phone ? ` — ${c.phone}` : ''}</option>
                ))}
              </select>
            </div>
          )}

          {/* Cliente */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-charcoal-600 dark:text-charcoal-400 mb-1 uppercase tracking-wide">
                Nome do cliente <span className="text-red-400">*</span>
              </label>
              <input value={customerName} onChange={(e) => { setCustomerName(e.target.value); setCustomerId(''); }}
                placeholder="Ex: Maria Silva" className="input-field" />
            </div>
            <div>
              <label className="block text-xs font-medium text-charcoal-600 dark:text-charcoal-400 mb-1 uppercase tracking-wide">
                Telefone <span className="text-red-400">*</span>
              </label>
              <input value={customerPhone} onChange={(e) => { setCustomerPhone(e.target.value); setCustomerId(''); }}
                placeholder="Ex: (51) 99999-9999" className="input-field" />
              <p className="mt-1 text-[10px] text-charcoal-400">Obrigatório para confirmar ou cancelar (usado no aviso via WhatsApp).</p>
            </div>
          </div>

          {/* Itens */}
          <div>
            <label className="block text-xs font-medium text-charcoal-600 dark:text-charcoal-400 mb-2 uppercase tracking-wide">Itens</label>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="rounded-lg border border-charcoal-100 dark:border-charcoal-700 p-2">
                  {/* Linha 1: nome + remover */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-charcoal-700 dark:text-charcoal-200 truncate">{item.productName}</p>
                      <p className="text-[11px] text-charcoal-400 font-mono">{item.productSku}</p>
                    </div>
                    <button onClick={() => removeItem(idx)} title="Remover"
                      className="shrink-0 text-charcoal-300 hover:text-red-500 transition-colors px-1">✕</button>
                  </div>
                  {/* Linha 2: qtd, preço e subtotal */}
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-charcoal-400 uppercase">Qtd</span>
                      <input type="number" min={1} value={item.quantity}
                        onChange={(e) => updateItem(idx, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                        className="w-14 rounded border border-charcoal-200 dark:border-charcoal-600 bg-white dark:bg-charcoal-900 px-2 py-1 text-sm text-center" />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-charcoal-400 uppercase">R$</span>
                      <input type="number" min={0} step="0.01" value={item.effectivePrice}
                        onChange={(e) => updateItem(idx, { effectivePrice: parseFloat(e.target.value) || 0 })}
                        className="w-20 rounded border border-charcoal-200 dark:border-charcoal-600 bg-white dark:bg-charcoal-900 px-2 py-1 text-sm text-right" />
                    </div>
                    <span className="ml-auto text-sm font-medium text-charcoal-700 dark:text-charcoal-200">
                      {BRL.format(item.effectivePrice * item.quantity)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Adicionar item do estoque */}
            <div className="flex items-center gap-2 mt-2">
              <select value={addProductId} onChange={(e) => setAddProductId(e.target.value)} className="input-field py-1.5 text-sm flex-1">
                <option value="">+ Adicionar item do estoque...</option>
                {availableProducts.map((p) => (
                  <option key={p.id} value={p.id}>{p.sku} — {p.name} ({BRL.format(p.salePrice)})</option>
                ))}
              </select>
              <button onClick={addItem} disabled={!addProductId}
                className="rounded-lg bg-charcoal-100 dark:bg-charcoal-700 px-3 py-1.5 text-sm text-charcoal-600 dark:text-charcoal-300 hover:bg-gold hover:text-white transition-all disabled:opacity-40">
                Adicionar
              </button>
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-xs font-medium text-charcoal-600 dark:text-charcoal-400 mb-1 uppercase tracking-wide">Observações</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" className="input-field" />
          </div>

          {/* Total */}
          <div className="flex justify-between items-center pt-2 border-t border-charcoal-100 dark:border-charcoal-700">
            <span className="text-sm text-charcoal-500 dark:text-charcoal-400">Total</span>
            <span className="text-lg font-serif font-semibold text-charcoal-800 dark:text-cream-200">{BRL.format(total)}</span>
          </div>

          {/* Pagamento(s) (opcional) — registrado(s) ao confirmar a venda */}
          <div className="rounded-lg border border-charcoal-100 dark:border-charcoal-700 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wide text-charcoal-500 dark:text-charcoal-400">
                Pagamento <span className="font-normal normal-case text-charcoal-400">(opcional)</span>
              </label>
              {/* Preenche a primeira linha com o total restante (pagamento único integral) */}
              {payTotal === 0 && (
                <button type="button"
                  onClick={() => setPayments([{ method: payments[0]?.method ?? 'PIX', amount: total ? total.toFixed(2) : '', fee: '', installments: payments[0]?.installments ?? '1' }])}
                  className="text-[11px] text-gold hover:underline">
                  Pago integralmente
                </button>
              )}
            </div>

            {/* Cabeçalho das colunas (desktop) */}
            <div className="hidden sm:grid grid-cols-[1fr_100px_90px_28px] gap-2 text-[10px] text-charcoal-400 uppercase">
              <span>Forma</span>
              <span className="text-right">Valor (R$)</span>
              <span className="text-right">Taxa (R$)</span>
              <span />
            </div>

            {payments.map((line, idx) => {
              const isCredit = line.method === 'CARTAO_CREDITO';
              const nParc = isCredit ? Math.max(1, parseInt(line.installments, 10) || 1) : 1;
              const amountNum = parseFloat(line.amount) || 0;
              const feeNum = parseFloat(line.fee) || 0;
              const netNum = Math.max(0, amountNum - feeNum);
              return (
                <div key={idx} className="space-y-1.5">
                  <div className="grid grid-cols-2 sm:grid-cols-[1fr_100px_90px_28px] gap-2 items-center">
                    <select value={line.method} onChange={(e) => updatePayLine(idx, { method: e.target.value })}
                      className="input-field py-1.5 text-sm col-span-2 sm:col-span-1">
                      {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                    <input type="number" step="0.01" min="0" value={line.amount} placeholder="0,00"
                      onChange={(e) => updatePayLine(idx, { amount: e.target.value })}
                      className="w-full rounded border border-charcoal-200 dark:border-charcoal-600 bg-white dark:bg-charcoal-900 px-2 py-1.5 text-sm text-right" />
                    <input type="number" step="0.01" min="0" value={line.fee} placeholder="0,00"
                      onChange={(e) => updatePayLine(idx, { fee: e.target.value })}
                      className="w-full rounded border border-charcoal-200 dark:border-charcoal-600 bg-white dark:bg-charcoal-900 px-2 py-1.5 text-sm text-right" />
                    <button type="button" onClick={() => removePayLine(idx)} title="Remover forma"
                      className="justify-self-center text-charcoal-300 hover:text-red-500 transition-colors">✕</button>
                  </div>
                  {isCredit && (
                    <div className="flex items-center gap-2 pl-1">
                      <span className="text-[10px] text-charcoal-400 uppercase">Parcelas</span>
                      <input type="number" min="1" max="24" value={line.installments}
                        onChange={(e) => updatePayLine(idx, { installments: e.target.value })}
                        className="w-16 rounded border border-charcoal-200 dark:border-charcoal-600 bg-white dark:bg-charcoal-900 px-2 py-1 text-sm text-center" />
                      {netNum > 0 && (
                        <span className="text-[10px] text-charcoal-400">
                          {nParc}x de {BRL.format(netNum / nParc)} líquido · repasse a partir de {creditFirstSettlementLabel()}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            <div className="flex items-center justify-between">
              <button type="button" onClick={addPayLine}
                className="text-[11px] text-gold hover:underline">
                + Adicionar forma de pagamento
              </button>
              {payTotal > 0 && (
                <span className={`text-[11px] ${Math.abs(payTotal - total) < 0.005 ? 'text-emerald-600 dark:text-emerald-400' : 'text-charcoal-400'}`}>
                  Pago: {BRL.format(payTotal)}{Math.abs(payTotal - total) >= 0.005 ? ` de ${BRL.format(total)}` : ''}
                </span>
              )}
            </div>

            <p className="text-[10px] text-charcoal-400">
              Informe uma ou mais formas para registrar o pagamento ao confirmar a venda. Em branco, você confirma agora e registra depois.
            </p>
          </div>

          {error && <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 p-3 text-xs text-red-600 dark:text-red-400">{error}</div>}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-charcoal-100 dark:border-charcoal-700 px-6 py-4">
          <button onClick={onClose} className="btn-ghost">Fechar</button>
          <button onClick={() => handleSave(null)} disabled={loading}
            className="rounded-lg border border-charcoal-200 dark:border-charcoal-600 px-4 py-2 text-sm font-medium text-charcoal-600 dark:text-charcoal-300 hover:border-gold hover:text-gold transition-all disabled:opacity-50">
            {loading ? 'Salvando...' : isCreate ? 'Salvar como pendente' : 'Salvar'}
          </button>
          {/* Cancelar pedido: só faz sentido para um pedido existente */}
          {!isCreate && (
            <button onClick={() => handleSave('CANCELADO')} disabled={loading}
              className="rounded-lg border border-red-300 dark:border-red-800/50 px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50">
              Salvar e cancelar pedido
            </button>
          )}
          <button onClick={() => handleSave('CONFIRMADO')} disabled={loading}
            className="rounded-lg bg-emerald-500 hover:bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50">
            {isCreate ? 'Registrar venda' : 'Salvar e confirmar venda'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: number; accent: 'amber' | 'emerald' | 'red' }) {
  const styles = {
    amber: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200/50 dark:border-amber-800/40',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200/50 dark:border-emerald-800/40',
    red: 'bg-red-50 dark:bg-red-900/20 border-red-200/50 dark:border-red-800/40',
  };
  const dot = { amber: 'bg-amber-500', emerald: 'bg-emerald-500', red: 'bg-red-500' };
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
