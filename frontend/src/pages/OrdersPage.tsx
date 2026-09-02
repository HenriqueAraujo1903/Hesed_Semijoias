import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { buildOrderMessage, openWhatsApp } from '../utils/whatsapp';

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

  /** Abre o WhatsApp com o aviso do template, se ele existir e estiver ativo. */
  function notifyCustomer(order: import('../utils/whatsapp').OrderLike, status: string) {
    const key = status === 'CONFIRMADO' ? 'ORDER_CONFIRMED'
      : status === 'CANCELADO' ? 'ORDER_CANCELLED' : null;
    if (!key) return;
    const tpl = messageTemplates[key];
    if (!tpl || !tpl.active) return;                 // aviso desligado nas Configurações
    if (!order.customerPhone) return;                // sem telefone não há como enviar
    const msg = buildOrderMessage(tpl.body, order, tpl.imageUrl);
    openWhatsApp(order.customerPhone, msg);
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
          onResolved={(status, o) => notifyCustomer(o, status)}
        />
      )}
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

function OrderEditModal({ order, products, onClose, onSaved, onResolved }: {
  order: Order | null; products: Product[]; onClose: () => void; onSaved: () => void;
  onResolved: (status: 'CONFIRMADO' | 'CANCELADO', order: import('../utils/whatsapp').OrderLike) => void;
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

    const payloadItems = items.map((i) => ({
      productId: i.productId,
      quantity: i.quantity,
      effectivePrice: i.effectivePrice,
    }));

    setLoading(true);
    try {
      let orderNumber = order?.orderNumber ?? '';
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
        });
      }
      onSaved();
    } catch (e: any) {
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
