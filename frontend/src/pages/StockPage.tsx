import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { BRL } from '../utils/format';
import { ProductsManager } from './AdminProductsPage';

type StockTab = 'produtos' | 'compras' | 'reposicao' | 'garantia';

export default function StockPage() {
  const [tab, setTab] = useState<StockTab>('produtos');

  const tabs: { key: StockTab; label: string }[] = [
    { key: 'produtos', label: 'Produtos' },
    { key: 'compras', label: 'Compras' },
    { key: 'reposicao', label: 'Reposição' },
    { key: 'garantia', label: 'Garantia' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-800">Estoque</h1>
        <p className="mt-1 text-sm text-stone-500">Produtos, reposição e controle de garantia num só lugar.</p>
      </div>

      {/* Sub-abas */}
      <div className="flex gap-1 border-b border-stone-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.key ? 'text-gold' : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            {t.label}
            {tab === t.key && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-gold" />}
          </button>
        ))}
      </div>

      {tab === 'produtos' && <ProductsManager />}
      {tab === 'compras' && <PurchasesTab />}
      {(tab === 'reposicao' || tab === 'garantia') && <StockAlertsTab tab={tab} />}
    </div>
  );
}

// ─── Aba: Compras (entrada de compra em lote) ────────────────────────────────

interface PurchaseItem {
  id: string;
  productSku: string;
  productName: string;
  unitCost: number;
  quantity: number;
  subtotal: number;
  createdProduct: boolean;
}
interface PurchaseBatch {
  id: string;
  supplierName: string;
  purchaseDate: string;
  totalAmount: number;
  installmentsCount: number;
  expenseId: string | null;
  notes: string | null;
  items: PurchaseItem[];
}

