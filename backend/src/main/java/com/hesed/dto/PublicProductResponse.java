package com.hesed.dto;

import com.hesed.models.Product;
import com.hesed.models.Promotion;
import lombok.Data;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.UUID;

/**
 * Visão PÚBLICA do produto (catálogo, sem autenticação).
 *
 * Deliberadamente NÃO expõe dados internos de negócio: preço de custo,
 * preço do fornecedor, quantidade numérica em estoque, limiar, fornecedor
 * ou data de compra. Esses campos são segredo comercial e só aparecem na
 * visão admin (ProductResponse), protegida por autenticação.
 *
 * Preço: `salePrice` é o preço cheio; `effectivePrice` é o que o cliente
 * realmente paga (já com a promoção ativa aplicada). Quando `onSale` é true,
 * `salePrice` serve de referência riscada e `effectivePrice` é o preço promocional.
 */
@Data
public class PublicProductResponse {
    private UUID id;
    private String sku;
    private String name;
    private String description;
    private String category;
    private String imageUrl;
    private List<String> imageUrls;
    private BigDecimal salePrice;       // preço cheio (referência)
    private BigDecimal effectivePrice;  // preço a pagar (com promoção, se houver)
    private boolean onSale;
    private BigDecimal discountPercent; // % de desconto, quando a promo usa percentual
    private String stockStatus;

    /** Sem promoção: effectivePrice = salePrice. */
    public static PublicProductResponse from(Product p) {
        return from(p, null);
    }

    /**
     * Com a promoção ativa resolvida (ou null). O cálculo do preço efetivo é o
     * MESMO usado ao registrar o pedido (OrderService), garantindo que o cliente
     * pague exatamente o que vê no catálogo.
     */
    public static PublicProductResponse from(Product p, Promotion promo) {
        PublicProductResponse r = new PublicProductResponse();
        r.setId(p.getId());
        r.setSku(p.getSku());
        r.setName(p.getName());
        r.setDescription(p.getDescription());
        r.setCategory(p.getCategory());
        r.setImageUrl(p.getImageUrl());
        r.setImageUrls(p.getImageUrls());
        r.setStockStatus(p.getStockStatus());

        BigDecimal salePrice = p.getSalePrice();
        r.setSalePrice(salePrice);

        BigDecimal effective = salePrice;
        boolean onSale = false;
        BigDecimal discountPercent = null;

        if (promo != null && salePrice != null) {
            if (promo.getPromoPrice() != null) {
                effective = promo.getPromoPrice();
                onSale = true;
            } else if (promo.getDiscountPercent() != null) {
                BigDecimal factor = BigDecimal.ONE.subtract(
                        promo.getDiscountPercent().divide(BigDecimal.valueOf(100)));
                effective = salePrice.multiply(factor).setScale(2, RoundingMode.HALF_UP);
                discountPercent = promo.getDiscountPercent();
                onSale = true;
            }
        }

        r.setEffectivePrice(effective);
        r.setOnSale(onSale);
        r.setDiscountPercent(discountPercent);
        return r;
    }
}
