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
 */
export function buildOrderMessage(templateBody: string, order: OrderLike): string {
  const vars: Record<string, string> = {
    cliente: order.customerName ?? '',
    pedido: order.orderNumber ?? '',
    total: BRL.format(order.totalAmount ?? 0),
    itens: formatItems(order.items),
  };
  return templateBody.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? vars[key] : match
  );
}

/**
 * Abre o WhatsApp (web/app) com o número e a mensagem pré-preenchidos.
 * Deve ser chamado de forma síncrona a um gesto do usuário (clique) para não
 * ser bloqueado como popup. Retorna false se o telefone for inválido.
 */
export function openWhatsApp(phone: string | null | undefined, message: string): boolean {
  const sanitized = sanitizePhone(phone);
  if (!sanitized) return false;
  const url = `https://wa.me/${sanitized}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}
