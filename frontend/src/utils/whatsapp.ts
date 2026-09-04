import { BRL } from './format';

/**
 * Utilitários de WhatsApp — isolados para reuso.
 *
 * Hoje (Caminho A / semi-automático) montamos o texto e abrimos o wa.me para a
 * operadora enviar com um clique. No futuro (Caminho B / API oficial), o
 * `buildOrderMessage` continua sendo a fonte da mensagem — só troca o
 * `openWhatsApp` (link) por uma chamada de API no backend.
 */

// Forma mínima de pedido necessária para montar a mensagem.
export interface OrderLike {
  orderNumber: string;
  customerName: string | null;
  customerPhone: string | null;
  totalAmount: number;
  items: { productName: string; quantity: number; effectivePrice: number }[];
}

/**
 * Normaliza um telefone brasileiro para o formato aceito pelo wa.me:
 * apenas dígitos, com DDI 55 na frente. Retorna null se não houver dígitos
 * suficientes (evita abrir um link inválido).
 */
export function sanitizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return null;      // DDD + número — mínimo plausível
  if (!digits.startsWith('55')) digits = '55' + digits;
  return digits;
}

/** Lista de itens formatada para o corpo da mensagem. */
function formatItems(items: OrderLike['items']): string {
  if (!items || items.length === 0) return '';
  return items
    .map((i) => `• ${i.quantity}x ${i.productName} — ${BRL.format(i.effectivePrice)}`)
    .join('\n');
}

/**
 * Substitui as variáveis do template pelos dados do pedido:
 * {cliente} {pedido} {total} {itens}
 *
 * Se o template tiver uma imagem (imageUrl), o link é acrescentado ao final,
 * em linha própria — o WhatsApp gera o preview a partir do link. O wa.me só
 * carrega texto, então esse é o caminho para "mandar imagem" no aviso.
 */
export function buildOrderMessage(templateBody: string, order: OrderLike, imageUrl?: string | null): string {
  const vars: Record<string, string> = {
    cliente: order.customerName ?? '',
    pedido: order.orderNumber ?? '',
    total: BRL.format(order.totalAmount ?? 0),
    itens: formatItems(order.items),
  };
  const text = templateBody.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? vars[key] : match
  );
  const img = imageUrl?.trim();
  return img ? `${text}\n\n${img}` : text;
}

/**
 * Monta a URL do WhatsApp com telefone (sanitizado) e mensagem. Null se
 * telefone inválido.
 *
 * Usamos web.whatsapp.com/send (WhatsApp Web) em vez de wa.me: no desktop do
 * macOS, o wa.me faz handoff para o app nativo e corrompe emojis (4 bytes viram
 * �). A versão web preserva o texto em UTF-8.
 */
export function buildWhatsAppUrl(phone: string | null | undefined, message: string): string | null {
  const sanitized = sanitizePhone(phone);
  if (!sanitized) return null;
  return `https://web.whatsapp.com/send?phone=${sanitized}&text=${encodeURIComponent(message)}`;
}

/**
 * Abre o WhatsApp (web/app) com o número e a mensagem pré-preenchidos.
 * Deve ser chamado de forma síncrona a um gesto do usuário (clique) para não
 * ser bloqueado como popup. Retorna false se o telefone for inválido.
 */
export function openWhatsApp(phone: string | null | undefined, message: string): boolean {
  const url = buildWhatsAppUrl(phone, message);
  if (!url) return false;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

/**
 * Envia o aviso usando uma aba já aberta no clique (evita bloqueio de popup
 * após chamadas assíncronas). Navega a aba para o WhatsApp Web
 * (web.whatsapp.com/send), que preserva o texto em UTF-8 — diferente do wa.me,
 * que no desktop faz handoff para o app nativo e corrompe emojis (viram �).
 *
 * Se o telefone for inválido, fecha a aba. Se não houver aba (popup bloqueado),
 * faz fallback com window.open direto.
 */
export function sendWhatsAppViaWindow(win: Window | null, phone: string | null | undefined, message: string): boolean {
  const url = buildWhatsAppUrl(phone, message);
  if (!url) {
    if (win && !win.closed) win.close();
    return false;
  }
  if (win && !win.closed) {
    win.location.href = url;
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
  return true;
}
