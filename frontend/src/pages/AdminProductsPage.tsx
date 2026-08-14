import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../services/api';

interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  category: string;
  imageUrl: string | null;
  costPrice: number;
  salePrice: number;
  status: string;
  stockStatus: string;
}

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const CATEGORIES = ['Brinco', 'Brinco / Trio', 'Conjunto', 'Corrente', 'Gargantilha', 'Outro'];
const STOCK_OPTIONS = [
  { value: 'DISPONIVEL', label: 'Disponível' },
  { value: 'BAIXO', label: 'Baixo' },
  { value: 'ESGOTADO', label: 'Esgotado' },
];

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
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
      const res = await api.get('/products', { params });
      setProducts(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter, stockFilter]);

  useEffect(() => { load(); }, [load]);

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
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
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
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-stone-100 text-sm">
              <thead className="bg-stone-50">
                <tr>
                  {['SKU', 'Nome', 'Categoria', 'Custo', 'Venda', 'Estoque', 'Ações'].map((col) => (
                    <th key={col} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">{col}</th>
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
                    <td className="whitespace-nowrap px-4 py-3 text-xs">{p.stockStatus}</td>
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

// ---- Image Uploader ----
function ImageUploader({ currentUrl, onUploaded }: {
  currentUrl: string | null;
  onUploaded: (url: string) => void;
}) {
  const [preview, setPreview] = useState<string | null>(currentUrl);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setUploadError(null);
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/admin/products/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const url = res.data.url;
      setPreview(url);
      onUploaded(url);
    } catch (e: any) {
      setUploadError(e.response?.data?.error || 'Erro no upload');
    } finally {
      setUploading(false);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-stone-600 uppercase tracking-wide">
        Imagem do produto
      </label>
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className="relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-stone-200 bg-stone-50 p-4 transition hover:border-gold hover:bg-gold-light"
      >
        {preview ? (
          <div className="relative h-36 w-36 overflow-hidden rounded-lg">
            <img src={preview} alt="Preview" className="h-full w-full object-cover" />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-4 text-stone-400">
            <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M13.5 12h.008v.008H13.5V12zm-3 6.75h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H3.75A2.25 2.25 0 001.5 6.75v10.5a2.25 2.25 0 002.25 2.25z" />
            </svg>
            <p className="text-xs">Clique ou arraste a foto aqui</p>
            <p className="text-xs text-stone-300">JPG, PNG, WebP — máx 5 MB</p>
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/70">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-gold border-t-transparent" />
          </div>
        )}
      </div>
      {preview && (
        <div className="flex items-center gap-2">
          <p className="flex-1 truncate text-xs text-stone-400">{preview}</p>
          <button type="button" onClick={() => { setPreview(null); onUploaded(''); }}
            className="text-xs text-red-400 hover:text-red-600">Remover</button>
        </div>
      )}
      {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleChange} />
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
    category: product?.category ?? 'Brinco',
    costPrice: product?.costPrice?.toString() ?? '',
    salePrice: product?.salePrice?.toString() ?? '',
    stockStatus: product?.stockStatus ?? 'DISPONIVEL',
    imageUrl: product?.imageUrl ?? '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const body = {
      ...form,
      costPrice: parseFloat(form.costPrice),
      salePrice: parseFloat(form.salePrice),
      description: form.description || null,
      imageUrl: form.imageUrl || null,
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
          {/* Image Upload */}
          <ImageUploader
            currentUrl={form.imageUrl || null}
            onUploaded={(url) => setForm({ ...form, imageUrl: url })}
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">SKU *</label>
              <input required disabled={isEdit} value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })}
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm font-mono disabled:bg-stone-50 focus:border-gold focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Categoria</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-gold focus:outline-none">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Custo (R$) *</label>
              <input required type="number" step="0.01" min="0" value={form.costPrice}
                onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-gold focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Venda (R$) *</label>
              <input required type="number" step="0.01" min="0" value={form.salePrice}
                onChange={(e) => setForm({ ...form, salePrice: e.target.value })}
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-gold focus:outline-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Status de Estoque</label>
            <select value={form.stockStatus} onChange={(e) => setForm({ ...form, stockStatus: e.target.value })}
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-gold focus:outline-none">
              <option value="DISPONIVEL">Disponível</option>
              <option value="BAIXO">Baixo</option>
              <option value="ESGOTADO">Esgotado</option>
            </select>
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
