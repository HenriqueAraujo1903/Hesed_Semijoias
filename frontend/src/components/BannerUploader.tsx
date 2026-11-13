import { useRef, useState } from 'react';
import api from '../services/api';

const MAX_BYTES = 5 * 1024 * 1024; // mesmo limite do upload de fotos de produto
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Upload do banner de uma promoção (imagem exibida no carrossel do catálogo).
 * Reaproveita o endpoint de upload de imagens do admin, que valida o tipo real
 * do arquivo (magic bytes) e devolve a URL pública. Sem banner, o carrossel usa
 * a foto do produto.
 */
export default function BannerUploader({ value, onChange }: {
  value: string;
  onChange: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);
    if (!ACCEPTED.includes(file.type)) {
      setError('Use uma imagem JPG, PNG ou WebP.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('A imagem passa de 5 MB. Reduza o tamanho e tente de novo.');
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/admin/products/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onChange(res.data.url as string);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Erro no upload do banner.');
    } finally {
      setUploading(false);
    }
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <div>
      <label className="block text-xs font-medium text-stone-600 dark:text-charcoal-400 mb-1 uppercase tracking-wide">
        Banner do carrossel (opcional)
      </label>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex items-center gap-4 rounded-xl border-2 border-dashed p-3 transition-colors ${
          dragging
            ? 'border-gold bg-gold/10'
            : 'border-stone-200 dark:border-charcoal-600'
        }`}
      >
        {/* Prévia no mesmo enquadramento quadrado do carrossel */}
        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-stone-100 dark:bg-charcoal-700">
          {value ? (
            <img src={value} alt="Prévia do banner" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-center text-[10px] leading-tight text-stone-400 dark:text-charcoal-300 px-2">
              Usa a foto do produto
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="btn-secondary text-xs px-3 py-1.5"
            >
              {uploading ? 'Enviando...' : value ? 'Trocar imagem' : 'Enviar imagem'}
            </button>
            {value && !uploading && (
              <button
                type="button"
                onClick={() => { setError(null); onChange(''); }}
                className="text-xs text-red-500 hover:text-red-600 underline underline-offset-2"
              >
                Remover
              </button>
            )}
          </div>
          <p className="text-[11px] leading-snug text-stone-400 dark:text-charcoal-300">
            Ideal: imagem <strong>quadrada</strong> (1200×1200), com o texto no centro. JPG, PNG ou WebP até 5 MB.
            Arraste um arquivo aqui ou clique em enviar. Sem banner, o carrossel mostra a foto do produto.
          </p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={onPick}
          className="hidden"
          aria-label="Selecionar imagem do banner"
        />
      </div>

      {error && <p role="alert" className="mt-1.5 text-xs text-red-500">{error}</p>}
    </div>
  );
}
