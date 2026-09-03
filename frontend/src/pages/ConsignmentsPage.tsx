import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../services/api';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const PCT = new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 0, maximumFractionDigits: 1 });

interface Consignee {
  id: string;
  name: string;
  commissionRate: number;
}

interface ProductOption {
  id: string;
  sku: string;
  name: string;
  salePrice: number;
  stockQuantity: number;
  reservedQuantity: number;
}

interface ConsignmentItem {
  id: string;
  productId: string;
  productSku: string;
  productName: string;
  quantity: number;
  soldQuantity: number;
  returnedQuantity: number;
  unitSalePrice: number;
}

interface Consignment {
  id: string;
  consigneeId: string;
  consigneeName: string;
  status: string; // ABERTO | FECHADO | CANCELADO
  commissionRate: number | null;
  totalSold: number | null;
  commissionAmount: number | null;
  netAmount: number | null;
  openedAt: string;
  closedAt: string | null;
  notes: string | null;
  items: ConsignmentItem[];
}

const STATUS_STYLES: Record<string, string> = {
  ABERTO: 'bg-amber-100 text-amber-700',
  FECHADO: 'bg-emerald-100 text-emerald-700',
  CANCELADO: 'bg-stone-200 text-stone-500',
};

function statusBadge(status: string) {
  return STATUS_STYLES[status] ?? 'bg-stone-100 text-stone-600';
}