function PurchasesTab() {
  const [batches, setBatches] = useState<PurchaseBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/stock/purchases');
      setBatches(res.data);
    } catch (e) {
      console.error('Erro ao carregar compras:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-stone-500">
          Entradas de compra: dão entrada no estoque e geram uma conta a pagar ao fornecedor.
        </p>
        <button onClick={() => setShowForm(true)}
          className="rounded-lg bg-gold px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity">
          + Entrada de compra
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gold border-t-transparent" />
        </div>
      ) : batches.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white py-16 text-center shadow-sm">
          <p className="text-sm text-stone-400">Nenhuma compra registrada ainda.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {batches.map((b) => {
            const isOpen = expanded === b.id;
            return (
              <div key={b.id} className="rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
                <button onClick={() => setExpanded(isOpen ? null : b.id)}
                  className="w-full flex items-center gap-4 p-4 text-left hover:bg-stone-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-stone-800">{b.supplierName}</span>
                    <p className="text-xs text-stone-400 mt-0.5">
                      {BRL_DATE(b.purchaseDate)} • {b.items.length} {b.items.length === 1 ? 'item' : 'itens'}
                      {b.installmentsCount > 1 ? ` • ${b.installmentsCount}x` : ''}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-stone-800">{BRL.format(b.totalAmount)}</span>
                  <svg className={`h-4 w-4 text-stone-300 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
                {isOpen && (
                  <div className="border-t border-stone-100 px-4 py-3 bg-stone-50/50 space-y-1.5">
                    {b.items.map((it) => (
                      <div key={it.id} className="flex items-center gap-2 text-sm">
                        <span className="text-stone-700">{it.productName}</span>
                        <span className="text-xs text-stone-400 font-mono">{it.productSku}</span>
                        {it.createdProduct && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">novo</span>}
                        <span className="ml-auto text-xs text-stone-500">{it.quantity} × {BRL.format(it.unitCost)}</span>
                        <span className="w-24 text-right font-medium text-stone-700">{BRL.format(it.subtotal)}</span>
                      </div>
                    ))}
                    {b.notes && <p className="pt-2 text-xs text-stone-500">{b.notes}</p>}
                    {b.expenseId && <p className="pt-1 text-[11px] text-stone-400">Conta a pagar gerada — veja em Financeiro › Contas a Pagar.</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showForm && <PurchaseModal onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

interface SupplierOpt { id: string; name: string; }
interface ProductOpt { id: string; sku: string; name: string; }
interface FormItem {
  mode: 'existente' | 'novo';
  productId: string;
  sku: string;
  name: string;
  category: string;
  supplierPrice: string;   // preço de tabela do fornecedor (dirige o custo)
  profitPercent: string;   // % de lucro sobre a venda (dirige o preço de venda)
  salePrice: string;
  unitCost: string;        // custo pago = o que vai para a conta a pagar
  quantity: string;
}

function emptyItem(): FormItem {
  return {
    mode: 'existente', productId: '', sku: '', name: '', category: '',
    supplierPrice: '', profitPercent: '85', salePrice: '', unitCost: '', quantity: '1',
  };
}

// Mesma regra do cadastro individual de produto:
//   Custo pago = Preço fornecedor / 2
//   Venda = Custo / (1 - lucro%/100)
const round2 = (n: number) => Math.round(n * 100) / 100;
function saleFromCost(cost: number, profit: number): string {
  if (isNaN(cost) || isNaN(profit) || profit >= 100) return '';
  return String(round2(cost / (1 - profit / 100)));
}

function PurchaseModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [suppliers, setSuppliers] = useState<SupplierOpt[]>([]);
  const [products, setProducts] = useState<ProductOpt[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [installments, setInstallments] = useState('1');
  const [firstDueDate, setFirstDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<FormItem[]>([emptyItem()]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get('/admin/suppliers').then((r) => setSuppliers(r.data)).catch(() => {});
    api.get('/admin/products').then((r) => setProducts(r.data)).catch(() => {
      api.get('/products/catalog').then((r) => setProducts(r.data)).catch(() => {});
    });
    // Categorias ativas (cadastro de categorias) para o seletor do produto novo.
    api.get('/admin/categories')
      .then((r) => setCategories(r.data.filter((c: any) => c.active).map((c: any) => c.name)))
      .catch(() => setCategories([]));
  }, []);

  function updateItem(idx: number, patch: Partial<FormItem>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  // Cascata de preços (só para produto novo), espelhando o cadastro individual.
  // Preço fornecedor muda → custo = metade; venda recalculada pelo lucro atual.
  function onSupplierPrice(idx: number, value: string, it: FormItem) {
    const supplier = parseFloat(value);
    const profit = parseFloat(it.profitPercent);
    if (!isNaN(supplier)) {
      const cost = round2(supplier * 0.5);
      updateItem(idx, { supplierPrice: value, unitCost: String(cost), salePrice: saleFromCost(cost, profit) });
    } else {
      updateItem(idx, { supplierPrice: value });
    }
  }
  // Custo pago editado → venda recalculada pelo lucro atual.
  function onCost(idx: number, value: string, it: FormItem) {
    const cost = parseFloat(value);
    const profit = parseFloat(it.profitPercent);
    updateItem(idx, { unitCost: value, salePrice: !isNaN(cost) ? saleFromCost(cost, profit) : it.salePrice });
  }
  // % de lucro editado → venda recalculada a partir do custo atual.
  function onProfit(idx: number, value: string, it: FormItem) {
    const profit = parseFloat(value);
    const cost = parseFloat(it.unitCost);
    updateItem(idx, { profitPercent: value, salePrice: !isNaN(cost) ? saleFromCost(cost, profit) : it.salePrice });
  }
  // Venda editada na mão → mantém o valor; o lucro% passa a refletir o resultado.
  function onSale(idx: number, value: string, it: FormItem) {
    const sale = parseFloat(value);
    const cost = parseFloat(it.unitCost);
    updateItem(idx, {
      salePrice: value,
      profitPercent: (!isNaN(sale) && sale > 0 && !isNaN(cost))
        ? String(Math.round((1 - cost / sale) * 1000) / 10) : it.profitPercent,
    });
  }

  function addItem() { setItems((prev) => [...prev, emptyItem()]); }
  function removeItem(idx: number) {
    setItems((prev) => (prev.length === 1 ? [emptyItem()] : prev.filter((_, i) => i !== idx)));
  }

  const total = useMemo(
    () => items.reduce((s, it) => s + (parseFloat(it.unitCost) || 0) * (parseInt(it.quantity, 10) || 0), 0),
    [items]
  );
  const nParc = Math.max(1, parseInt(installments, 10) || 1);

  async function save() {
    setError(null);
    if (!supplierId) { setError('Selecione o fornecedor.'); return; }
    const payloadItems = [];
    for (const it of items) {
      const unitCost = parseFloat(it.unitCost);
      const qty = parseInt(it.quantity, 10);
      if (isNaN(unitCost) || unitCost <= 0) { setError('Cada item precisa de um custo unitário maior que zero.'); return; }
      if (isNaN(qty) || qty < 1) { setError('Cada item precisa de quantidade ao menos 1.'); return; }
      if (it.mode === 'existente') {
        if (!it.productId) { setError('Selecione o produto de cada item existente.'); return; }
        payloadItems.push({ productId: it.productId, unitCost, quantity: qty });
      } else {
        if (!it.sku.trim() || !it.name.trim()) { setError('Informe SKU e nome de cada produto novo.'); return; }
        if (!it.category) { setError(`Selecione a categoria do produto novo "${it.name}".`); return; }
        const salePrice = parseFloat(it.salePrice);
        if (isNaN(salePrice) || salePrice <= 0) { setError(`Informe o preço de venda do produto novo "${it.name}".`); return; }
        payloadItems.push({
          sku: it.sku.trim(), name: it.name.trim(),
          category: it.category, salePrice, unitCost, quantity: qty,
        });
      }
    }
    setLoading(true);
    try {
      await api.post('/admin/stock/purchases', {
        supplierId, purchaseDate, installmentsCount: nParc, firstDueDate,
        notes: notes.trim() || null, items: payloadItems,
      });
      onSaved();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Erro ao registrar a compra');
    } finally {
      setLoading(false);
    }
  }

  const fieldLabel = 'block text-xs font-medium text-stone-600 mb-1 uppercase tracking-wide';
  const input = 'w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-gold focus:outline-none';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-100 px-6 py-4">
          <h2 className="text-base font-semibold text-stone-800">Entrada de compra</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600">✕</button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={fieldLabel}>Fornecedor</label>
              <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={input}>
                <option value="">— Selecionar —</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className={fieldLabel}>Data da compra</label>
              <input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} className={input} />
            </div>
          </div>

          {/* Itens */}
          <div className="space-y-3">
            <label className={fieldLabel}>Itens da compra</label>
            {items.map((it, idx) => (
              <div key={idx} className="rounded-lg border border-stone-200 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <button type="button" onClick={() => updateItem(idx, { mode: 'existente' })}
                      className={`rounded px-2 py-1 text-xs font-medium ${it.mode === 'existente' ? 'bg-gold text-white' : 'bg-stone-100 text-stone-500'}`}>
                      Existente
                    </button>
                    <button type="button" onClick={() => updateItem(idx, { mode: 'novo' })}
                      className={`rounded px-2 py-1 text-xs font-medium ${it.mode === 'novo' ? 'bg-gold text-white' : 'bg-stone-100 text-stone-500'}`}>
                      Novo
                    </button>
                  </div>
                  <button type="button" onClick={() => removeItem(idx)} className="ml-auto text-stone-300 hover:text-red-500" title="Remover item">✕</button>
                </div>

                {it.mode === 'existente' ? (
                  <>
                    <select value={it.productId} onChange={(e) => updateItem(idx, { productId: e.target.value })} className={input}>
                      <option value="">— Selecionar produto —</option>
                      {products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
                    </select>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="block text-[10px] text-stone-400 uppercase mb-0.5">Custo unitário (R$)</span>
                        <input type="number" step="0.01" min="0" value={it.unitCost} onChange={(e) => updateItem(idx, { unitCost: e.target.value })} className={input} />
                      </div>
                      <div>
                        <span className="block text-[10px] text-stone-400 uppercase mb-0.5">Quantidade</span>
                        <input type="number" min="1" value={it.quantity} onChange={(e) => updateItem(idx, { quantity: e.target.value })} className={input} />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <input value={it.sku} onChange={(e) => updateItem(idx, { sku: e.target.value })} placeholder="SKU" className={input} />
                      <input value={it.name} onChange={(e) => updateItem(idx, { name: e.target.value })} placeholder="Nome" className={input} />
                      <select value={it.category} onChange={(e) => updateItem(idx, { category: e.target.value })} className={`${input} col-span-2`}>
                        <option value="">— Categoria —</option>
                        {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    {/* Preços em cascata (mesma regra do cadastro individual):
                        fornecedor → custo (metade) → venda (pelo lucro). Todos editáveis. */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <span className="block text-[10px] text-stone-400 uppercase mb-0.5">Preço fornecedor</span>
                        <input type="number" step="0.01" min="0" value={it.supplierPrice} onChange={(e) => onSupplierPrice(idx, e.target.value, it)} className={input} />
                      </div>
                      <div>
                        <span className="block text-[10px] text-stone-400 uppercase mb-0.5">Custo (R$)</span>
                        <input type="number" step="0.01" min="0" value={it.unitCost} onChange={(e) => onCost(idx, e.target.value, it)} className={input} />
                      </div>
                      <div>
                        <span className="block text-[10px] text-stone-400 uppercase mb-0.5">Lucro (%)</span>
                        <input type="number" step="0.1" min="0" max="99" value={it.profitPercent} onChange={(e) => onProfit(idx, e.target.value, it)} className={input} />
                      </div>
                      <div>
                        <span className="block text-[10px] text-stone-400 uppercase mb-0.5">Venda (R$)</span>
                        <input type="number" step="0.01" min="0" value={it.salePrice} onChange={(e) => onSale(idx, e.target.value, it)} className={input} />
                      </div>
                    </div>
                    <div>
                      <span className="block text-[10px] text-stone-400 uppercase mb-0.5">Quantidade</span>
                      <input type="number" min="1" value={it.quantity} onChange={(e) => updateItem(idx, { quantity: e.target.value })} className={`${input} w-24`} />
                    </div>
                  </>
                )}
                <div className="text-right text-xs text-stone-500">
                  Subtotal: <span className="font-medium text-stone-700">{BRL.format((parseFloat(it.unitCost) || 0) * (parseInt(it.quantity, 10) || 0))}</span>
                </div>
              </div>
            ))}
            <button type="button" onClick={addItem} className="text-xs text-gold hover:underline">+ Adicionar item</button>
          </div>

          {/* Pagamento ao fornecedor */}
          <div className="rounded-lg border border-stone-200 p-3 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Pagamento ao fornecedor</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="block text-[10px] text-stone-400 uppercase mb-0.5">Parcelas</span>
                <input type="number" min="1" value={installments} onChange={(e) => setInstallments(e.target.value)} className={input} />
              </div>
              <div>
                <span className="block text-[10px] text-stone-400 uppercase mb-0.5">1º vencimento</span>
                <input type="date" value={firstDueDate} onChange={(e) => setFirstDueDate(e.target.value)} className={input} />
              </div>
            </div>
            {nParc > 1 && total > 0 && (
              <p className="text-xs text-stone-500">{nParc}x de aproximadamente <span className="font-medium">{BRL.format(total / nParc)}</span> (uma por mês).</p>
            )}
          </div>

          <div>
            <label className={fieldLabel}>Observações (opcional)</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className={input} />
          </div>

          <div className="flex items-center justify-between border-t border-stone-100 pt-3">
            <span className="text-sm text-stone-500">Total da compra</span>
            <span className="text-lg font-semibold text-stone-800">{BRL.format(total)}</span>
          </div>

          {error && <p className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-stone-100 px-6 py-4">
          <button onClick={onClose} className="rounded-lg border border-stone-200 px-4 py-2 text-sm text-stone-500">Cancelar</button>
          <button onClick={save} disabled={loading} className="rounded-lg bg-gold px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
            {loading ? 'Salvando...' : 'Registrar compra'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface StockProduct {
  id: string;
  sku: string;
  name: string;
  category: string;
  stockQuantity: number;
  lowStockThreshold: number;
  stockStatus: string;
  supplierName: string | null;
}

interface WarrantyRow {
  id: string;
  sku: string;
  name: string;
  purchaseDate: string;
  warrantyExpiresAt: string;
}

interface Movement {
  id: string;
  type: string;
  delta: number;
  resultingQuantity: number;
  reason: string | null;
  createdAt: string | null;
}

const BRL_DATE = (iso: string) => {
  try { return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR'); }
  catch { return iso; }
};

function StockAlertsTab({ tab }: { tab: 'reposicao' | 'garantia' }) {
  const [low, setLow] = useState<StockProduct[]>([]);
  const [warranty, setWarranty] = useState<{ expiring: WarrantyRow[]; expired: WarrantyRow[]; active: WarrantyRow[] }>({ expiring: [], expired: [], active: [] });
  const [loading, setLoading] = useState(true);
  const [adjustTarget, setAdjustTarget] = useState<StockProduct | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [lowRes, warRes] = await Promise.all([
        api.get('/admin/stock/low'),
        api.get('/admin/stock/warranty', { params: { days: 60 } }),
      ]);
      setLow(lowRes.data);
      setWarranty(warRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gold border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {tab === 'reposicao' && (
        <section className="rounded-2xl border border-stone-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-stone-800">Reposição — estoque baixo ou esgotado</h2>
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">{low.length}</span>
          </div>
          {low.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-stone-400">Tudo em ordem — nenhum item precisando de reposição.</p>
          ) : (
            <div className="divide-y divide-stone-50">
              {low.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="font-medium text-stone-800 truncate">{p.name}</p>
                    <p className="font-mono text-xs text-stone-400">{p.sku}{p.supplierName ? ` · ${p.supplierName}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      p.stockStatus === 'ESGOTADO' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {p.stockQuantity} un · {p.stockStatus}
                    </span>
                    <button onClick={() => setAdjustTarget(p)}
                      className="rounded-lg bg-gold px-3 py-1.5 text-xs font-semibold text-white hover:bg-gold-dark transition">
                      Ajustar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === 'garantia' && (
        <div className="space-y-4">
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <WarrantyCard title="Garantia vencida" rows={warranty.expired} tone="red" />
            <WarrantyCard title="Garantia vencendo (60 dias)" rows={warranty.expiring} tone="amber" />
          </section>
          <WarrantyCard title="Garantia vigente (no prazo)" rows={warranty.active} tone="emerald" />
          {warranty.expired.length === 0 && warranty.expiring.length === 0 && warranty.active.length === 0 && (
            <p className="rounded-2xl border-2 border-dashed border-stone-200 bg-white py-10 text-center text-sm text-stone-400">
              Nenhum produto com data de compra lançada ainda. Informe a data de compra no cadastro do produto para acompanhar a garantia.
            </p>
          )}
        </div>
      )}

      {adjustTarget && (
        <StockAdjustModal
          product={adjustTarget}
          onClose={() => setAdjustTarget(null)}
          onSaved={() => { setAdjustTarget(null); load(); }}
        />
      )}
    </div>
  );
}

function WarrantyCard({ title, rows, tone }: { title: string; rows: WarrantyRow[]; tone: 'red' | 'amber' | 'emerald' }) {
  const badgeClass = tone === 'red' ? 'bg-red-100 text-red-600'
    : tone === 'amber' ? 'bg-amber-100 text-amber-700'
    : 'bg-emerald-100 text-emerald-700';
  const dateClass = tone === 'red' ? 'text-red-500 font-medium'
    : tone === 'amber' ? 'text-amber-600 font-medium'
    : 'text-emerald-600 font-medium';
  return (
    <div className="rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-stone-800">{title}</h2>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeClass}`}>{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-stone-400">Nenhum item.</p>
      ) : (
        <div className="divide-y divide-stone-50">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="font-medium text-stone-800 truncate">{r.name}</p>
                <p className="font-mono text-xs text-stone-400">{r.sku}</p>
              </div>
              <div className="text-right text-xs text-stone-500">
                <p>compra: {BRL_DATE(r.purchaseDate)}</p>
                <p className={dateClass}>
                  vence: {BRL_DATE(r.warrantyExpiresAt)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StockAdjustModal({ product, onClose, onSaved }: {
  product: StockProduct; onClose: () => void; onSaved: () => void;
}) {
  const [mode, setMode] = useState<'ENTRADA' | 'AJUSTE'>('ENTRADA');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMovements = useCallback(() => {
    api.get(`/admin/stock/${product.id}/movements`).then((res) => setMovements(res.data)).catch(() => setMovements([]));
  }, [product.id]);

  useEffect(() => { loadMovements(); }, [loadMovements]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post(`/admin/stock/${product.id}/adjust`, {
        mode,
        quantity: parseInt(quantity, 10),
        reason: reason || null,
      });
      onSaved();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Erro ao ajustar estoque');
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-100 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-stone-800">Ajustar estoque</h2>
            <p className="text-xs text-stone-400">{product.name} · atual: {product.stockQuantity} un</p>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <div className="flex gap-2">
            <button type="button" onClick={() => setMode('ENTRADA')}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                mode === 'ENTRADA' ? 'bg-gold text-white' : 'bg-stone-100 text-stone-600'
              }`}>Entrada (somar)</button>
            <button type="button" onClick={() => setMode('AJUSTE')}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                mode === 'AJUSTE' ? 'bg-gold text-white' : 'bg-stone-100 text-stone-600'
              }`}>Ajuste (definir total)</button>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">
              {mode === 'ENTRADA' ? 'Quantidade a adicionar' : 'Nova quantidade total'}
            </label>
            <input required type="number" step="1" min="0" value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-gold focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Motivo</label>
            <input value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder={mode === 'ENTRADA' ? 'compra fornecedor' : 'correção de inventário'}
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-gold focus:outline-none" />
          </div>

          {error && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-600">{error}</div>}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-stone-500">Cancelar</button>
            <button type="submit" disabled={loading}
              className="rounded-lg bg-gold px-5 py-2 text-sm font-semibold text-white hover:bg-gold-dark disabled:opacity-50 transition">
              {loading ? 'Salvando...' : 'Aplicar'}
            </button>
          </div>

          {/* Histórico de movimentação */}
          <div className="border-t border-stone-100 pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">Histórico</p>
            {movements.length === 0 ? (
              <p className="text-xs text-stone-400">Sem movimentações registradas.</p>
            ) : (
              <div className="max-h-40 space-y-1.5 overflow-y-auto">
                {movements.map((m) => (
                  <div key={m.id} className="flex items-center justify-between text-xs">
                    <span className="text-stone-500">
                      <span className={`font-medium ${m.delta >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {m.delta >= 0 ? '+' : ''}{m.delta}
                      </span>
                      {' '}· {m.type} {m.reason ? `· ${m.reason}` : ''}
                    </span>
                    <span className="text-stone-400">→ {m.resultingQuantity}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
