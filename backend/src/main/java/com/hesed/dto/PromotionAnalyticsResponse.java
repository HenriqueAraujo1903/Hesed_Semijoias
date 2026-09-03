package com.hesed.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

/**
 * Payload do dashboard de Promoções. Os números de venda (split, top produtos,
 * receita/itens em promoção, desconto concedido) respeitam o período informado;
 * a lista de promoções ativas é sempre "agora" (independe do período).
 */
@Data
public class PromotionAnalyticsResponse {

    private Kpis kpis;
    private Split split;
    private List<ProductRow> topPromoProducts;
    private List<PromotionResponse> activePromotions;

    @Data
    public static class Kpis {
        private long activeCount;         // promoções ativas agora
        private long totalCount;          // promoções cadastradas
        private BigDecimal promoRevenue;  // receita de itens em promoção (período)
        private long promoItems;          // itens vendidos em promoção (período)
        private BigDecimal promoShare;    // % da receita total que veio de promoção
        private BigDecimal discountGranted; // desconto concedido (preço cheio - efetivo)
    }

    @Data
    public static class Split {
        private BigDecimal promoRevenue;
        private long promoItems;
        private BigDecimal regularRevenue;
        private long regularItems;
    }

    @Data
    public static class ProductRow {
        private String sku;
        private String name;
        private String category;
        private BigDecimal revenue;
        private long items;
    }
}
