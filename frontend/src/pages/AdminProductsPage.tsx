import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../services/api';

interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  category: string;
  imageUrl: string | null;
  imageUrls: string[] | null;
  supplierPrice: number | null;
  costPrice: number;
  salePrice: number;
  status: string;
  stockStatus: string;
  stockQuantity: number;
  lowStockThreshold: number;
  supplierId: string | null;
  supplierName: string | null;
  purchaseDate: string | null;
  warrantyMonths: number | null;
  warrantyExpiresAt: string | null;
  onDemand: boolean | null;
  leadTimeDays: number | null;
}

interface SupplierOption {
  id: string;
  name: string;
}

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const STOCK_OPTIONS = [
  { value: 'DISPONIVEL', label: 'Disponível' },
  { value: 'BAIXO', label: 'Baixo' },
  { value: 'ESGOTADO', label: 'Esgotado' },
];

export function ProductsManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [stockFilter, setStockFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (categoryFilter) params.category = categoryFilter;
      if (stockFilter) params.stockStatus = stockFilter;
      // Endpoint admin: retorna a visão completa (custo, estoque, fornecedor).
      // O /products público não expõe mais esses campos sensíveis.
      const res = await api.get('/admin/products', { params });
      setProducts(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter, stockFilter]);

  useEffect(() => { load(); }, [load]);

  // Categorias ativas (fonte: cadastro de categorias) para o filtro.
  useEffect(() => {
    api.get('/admin/categories')
      .then((res) => setCategories(res.data.filter((c: any) => c.active).map((c: any) => c.name)))
      .catch(() => setCategories([]));
  }, []);

  async function handleDelete(id: string) {
    if (!confirm('Excluir este produto?')) return;
    try {
      await api.delete(`/admin/products/${id}`);
      load();
    } catch (e: any) {
      alert(e.response?.data?.error || 'Erro ao excluir');
    }
  }

  function openCreate() {
    setEditProduct(null);
    setShowModal(true);
  }

  function openEdit(p: Product) {
    setEditProduct(p);
    setShowModal(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-800">Admin — Produtos</h1>
          <p className="mt-1 text-sm text-stone-500">Gerencie catálogo, imagens e estoque.</p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-white hover:bg-gold-dark transition shadow-sm"
        >
          + Novo Produto
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="text"
          placeholder="Buscar por nome ou SKU..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-lg border border-stone-200 bg-white py-2 px-3 text-sm focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
        />
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm">
          <option value="">Todas categorias</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={stockFilter} onChange={(e) => setStockFilter(e.target.value)}
          className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm">
          <option value="">Todos estoques</option>
          {STOCK_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gold border-t-transparent" />
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-stone-200 bg-white py-16 text-center">
          <p className="text-sm text-stone-500">Nenhum produto cadastrado.</p>
        </div>
      ) : (
        <>
          {/* Tabela (desktop) */}
          <div className="hidden md:block overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-stone-100 text-sm">
                <thead className="bg-stone-50">
                  <tr>
                    {['SKU', 'Nome', 'Categoria', 'Custo', 'Venda', 'Estoque', 'Ações'].map((col) => (
                      <th key={col} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">{col === 'Estoque' ? 'Estoque (qtd)' : col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {products.map((p) => (
                    <tr key={p.id} className="hover:bg-stone-50 transition-colors">
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-medium text-stone-800">{p.sku}</td>
                      <td className="max-w-xs truncate px-4 py-3 font-medium text-stone-700">{p.name}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-stone-500">{p.category}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-stone-500">{BRL.format(p.costPrice)}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-stone-800">{BRL.format(p.salePrice)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs">
                        <span className="font-medium text-stone-700">{p.stockQuantity ?? 0}</span>
                        <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          p.stockStatus === 'ESGOTADO' ? 'bg-red-100 text-red-600'
                          : p.stockStatus === 'BAIXO' ? 'bg-amber-100 text-amber-700'
                          : 'bg-emerald-100 text-emerald-700'
                        }`}>{p.stockStatus}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => openEdit(p)} className="text-xs text-gold hover:underline">Editar</button>
                          <button onClick={() => handleDelete(p.id)} className="text-xs text-red-500 hover:underline">Excluir</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cards (mobile) */}
          <div className="md:hidden space-y-3">
            {products.map((p) => (
              <div key={p.id} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-stone-800 truncate">{p.name}</p>
                    <p className="font-mono text-xs text-stone-400 mt-0.5">{p.sku}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    p.stockStatus === 'ESGOTADO' ? 'bg-red-100 text-red-600'
                    : p.stockStatus === 'BAIXO' ? 'bg-amber-100 text-amber-700'
                    : 'bg-emerald-100 text-emerald-700'
                  }`}>{p.stockQuantity ?? 0} · {p.stockStatus}</span>
                </div>
                <div className="mt-3 flex items-center gap-4 text-sm">
                  <span className="text-stone-400 text-xs uppercase tracking-wide">{p.category}</span>
                  <span className="text-stone-500">Custo: {BRL.format(p.costPrice)}</span>
                  <span className="font-semibold text-stone-800">{BRL.format(p.salePrice)}</span>
                </div>
                <div className="mt-3 flex gap-4 border-t border-stone-100 pt-3">
                  <button onClick={() => openEdit(p)} className="text-sm text-gold font-medium">Editar</button>
                  <button onClick={() => handleDelete(p.id)} className="text-sm text-red-500 font-medium">Excluir</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {showModal && (
        <ProductModal
          product={editProduct}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}

// ---- Gallery Uploader (até 5 fotos; a 1ª é a capa) ----
const MAX_IMAGES = 5;

function GalleryUploader({ images, onChange }: {
  images: string[];
  onChange: (urls: string[]) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function uploadOne(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post('/admin/products/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.url as string;
  }

  async function handleFiles(files: FileList) {
    setUploadError(null);
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      setUploadError(`Máximo de ${MAX_IMAGES} fotos por produto.`);
      return;
    }
    const toUpload = Array.from(files).slice(0, remaining);
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of toUpload) {
        uploaded.push(await uploadOne(file));
      }
      onChange([...images, ...uploaded]);
      if (files.length > remaining) {
        setUploadError(`Só cabem mais ${remaining}. As demais foram ignoradas.`);
      }
    } catch (e: any) {
      setUploadError(e.response?.data?.error || 'Erro no upload');
    } finally {
      setUploading(false);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) handleFiles(e.target.files);
    e.target.value = '';
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  }

  function removeAt(idx: number) {
    onChange(images.filter((_, i) => i !== idx));
  }

  function move(idx: number, dir: -1 | 1) {
    const next = [...images];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  }

  function makeCover(idx: number) {
    if (idx === 0) return;
    const next = [...images];
    const [pick] = next.splice(idx, 1);
    next.unshift(pick);
    onChange(next);
  }

  const canAddMore = images.length < MAX_IMAGES;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-medium text-stone-600 uppercase tracking-wide">
          Fotos do produto
        </label>
        <span className="text-[11px] text-stone-400">{images.length}/{MAX_IMAGES} — a 1ª é a capa</span>
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {images.map((url, idx) => (
            <div key={`${url}-${idx}`}
              className={`group relative aspect-square overflow-hidden rounded-lg border ${idx === 0 ? 'border-gold ring-1 ring-gold' : 'border-stone-200'}`}>
              <img src={url} alt={`Foto ${idx + 1}`} className="h-full w-full object-cover" />
              {idx === 0 && (
                <span className="absolute left-1 top-1 rounded bg-gold px-1.5 py-0.5 text-[9px] font-semibold text-white">Capa</span>
              )}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/50 px-1 py-0.5 opacity-0 transition group-hover:opacity-100">
                <button type="button" title="Mover para trás" onClick={() => move(idx, -1)} disabled={idx === 0}
                  className="text-white disabled:opacity-30 px-1 text-xs">‹</button>
                {idx !== 0 && (
                  <button type="button" title="Definir como capa" onClick={() => makeCover(idx)}
                    className="text-white px-1 text-[9px] uppercase">Capa</button>
                )}
                <button type="button" title="Mover para frente" onClick={() => move(idx, 1)} disabled={idx === images.length - 1}
                  className="text-white disabled:opacity-30 px-1 text-xs">›</button>
              </div>
              <button type="button" title="Remover" onClick={() => removeAt(idx)}
                className="absolute right-1 top-1 rounded-full bg-white/80 px-1.5 text-xs text-red-500 opacity-0 transition group-hover:opacity-100 hover:bg-white">✕</button>
            </div>
          ))}
        </div>
      )}

      {canAddMore && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          className="relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-stone-200 bg-stone-50 p-4 transition hover:border-gold hover:bg-gold-light"
        >
          <div className="flex flex-col items-center gap-2 py-3 text-stone-400">
            <svg className="h-9 w-9" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M13.5 12h.008v.008H13.5V12zm-3 6.75h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H3.75A2.25 2.25 0 001.5 6.75v10.5a2.25 2.25 0 002.25 2.25z" />
            </svg>
            <p className="text-xs">Clique ou arraste fotos aqui</p>
            <p className="text-xs text-stone-300">JPG, PNG, WebP — máx 5 MB cada</p>
          </div>
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/70">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-gold border-t-transparent" />
            </div>
          )}
        </div>
      )}

      {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={handleChange} />
    </div>
  );
}

