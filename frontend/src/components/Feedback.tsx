import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

// ─── Feedback padrão do painel: toasts (sucesso/erro/info) + confirmação ─────
// Substitui window.alert / window.confirm por componentes no visual da marca,
// com suporte ao modo escuro, Esc e leitores de tela.

type ToastKind = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Ação destrutiva (exclusão etc.): botão vermelho e foco inicial em "Cancelar". */
  danger?: boolean;
}

interface FeedbackApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  confirm: (options: ConfirmOptions | string) => Promise<boolean>;
}

const FeedbackContext = createContext<FeedbackApi | null>(null);

const TOAST_DURATION: Record<ToastKind, number> = { success: 3500, info: 4000, error: 6500 };

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [pending, setPending] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);
  const nextId = useRef(1);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) { clearTimeout(timer); timers.current.delete(id); }
  }, []);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = nextId.current++;
    // Limita a 4 toasts visíveis (descarta os mais antigos).
    setToasts((prev) => [...prev.slice(-3), { id, kind, message }]);
    timers.current.set(id, setTimeout(() => dismiss(id), TOAST_DURATION[kind]));
  }, [dismiss]);

  useEffect(() => {
    const map = timers.current;
    return () => { map.forEach((t) => clearTimeout(t)); map.clear(); };
  }, []);

  const confirm = useCallback((options: ConfirmOptions | string) => {
    const opts = typeof options === 'string' ? { message: options } : options;
    return new Promise<boolean>((resolve) => setPending({ ...opts, resolve }));
  }, []);

  const closeConfirm = useCallback((ok: boolean) => {
    setPending((current) => {
      current?.resolve(ok);
      return null;
    });
  }, []);

  const api = useMemo<FeedbackApi>(() => ({
    success: (m) => push('success', m),
    error: (m) => push('error', m),
    info: (m) => push('info', m),
    confirm,
  }), [push, confirm]);

  return (
    <FeedbackContext.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
      {pending && <ConfirmDialog options={pending} onClose={closeConfirm} />}
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): FeedbackApi {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useFeedback deve ser usado dentro de <FeedbackProvider>');
  return ctx;
}

// ─── Toasts ──────────────────────────────────────────────────────────────────

const TOAST_STYLES: Record<ToastKind, { box: string; icon: string; path: string }> = {
  success: {
    box: 'border-emerald-200 dark:border-emerald-800/60',
    icon: 'text-emerald-500',
    path: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  error: {
    box: 'border-red-200 dark:border-red-800/60',
    icon: 'text-red-500',
    path: 'M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z',
  },
  info: {
    box: 'border-gold-200 dark:border-gold-800/60',
    icon: 'text-gold',
    path: 'M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z',
  },
};

function ToastViewport({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-4 z-[80] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:items-end"
      aria-live="polite"
    >
      {toasts.map((t) => {
        const s = TOAST_STYLES[t.kind];
        return (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border bg-white px-4 py-3 shadow-lg dark:bg-charcoal-800 ${s.box}`}
          >
            <svg className={`mt-0.5 h-5 w-5 shrink-0 ${s.icon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d={s.path} />
            </svg>
            <p className="flex-1 whitespace-pre-line text-sm text-charcoal-700 dark:text-charcoal-100">{t.message}</p>
            <button
              onClick={() => onDismiss(t.id)}
              aria-label="Fechar aviso"
              className="shrink-0 rounded p-0.5 text-charcoal-300 hover:text-charcoal-600 dark:hover:text-charcoal-200"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ─── Confirmação ─────────────────────────────────────────────────────────────

function ConfirmDialog({ options, onClose }: { options: ConfirmOptions; onClose: (ok: boolean) => void }) {
  const { title, message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', danger } = options;
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Foco inicial: em ação destrutiva começa no "Cancelar" (evita Enter acidental).
  useEffect(() => {
    (danger ? cancelRef.current : confirmRef.current)?.focus();
  }, [danger]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(false); }
      // Mantém o foco dentro do diálogo (Tab alterna entre os dois botões).
      if (e.key === 'Tab') {
        e.preventDefault();
        const next = document.activeElement === cancelRef.current ? confirmRef.current : cancelRef.current;
        next?.focus();
      }
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={() => onClose(false)}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-charcoal-800"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-title" className="font-serif text-lg font-semibold text-charcoal-800 dark:text-cream-200">
          {title ?? (danger ? 'Confirmar exclusão' : 'Confirmar ação')}
        </h2>
        <p id="confirm-message" className="mt-2 text-sm text-charcoal-500 dark:text-charcoal-300">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button ref={cancelRef} onClick={() => onClose(false)} className="btn-secondary text-sm">
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            onClick={() => onClose(true)}
            className={
              danger
                ? 'rounded-xl bg-red-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400'
                : 'btn-primary text-sm'
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
