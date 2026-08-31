import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import { ProductsManager } from './AdminProductsPage';

type StockTab = 'produtos' | 'reposicao' | 'garantia';

export default function StockPage() {
  const [tab, setTab] = useState<StockTab>('produtos');

  const tabs: { key: StockTab; label: string }[] = [
    { key: 'produtos', label: 'Produtos' },
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
      {(tab === 'reposicao' || tab === 'garantia') && <StockAlertsTab tab={tab} />}
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
