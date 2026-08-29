package com.hesed.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

/**
 * Payload analítico do dashboard de vendas.
 * Considera apenas pedidos do status solicitado (default CONFIRMADO).
 */
@Data
public class SalesAnalyticsResponse {

    private Kpis kpis;
    private List<TimePoint> timeSeries;
    private List<CategorySlice> byCategory;
    private List<ProductRow> topProducts;
    private PromotionSplit promotionSplit;
    private Conversion conversion;

    @Data
    public static class Kpis {
        private BigDecimal revenue;        // receita (soma effectivePrice)
        private BigDecimal cost;           // custo total (soma costPrice)
        private BigDecimal margin;         // receita - custo
        private BigDecimal marginPercent;  // margem / receita * 100
        private long orders;               // nº de pedidos
        private long items;                // nº de itens
        private BigDecimal averageTicket;  // receita / nº de pedidos
    }

    @Data
    public static class TimePoint {
        private String period;      // yyyy-MM-dd | yyyy-MM | yyyy
        private BigDecimal revenue;
        private long items;
        private long orders;
    }

    @Data
    public static class CategorySlice {
        private String category;
        private BigDecimal revenue;
        private long items;
    }

    @Data
    public static class ProductRow {
        private String sku;
        private String name;
        private String category;
        private BigDecimal revenue;
        private long items;
    }

    @Data
    public static class PromotionSplit {
        private BigDecimal promoRevenue;
        private long promoItems;
        private BigDecimal regularRevenue;
        private long regularItems;
    }

    @Data
    public static class Conversion {
        private long totalOrders;      // todos os pedidos no período (qualquer status)
        private long confirmedOrders;
        private long pendingOrders;
        private long cancelledOrders;
        private BigDecimal conversionRate; // confirmados / total * 100
    }
}
