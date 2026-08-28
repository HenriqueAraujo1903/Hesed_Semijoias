import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';

interface Promotion {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  productImageUrl: string | null;
  originalPrice: number;
  title: string;
  subtitle: string | null;
  discountPercent: number | null;
  promoPrice: number | null;
  bannerUrl: string | null;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  sortOrder: number;
  createdAt: string;
}

interface Product {
  id: string;
  sku: string;
  name: string;
  salePrice: number;
}

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export default function AdminPromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Promotion | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const prodRes = await api.get('/products/catalog');
      setProducts(prodRes.data);
    } catch (e) {
      console.error('Erro ao carregar produtos:', e);
    }
    try {
      const promoRes = await api.get('/admin/promotions');
      setPromotions(promoRes.data);
    } catch (e) {
      console.error('Erro ao carregar promoções:', e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta promoção?')) return;
    try {
      await api.delete(`/admin/promotions/${id}`);
      load();
    } catch (e: any) {
      alert(e.response?.data?.error || 'Erro ao excluir');
    }
  }

  async function handleToggle(id: string) {
    try {
      await api.patch(`/admin/promotions/${id}/toggle`);
      load();
    } catch (e: any) {
      alert(e.response?.data?.error || 'Erro ao alterar status');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-800 dark:text-cream-200 font-serif">Promoções</h1>
          <p className="mt-1 text-sm text-stone-500 dark:text-charcoal-400">
            Gerencie as promoções exibidas no carrossel do catálogo.
          </p>
        </div>
        <button
          onClick={() => { setEditTarget(null); setShowModal(true); }}
          className="btn-primary"
        >
          + Nova Promoção
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gold border-t-transparent" />
        </div>
      ) : promotions.length === 0 ? (
        <div className="card py-16 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gold-50 dark:bg-gold-900/20 mb-4">
            <svg className="w-6 h-6 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
            </svg>
          </div>
          <p className="text-sm text-stone-500 dark:text-charcoal-400">Nenhuma promoção criada.</p>
          <p className="text-xs text-stone-400 dark:text-charcoal-500 mt-1">
            Crie promoções para aparecerem no carrossel do catálogo.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {promotions.map((promo) => (
            <div key={promo.id} className={`card p-5 flex flex-col sm:flex-row items-start gap-4 transition-opacity ${!promo.active ? 'opacity-50' : ''}`}>
              {/* Product image */}
              <div className="w-16 h-16 rounded-xl bg-stone-100 dark:bg-charcoal-700 overflow-hidden shrink-0">
                {promo.productImageUrl ? (
                  <img src={promo.productImageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-stone-400 font-mono">
                    {promo.productSku}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-semibold text-stone-800 dark:text-cream-200 truncate">{promo.title}</h3>
                  <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    promo.active
                      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                      : 'bg-stone-100 dark:bg-charcoal-700 text-stone-500 dark:text-charcoal-400'
                  }`}>
                    {promo.active ? 'Ativa' : 'Inativa'}
                  </span>
                </div>
                <p className="text-xs text-stone-500 dark:text-charcoal-400 truncate">
                  {promo.productName} • {promo.productSku}
                </p>
                <div className="flex items-center gap-3 mt-2">
                  {promo.promoPrice && (
                    <span className="text-sm font-semibold text-gold">{BRL.format(promo.promoPrice)}</span>
                  )}
                  {promo.discountPercent && (
                    <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full font-medium">
                      -{promo.discountPercent}%
                    </span>
                  )}
                  {promo.originalPrice && promo.promoPrice && (
                    <span className="text-xs text-stone-400 line-through">{BRL.format(promo.originalPrice)}</span>
                  )}
                </div>
                {promo.subtitle && (
                  <p className="text-xs text-stone-400 dark:text-charcoal-500 mt-1 truncate">{promo.subtitle}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => handleToggle(promo.id)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-stone-200 dark:border-charcoal-600 text-stone-500 dark:text-charcoal-400 hover:border-gold hover:text-gold transition-all">
                  {promo.active ? 'Desativar' : 'Ativar'}
                </button>
                <button onClick={() => { setEditTarget(promo); setShowModal(true); }}
                  className="text-xs text-gold hover:underline">Editar</button>
                <button onClick={() => handleDelete(promo.id)}
                  className="text-xs text-red-500 hover:underline">Excluir</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <PromotionModal
          promotion={editTarget}
          products={products}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}

// ─── Promotion Modal ─────────────────────────────────────────────────────────

function PromotionModal({ promotion, products, onClose, onSaved }: {
  promotion: Promotion | null;
  products: Product[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = promotion !== null;
  const [form, setForm] = useState({
    productId: promotion?.productId ?? '',
    title: promotion?.title ?? '',
    subtitle: promotion?.subtitle ?? '',
    discountPercent: promotion?.discountPercent?.toString() ?? '',
    promoPrice: promotion?.promoPrice?.toString() ?? '',
    bannerUrl: promotion?.bannerUrl ?? '',
    active: promotion?.active ?? true,
    startsAt: promotion?.startsAt ? promotion.startsAt.slice(0, 16) : '',
    endsAt: promotion?.endsAt ? promotion.endsAt.slice(0, 16) : '',
    sortOrder: promotion?.sortOrder?.toString() ?? '0',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-calculate promo price when discount changes
  const selectedProduct = products.find(p => p.id === form.productId);
  
  function handleDiscountChange(value: string) {
    setForm(prev => {
      const updated = { ...prev, discountPercent: value };
      if (selectedProduct && value) {
        const discount = parseFloat(value);
        if (!isNaN(discount) && discount > 0 && discount <= 100) {
          updated.promoPrice = (selectedProduct.salePrice * (1 - discount / 100)).toFixed(2);
        }
      }
      return updated;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const body = {
      productId: form.productId,
      title: form.title,
      subtitle: form.subtitle || null,
      discountPercent: form.discountPercent ? parseFloat(form.discountPercent) : null,
      promoPrice: form.promoPrice ? parseFloat(form.promoPrice) : null,
      bannerUrl: form.bannerUrl || null,
      active: form.active,
      startsAt: form.startsAt ? (form.startsAt.length === 16 ? form.startsAt + ':00' : form.startsAt) : null,
      endsAt: form.endsAt ? (form.endsAt.length === 16 ? form.endsAt + ':00' : form.endsAt) : null,
      sortOrder: parseInt(form.sortOrder) || 0,
    };

    try {
      if (isEdit) {
        await api.put(`/admin/promotions/${promotion.id}`, body);
      } else {
        await api.post('/admin/promotions', body);
      }
      onSaved();
    } catch (e: any) {
      const msg = e.response?.data?.error 
        || e.response?.data?.message 
        || (typeof e.response?.data === 'string' ? e.response.data : null)
        || e.message 
        || 'Erro ao salvar';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-charcoal-800 shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-100 dark:border-charcoal-700 px-6 py-4">
          <h2 className="text-base font-semibold text-stone-800 dark:text-cream-200">
            {isEdit ? 'Editar Promoção' : 'Nova Promoção'}
          </h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 dark:hover:text-charcoal-200">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          {/* Product select */}
          <div>
            <label className="block text-xs font-medium text-stone-600 dark:text-charcoal-400 mb-1 uppercase tracking-wide">
              Produto *
            </label>
            <select required value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}
              className="input-field">
              <option value="">Selecione um produto...</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.sku} — {p.name} ({BRL.format(p.salePrice)})</option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-stone-600 dark:text-charcoal-400 mb-1 uppercase tracking-wide">
              Título da Promoção *
            </label>
            <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Ex: Oferta Especial de Verão"
              className="input-field" />
          </div>

          {/* Subtitle */}
          <div>
            <label className="block text-xs font-medium text-stone-600 dark:text-charcoal-400 mb-1 uppercase tracking-wide">
              Subtítulo
            </label>
            <input value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
              placeholder="Ex: Válido até domingo"
              className="input-field" />
          </div>

          {/* Discount + Promo Price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-600 dark:text-charcoal-400 mb-1 uppercase tracking-wide">
                Desconto (%)
              </label>
              <input type="number" step="0.5" min="0" max="100" value={form.discountPercent}
                onChange={(e) => handleDiscountChange(e.target.value)}
                placeholder="Ex: 20"
                className="input-field" />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 dark:text-charcoal-400 mb-1 uppercase tracking-wide">
                Preço Promo (R$)
              </label>
              <input type="number" step="0.01" min="0" value={form.promoPrice}
                onChange={(e) => setForm({ ...form, promoPrice: e.target.value })}
                placeholder="Auto-calculado"
                className="input-field" />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-600 dark:text-charcoal-400 mb-1 uppercase tracking-wide">
                Início (opcional)
              </label>
              <input type="datetime-local" value={form.startsAt}
                onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                className="input-field" />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 dark:text-charcoal-400 mb-1 uppercase tracking-wide">
                Fim (opcional)
              </label>
              <input type="datetime-local" value={form.endsAt}
                onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                className="input-field" />
            </div>
          </div>

          {/* Order + Active */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-600 dark:text-charcoal-400 mb-1 uppercase tracking-wide">
                Ordem no carrossel
              </label>
              <input type="number" min="0" value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                className="input-field" />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  className="w-4 h-4 rounded border-stone-300 text-gold focus:ring-gold" />
                <span className="text-sm text-stone-600 dark:text-charcoal-300">Ativa</span>
              </label>
            </div>
          </div>

          {error && <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 p-3 text-xs text-red-600 dark:text-red-400">{error}</div>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Salvando...' : isEdit ? 'Salvar' : 'Criar Promoção'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
