package com.hesed.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

/**
 * Payload do resumo executivo da Visão Geral (tela inicial do admin).
 * Agrega KPIs do mês vigente, meta resolvida (com herança), progresso vs meta,
 * contagens de catálogo/revendedoras, alertas de estoque/garantia e a série de
 * receita dos últimos 6 meses. Fonte única da verdade para o "mês vigente".
 */
@Data
public class OverviewResponse {

    /** Mês de referência do resumo (mês corrente). */
    private int year;
    private int month;

    /** KPIs do mês vigente (vendas confirmadas). */
    private MonthKpis month_kpis;

    /** Meta efetiva do mês (própria ou herdada). */
    private GoalResponse goal;

    /** Progresso vs meta, em % (0-100+; null quando não há meta definida). */
    private Progress progress;

    /** Contagem de pedidos por status (todos os tempos). */
    private OrdersSummary orders;

    /** Totais de catálogo e revendedoras. */
    private Counts counts;

    /** Alertas acionáveis de estoque e garantia. */
    private Alerts alerts;

    /** Receita confirmada dos últimos 6 meses (para mini gráfico). */
    private List<RevenuePoint> revenue6m;

    @Data
    public static class MonthKpis {
        private BigDecimal revenue;
        private long orders;
        private long items;
        private BigDecimal averageTicket;
        private BigDecimal margin;
        private BigDecimal marginPercent;
    }

    @Data
    public static class Progress {
        /** % da meta de receita atingida (null se sem meta de receita). */
        private BigDecimal revenuePercent;
        /** % da meta de pedidos atingida (null se sem meta de pedidos). */
        private BigDecimal ordersPercent;
    }

    @Data
    public static class OrdersSummary {
        private long pendente;
        private long confirmado;
        private long cancelado;
    }

    @Data
    public static class Counts {
        private long products;
        private long consignees;
    }

    @Data
    public static class Alerts {
        /** Quantidade de produtos com estoque baixo ou esgotado. */
        private long lowStock;
        /** Garantias já vencidas. */
        private long warrantyExpired;
        /** Garantias vencendo na janela de alerta. */
        private long warrantyExpiring;
    }

    @Data
    public static class RevenuePoint {
        private String period; // yyyy-MM
        private BigDecimal revenue;
        private long orders;
    }
}