export default function ConsignmentsPage() {
  const [consignments, setConsignments] = useState<Consignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [showOpen, setShowOpen] = useState(false);
  const [detailTarget, setDetailTarget] = useState<Consignment | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      const res = await api.get('/admin/consignments', { params });
      setConsignments(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-800">Consignações</h1>
          <p className="mt-1 text-sm text-stone-500">
            Lotes com revendedoras. Abrir reserva o estoque; fechar apura vendas e comissão.
          </p>
        </div>
        <button onClick={() => setShowOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-white hover:bg-gold-dark transition shadow-sm">
          + Novo Lote
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { v: '', label: 'Todos' },
          { v: 'ABERTO', label: 'Abertos' },
          { v: 'FECHADO', label: 'Fechados' },
          { v: 'CANCELADO', label: 'Cancelados' },
        ].map((f) => (
          <button key={f.v} onClick={() => setStatusFilter(f.v)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              statusFilter === f.v ? 'bg-gold text-white' : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gold border-t-transparent" />
        </div>
      ) : consignments.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-stone-200 bg-white py-16 text-center">
          <p className="text-sm text-stone-500">Nenhum lote de consignação.</p>
        </div>
      ) : (
        <>
          {/* Tabela (desktop) */}
          <div className="hidden md:block overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-stone-100 text-sm">
                <thead className="bg-stone-50">
                  <tr>
                    {['Revendedora', 'Aberto em', 'Itens', 'Comissão', 'Vendido', 'Status', 'Ações'].map((col) => (
                      <th key={col} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {consignments.map((c) => {
                    const totalPieces = c.items.reduce((s, i) => s + i.quantity, 0);
                    return (
                      <tr key={c.id} className="hover:bg-stone-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-stone-800">{c.consigneeName}</td>
                        <td className="px-4 py-3 text-stone-500">{new Date(c.openedAt).toLocaleDateString('pt-BR')}</td>
                        <td className="px-4 py-3 text-stone-600">{c.items.length} produto(s) · {totalPieces} pç</td>
                        <td className="px-4 py-3 text-stone-700">{c.commissionRate != null ? PCT.format(c.commissionRate) : '—'}</td>
                        <td className="px-4 py-3 text-stone-700">{c.totalSold != null ? BRL.format(c.totalSold) : '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusBadge(c.status)}`}>{c.status}</span>
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => setDetailTarget(c)} className="text-xs text-gold hover:underline">
                            {c.status === 'ABERTO' ? 'Acertar / Fechar' : 'Detalhes'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cards (mobile) */}
          <div className="md:hidden space-y-3">
            {consignments.map((c) => (
              <div key={c.id} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
                   onClick={() => setDetailTarget(c)}>
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium text-stone-800 min-w-0 flex-1 truncate">{c.consigneeName}</p>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusBadge(c.status)}`}>{c.status}</span>
                </div>
                <div className="mt-2 space-y-1 text-sm text-stone-500">
                  <p>{new Date(c.openedAt).toLocaleDateString('pt-BR')} · {c.items.length} produto(s)</p>
                  <p>Comissão {c.commissionRate != null ? PCT.format(c.commissionRate) : '—'}
                     {c.totalSold != null && ` · Vendido ${BRL.format(c.totalSold)}`}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {showOpen && (
        <OpenConsignmentModal
          onClose={() => setShowOpen(false)}
          onSaved={() => { setShowOpen(false); load(); }}
        />
      )}

      {detailTarget && (
        <ConsignmentDetailModal
          consignmentId={detailTarget.id}
          onClose={() => setDetailTarget(null)}
          onChanged={() => { load(); }}
        />
      )}
    </div>
  );
}

// ============================================================================
// Abrir novo lote
// ============================================================================

interface DraftItem {
  productId: string;
  productLabel: string;
  quantity: string;
  unitSalePrice: string;
  maxAvailable: number;
}

function OpenConsignmentModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [consignees, setConsignees] = useState<Consignee[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [consigneeId, setConsigneeId] = useState('');
  const [commission, setCommission] = useState(''); // percent string
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<DraftItem[]>([]);
  const [productToAdd, setProductToAdd] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [cRes, pRes] = await Promise.all([
          api.get('/consignees'),
          api.get('/admin/products'),
        ]);
        setConsignees(cRes.data);
        setProducts(pRes.data);
      } catch (e) { console.error(e); }
    })();
  }, []);

  // Ao escolher a revendedora, sugere a comissão dela (editável).
  function handleConsignee(id: string) {
    setConsigneeId(id);
    const c = consignees.find((x) => x.id === id);
    if (c && commission === '') setCommission((c.commissionRate * 100).toString());
  }

  function addProduct() {
    if (!productToAdd) return;
    if (items.some((i) => i.productId === productToAdd)) { setProductToAdd(''); return; }
    const p = products.find((x) => x.id === productToAdd);
    if (!p) return;
    setItems([...items, {
      productId: p.id,
      productLabel: `${p.name} (${p.sku})`,
      quantity: '1',
      unitSalePrice: p.salePrice.toString(),
      maxAvailable: p.stockQuantity,
    }]);
    setProductToAdd('');
  }

  function updateItem(idx: number, patch: Partial<DraftItem>) {
    setItems(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function removeItem(idx: number) {
    setItems(items.filter((_, i) => i !== idx));
  }

  const availableProducts = useMemo(
    () => products.filter((p) => !items.some((i) => i.productId === p.id)),
    [products, items]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!consigneeId) { setError('Selecione a revendedora.'); return; }
    if (items.length === 0) { setError('Adicione ao menos um produto.'); return; }
    for (const it of items) {
      const q = parseInt(it.quantity, 10);
      if (!q || q < 1) { setError(`Quantidade inválida em ${it.productLabel}.`); return; }
      if (q > it.maxAvailable) { setError(`${it.productLabel}: só há ${it.maxAvailable} disponível.`); return; }
    }
    setLoading(true);
    const body = {
      consigneeId,
      commissionRate: commission !== '' ? parseFloat(commission) / 100 : null,
      notes: notes || null,
      items: items.map((it) => ({
        productId: it.productId,
        quantity: parseInt(it.quantity, 10),
        unitSalePrice: it.unitSalePrice !== '' ? parseFloat(it.unitSalePrice) : null,
      })),
    };
    try {
      await api.post('/admin/consignments', body);
      onSaved();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Erro ao abrir o lote');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-stone-100 px-6 py-4">
          <h2 className="text-base font-semibold text-stone-800">Novo Lote de Consignação</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Revendedora *</label>
              <select required value={consigneeId} onChange={(e) => handleConsignee(e.target.value)}
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-gold focus:outline-none">
                <option value="">Selecione...</option>
                {consignees.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Comissão do lote (%)</label>
              <input type="number" step="0.5" min="0" max="100" value={commission}
                onChange={(e) => setCommission(e.target.value)} placeholder="Padrão da revendedora"
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-gold focus:outline-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Adicionar produto</label>
            <div className="flex gap-2">
              <select value={productToAdd} onChange={(e) => setProductToAdd(e.target.value)}
                className="flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-gold focus:outline-none">
                <option value="">Selecione um produto...</option>
                {availableProducts.map((p) => (
                  <option key={p.id} value={p.id} disabled={p.stockQuantity < 1}>
                    {p.name} ({p.sku}) · {p.stockQuantity} disp.
                  </option>
                ))}
              </select>
              <button type="button" onClick={addProduct}
                className="rounded-lg bg-stone-100 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-200">
                Adicionar
              </button>
            </div>
          </div>

          {items.length > 0 && (
            <div className="rounded-lg border border-stone-200 divide-y divide-stone-100">
              <div className="hidden sm:grid grid-cols-12 gap-2 bg-stone-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-stone-500">
                <span className="col-span-5">Produto</span>
                <span className="col-span-2">Qtd</span>
                <span className="col-span-3">Preço venda (R$)</span>
                <span className="col-span-2"></span>
              </div>
              {items.map((it, idx) => (
                <div key={it.productId} className="grid grid-cols-12 gap-2 px-3 py-2 items-center">
                  <div className="col-span-12 sm:col-span-5 text-sm text-stone-700 truncate">
                    {it.productLabel}
                    <span className="ml-1 text-[10px] text-stone-400">({it.maxAvailable} disp.)</span>
                  </div>
                  <div className="col-span-5 sm:col-span-2">
                    <input type="number" min="1" max={it.maxAvailable} value={it.quantity}
                      onChange={(e) => updateItem(idx, { quantity: e.target.value })}
                      className="w-full rounded-lg border border-stone-200 px-2 py-1.5 text-sm focus:border-gold focus:outline-none" />
                  </div>
                  <div className="col-span-5 sm:col-span-3">
                    <input type="number" step="0.01" min="0" value={it.unitSalePrice}
                      onChange={(e) => updateItem(idx, { unitSalePrice: e.target.value })}
                      className="w-full rounded-lg border border-stone-200 px-2 py-1.5 text-sm focus:border-gold focus:outline-none" />
                  </div>
                  <div className="col-span-2 sm:col-span-2 text-right">
                    <button type="button" onClick={() => removeItem(idx)} className="text-xs text-red-500 hover:underline">Remover</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Observações</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-gold focus:outline-none" />
          </div>

          {error && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-600">{error}</div>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-stone-500">Cancelar</button>
            <button type="submit" disabled={loading}
              className="rounded-lg bg-gold px-5 py-2 text-sm font-semibold text-white hover:bg-gold-dark disabled:opacity-50 transition">
              {loading ? 'Abrindo...' : 'Abrir Lote'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// Detalhe / Acerto / Fechar
// ============================================================================

function ConsignmentDetailModal({ consignmentId, onClose, onChanged }: {
  consignmentId: string; onClose: () => void; onChanged: () => void;
}) {
  const [c, setC] = useState<Consignment | null>(null);
  const [sold, setSold] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/consignments/${consignmentId}`);
      const data: Consignment = res.data;
      setC(data);
      const s: Record<string, string> = {};
      data.items.forEach((i) => { s[i.id] = (i.soldQuantity ?? 0).toString(); });
      setSold(s);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [consignmentId]);

  useEffect(() => { load(); }, [load]);

  const isOpen = c?.status === 'ABERTO';

  // Resumo ao vivo do acerto atual (enquanto aberto).
  const summary = useMemo(() => {
    if (!c) return null;
    let totalSold = 0;
    let piecesSold = 0;
    let piecesReturned = 0;
    for (const it of c.items) {
      const sq = isOpen ? (parseInt(sold[it.id] ?? '0', 10) || 0) : it.soldQuantity;
      totalSold += sq * it.unitSalePrice;
      piecesSold += sq;
      piecesReturned += it.quantity - sq;
    }
    const rate = c.commissionRate ?? 0;
    const commissionAmount = totalSold * rate;
    return { totalSold, piecesSold, piecesReturned, commissionAmount, netAmount: totalSold - commissionAmount };
  }, [c, sold, isOpen]);

  function settlePayload() {
    return { items: Object.entries(sold).map(([itemId, v]) => ({ itemId, soldQuantity: parseInt(v, 10) || 0 })) };
  }

  function validate(): string | null {
    if (!c) return 'Lote não carregado';
    for (const it of c.items) {
      const q = parseInt(sold[it.id] ?? '0', 10) || 0;
      if (q < 0 || q > it.quantity) return `Vendido inválido em ${it.productName} (levado ${it.quantity}).`;
    }
    return null;
  }

  async function handleSaveSettle() {
    const v = validate(); if (v) { setError(v); return; }
    setError(null); setBusy(true);
    try {
      await api.put(`/admin/consignments/${consignmentId}/settle`, settlePayload());
      await load(); onChanged();
    } catch (e: any) { setError(e.response?.data?.error || 'Erro ao salvar acerto'); }
    finally { setBusy(false); }
  }

  async function handleClose() {
    const v = validate(); if (v) { setError(v); return; }
    if (!confirm('Fechar o lote? Isso baixa os vendidos, devolve o restante ao estoque e gera a venda consignada.')) return;
    setError(null); setBusy(true);
    try {
      await api.post(`/admin/consignments/${consignmentId}/close`, settlePayload());
      await load(); onChanged();
    } catch (e: any) { setError(e.response?.data?.error || 'Erro ao fechar o lote'); }
    finally { setBusy(false); }
  }

  async function handleCancel() {
    if (!confirm('Cancelar o lote? Todo o estoque reservado volta ao disponível.')) return;
    setError(null); setBusy(true);
    try {
      await api.post(`/admin/consignments/${consignmentId}/cancel`);
      await load(); onChanged();
    } catch (e: any) { setError(e.response?.data?.error || 'Erro ao cancelar'); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-stone-100 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-stone-800">
              {c ? c.consigneeName : 'Lote'}
              {c && <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusBadge(c.status)}`}>{c.status}</span>}
            </h2>
            {c && <p className="text-xs text-stone-400">Comissão do lote: {c.commissionRate != null ? PCT.format(c.commissionRate) : '—'}</p>}
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600">✕</button>
        </div>

        {loading || !c ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gold border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-4 px-6 py-5 overflow-y-auto">
            <div className="rounded-lg border border-stone-200 divide-y divide-stone-100">
              <div className="grid grid-cols-12 gap-2 bg-stone-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-stone-500">
                <span className="col-span-5">Produto</span>
                <span className="col-span-2 text-center">Levado</span>
                <span className="col-span-3 text-center">Vendido</span>
                <span className="col-span-2 text-right">Preço</span>
              </div>
              {c.items.map((it) => (
                <div key={it.id} className="grid grid-cols-12 gap-2 px-3 py-2 items-center text-sm">
                  <div className="col-span-5 text-stone-700 truncate">
                    {it.productName}<span className="block text-[10px] text-stone-400">{it.productSku}</span>
                  </div>
                  <div className="col-span-2 text-center text-stone-600">{it.quantity}</div>
                  <div className="col-span-3 text-center">
                    {isOpen ? (
                      <input type="number" min="0" max={it.quantity} value={sold[it.id] ?? '0'}
                        onChange={(e) => setSold({ ...sold, [it.id]: e.target.value })}
                        className="w-16 rounded-lg border border-stone-200 px-2 py-1 text-sm text-center focus:border-gold focus:outline-none" />
                    ) : (
                      <span className="text-stone-700">{it.soldQuantity}
                        <span className="text-[10px] text-stone-400"> · dev. {it.returnedQuantity}</span>
                      </span>
                    )}
                  </div>
                  <div className="col-span-2 text-right text-stone-600">{BRL.format(it.unitSalePrice)}</div>
                </div>
              ))}
            </div>

            {/* Resumo */}
            {summary && (
              <div className="rounded-lg bg-stone-50 border border-stone-200 p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-stone-400">Vendido</p>
                  <p className="text-sm font-semibold text-stone-800">{BRL.format(summary.totalSold)}</p>
                  <p className="text-[10px] text-stone-400">{summary.piecesSold} pç</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-stone-400">Devolvido</p>
                  <p className="text-sm font-semibold text-stone-800">{summary.piecesReturned} pç</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-stone-400">Comissão</p>
                  <p className="text-sm font-semibold text-amber-700">{BRL.format(summary.commissionAmount)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-stone-400">Líquido loja</p>
                  <p className="text-sm font-semibold text-emerald-700">{BRL.format(summary.netAmount)}</p>
                </div>
              </div>
            )}

            {c.status === 'FECHADO' && (
              <p className="text-xs text-stone-400">
                Fechado em {c.closedAt ? new Date(c.closedAt).toLocaleString('pt-BR') : '—'}. A venda entrou na receita com origem CONSIGNADO.
              </p>
            )}

            {error && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-600">{error}</div>}

            {isOpen && (
              <div className="flex flex-wrap justify-between gap-2 pt-2">
                <button type="button" onClick={handleCancel} disabled={busy}
                  className="rounded-lg px-4 py-2 text-sm text-red-500 hover:bg-red-50 disabled:opacity-50">
                  Cancelar lote
                </button>
                <div className="flex gap-2">
                  <button type="button" onClick={handleSaveSettle} disabled={busy}
                    className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50">
                    Salvar acerto
                  </button>
                  <button type="button" onClick={handleClose} disabled={busy}
                    className="rounded-lg bg-gold px-5 py-2 text-sm font-semibold text-white hover:bg-gold-dark disabled:opacity-50 transition">
                    {busy ? 'Processando...' : 'Fechar lote'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
