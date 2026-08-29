// Telemetria de engajamento do catálogo (anônima, não-bloqueante).
// Registra eventos no backend e, se configurado, também no Google Analytics.
import axios from 'axios';

const SESSION_KEY = 'hesed_session_id';

/**
 * Inicializa o Google Analytics se VITE_GA_ID estiver configurado.
 * Sem a variável, é inerte (nenhum script é carregado).
 * Chamar uma vez no bootstrap da aplicação.
 */
export function initAnalytics(): void {
  const gaId = import.meta.env.VITE_GA_ID as string | undefined;
  if (!gaId) return;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
  document.head.appendChild(script);

  (window as any).dataLayer = (window as any).dataLayer || [];
  function gtag(...args: unknown[]) { (window as any).dataLayer.push(args); }
  (window as any).gtag = gtag;
  gtag('js', new Date());
  gtag('config', gaId);
}

/** Id anônimo de sessão, persistido no navegador. Não identifica a pessoa. */
function getSessionId(): string {
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = (crypto.randomUUID?.() ?? `s-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    // localStorage indisponível (modo privado etc.) — usa id efêmero
    return `s-${Date.now()}`;
  }
}

type CatalogEventType = 'VIEW' | 'SELECT';

/**
 * Registra um evento de engajamento. Nunca lança nem bloqueia o fluxo:
 * é telemetria — falhas são silenciosas.
 */
export function trackCatalogEvent(type: CatalogEventType, productId?: string): void {
  const payload: Record<string, unknown> = { type, sessionId: getSessionId() };
  if (productId) payload.productId = productId;

  // Backend (dado de negócio)
  axios.post('/api/catalog-events', payload).catch(() => { /* silencioso */ });

  // Google Analytics (se configurado)
  const gtag = (window as any).gtag;
  if (typeof gtag === 'function') {
    gtag('event', type === 'VIEW' ? 'catalog_view' : 'catalog_select', {
      product_id: productId ?? undefined,
    });
  }
}
