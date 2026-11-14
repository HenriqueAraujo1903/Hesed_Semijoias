import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import { useFeedback } from '../components/Feedback';

interface Consignee {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  commissionRate: number;
  createdAt: string;
}

const PCT = new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 0, maximumFractionDigits: 1 });

export default function ConsigneesPage() {
  const fb = useFeedback();
  const [consignees, setConsignees] = useState<Consignee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Consignee | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      const res = await api.get('/consignees', { params });
      setConsignees(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: string, name: string) {
    if (!(await fb.confirm({ message: `Excluir ${name}?`, danger: true, confirmLabel: 'Excluir' }))) return;
    try {
      await api.delete(`/consignees/${id}`);
      fb.success('Excluído com sucesso.');
      load();
    } catch (e: any) {
      fb.error(e.response?.data?.error || 'Erro ao excluir');
    }
  }

  function openCreate() { setEditTarget(null); setShowForm(true); }
  function openEdit(c: Consignee) { setEditTarget(c); setShowForm(true); }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-800 dark:text-cream-200">Revendedoras</h1>
          <p className="mt-1 text-sm text-stone-500 dark:text-charcoal-300">Gerencie as parceiras e suas comissões.</p>
        </div>
        <button onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-white hover:bg-gold-dark transition shadow-sm">
          + Nova Revendedora
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
      ) : consignees.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-stone-200 dark:border-charcoal-600 bg-white dark:bg-charcoal-800 py-16 text-center">
          <p className="text-sm text-stone-500 dark:text-charcoal-300">Nenhuma revendedora cadastrada.</p>
        </div>
      ) : (
        <>
          {/* Tabela (desktop) */}
          <div className="hidden md:block overflow-hidden rounded-2xl border border-stone-200 dark:border-charcoal-600 bg-white dark:bg-charcoal-800 shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-stone-100 dark:divide-charcoal-700 text-sm">
                <thead className="bg-stone-50 dark:bg-charcoal-700/50">
                  <tr>
                    {['Nome', 'Telefone', 'E-mail', 'Comissão', 'Ações'].map((col) => (
                      <th key={col} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-charcoal-300">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50 dark:divide-charcoal-700">
                  {consignees.map((c) => (
                    <tr key={c.id} className="hover:bg-stone-50 dark:hover:bg-charcoal-700/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-stone-800 dark:text-cream-200">{c.name}</td>
                      <td className="px-4 py-3 text-stone-600 dark:text-charcoal-200">{c.phone || '—'}</td>
                      <td className="px-4 py-3 text-stone-500 dark:text-charcoal-300 max-w-[200px] truncate">{c.email || '—'}</td>
                      <td className="px-4 py-3 font-medium text-stone-700 dark:text-charcoal-100">{PCT.format(c.commissionRate)}</td>
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
            {consignees.map((c) => (
              <div key={c.id} className="rounded-2xl border border-stone-200 dark:border-charcoal-600 bg-white dark:bg-charcoal-800 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium text-stone-800 dark:text-cream-200 min-w-0 flex-1 truncate">{c.name}</p>
                  <span className="shrink-0 rounded-full bg-gold-50 dark:bg-gold-900/20 px-2 py-0.5 text-[10px] font-medium text-gold-700 dark:text-gold-300">
                    {PCT.format(c.commissionRate)}
                  </span>
                </div>
                <div className="mt-2 space-y-1 text-sm text-stone-500 dark:text-charcoal-300">
                  <p>{c.phone || '—'}</p>
                  <p className="truncate">{c.email || '—'}</p>
                </div>
                <div className="mt-3 flex gap-4 border-t border-stone-100 dark:border-charcoal-700 pt-3">
                  <button onClick={() => openEdit(c)} className="text-sm text-gold font-medium">Editar</button>
                  <button onClick={() => handleDelete(c.id, c.name)} className="text-sm text-red-500 font-medium">Excluir</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {showForm && (
        <ConsigneeModal
          consignee={editTarget}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); fb.success('Revendedora salva com sucesso.'); load(); }}
        />
      )}
    </div>
  );
}

function ConsigneeModal({ consignee, onClose, onSaved }: {
  consignee: Consignee | null; onClose: () => void; onSaved: () => void;
}) {
  const isEdit = consignee !== null;
  const [form, setForm] = useState({
    name: consignee?.name ?? '',
    phone: consignee?.phone ?? '',
    email: consignee?.email ?? '',
    commissionRate: consignee ? (consignee.commissionRate * 100).toString() : '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const body = {
      name: form.name,
      phone: form.phone,
      email: form.email || null,
      commissionRate: parseFloat(form.commissionRate) / 100,
    };

    try {
      if (isEdit) {
        await api.put(`/consignees/${consignee.id}`, body);
      } else {
        await api.post('/consignees', body);
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
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-charcoal-800 shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-100 dark:border-charcoal-700 px-6 py-4">
          <h2 className="text-base font-semibold text-stone-800 dark:text-cream-200">
            {isEdit ? 'Editar Revendedora' : 'Nova Revendedora'}
          </h2>
          <button onClick={onClose} className="text-stone-400 dark:text-charcoal-300 hover:text-stone-600 dark:hover:text-charcoal-100">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <div>
            <label className="block text-xs font-medium text-stone-600 dark:text-charcoal-200 mb-1">Nome *</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-stone-200 dark:border-charcoal-600 px-3 py-2 text-sm focus:border-gold focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 dark:text-charcoal-200 mb-1">Telefone *</label>
            <input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="(11) 99999-9999"
              className="w-full rounded-lg border border-stone-200 dark:border-charcoal-600 px-3 py-2 text-sm focus:border-gold focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 dark:text-charcoal-200 mb-1">E-mail</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-lg border border-stone-200 dark:border-charcoal-600 px-3 py-2 text-sm focus:border-gold focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 dark:text-charcoal-200 mb-1">Comissão (%) *</label>
            <input required type="number" step="0.5" min="0" max="100" value={form.commissionRate}
              onChange={(e) => setForm({ ...form, commissionRate: e.target.value })}
              className="w-full rounded-lg border border-stone-200 dark:border-charcoal-600 px-3 py-2 text-sm focus:border-gold focus:outline-none" />
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
