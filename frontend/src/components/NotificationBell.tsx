import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

interface Notification {
  key: string;
  type: string;
  title: string;
  message: string;
  daysUntil: number | null;
  customerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  birthDate: string | null;
}

/** Rótulo curto de proximidade a partir de daysUntil. */
function whenLabel(days: number | null): string {
  if (days == null) return '';
  if (days === 0) return 'Hoje 🎉';
  if (days === 1) return 'Amanhã';
  return `Em ${days} dias`;
}

/** Cor do selo conforme a urgência (hoje = destaque). */
function whenBadge(days: number | null): string {
  if (days === 0) return 'bg-gold/15 text-gold';
  if (days === 1) return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400';
  return 'bg-charcoal-100 dark:bg-charcoal-700 text-charcoal-500 dark:text-charcoal-300';
}

export default function NotificationBell() {
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      const res = await api.get('/admin/notifications');
      setItems(res.data);
    } catch {
      // silencioso: o sino não deve quebrar o layout se a API falhar
      setItems([]);
    }
  }, []);

  // Carrega ao montar (login/abertura do painel) e revalida a cada 5 min.
  useEffect(() => {
    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  // Fecha o dropdown ao clicar fora.
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  async function dismiss(key: string) {
    // Otimista: remove da lista já; se falhar, recarrega.
    setItems((prev) => prev.filter((n) => n.key !== key));
    try {
      await api.post('/admin/notifications/dismiss', { key });
    } catch {
      load();
    }
  }

  /** Vai para Configurações → Mensagens (para enviar os parabéns pelo template). */
  function goToMessages() {
    setOpen(false);
    navigate('/admin/configuracoes?tab=mensagens');
  }

  const count = items.length;

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Notificações"
        className="relative rounded-lg p-2 text-charcoal-500 dark:text-charcoal-300 hover:bg-cream-200 dark:hover:bg-charcoal-700 transition-colors"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-gold px-1 text-[10px] font-semibold text-white">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 max-w-[90vw] overflow-hidden rounded-xl border border-charcoal-100 dark:border-charcoal-700 bg-white dark:bg-charcoal-800 shadow-xl">
          <div className="flex items-center justify-between border-b border-charcoal-100/60 dark:border-charcoal-700/60 px-4 py-3">
            <span className="text-sm font-semibold text-charcoal-700 dark:text-cream-200">Notificações</span>
            {count > 0 && <span className="text-xs text-charcoal-400">{count}</span>}
          </div>

          {count === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-charcoal-400 dark:text-charcoal-500">Nenhuma notificação no momento.</p>
            </div>
          ) : (
            <ul className="max-h-[360px] overflow-y-auto divide-y divide-charcoal-100/60 dark:divide-charcoal-700/60">
              {items.map((n) => (
                <li key={n.key} className="px-4 py-3">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 text-base leading-none">🎂</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-charcoal-700 dark:text-cream-200">
                          {n.customerName ?? n.title}
                        </p>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${whenBadge(n.daysUntil)}`}>
                          {whenLabel(n.daysUntil)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-charcoal-400 dark:text-charcoal-500">{n.message}</p>
                      <div className="mt-2 flex items-center gap-3">
                        <button
                          onClick={goToMessages}
                          className="text-xs font-medium text-gold hover:underline"
                        >
                          Enviar parabéns
                        </button>
                        <button
                          onClick={() => dismiss(n.key)}
                          className="text-xs text-charcoal-400 hover:text-charcoal-600 dark:hover:text-charcoal-200"
                        >
                          Dispensar
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
