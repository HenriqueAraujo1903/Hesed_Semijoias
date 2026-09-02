import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
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
  imageUrl: string | null;
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
          Você pode anexar uma imagem opcional (ex.: cuidados com a peça) — o link dela entra na mensagem e o WhatsApp mostra a prévia.
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
  const [imageUrl, setImageUrl] = useState<string | null>(template.imageUrl ?? null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const dirty = body !== template.body || active !== template.active
    || (imageUrl ?? null) !== (template.imageUrl ?? null);

  async function handleImageChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite re-selecionar o mesmo arquivo
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/admin/products/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImageUrl(res.data.url as string);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Erro ao enviar a imagem');
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    setError(null);
    if (!body.trim()) { setError('A mensagem não pode ficar vazia.'); return; }
    setSaving(true);
    try {
      await api.put(`/admin/settings/messages/${template.templateKey}`, {
        body: body.trim(), active, imageUrl: imageUrl || null,
      });
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

      {/* Imagem opcional (ex.: cuidados com a peça) */}
      <div className="mt-3">
        <p className="text-xs font-medium text-stone-600 mb-1.5">Imagem (opcional)</p>
        {imageUrl ? (
          <div className="flex items-center gap-3">
            <img src={imageUrl} alt="Prévia da imagem da mensagem"
              className="h-16 w-16 rounded-lg object-cover border border-stone-200" />
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="text-xs text-stone-600 hover:text-stone-800 underline disabled:opacity-40"
              >
                {uploading ? 'Enviando...' : 'Trocar imagem'}
              </button>
              <button
                type="button"
                onClick={() => setImageUrl(null)}
                className="text-xs text-red-500 hover:text-red-600 underline"
              >
                Remover imagem
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="rounded-lg border border-dashed border-stone-300 px-4 py-2 text-xs text-stone-500 hover:border-gold hover:text-gold disabled:opacity-40 transition"
          >
            {uploading ? 'Enviando...' : '+ Anexar imagem'}
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp"
          className="hidden" onChange={handleImageChange} />
      </div>

      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

      <div className="mt-3 flex items-center justify-end gap-3">
        {savedFlash && <span className="text-xs text-emerald-600">Salvo ✓</span>}
        <button
          onClick={handleSave}
          disabled={saving || uploading || !dirty}
          className="rounded-lg bg-gold px-5 py-2 text-sm font-semibold text-white hover:bg-gold-dark disabled:opacity-40 transition"
        >
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}
