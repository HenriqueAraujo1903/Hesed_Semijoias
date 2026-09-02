import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  createdAt: string;
}

const ROLE_LABEL: Record<string, string> = {
  ROLE_ADMIN: 'Administrador',
  ROLE_OPERATOR: 'Operador',
};

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<User | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      const res = await api.get('/admin/users', { params });
      setUsers(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(u: User) {
    if (!confirm(`Excluir o usuário ${u.name}?`)) return;
    try {
      await api.delete(`/admin/users/${u.id}`);
      load();
    } catch (e: any) {
      alert(e.response?.data?.error || 'Erro ao excluir');
    }
  }

  function openCreate() { setEditTarget(null); setShowForm(true); }
  function openEdit(u: User) { setEditTarget(u); setShowForm(true); }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-800">Usuários</h1>
          <p className="mt-1 text-sm text-stone-500">Gerencie os usuários do sistema e seus papéis de acesso.</p>
        </div>
        <button onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-white hover:bg-gold-dark transition shadow-sm">
          + Novo Usuário
        </button>
      </div>

      <div className="relative max-w-md">
        <input type="text" placeholder="Buscar por nome ou e-mail..." value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-stone-200 bg-white py-2 px-3 text-sm focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gold border-t-transparent" />
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-stone-200 bg-white py-16 text-center">
          <p className="text-sm text-stone-500">Nenhum usuário encontrado.</p>
        </div>
      ) : (
        <>
          {/* Tabela (desktop) */}
          <div className="hidden md:block overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-stone-100 text-sm">
                <thead className="bg-stone-50">
                  <tr>
                    {['Nome', 'E-mail', 'Telefone', 'Papel', 'Ações'].map((col) => (
                      <th key={col} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {users.map((u) => {
                    const isSelf = u.id === currentUser?.id;
                    return (
                      <tr key={u.id} className="hover:bg-stone-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-stone-800">
                          {u.name}
                          {isSelf && <span className="ml-2 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] text-stone-500">você</span>}
                        </td>
                        <td className="px-4 py-3 text-stone-500 max-w-[220px] truncate">{u.email}</td>
                        <td className="px-4 py-3 text-stone-600">{u.phone || '—'}</td>
                        <td className="px-4 py-3">
                          <RoleBadge role={u.role} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button onClick={() => openEdit(u)} className="text-xs text-gold hover:underline">Editar</button>
                            {!isSelf && (
                              <button onClick={() => handleDelete(u)} className="text-xs text-red-500 hover:underline">Excluir</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cards (mobile) */}
          <div className="md:hidden space-y-3">
            {users.map((u) => {
              const isSelf = u.id === currentUser?.id;
              return (
                <div key={u.id} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium text-stone-800 min-w-0 flex-1 truncate">
                      {u.name}
                      {isSelf && <span className="ml-2 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] text-stone-500">você</span>}
                    </p>
                    <RoleBadge role={u.role} />
                  </div>
                  <div className="mt-2 space-y-1 text-sm text-stone-500">
                    <p className="truncate">{u.email}</p>
                    <p>{u.phone || '—'}</p>
                  </div>
                  <div className="mt-3 flex gap-4 border-t border-stone-100 pt-3">
                    <button onClick={() => openEdit(u)} className="text-sm text-gold font-medium">Editar</button>
                    {!isSelf && (
                      <button onClick={() => handleDelete(u)} className="text-sm text-red-500 font-medium">Excluir</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {showForm && (
        <UserModal
          target={editTarget}
          isSelf={editTarget?.id === currentUser?.id}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const isAdmin = role === 'ROLE_ADMIN';
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
      isAdmin ? 'bg-gold-50 text-gold-700' : 'bg-stone-100 text-stone-600'
    }`}>
      {ROLE_LABEL[role] ?? role}
    </span>
  );
}

function UserModal({ target, isSelf, onClose, onSaved }: {
  target: User | null; isSelf: boolean; onClose: () => void; onSaved: () => void;
}) {
  const isEdit = target !== null;
  const [form, setForm] = useState({
    name: target?.name ?? '',
    email: target?.email ?? '',
    phone: target?.phone ?? '',
    password: '',
    role: target?.role ?? 'ROLE_OPERATOR',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const body: Record<string, unknown> = {
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || null,
      role: form.role,
      // senha: no create é obrigatória; no edit, só envia se preenchida
      password: form.password.trim() || null,
    };

    try {
      if (isEdit) {
        await api.put(`/admin/users/${target.id}`, body);
      } else {
        await api.post('/admin/users', body);
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
            {isEdit ? 'Editar Usuário' : 'Novo Usuário'}
          </h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Nome *</label>
            <input required minLength={3} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-gold focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">E-mail *</label>
            <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-gold focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Telefone</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="(11) 99999-9999"
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-gold focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">
              Senha {isEdit ? '' : '*'}
            </label>
            <input type="password" required={!isEdit} minLength={6} value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={isEdit ? 'Deixe em branco para manter a atual' : 'Mínimo 6 caracteres'}
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-gold focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Papel *</label>
            <select required value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
              disabled={isSelf}
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-gold focus:outline-none disabled:bg-stone-50 disabled:text-stone-400">
              <option value="ROLE_OPERATOR">Operador</option>
              <option value="ROLE_ADMIN">Administrador</option>
            </select>
            {isSelf && (
              <p className="mt-1 text-[11px] text-stone-400">Você não pode alterar o seu próprio papel.</p>
            )}
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
