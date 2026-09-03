package com.hesed.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Payload do dashboard de Estoque. Considera apenas o estoque próprio
 * (produtos sob encomenda ficam de fora dos números de estoque).
 */
@Data
public class StockAnalyticsResponse {

    private Kpis kpis;
    private List<CategorySlice> byCategory;
    private List<CriticalItem> critical;
    private List<Movement> recentMovements;

    @Data
    public static class Kpis {
        private long skus;              // nº de produtos (estoque próprio)
        private long units;             // soma de unidades em estoque
        private BigDecimal costValue;   // valor imobilizado a custo (custo*qtd)
        private BigDecimal saleValue;   // valor potencial de venda (venda*qtd)
        private long available;         // produtos DISPONIVEL
        private long low;               // produtos BAIXO
        private long out;               // produtos ESGOTADO
    }

    @Data
    public static class CategorySlice {
        private String category;
        private long skus;
        private long units;
        private BigDecimal costValue;
        private BigDecimal saleValue;
    }

    @Data
    public static class CriticalItem {
        private String sku;
        private String name;
        private String category;
        private int stockQuantity;
        private String stockStatus;   // BAIXO | ESGOTADO
    }

    @Data
    public static class Movement {
        private String sku;
        private String productName;
        private String type;          // ENTRADA | SAIDA | AJUSTE | ESTORNO
        private int delta;
        private int resultingQuantity;
        private String reason;
        private LocalDateTime at;
    }
}
