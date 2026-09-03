package com.hesed.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Payload do dashboard de Revendedoras (consignação Fase 2).
 * Os números financeiros e o ranking consideram os lotes FECHADOS cujo
 * fechamento (closedAt) caiu no período. A lista de consignações em aberto é
 * sempre "agora" (independe do período), com o valor potencial das peças.
 */
@Data
public class ResellersAnalyticsResponse {

    private Kpis kpis;
    private List<ResellerRow> ranking;
    private List<OpenRow> openConsignments;

    @Data
    public static class Kpis {
        private BigDecimal totalSold;        // receita consignada realizada no período
        private BigDecimal commissionAmount; // comissão paga às revendedoras
        private BigDecimal netAmount;        // líquido da loja
        private BigDecimal sellThroughRate;  // % vendido/consignado (peças) nos fechados
        private long piecesConsigned;        // peças levadas (fechados no período)
        private long piecesSold;             // peças vendidas
        private long piecesReturned;         // peças devolvidas
        private long openCount;              // lotes abertos agora
        private long closedCount;            // lotes fechados no período
    }

    @Data
    public static class ResellerRow {
        private String name;
        private BigDecimal totalSold;
        private BigDecimal commissionAmount;
        private BigDecimal netAmount;
        private long batches;          // nº de lotes fechados no período
        private long piecesConsigned;
        private long piecesSold;
        private BigDecimal sellThroughRate; // % vendido/consignado desta revendedora
    }

    @Data
    public static class OpenRow {
        private UUID id;
        private String consigneeName;
        private LocalDateTime openedAt;
        private long pieces;
        private BigDecimal potentialValue;
    }
}
