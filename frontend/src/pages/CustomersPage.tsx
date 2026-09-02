import { useCallback, useEffect, useState, type FormEvent } from 'react';
import api from '../services/api';

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  createdAt: string;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Customer | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      const res = await api.get('/admin/customers', { params });
      setCustomers(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Excluir o cliente ${name}?`)) return;
    try {
      await api.delete(`/admin/customers/${id}`);
      load();
    } catch (e: any) {
      alert(e.response?.data?.error || 'Erro ao excluir');
    }
  }

  function openCreate() { setEditTarget(null); setShowForm(true); }
  function openEdit(c: Customer) { setEditTarget(c); setShowForm(true); }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-stone-500">Clientes da loja. Usados nos pedidos e, em breve, no envio de mensagens.</p>
        <button onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-white hover:bg-gold-dark transition shadow-sm shrink-0">
          + Novo Cliente
        </button>
      </div>

      <div className="relative max-w-md">
        <input type="text" placeholder="Buscar por nome ou telefone..." value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-stone-200 bg-white py-2 px-3 text-sm focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gold border-t-transparent" />
        </div>
      ) : customers.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-stone-200 bg-white py-16 text-center">
          <p className="text-sm text-stone-500">Nenhum cliente cadastrado.</p>
        </div>
      ) : (
        <>
          {/* Tabela (desktop) */}
          <div className="hidden md:block overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-stone-100 text-sm">
                <thead className="bg-stone-50">
                  <tr>
                    {['Nome', 'Telefone', 'E-mail', 'Observações', 'Ações'].map((col) => (
                      <th key={col} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {customers.map((c) => (
                    <tr key={c.id} className="hover:bg-stone-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-stone-800">{c.name}</td>
                      <td className="px-4 py-3 text-stone-600">{c.phone || '—'}</td>
                      <td className="px-4 py-3 text-stone-500 max-w-[200px] truncate">{c.email || '—'}</td>
                      <td className="px-4 py-3 text-stone-500 max-w-[240px] truncate">{c.notes || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => openEdit(c)} className="text-xs text-gold hover:underline">Editar</button>
                          <button onClick={() => handleDelete(c.id, c.name)} className="text-xs text-red-500 hover:underline">Excluir</button>
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
            {customers.map((c) => (
              <div key={c.id} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                <p className="font-medium text-stone-800 truncate">{c.name}</p>
                <div className="mt-2 space-y-1 text-sm text-stone-500">
                  <p>{c.phone || '—'}</p>
                  {c.email && <p className="truncate">{c.email}</p>}
                  {c.notes && <p className="text-xs text-stone-400 line-clamp-2">{c.notes}</p>}
                </div>
                <div className="mt-3 flex gap-4 border-t border-stone-100 pt-3">
                  <button onClick={() => openEdit(c)} className="text-sm text-gold font-medium">Editar</button>
                  <button onClick={() => handleDelete(c.id, c.name)} className="text-sm text-red-500 font-medium">Excluir</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {showForm && (
        <CustomerModal
          customer={editTarget}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}
    </div>
  );
}

function CustomerModal({ customer, onClose, onSaved }: {
  customer: Customer | null; onClose: () => void; onSaved: () => void;
}) {
  const isEdit = customer !== null;
  const [form, setForm] = useState({
    name: customer?.name ?? '',
    phone: customer?.phone ?? '',
    email: customer?.email ?? '',
    notes: customer?.notes ?? '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const body = {
      name: form.name,
      phone: form.phone,
      email: form.email || null,
      notes: form.notes || null,
    };

    try {
      if (isEdit) {
        await api.put(`/admin/customers/${customer.id}`, body);
      } else {
        await api.post('/admin/customers', body);
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
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-100 px-6 py-4">
          <h2 className="text-base font-semibold text-stone-800">
            {isEdit ? 'Editar Cliente' : 'Novo Cliente'}
          </h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Nome *</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-gold focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Telefone *</label>
            <input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="(51) 99999-9999"
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-gold focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">E-mail</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-gold focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Observações</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3} maxLength={1000} placeholder="Preferências, tamanho, aniversário..."
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-gold focus:outline-none resize-y" />
          </div>

          {error && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-600">{error}</div>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-stone-500">Cancelar</button>
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
