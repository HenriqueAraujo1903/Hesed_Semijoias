import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import { useFeedback } from '../components/Feedback';

interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  notes: string | null;
  createdAt: string;
}

export default function SuppliersPage() {
  const fb = useFeedback();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Supplier | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      const res = await api.get('/admin/suppliers', { params });
      setSuppliers(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: string, name: string) {
    if (!(await fb.confirm({ message: `Excluir o fornecedor ${name}?`, danger: true, confirmLabel: 'Excluir' }))) return;
    try {
      await api.delete(`/admin/suppliers/${id}`);
      fb.success('Excluído com sucesso.');
      load();
    } catch (e: any) {
      fb.error(e.response?.data?.error || 'Erro ao excluir');
    }
  }

  function openCreate() { setEditTarget(null); setShowForm(true); }
  function openEdit(s: Supplier) { setEditTarget(s); setShowForm(true); }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-stone-500 dark:text-charcoal-300">Cadastre de quem você compra as peças.</p>
        <button onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-white hover:bg-gold-dark transition shadow-sm shrink-0">
          + Novo Fornecedor
        </button>
      </div>

      <div className="relative max-w-md">
        <input type="text" placeholder="Buscar por nome..." value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-stone-200 dark:border-charcoal-600 bg-white dark:bg-charcoal-900 py-2 px-3 text-sm focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gold border-t-transparent" />
        </div>
      ) : suppliers.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-stone-200 dark:border-charcoal-600 bg-white dark:bg-charcoal-800 py-16 text-center">
          <p className="text-sm text-stone-500 dark:text-charcoal-300">Nenhum fornecedor cadastrado.</p>
        </div>
      ) : (
        <>
          {/* Tabela (desktop) */}
          <div className="hidden md:block overflow-hidden rounded-2xl border border-stone-200 dark:border-charcoal-600 bg-white dark:bg-charcoal-800 shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-stone-100 dark:divide-charcoal-700 text-sm">
                <thead className="bg-stone-50 dark:bg-charcoal-700/50">
                  <tr>
                    {['Nome', 'Telefone', 'E-mail', 'Site', 'Ações'].map((col) => (
                      <th key={col} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-charcoal-300">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50 dark:divide-charcoal-700">
                  {suppliers.map((s) => (
                    <tr key={s.id} className="hover:bg-stone-50 dark:hover:bg-charcoal-700/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-stone-800 dark:text-cream-200">{s.name}</td>
                      <td className="px-4 py-3 text-stone-600 dark:text-charcoal-200">{s.phone || '—'}</td>
                      <td className="px-4 py-3 text-stone-500 dark:text-charcoal-300 max-w-[200px] truncate">{s.email || '—'}</td>
                      <td className="px-4 py-3 text-stone-500 dark:text-charcoal-300 max-w-[200px] truncate">
                        {s.website ? (
                          <a href={s.website} target="_blank" rel="noopener noreferrer" className="text-gold hover:underline">
                            {s.website.replace(/^https?:\/\//, '')}
                          </a>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => openEdit(s)} className="text-xs text-gold hover:underline">Editar</button>
                          <button onClick={() => handleDelete(s.id, s.name)} className="text-xs text-red-500 hover:underline">Excluir</button>
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
            {suppliers.map((s) => (
              <div key={s.id} className="rounded-2xl border border-stone-200 dark:border-charcoal-600 bg-white dark:bg-charcoal-800 p-4 shadow-sm">
                <p className="font-medium text-stone-800 dark:text-cream-200">{s.name}</p>
                <div className="mt-2 space-y-1 text-sm text-stone-500 dark:text-charcoal-300">
                  <p>{s.phone || '—'}</p>
                  <p className="truncate">{s.email || '—'}</p>
                  {s.website && (
                    <a href={s.website} target="_blank" rel="noopener noreferrer" className="block truncate text-gold">
                      {s.website.replace(/^https?:\/\//, '')}
                    </a>
                  )}
                </div>
                <div className="mt-3 flex gap-4 border-t border-stone-100 dark:border-charcoal-700 pt-3">
                  <button onClick={() => openEdit(s)} className="text-sm text-gold font-medium">Editar</button>
                  <button onClick={() => handleDelete(s.id, s.name)} className="text-sm text-red-500 font-medium">Excluir</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {showForm && (
        <SupplierModal
          supplier={editTarget}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); fb.success('Fornecedor salvo com sucesso.'); load(); }}
        />
      )}
    </div>
  );
}

function SupplierModal({ supplier, onClose, onSaved }: {
  supplier: Supplier | null; onClose: () => void; onSaved: () => void;
}) {
  const isEdit = supplier !== null;
  const [form, setForm] = useState({
    name: supplier?.name ?? '',
    phone: supplier?.phone ?? '',
    email: supplier?.email ?? '',
    website: supplier?.website ?? '',
    notes: supplier?.notes ?? '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const body = {
      name: form.name,
      phone: form.phone || null,
      email: form.email || null,
      website: form.website || null,
      notes: form.notes || null,
    };

    try {
      if (isEdit) {
        await api.put(`/admin/suppliers/${supplier.id}`, body);
      } else {
        await api.post('/admin/suppliers', body);
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
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-charcoal-800 shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-100 dark:border-charcoal-700 px-6 py-4">
          <h2 className="text-base font-semibold text-stone-800 dark:text-cream-200">
            {isEdit ? 'Editar Fornecedor' : 'Novo Fornecedor'}
          </h2>
          <button onClick={onClose} className="text-stone-400 dark:text-charcoal-300 hover:text-stone-600 dark:hover:text-charcoal-100">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <div>
            <label className="block text-xs font-medium text-stone-600 dark:text-charcoal-200 mb-1">Nome *</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-stone-200 dark:border-charcoal-600 px-3 py-2 text-sm focus:border-gold focus:outline-none" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-600 dark:text-charcoal-200 mb-1">Telefone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="(11) 99999-9999"
                className="w-full rounded-lg border border-stone-200 dark:border-charcoal-600 px-3 py-2 text-sm focus:border-gold focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 dark:text-charcoal-200 mb-1">E-mail</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-lg border border-stone-200 dark:border-charcoal-600 px-3 py-2 text-sm focus:border-gold focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 dark:text-charcoal-200 mb-1">Site do fornecedor</label>
            <input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })}
              placeholder="https://..."
              className="w-full rounded-lg border border-stone-200 dark:border-charcoal-600 px-3 py-2 text-sm focus:border-gold focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 dark:text-charcoal-200 mb-1">Observações</label>
            <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full rounded-lg border border-stone-200 dark:border-charcoal-600 px-3 py-2 text-sm resize-none focus:border-gold focus:outline-none" />
          </div>

          {error && <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 p-3 text-xs text-red-600 dark:text-red-400">{error}</div>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-stone-500 dark:text-charcoal-300">Cancelar</button>
            <button type="submit" disabled={loading}
              className="rounded-lg bg-gold px-5 py-2 text-sm font-semibold text-white hover:bg-gold-dark disabled:opacity-50 transition">
              {loading ? 'Salvando...' : isEdit ? 'Salvar' : 'Cadastrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
