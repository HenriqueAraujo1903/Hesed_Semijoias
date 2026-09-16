// Imagem padrão exibida quando um produto não tem foto cadastrada
// (ou quando a URL da foto existe mas falha ao carregar). Servida
// localmente de public/ — sem depender de serviço externo.
//
// Há duas versões da mesma arte da marca ("FOTO DISPONÍVEL EM BREVE"):
//  - quadrada (1:1): para os cards e o modal do produto (áreas aspect-square).
//    Preenche o quadro com object-cover, sem faixas e sem cortar o texto.
//  - paisagem: para o carrossel de promoções (área retangular).
export const PRODUCT_PLACEHOLDER = '/product-placeholder-square.jpg';
export const PRODUCT_PLACEHOLDER_WIDE = '/product-placeholder.jpg';

/**
 * Resolve a URL da capa de um produto, caindo no placeholder da marca
 * quando não houver nenhuma foto. Aceita o par (imageUrls, imageUrl)
 * usado em todo o sistema (galeria tem prioridade; imageUrl é a capa legada).
 */
export function productCoverUrl(
  imageUrls?: string[] | null,
  imageUrl?: string | null,
): string {
  if (imageUrls && imageUrls.length > 0 && imageUrls[0]) return imageUrls[0];
  if (imageUrl) return imageUrl;
  return PRODUCT_PLACEHOLDER;
}

/**
 * onError para <img>: se a foto real quebrar (arquivo removido, URL inválida),
 * troca pelo placeholder quadrado. Guarda contra loop caso o próprio
 * placeholder falhe.
 */
export function handleImageError(e: React.SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;
  if (img.src.endsWith(PRODUCT_PLACEHOLDER)) return;
  img.src = PRODUCT_PLACEHOLDER;
}
