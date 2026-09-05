import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useTheme } from '../contexts/ThemeContext';
import { trackCatalogEvent } from '../services/telemetry';
import Logo from '../components/Logo';

interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  salePrice: number;         // preço cheio (referência)
  effectivePrice: number;    // preço a pagar (com promoção, se houver)
  onSale: boolean;
  discountPercent: number | null;
  stockStatus: string;
  onDemand: boolean;
  leadTimeDays: number | null;
  imageUrl: string | null;
  imageUrls: string[] | null;
  description?: string | null;
}

const WHATSAPP_NUMBER = '5551983396457';
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function generateOrderNumber(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(1000 + Math.random() * 9000);
  return `HSD-${date}-${random}`;
}

export default function CatalogoPage() {
  const { isDark, toggleTheme } = useTheme();
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<Product[]>([]);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [orderNumber] = useState(generateOrderNumber());
  // Sacola: expande ao adicionar item e minimiza sozinha após alguns segundos,
  // para não atrapalhar a navegação pelo catálogo.
  const [cartExpanded, setCartExpanded] = useState(false);
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewTracked = useRef(false);

  // Limpa o timer ao desmontar
  useEffect(() => () => { if (collapseTimer.current) clearTimeout(collapseTimer.current); }, []);

  useEffect(() => {
    axios.get('/api/products/catalog').then((res) => setProducts(res.data));
    // Telemetria: registra a visita ao catálogo uma única vez
    // (guarda contra o double-invoke do React StrictMode em desenvolvimento).
    if (!viewTracked.current) {
      viewTracked.current = true;
      trackCatalogEvent('VIEW');
    }
  }, []);

  const [categoryNames, setCategoryNames] = useState<string[]>([]);

  // Categorias ativas (cadastro de categorias). Público via /api/products/categories.
  useEffect(() => {
    axios.get('/api/products/categories')
      .then((res) => setCategoryNames(res.data))
      .catch(() => setCategoryNames([]));
  }, []);

  const categories = useMemo(() => ['Todos', ...categoryNames], [categoryNames]);

  const filtered = useMemo(() => {
    if (activeCategory === 'Todos') return products;
    return products.filter((p) => p.category === activeCategory);
  }, [products, activeCategory]);

  function expandCartThenCollapse() {
    setCartExpanded(true);
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    collapseTimer.current = setTimeout(() => setCartExpanded(false), 2500);
  }

  function toggle(product: Product) {
    setSelected((prev) => {
      const alreadySelected = prev.find((p) => p.id === product.id);
      if (alreadySelected) {
        return prev.filter((p) => p.id !== product.id);
      }
      // Telemetria: registra o interesse (seleção) — não registramos deseleção
      trackCatalogEvent('SELECT', product.id);
      // Mostra a sacola expandida brevemente ao adicionar, depois minimiza
      expandCartThenCollapse();
      return [...prev, product];
    });
  }

  function sendWhatsApp() {
    if (selected.length === 0) return;

    const total = selected.reduce((sum, p) => sum + p.effectivePrice, 0);
    const items = selected.map((p, i) => `${i + 1}. ${p.name}\n   Ref: ${p.sku} | ${BRL.format(p.effectivePrice)}`).join('\n\n');
    const msg = `✨ *HESED Semijoias — Novo Pedido* ✨\n\n*Nº do Pedido:* ${orderNumber}\n\n*Itens selecionados:*\n${items}\n\n━━━━━━━━━━━━━━━━━\n*Total estimado:* ${BRL.format(total)}\n━━━━━━━━━━━━━━━━━\n\nOlá! Gostaria de finalizar este pedido. 😊`;

    // Registra o pedido no backend (não bloqueia o cliente).
    // A abertura do WhatsApp acontece de qualquer forma — a venda é prioridade
    // sobre o registro. Falhas de registro são apenas logadas.
    axios.post('/api/orders', {
      productIds: selected.map((p) => p.id),
      orderNumber,
    }).catch((err) => {
      console.error('Falha ao registrar o pedido (o WhatsApp foi aberto normalmente):', err);
    });

    // Abre o WhatsApp imediatamente (síncrono, para não ser bloqueado como popup).
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] dark:bg-[#141210] transition-colors duration-300">

      {/* ═══════════ HERO (scrolls with page) ═══════════ */}
      <section className="relative bg-white dark:bg-[#1C1A16] border-b border-[#F0E4CC]/50 dark:border-[#292620]">
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#FAF7F2]/50 dark:to-[#141210]/50 pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-6">
          {/* Top utility bar */}
          <div className="flex items-center justify-between py-4">
            <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[11px] text-[#A8A5A0] dark:text-[#5C584F] hover:text-[#25D366] transition-colors tracking-wide">
              <svg className="w-3.5 h-3.5 text-[#25D366]" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Atendimento via WhatsApp
            </a>
            <div className="flex items-center gap-3">
              <button
                onClick={toggleTheme}
                className="flex items-center justify-center w-8 h-8 rounded-full text-[#A8A5A0] dark:text-[#5C584F] hover:text-[#C8A96E] transition-colors"
                title={isDark ? 'Modo claro' : 'Modo escuro'}
              >
                {isDark ? (
                  <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                  </svg>
                ) : (
                  <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                  </svg>
                )}
              </button>
              {selected.length > 0 && (
                <div className="flex items-center gap-1.5 bg-[#C8A96E] px-3 py-1.5 rounded-full">
                  <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                  <span className="text-xs font-semibold text-white">{selected.length}</span>
                </div>
              )}
            </div>
          </div>

          {/* Logo + Headline — generous breathing room */}
          <div className="text-center pt-6 pb-10">
            <Logo className="h-32 mx-auto mb-8" />
            
            <h2 className="font-serif text-2xl md:text-3xl text-[#353229] dark:text-[#E8E7E5] font-medium tracking-wide leading-relaxed">
              Peças que contam <span className="text-[#C8A96E] italic">a sua história</span>
            </h2>
            
            {/* Diferenciais — explícitos, mas discretos */}
            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-[13px] tracking-wide text-[#96784A] dark:text-[#C9B892]">
              <span>Não escurece</span>
              <span className="text-[#E2CFA3] dark:text-[#3D3A33]">•</span>
              <span>Antialérgica</span>
              <span className="text-[#E2CFA3] dark:text-[#3D3A33]">•</span>
              <span>Garantia de 1 ano</span>
            </div>

            <p className="mt-4 text-[13px] text-[#A8A5A0] dark:text-[#5C584F] tracking-wide">
              Selecione suas favoritas e envie pelo WhatsApp
            </p>
          </div>

          {/* Category filters — centered, generous spacing */}
          <div className="flex items-center justify-center gap-3 pb-6 overflow-x-auto scrollbar-hide">
            {categories.map((cat) => (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                className={`shrink-0 px-5 py-2 rounded-full text-[13px] font-medium transition-all duration-300 ${
                  activeCategory === cat
                    ? 'bg-[#C8A96E] text-white'
                    : 'text-[#7A766F] dark:text-[#A8A5A0] hover:text-[#C8A96E] dark:hover:text-[#C8A96E]'
                }`}>
                {cat}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ PROMOTIONS CAROUSEL ═══════════ */}
      <PromotionCarousel onSelectProduct={(productId) => {
        const product = products.find(p => p.id === productId);
        if (product && product.stockStatus !== 'ESGOTADO') toggle(product);
      }} />

      {/* ═══════════ PRODUCTS GRID ═══════════ */}
      <main className="max-w-6xl mx-auto px-4 py-8 pb-56">
        {filtered.length === 0 ? (
          <div className="text-center py-24">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[#F9F3E8] dark:bg-[#292620] mb-4">
              <svg className="w-8 h-8 text-[#C8A96E]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </div>
            <p className="text-[#7A766F] dark:text-[#A8A5A0] text-sm">Nenhum produto nesta categoria.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
            {filtered.map((p) => {
              const isSelected = !!selected.find((s) => s.id === p.id);
              const isOnDemand = p.onDemand;
              const isEsgotado = p.stockStatus === 'ESGOTADO';
              const isBaixo = p.stockStatus === 'BAIXO' && !isOnDemand;
              const gallery = (p.imageUrls && p.imageUrls.length > 0)
                ? p.imageUrls
                : (p.imageUrl ? [p.imageUrl] : []);
              const photoCount = gallery.length;
              const imgUrl = gallery[0] || `https://placehold.co/400x400/FAF7F2/C8A96E?text=${encodeURIComponent(p.sku)}`;

              return (
                <div key={p.id}
                  onClick={() => !isEsgotado && toggle(p)}
                  className={`group relative rounded-2xl overflow-hidden transition-all duration-300 
                    bg-white dark:bg-[#1C1A16] cursor-pointer
                    ${isEsgotado 
                      ? 'opacity-50 cursor-not-allowed ring-1 ring-[#E8E7E5] dark:ring-[#3D3A33]'
                      : isSelected 
                        ? 'ring-2 ring-[#C8A96E] shadow-xl shadow-[#C8A96E]/15 dark:shadow-[#C8A96E]/10 scale-[1.02]'
                        : 'ring-1 ring-[#F0E4CC]/60 dark:ring-[#3D3A33]/60 hover:ring-[#C8A96E]/50 hover:shadow-xl hover:shadow-[#C8A96E]/10 hover:-translate-y-1'
                    }`}
                >
                  {isSelected && (
                    <div className="absolute top-3 right-3 z-10">
                      <div className="flex items-center justify-center w-7 h-7 bg-gradient-to-br from-[#C8A96E] to-[#96784A] rounded-full shadow-lg">
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                  )}

                  {isEsgotado && (
                    <div className="absolute top-3 left-3 z-10 bg-[#5C584F] text-white text-[10px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wide">
                      Esgotado
                    </div>
                  )}
                  {isBaixo && !isSelected && !isEsgotado && (
                    <div className="absolute top-3 left-3 z-10 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wide">
                      Últimas peças
                    </div>
                  )}
                  {isOnDemand && !isSelected && (
                    <div className="absolute top-3 left-3 z-10 bg-gradient-to-r from-[#C8A96E] to-[#96784A] text-white text-[10px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wide">
                      Sob encomenda
                    </div>
                  )}

                  <div
                    className="relative aspect-square bg-gradient-to-br from-[#FAF7F2] to-[#F5F0EA] dark:from-[#292620] dark:to-[#1C1A16] overflow-hidden"
                    onClick={(e) => { e.stopPropagation(); setDetailProduct(p); }}
                  >
                    <img 
                      src={imgUrl} 
                      alt={p.name} 
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                    />
                    {!isEsgotado && (
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    )}
                    {photoCount > 1 && (
                      <div className="absolute bottom-2 right-2 z-10 flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[10px] font-medium text-white backdrop-blur-sm">
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 3.75h16.5v16.5H3.75V3.75z" />
                        </svg>
                        {photoCount}
                      </div>
                    )}
                  </div>

                  <div className="p-4">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <div className="w-1 h-1 rounded-full bg-[#C8A96E]" />
                      <span className="text-[10px] text-[#C8A96E] font-semibold uppercase tracking-[0.15em]">
                        {p.category}
                      </span>
                    </div>
                    
                    <h3 className="text-sm font-medium text-[#353229] dark:text-[#E8E7E5] leading-snug line-clamp-2 min-h-[2.5rem] mb-1">
                      {p.name}
                    </h3>
                    
                    <p className="text-[10px] text-[#A8A5A0] dark:text-[#5C584F] mb-1 font-mono">Ref: {p.sku}</p>
                    {isOnDemand && (
                      <p className="text-[10px] text-[#96784A] dark:text-[#D4B87A] mb-3 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {p.leadTimeDays ? `Entrega em até ${p.leadTimeDays} dias úteis` : 'Sob encomenda'}
                      </p>
                    )}
                    {!isOnDemand && <div className="mb-3" />}

                    <div className="flex items-center justify-between">
                      <span className="flex flex-col leading-tight">
                        {p.onSale && (
                          <span className="text-[11px] text-[#A8A5A0] dark:text-[#5C584F] line-through">
                            {BRL.format(p.salePrice)}
                          </span>
                        )}
                        <span className={`font-serif text-xl font-semibold ${p.onSale ? 'text-[#C8A96E]' : 'text-[#292620] dark:text-[#F5F0EA]'}`}>
                          {BRL.format(p.effectivePrice)}
                        </span>
                      </span>
                      {!isEsgotado && (
                        <button
                          onClick={(e) => { e.stopPropagation(); toggle(p); }}
                          className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all duration-300 ${
                            isSelected
                              ? 'bg-[#C8A96E] text-white shadow-sm'
                              : 'bg-[#F9F3E8] dark:bg-[#292620] text-[#96784A] dark:text-[#D4B87A] hover:bg-[#C8A96E] hover:text-white'
                          }`}
                        >
                          {isSelected ? '✓ Adicionado' : 'Selecionar'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Spacing for cart drawer */}
      </main>

      {/* ═══════════ PRODUCT DETAIL MODAL ═══════════ */}
      {detailProduct && (
        <ProductDetailModal
          product={detailProduct}
          isSelected={!!selected.find((s) => s.id === detailProduct.id)}
          onClose={() => setDetailProduct(null)}
          onToggle={() => toggle(detailProduct)}
        />
      )}

      {/* ═══════════ CART DRAWER ═══════════ */}
      {selected.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 md:bottom-6 md:right-6 md:left-auto md:w-[420px]">
          <div className="bg-white dark:bg-[#1C1A16] border border-[#C8A96E]/20 dark:border-[#4A3B25]/40 shadow-2xl shadow-black/10 dark:shadow-black/40 rounded-t-3xl md:rounded-3xl overflow-hidden">
            {/* Header — clicável para expandir/minimizar */}
            <button
              onClick={() => setCartExpanded((v) => !v)}
              aria-expanded={cartExpanded}
              aria-controls="cart-body"
              className="w-full bg-gradient-to-r from-[#C8A96E] to-[#B5935A] px-6 py-4 flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 bg-white/20 rounded-full">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                </div>
                <div className="flex flex-col">
                  <span className="text-white font-semibold text-sm leading-tight">
                    {selected.length} {selected.length === 1 ? 'peça selecionada' : 'peças selecionadas'}
                  </span>
                  {!cartExpanded && (
                    <span className="text-white/85 text-xs font-serif">
                      {BRL.format(selected.reduce((s, p) => s + p.effectivePrice, 0))}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {!cartExpanded && <span className="text-white/90 text-xs font-medium">Ver pedido</span>}
                <svg
                  className={`w-4 h-4 text-white transition-transform duration-300 ${cartExpanded ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                </svg>
              </div>
            </button>

            {/* Corpo — só quando expandido */}
            {cartExpanded && (
            <div id="cart-body">
            <div className="flex justify-end px-6 pt-2">
              <button onClick={() => setSelected([])} className="text-[#A8A5A0] hover:text-red-400 text-xs underline underline-offset-2 transition-colors">
                Limpar tudo
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto divide-y divide-[#F0E4CC]/40 dark:divide-[#3D3A33]/40">
              {selected.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-6 py-3 hover:bg-[#FDFBF7] dark:hover:bg-[#292620] transition-colors">
                  <div className="flex-1 min-w-0 pr-4">
                    <p className="text-sm text-[#353229] dark:text-[#E8E7E5] font-medium truncate">{p.name}</p>
                    <p className="text-[10px] text-[#A8A5A0] dark:text-[#5C584F] font-mono mt-0.5">Ref: {p.sku}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="flex flex-col items-end leading-tight">
                      {p.onSale && (
                        <span className="text-[10px] text-[#A8A5A0] dark:text-[#5C584F] line-through">
                          {BRL.format(p.salePrice)}
                        </span>
                      )}
                      <span className={`font-serif text-sm font-semibold ${p.onSale ? 'text-[#C8A96E]' : 'text-[#292620] dark:text-[#F5F0EA]'}`}>
                        {BRL.format(p.effectivePrice)}
                      </span>
                    </span>
                    <button
                      onClick={() => toggle(p)}
                      className="text-[#D4D2CF] dark:text-[#5C584F] hover:text-red-400 transition-colors p-1"
                      aria-label="Remover item"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-6 py-5 bg-gradient-to-b from-[#FDFBF7] dark:from-[#1C1A16] to-white dark:to-[#141210] border-t border-[#F0E4CC]/40 dark:border-[#3D3A33]/40">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-[#7A766F] dark:text-[#A8A5A0]">Total estimado</span>
                <span className="font-serif text-2xl font-bold text-[#292620] dark:text-[#F5F0EA]">
                  {BRL.format(selected.reduce((s, p) => s + p.effectivePrice, 0))}
                </span>
              </div>
              <button onClick={sendWhatsApp}
                className="w-full bg-[#25D366] hover:bg-[#20BD5A] text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2.5 transition-all duration-200 shadow-lg shadow-[#25D366]/25 hover:shadow-xl hover:shadow-[#25D366]/30 active:scale-[0.98]">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                Enviar pedido via WhatsApp
              </button>
              <p className="text-center text-[10px] text-[#A8A5A0] dark:text-[#5C584F] mt-2">Sem compromisso — finalize pelo chat</p>
            </div>
            </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════ FOOTER ═══════════ */}
      <footer className="bg-white dark:bg-[#1C1A16] border-t border-[#F0E4CC]/40 dark:border-[#3D3A33]/40 py-12 transition-colors">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <Logo className="h-16 mx-auto mb-6" />
          
          {/* Trust badges — here they reinforce confidence at decision point */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-[#96784A] dark:text-[#A8A5A0] mb-8">
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-[#C8A96E]" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
              </svg>
              <span>Folheado Ouro 18K, Prata 1000 e Ródio</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-[#C8A96E]" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
              </svg>
              <span>Não escurece e antialérgica</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-[#C8A96E]" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
              </svg>
              <span>Garantia de 1 ano · Envio para todo Brasil</span>
            </div>
          </div>

          <div className="w-16 h-px bg-[#E2CFA3]/40 dark:bg-[#3D3A33] mx-auto mb-6" />
          
          <p className="text-[13px] text-[#A8A5A0] dark:text-[#5C584F] italic max-w-xs mx-auto mb-6">
            "Amor leal. Bondade. Misericórdia. Fidelidade."
          </p>
          <div className="flex items-center justify-center gap-6">
            <a href="https://instagram.com/hesedsemijoias" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-[#7A766F] dark:text-[#A8A5A0] hover:text-[#C8A96E] transition-colors">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
              </svg>
              @hesedsemijoias
            </a>
            <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-[#7A766F] dark:text-[#A8A5A0] hover:text-[#25D366] transition-colors">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              WhatsApp
            </a>
          </div>
          <p className="mt-8 text-[10px] text-[#D4D2CF] dark:text-[#3D3A33]">© 2026 HESED Semijoias. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}


// ─── Promotion Banner Slider ─────────────────────────────────────────────────

interface PromotionSlide {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  productImageUrl: string | null;
  originalPrice: number;
  title: string;
  subtitle: string | null;
  discountPercent: number | null;
  promoPrice: number | null;
  bannerUrl: string | null;
}

function PromotionCarousel({ onSelectProduct }: { onSelectProduct: (productId: string) => void }) {
  const [slides, setSlides] = useState<PromotionSlide[]>([]);
  const [current, setCurrent] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    axios.get('/api/promotions').then((res) => setSlides(res.data));
  }, []);

  // Auto-play: advances every 4 seconds
  useEffect(() => {
    if (slides.length <= 1) return;
    intervalRef.current = setInterval(() => {
      advance();
    }, 4000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [slides.length]);

  function advance() {
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrent((prev) => (prev + 1) % slides.length);
      setIsTransitioning(false);
    }, 300);
  }

  function goTo(i: number) {
    if (i === current) return;
    // Reset auto-play timer
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrent(i);
      setIsTransitioning(false);
    }, 300);
    intervalRef.current = setInterval(() => advance(), 4000);
  }

  if (slides.length === 0) return null;

  const slide = slides[current];
  const imgUrl = slide.bannerUrl || slide.productImageUrl
    || `https://placehold.co/500x500/FAF7F2/C8A96E?font=playfair-display&text=${encodeURIComponent(slide.productSku)}`;

  return (
    <section className="max-w-6xl mx-auto px-4 pt-8 pb-6">
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-[#F9F3E8] to-[#FDF9F3] dark:from-[#1C1A16] dark:to-[#292620] border border-[#E2CFA3]/30 dark:border-[#3D3A33]/40">
        {/* Main content */}
        <div className={`flex flex-col sm:flex-row items-center gap-6 p-6 md:p-8 transition-opacity duration-300 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
          {/* Image */}
          <div className="w-full sm:w-48 md:w-64 aspect-square sm:aspect-auto sm:h-64 rounded-xl overflow-hidden bg-white dark:bg-[#292620] shadow-lg shrink-0">
            <img
              src={imgUrl}
              alt={slide.productName}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Text content */}
          <div className="flex-1 text-center sm:text-left">
            {slide.discountPercent && (
              <span className="inline-block bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full mb-3">
                {slide.discountPercent}% OFF
              </span>
            )}

            <h3 className="font-serif text-xl md:text-2xl font-semibold text-[#292620] dark:text-[#F5F0EA] mb-2 leading-tight">
              {slide.title}
            </h3>

            {slide.subtitle && (
              <p className="text-sm text-[#7A766F] dark:text-[#A8A5A0] mb-2">{slide.subtitle}</p>
            )}

            <p className="text-xs text-[#A8A5A0] dark:text-[#5C584F] mb-4">
              {slide.productName}
            </p>

            <div className="flex items-baseline gap-3 justify-center sm:justify-start mb-5">
              {slide.promoPrice != null && (
                <span className="font-serif text-2xl md:text-3xl font-bold text-[#C8A96E]">
                  {BRL.format(slide.promoPrice)}
                </span>
              )}
              {slide.originalPrice != null && slide.promoPrice != null && (
                <span className="text-sm text-[#A8A5A0] line-through">
                  {BRL.format(slide.originalPrice)}
                </span>
              )}
            </div>

            <button
              onClick={() => onSelectProduct(slide.productId)}
              className="inline-flex items-center gap-2 bg-[#C8A96E] hover:bg-[#B5935A] text-white text-sm font-semibold px-6 py-3 rounded-full transition-all shadow-md hover:shadow-lg active:scale-95"
            >
              Quero esta peça
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </button>
          </div>
        </div>

        {/* Navigation arrows */}
        {slides.length > 1 && (
          <>
            <button
              onClick={() => goTo((current - 1 + slides.length) % slides.length)}
              className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-9 h-9 rounded-full bg-white/80 dark:bg-[#292620]/80 text-[#7A766F] hover:text-[#C8A96E] shadow-md transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            <button
              onClick={() => goTo((current + 1) % slides.length)}
              className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-9 h-9 rounded-full bg-white/80 dark:bg-[#292620]/80 text-[#7A766F] hover:text-[#C8A96E] shadow-md transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </>
        )}

        {/* Dots */}
        {slides.length > 1 && (
          <div className="flex items-center justify-center gap-2 pb-4">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={`rounded-full transition-all duration-300 ${
                  i === current
                    ? 'w-7 h-2 bg-[#C8A96E]'
                    : 'w-2 h-2 bg-[#C8A96E]/30 hover:bg-[#C8A96E]/60'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}


// ─── Product Detail Modal (galeria de fotos) ─────────────────────────────────

function ProductDetailModal({ product, isSelected, onClose, onToggle }: {
  product: Product;
  isSelected: boolean;
  onClose: () => void;
  onToggle: () => void;
}) {
  const gallery = (product.imageUrls && product.imageUrls.length > 0)
    ? product.imageUrls
    : (product.imageUrl ? [product.imageUrl] : []);
  const hasPhotos = gallery.length > 0;
  const [active, setActive] = useState(0);
  const isOnDemand = product.onDemand;
  const isEsgotado = product.stockStatus === 'ESGOTADO' && !isOnDemand;

  // Fecha com ESC e bloqueia o scroll do fundo enquanto aberto
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && gallery.length > 1) setActive((i) => (i + 1) % gallery.length);
      if (e.key === 'ArrowLeft' && gallery.length > 1) setActive((i) => (i - 1 + gallery.length) % gallery.length);
    }
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [gallery.length, onClose]);

  const activeUrl = hasPhotos
    ? gallery[active]
    : `https://placehold.co/600x600/FAF7F2/C8A96E?text=${encodeURIComponent(product.sku)}`;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-[#1C1A16] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Fechar */}
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/85 dark:bg-[#292620]/85 text-[#7A766F] hover:text-[#C8A96E] shadow-md transition"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="flex flex-col md:flex-row">
          {/* Galeria */}
          <div className="w-full md:w-1/2 p-4 md:p-6">
            <div className="relative aspect-square overflow-hidden rounded-2xl bg-gradient-to-br from-[#FAF7F2] to-[#F5F0EA] dark:from-[#292620] dark:to-[#141210]">
              <img src={activeUrl} alt={product.name} className="h-full w-full object-cover" />

              {gallery.length > 1 && (
                <>
                  <button
                    onClick={() => setActive((i) => (i - 1 + gallery.length) % gallery.length)}
                    aria-label="Foto anterior"
                    className="absolute left-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 dark:bg-[#292620]/80 text-[#7A766F] hover:text-[#C8A96E] shadow-md transition"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setActive((i) => (i + 1) % gallery.length)}
                    aria-label="Próxima foto"
                    className="absolute right-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 dark:bg-[#292620]/80 text-[#7A766F] hover:text-[#C8A96E] shadow-md transition"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </button>
                </>
              )}
            </div>

            {/* Miniaturas */}
            {gallery.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-hide">
                {gallery.map((url, i) => (
                  <button
                    key={`${url}-${i}`}
                    onClick={() => setActive(i)}
                    className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 transition ${
                      i === active ? 'border-[#C8A96E]' : 'border-transparent opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={url} alt={`${product.name} ${i + 1}`} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex w-full flex-col md:w-1/2 p-4 md:p-6 md:pl-0">
            <div className="mb-1.5 flex items-center gap-1.5">
              <div className="h-1 w-1 rounded-full bg-[#C8A96E]" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#C8A96E]">
                {product.category}
              </span>
            </div>

            <h2 className="font-serif text-2xl font-semibold leading-snug text-[#292620] dark:text-[#F5F0EA]">
              {product.name}
            </h2>
            <p className="mt-1 font-mono text-[11px] text-[#A8A5A0] dark:text-[#5C584F]">Ref: {product.sku}</p>

            {isOnDemand && (
              <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#F9F3E8] dark:bg-[#292620] px-3 py-2 text-xs text-[#96784A] dark:text-[#D4B87A]">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>
                  <strong>Sob encomenda.</strong>{' '}
                  {product.leadTimeDays ? `Entrega em até ${product.leadTimeDays} dias úteis.` : 'Feito especialmente para você.'}
                </span>
              </div>
            )}

            {product.description && (
              <p className="mt-4 text-sm leading-relaxed text-[#7A766F] dark:text-[#A8A5A0]">
                {product.description}
              </p>
            )}

            <div className="mt-auto pt-6">
              <div className="mb-4 flex items-baseline gap-3">
                {product.onSale && (
                  <span className="font-serif text-lg text-[#A8A5A0] dark:text-[#5C584F] line-through">
                    {BRL.format(product.salePrice)}
                  </span>
                )}
                <span className={`font-serif text-3xl font-bold ${product.onSale ? 'text-[#C8A96E]' : 'text-[#292620] dark:text-[#F5F0EA]'}`}>
                  {BRL.format(product.effectivePrice)}
                </span>
                {product.onSale && product.discountPercent != null && (
                  <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {product.discountPercent}% OFF
                  </span>
                )}
              </div>

              {isEsgotado ? (
                <div className="rounded-xl bg-[#F5F0EA] dark:bg-[#292620] px-4 py-3 text-center text-sm font-medium text-[#7A766F] dark:text-[#A8A5A0]">
                  Produto esgotado no momento
                </div>
              ) : (
                <button
                  onClick={() => { onToggle(); }}
                  className={`w-full rounded-xl py-3.5 text-sm font-semibold transition-all duration-200 active:scale-[0.98] ${
                    isSelected
                      ? 'bg-[#F9F3E8] dark:bg-[#292620] text-[#96784A] dark:text-[#D4B87A] ring-1 ring-[#C8A96E]/40'
                      : 'bg-[#C8A96E] text-white shadow-lg shadow-[#C8A96E]/25 hover:bg-[#B5935A]'
                  }`}
                >
                  {isSelected ? '✓ Adicionado — remover' : 'Selecionar peça'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
