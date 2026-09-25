import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';

interface Line {
  id: string;
  name: string;
  active: boolean;
  luxo: boolean;
  sortOrder: number;
  createdAt: string;
}

export default function LinesPage() {
  const [lines, setLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Line | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/lines');
      setLines(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Excluir a linha ${name}?`)) return;
    try {
      await api.delete(`/admin/lines/${id}`);
      load();
    } catch (e: any) {
      alert(e.response?.data?.error || 'Erro ao excluir');
    }
  }

  function openCreate() { setEditTarget(null); setShowForm(true); }
  function openEdit(l: Line) { setEditTarget(l); setShowForm(true); }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-stone-500">Linhas de produto (ex.: Kids, Pet, Inverno, Verão). A flag "Luxo" marca linhas de luxo.</p>
        <button onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-white hover:bg-gold-dark transition shadow-sm shrink-0">
          + Nova Linha
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gold border-t-transparent" />
        </div>
      ) : lines.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-stone-200 bg-white py-16 text-center">
          <p className="text-sm text-stone-500">Nenhuma linha cadastrada.</p>
        </div>
      ) : (
        <>
          {/* Tabela (desktop) */}
          <div className="hidden md:block overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-stone-100 text-sm">
                <thead className="bg-stone-50">
                  <tr>
                    {['Nome', 'Luxo', 'Ordem', 'Situação', 'Ações'].map((col) => (
                      <th key={col} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {lines.map((l) => (
                    <tr key={l.id} className="hover:bg-stone-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-stone-800">{l.name}</td>
                      <td className="px-4 py-3">
                        {l.luxo ? (
                          <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-medium text-gold-dark">✦ Luxo</span>
                        ) : (
                          <span className="text-xs text-stone-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-stone-500">{l.sortOrder}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          l.active ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-200 text-stone-500'
                        }`}>{l.active ? 'Ativa' : 'Inativa'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => openEdit(l)} className="text-xs text-gold hover:underline">Editar</button>
                          <button onClick={() => handleDelete(l.id, l.name)} className="text-xs text-red-500 hover:underline">Excluir</button>
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
            {lines.map((l) => (
              <div key={l.id} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-stone-800">{l.name}</p>
                    {l.luxo && <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-medium text-gold-dark">✦ Luxo</span>}
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    l.active ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-200 text-stone-500'
                  }`}>{l.active ? 'Ativa' : 'Inativa'}</span>
                </div>
                <p className="mt-1 text-xs text-stone-400">Ordem: {l.sortOrder}</p>
                <div className="mt-3 flex gap-4 border-t border-stone-100 pt-3">
                  <button onClick={() => openEdit(l)} className="text-sm text-gold font-medium">Editar</button>
                  <button onClick={() => handleDelete(l.id, l.name)} className="text-sm text-red-500 font-medium">Excluir</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {showForm && (
        <LineModal
          line={editTarget}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}
    </div>
  );
}

function LineModal({ line, onClose, onSaved }: {
  line: Line | null; onClose: () => void; onSaved: () => void;
}) {
  const isEdit = line !== null;
  const [form, setForm] = useState({
    name: line?.name ?? '',
    active: line?.active ?? true,
    luxo: line?.luxo ?? false,
    sortOrder: line?.sortOrder != null ? line.sortOrder.toString() : '0',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const body = {
      name: form.name,
      active: form.active,
      luxo: form.luxo,
      sortOrder: form.sortOrder !== '' ? parseInt(form.sortOrder, 10) : 0,
    };

    try {
      if (isEdit) {
        await api.put(`/admin/lines/${line.id}`, body);
      } else {
        await api.post('/admin/lines', body);
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
            {isEdit ? 'Editar Linha' : 'Nova Linha'}
          </h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Nome *</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex: Kids, Pet, Inverno, Verão..."
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-gold focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Ordem de exibição</label>
            <input type="number" step="1" min="0" value={form.sortOrder}
              onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-gold focus:outline-none" />
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.luxo}
                onChange={(e) => setForm({ ...form, luxo: e.target.checked })}
                className="w-4 h-4 rounded border-stone-300 text-gold focus:ring-gold" />
              <span className="text-sm text-stone-600">Linha de luxo</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
                className="w-4 h-4 rounded border-stone-300 text-gold focus:ring-gold" />
              <span className="text-sm text-stone-600">Ativa (aparece nos seletores)</span>
            </label>
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
