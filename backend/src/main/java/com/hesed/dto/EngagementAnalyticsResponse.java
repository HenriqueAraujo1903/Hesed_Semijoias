package com.hesed.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

/**
 * Analytics de engajamento do catálogo: topo/meio do funil.
 */
@Data
public class EngagementAnalyticsResponse {

    private Kpis kpis;
    private List<DayPoint> timeSeries;      // visitas e seleções por dia
    private List<SelectedProduct> topSelected;
    private Funnel funnel;

    @Data
    public static class Kpis {
        private long visits;            // eventos VIEW
        private long uniqueSessions;    // sessões distintas
        private long selections;        // eventos SELECT
        private long ordersCreated;     // pedidos no período (qualquer status)
        private long salesConfirmed;    // pedidos confirmados
    }

    @Data
    public static class DayPoint {
        private String period;   // yyyy-MM-dd
        private long visits;
        private long selections;
    }

    @Data
    public static class SelectedProduct {
        private String sku;
        private String name;
        private String category;
        private long selections;       // quantas vezes foi selecionado
        private long uniqueSessions;   // por quantas sessões distintas
    }

    /** Etapas do funil, com contagem e taxa de conversão relativa ao passo anterior. */
    @Data
    public static class Funnel {
        private long visits;
        private long selections;
        private long orders;
        private long sales;
        private BigDecimal visitToSelection;   // % visitas que geraram seleção
        private BigDecimal selectionToOrder;    // % seleções que viraram pedido
        private BigDecimal orderToSale;         // % pedidos que viraram venda
    }
}