// ---- Product Modal ----
function ProductModal({ product, onClose, onSaved }: {
  product: Product | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = product !== null;
  const [form, setForm] = useState({
    sku: product?.sku ?? '',
    name: product?.name ?? '',
    description: product?.description ?? '',
    category: product?.category ?? '',
    supplierPrice: product?.supplierPrice != null ? product.supplierPrice.toString() : '',
    costPrice: product?.costPrice?.toString() ?? '',
    salePrice: product?.salePrice?.toString() ?? '',
    // % de lucro (margem sobre a venda): venda = custo / (1 - lucro/100).
    // Só dirige os cálculos na tela; não é persistido. Ao editar num produto
    // existente, deriva do custo/venda atuais; senão, default 85.
    profitPercent: (product?.costPrice && product?.salePrice && product.salePrice > 0)
      ? (Math.round((1 - product.costPrice / product.salePrice) * 1000) / 10).toString()
      : '85',
    stockQuantity: product?.stockQuantity != null ? product.stockQuantity.toString() : (isEdit ? '0' : ''),
    lowStockThreshold: product?.lowStockThreshold != null ? product.lowStockThreshold.toString() : '3',
    supplierId: product?.supplierId ?? '',
    purchaseDate: product?.purchaseDate ?? '',
    warrantyMonths: product?.warrantyMonths != null ? product.warrantyMonths.toString() : '12',
    onDemand: product?.onDemand ?? false,
    leadTimeDays: product?.leadTimeDays != null ? product.leadTimeDays.toString() : '',
  });
  const [images, setImages] = useState<string[]>(() => {
    if (product?.imageUrls && product.imageUrls.length > 0) return product.imageUrls;
    if (product?.imageUrl) return [product.imageUrl];
    return [];
  });
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get('/admin/suppliers').then((res) => setSuppliers(res.data)).catch(() => setSuppliers([]));
    // Categorias ativas (cadastro de categorias) para o seletor do produto.
    api.get('/admin/categories')
      .then((res) => setCategories(res.data.filter((c: any) => c.active).map((c: any) => c.name)))
      .catch(() => setCategories([]));
  }, []);

  // Status de estoque derivado (espelha a regra do backend) para pré-visualização.
  const qtyNum = parseInt(form.stockQuantity || '0', 10) || 0;
  const thresholdNum = parseInt(form.lowStockThreshold || '3', 10) || 0;
  const derivedStatus = qtyNum <= 0 ? 'ESGOTADO' : qtyNum <= thresholdNum ? 'BAIXO' : 'DISPONIVEL';

  // Margens calculadas para exibição.
  const supplierNum = parseFloat(form.supplierPrice || '');
  const costNum = parseFloat(form.costPrice || '');
  const saleNum = parseFloat(form.salePrice || '');
  // Variação do custo pago sobre o preço de tabela do fornecedor.
  // Positivo = pagamos ACIMA da tabela (acréscimo); negativo = ABAIXO (desconto).
  const purchaseVariation = (!isNaN(supplierNum) && supplierNum > 0 && !isNaN(costNum))
    ? (costNum / supplierNum - 1) * 100 : null;
  const saleMargin = (!isNaN(costNum) && costNum > 0 && !isNaN(saleNum))
    ? (1 - costNum / saleNum) * 100 : null;

  // ── Cálculo em cascata dos valores (todos os campos continuam editáveis) ──
  // Regras: Custo pago = Preço fornecedor / 2; Venda = Custo / (1 - lucro%/100).
  // Arredonda a 2 casas; string vazia quando não há base para calcular.
  const round2 = (n: number) => (Math.round(n * 100) / 100).toString();

  function saleFromCost(cost: number, profit: number): string {
    if (isNaN(cost) || isNaN(profit) || profit >= 100) return '';
    return round2(cost / (1 - profit / 100));
  }

  // Preço fornecedor muda → custo = metade; venda recalculada pelo lucro atual.
  function handleSupplierChange(value: string) {
    const supplier = parseFloat(value);
    const profit = parseFloat(form.profitPercent);
    if (!isNaN(supplier)) {
      const cost = Math.round(supplier * 0.5 * 100) / 100;
      setForm((f) => ({ ...f, supplierPrice: value, costPrice: round2(cost), salePrice: saleFromCost(cost, profit) }));
    } else {
      setForm((f) => ({ ...f, supplierPrice: value }));
    }
  }

  // Custo pago editado → venda recalculada pelo lucro atual (mantém o lucro%).
  function handleCostChange(value: string) {
    const cost = parseFloat(value);
    const profit = parseFloat(form.profitPercent);
    setForm((f) => ({ ...f, costPrice: value, salePrice: !isNaN(cost) ? saleFromCost(cost, profit) : f.salePrice }));
  }

  // % de lucro editado → venda recalculada a partir do custo atual.
  function handleProfitChange(value: string) {
    const profit = parseFloat(value);
    const cost = parseFloat(form.costPrice);
    setForm((f) => ({ ...f, profitPercent: value, salePrice: !isNaN(cost) ? saleFromCost(cost, profit) : f.salePrice }));
  }

  // Venda editada na mão → mantém o valor; o lucro% passa a refletir o resultado.
  function handleSaleChange(value: string) {
    const sale = parseFloat(value);
    const cost = parseFloat(form.costPrice);
    setForm((f) => ({
      ...f,
      salePrice: value,
      profitPercent: (!isNaN(sale) && sale > 0 && !isNaN(cost))
        ? (Math.round((1 - cost / sale) * 1000) / 10).toString()
        : f.profitPercent,
    }));
  }

  // Vencimento de garantia previsto.
  const warrantyExpiry = (() => {
    if (!form.purchaseDate) return null;
    const months = parseInt(form.warrantyMonths || '12', 10) || 0;
    const d = new Date(form.purchaseDate + 'T00:00:00');
    if (isNaN(d.getTime())) return null;
    d.setMonth(d.getMonth() + months);
    return d.toLocaleDateString('pt-BR');
  })();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const body = {
      sku: form.sku,
      name: form.name,
      category: form.category,
      description: form.description || null,
      supplierPrice: form.supplierPrice ? parseFloat(form.supplierPrice) : null,
      costPrice: parseFloat(form.costPrice),
      salePrice: parseFloat(form.salePrice),
      stockQuantity: form.stockQuantity !== '' ? parseInt(form.stockQuantity, 10) : 0,
      lowStockThreshold: form.lowStockThreshold !== '' ? parseInt(form.lowStockThreshold, 10) : 3,
      supplierId: form.supplierId || null,
      purchaseDate: form.purchaseDate || null,
      warrantyMonths: form.warrantyMonths !== '' ? parseInt(form.warrantyMonths, 10) : 12,
      onDemand: form.onDemand,
      leadTimeDays: form.onDemand && form.leadTimeDays !== '' ? parseInt(form.leadTimeDays, 10) : null,
      imageUrls: images,
      imageUrl: images[0] || null,
    };

    try {
      if (isEdit) {
        await api.put(`/admin/products/${product.id}`, body);
      } else {
        await api.post('/admin/products', body);
      }
      onSaved();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Erro ao salvar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-100 px-6 py-4">
          <h2 className="text-base font-semibold text-stone-800">
            {isEdit ? 'Editar Produto' : 'Novo Produto'}
          </h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          {/* Galeria de fotos */}
          <GalleryUploader images={images} onChange={setImages} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">SKU *</label>
              <input required disabled={isEdit} value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })}
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm font-mono disabled:bg-stone-50 focus:border-gold focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Categoria</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-gold focus:outline-none">
                <option value="" disabled>Selecione...</option>
                {/* Garante que a categoria atual do produto apareça mesmo se ela
                    tiver sido inativada/renomeada no cadastro. */}
                {(form.category && !categories.includes(form.category)
                  ? [form.category, ...categories]
                  : categories
                ).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Nome *</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-gold focus:outline-none" />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Descrição</label>
            <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Detalhes do produto..."
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm resize-none focus:border-gold focus:outline-none" />
          </div>

          {/* Valores: fornecedor (tabela) / custo (pago) / % lucro / venda (cliente).
              Custo pago = fornecedor / 2; Venda = custo / (1 - lucro%/100). Editáveis. */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="flex flex-col">
              <label className="flex-1 text-xs font-medium text-stone-600 mb-1 leading-tight">Preço fornecedor (R$)</label>
              <input type="number" step="0.01" min="0" value={form.supplierPrice}
                onChange={(e) => handleSupplierChange(e.target.value)}
                placeholder="tabela"
                className="mt-auto w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-gold focus:outline-none" />
            </div>
            <div className="flex flex-col">
              <label className="flex-1 text-xs font-medium text-stone-600 mb-1 leading-tight">Custo pago (R$) *</label>
              <input required type="number" step="0.01" min="0" value={form.costPrice}
                onChange={(e) => handleCostChange(e.target.value)}
                className="mt-auto w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-gold focus:outline-none" />
            </div>
            <div className="flex flex-col">
              <label className="flex-1 text-xs font-medium text-stone-600 mb-1 leading-tight">% de lucro</label>
              <input type="number" step="0.1" min="0" max="99.9" value={form.profitPercent}
                onChange={(e) => handleProfitChange(e.target.value)}
                placeholder="85"
                className="mt-auto w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-gold focus:outline-none" />
            </div>
            <div className="flex flex-col">
              <label className="flex-1 text-xs font-medium text-stone-600 mb-1 leading-tight">Venda (R$) *</label>
              <input required type="number" step="0.01" min="0" value={form.salePrice}
                onChange={(e) => handleSaleChange(e.target.value)}
                className="mt-auto w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-gold focus:outline-none" />
            </div>
          </div>

          {(purchaseVariation !== null || saleMargin !== null) && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-stone-500">
              {purchaseVariation !== null && (
                purchaseVariation > 0 ? (
                  <span>Acréscimo na compra: <strong className="text-red-500">+{purchaseVariation.toFixed(1)}%</strong> <span className="text-stone-400">(pagou acima da tabela)</span></span>
                ) : purchaseVariation < 0 ? (
                  <span>Desconto na compra: <strong className="text-emerald-600">{Math.abs(purchaseVariation).toFixed(1)}%</strong> <span className="text-stone-400">(pagou abaixo da tabela)</span></span>
                ) : (
                  <span>Compra: <strong className="text-stone-600">no preço de tabela</strong></span>
                )
              )}
              {saleMargin !== null && (
                <span>Margem na venda: <strong className={saleMargin >= 0 ? 'text-emerald-600' : 'text-red-500'}>{saleMargin.toFixed(1)}%</strong></span>
              )}
            </div>
          )}

          {/* Sob encomenda */}
          <div className="rounded-lg border border-stone-200 p-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.onDemand}
                onChange={(e) => setForm({ ...form, onDemand: e.target.checked })}
                className="h-4 w-4 rounded border-stone-300 text-gold focus:ring-gold" />
              <span className="text-sm font-medium text-stone-700">Produto sob encomenda</span>
            </label>
            <p className="mt-1 text-[11px] text-stone-500">
              Anunciado no catálogo mesmo sem estoque. Não consome estoque nem entra nos alertas de reposição.
              O <strong>preço de custo</strong> é uma estimativa do que será pago ao fornecedor.
            </p>
            {form.onDemand && (
              <div className="mt-3">
                <label className="block text-xs font-medium text-stone-600 mb-1">Prazo de entrega (dias úteis)</label>
                <input type="number" step="1" min="0" value={form.leadTimeDays}
                  onChange={(e) => setForm({ ...form, leadTimeDays: e.target.value })}
                  placeholder="Ex: 10"
                  className="w-full sm:w-48 rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-gold focus:outline-none" />
                <p className="mt-1 text-[10px] text-stone-400">Mostrado no catálogo como "Entrega em até X dias úteis".</p>
              </div>
            )}
          </div>

          {/* Estoque: quantidade + limiar; status é derivado. Oculto p/ sob encomenda. */}
          {!form.onDemand && (
          <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Quantidade em estoque</label>
              <input type="number" step="1" min="0" value={form.stockQuantity}
                onChange={(e) => setForm({ ...form, stockQuantity: e.target.value })}
                placeholder="0"
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-gold focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Alerta de estoque baixo (≤)</label>
              <input type="number" step="1" min="0" value={form.lowStockThreshold}
                onChange={(e) => setForm({ ...form, lowStockThreshold: e.target.value })}
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-gold focus:outline-none" />
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-stone-500">
            <span>Situação (automática):</span>
            <span className={`rounded-full px-2 py-0.5 font-medium ${
              derivedStatus === 'ESGOTADO' ? 'bg-red-100 text-red-600'
              : derivedStatus === 'BAIXO' ? 'bg-amber-100 text-amber-700'
              : 'bg-emerald-100 text-emerald-700'
            }`}>{derivedStatus}</span>
          </div>
          </>
          )}

          {/* Fornecedor + garantia */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Fornecedor</label>
              <select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-gold focus:outline-none">
                <option value="">— nenhum —</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Data da compra (garantia)</label>
              <input type="date" value={form.purchaseDate}
                onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })}
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-gold focus:outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Garantia (meses)</label>
              <input type="number" step="1" min="0" value={form.warrantyMonths}
                onChange={(e) => setForm({ ...form, warrantyMonths: e.target.value })}
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-gold focus:outline-none" />
            </div>
            {warrantyExpiry && (
              <div className="flex items-end pb-2 text-[11px] text-stone-500">
                Garantia até <strong className="ml-1 text-stone-700">{warrantyExpiry}</strong>
              </div>
            )}
          </div>

          {error && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-600">{error}</div>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-stone-500 hover:text-stone-700">Cancelar</button>
            <button type="submit" disabled={loading}
              className="rounded-lg bg-gold px-5 py-2 text-sm font-semibold text-white hover:bg-gold-dark disabled:opacity-50 transition">
              {loading ? 'Salvando...' : isEdit ? 'Salvar' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Mantido como default export por compatibilidade; a página agora vive dentro
// da aba Estoque (StockPage) como a sub-aba "Produtos".
export default ProductsManager;
