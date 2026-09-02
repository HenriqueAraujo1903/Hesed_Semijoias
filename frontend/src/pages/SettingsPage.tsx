import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import UsersPage from './UsersPage';

type Tab = 'usuarios' | 'mensagens';

const TABS: { key: Tab; label: string }[] = [
  { key: 'usuarios', label: 'Usuários' },
  { key: 'mensagens', label: 'Mensagens' },
];

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('usuarios');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-800">Configurações</h1>
        <p className="mt-1 text-sm text-stone-500">Usuários do sistema, mensagens automáticas e ajustes gerais.</p>
      </div>

      {/* Sub-abas */}
      <div className="flex gap-2 border-b border-stone-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-gold text-gold'
                : 'border-transparent text-stone-500 hover:text-stone-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'usuarios' ? <UsersPage /> : <MessagesSettings />}
    </div>
  );
}

// ─── Sub-aba: Mensagens automáticas ───────────────────────────────────────────
interface MessageTemplate {
  id: string;
  templateKey: string;
  title: string;
  body: string;
  active: boolean;
  updatedAt: string | null;
}

const VARIABLES = [
  { token: '{cliente}', desc: 'Nome do cliente' },
  { token: '{pedido}', desc: 'Número do pedido' },
  { token: '{total}', desc: 'Valor total' },
  { token: '{itens}', desc: 'Lista de itens' },
];

function MessagesSettings() {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/settings/messages');
      setTemplates(res.data);
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
    <div className="space-y-5">
      <div className="rounded-lg bg-stone-50 border border-stone-200 p-4">
        <p className="text-xs font-medium text-stone-600 mb-2">Variáveis disponíveis (use no texto):</p>
        <div className="flex flex-wrap gap-2">
          {VARIABLES.map((v) => (
            <span key={v.token} className="inline-flex items-center gap-1.5 rounded-md bg-white border border-stone-200 px-2 py-1 text-xs">
              <code className="text-gold font-mono">{v.token}</code>
              <span className="text-stone-400">{v.desc}</span>
            </span>
          ))}
        </div>
        <p className="mt-3 text-xs text-stone-400">
          Estas mensagens são abertas no WhatsApp ao confirmar ou cancelar um pedido. Desative para não enviar aquele aviso.
        </p>
      </div>

      {templates.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-stone-200 bg-white py-16 text-center">
          <p className="text-sm text-stone-500">Nenhuma mensagem configurada.</p>
        </div>
      ) : (
        templates.map((t) => (
          <TemplateEditor key={t.id} template={t} onSaved={load} />
        ))
      )}
    </div>
  );
}

function TemplateEditor({ template, onSaved }: { template: MessageTemplate; onSaved: () => void }) {
  const [body, setBody] = useState(template.body);
  const [active, setActive] = useState(template.active);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const dirty = body !== template.body || active !== template.active;

  async function handleSave() {
    setError(null);
    if (!body.trim()) { setError('A mensagem não pode ficar vazia.'); return; }
    setSaving(true);
    try {
      await api.put(`/admin/settings/messages/${template.templateKey}`, { body: body.trim(), active });
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
      onSaved();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-stone-800">{template.title}</h3>
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-xs text-stone-500">{active ? 'Ativa' : 'Inativa'}</span>
          <button
            type="button"
            onClick={() => setActive((a) => !a)}
            className={`relative h-5 w-9 rounded-full transition-colors ${active ? 'bg-gold' : 'bg-stone-300'}`}
            aria-pressed={active}
          >
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${active ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </button>
        </label>
      </div>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={5}
        className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-gold focus:outline-none resize-y font-mono"
      />

      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

      <div className="mt-3 flex items-center justify-end gap-3">
        {savedFlash && <span className="text-xs text-emerald-600">Salvo ✓</span>}
        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          className="rounded-lg bg-gold px-5 py-2 text-sm font-semibold text-white hover:bg-gold-dark disabled:opacity-40 transition"
        >
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}
