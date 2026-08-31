import { useEffect, useState } from 'react';
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

const STOCK_STYLES: Record<string, { label: string; className: string }> = {
  DISPONIVEL: { label: 'Disponível', className: 'bg-emerald-100 text-emerald-700' },
  BAIXO: { label: 'Estoque Baixo', className: 'bg-amber-100 text-amber-700' },
  ESGOTADO: { label: 'Esgotado', className: 'bg-red-100 text-red-600' },
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadProducts();
  }, [search]);

  async function loadProducts() {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      const res = await api.get('/products', { params });
      setProducts(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-800">Estoque de Produtos</h1>
        <p className="mt-1 text-sm text-stone-500">Visualize o inventário de semijoias.</p>
      </div>

      <div className="relative max-w-md">
        <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          type="text"
          placeholder="Buscar por nome ou SKU..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-stone-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gold border-t-transparent" />
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-stone-200 bg-white py-16 text-center">
          <p className="text-sm text-stone-500">Nenhum produto encontrado.</p>
        </div>
      ) : (
        <>
          {/* Tabela (desktop) */}
          <div className="hidden md:block overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-stone-100 text-sm">
                <thead className="bg-stone-50">
                  <tr>
                    {['SKU', 'Nome', 'Categoria', 'Preço Venda', 'Estoque'].map((col) => (
                      <th key={col} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {products.map((p) => {
                    const stock = STOCK_STYLES[p.stockStatus] ?? STOCK_STYLES.DISPONIVEL;
                    return (
                      <tr key={p.id} className="hover:bg-stone-50 transition-colors">
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-medium text-stone-800">{p.sku}</td>
                        <td className="max-w-xs truncate px-4 py-3 font-medium text-stone-700">{p.name}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-stone-500">{p.category}</td>
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-stone-800">{BRL.format(p.salePrice)}</td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${stock.className}`}>
                            {stock.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="border-t border-stone-100 bg-stone-50 px-4 py-2 text-right text-xs text-stone-400">
              {products.length} {products.length === 1 ? 'produto' : 'produtos'}
            </div>
          </div>

          {/* Cards (mobile) */}
          <div className="md:hidden space-y-3">
            {products.map((p) => {
              const stock = STOCK_STYLES[p.stockStatus] ?? STOCK_STYLES.DISPONIVEL;
              return (
                <div key={p.id} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-stone-800 truncate">{p.name}</p>
                      <p className="font-mono text-xs text-stone-400 mt-0.5">{p.sku}</p>
                    </div>
                    <span className={`shrink-0 inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-medium ${stock.className}`}>
                      {stock.label}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-stone-400 text-xs uppercase tracking-wide">{p.category}</span>
                    <span className="font-semibold text-stone-800">{BRL.format(p.salePrice)}</span>
                  </div>
                </div>
              );
            })}
            <p className="text-right text-xs text-stone-400">
              {products.length} {products.length === 1 ? 'produto' : 'produtos'}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
