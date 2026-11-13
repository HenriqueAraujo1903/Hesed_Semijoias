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
    private List<HourPoint> byHour;         // distribuição por hora do dia (0..23, horário de Brasília)
    private List<ShiftPoint> byShift;       // totais por turno (Madrugada/Manhã/Tarde/Noite)

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

    /** Um ponto por hora do dia (0..23), no horário de Brasília. */
    @Data
    public static class HourPoint {
        private int hour;        // 0..23
        private long visits;
        private long selections;
    }

    /** Total por turno do dia. */
    @Data
    public static class ShiftPoint {
        private String shift;    // MADRUGADA | MANHA | TARDE | NOITE
        private String label;    // "Madrugada" | "Manhã" | "Tarde" | "Noite"
        private String range;    // "00h–05h" etc.
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
