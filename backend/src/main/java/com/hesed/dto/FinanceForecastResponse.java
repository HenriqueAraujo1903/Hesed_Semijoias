package com.hesed.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

/**
 * Projeção financeira factual para o Dashboard Financeiro. Combina três visões:
 *
 *  (1) PRESENTE — a foto de agora: saldo do mês corrente (caixa realizado no
 *      mês), total a receber em aberto (liquidações PENDENTE) e total a pagar
 *      em aberto (parcelas de despesa PENDENTE), além do resultado do mês (DRE).
 *
 *  (2) HISTÓRICO — série de caixa REALIZADO mês a mês (entradas, saídas, saldo)
 *      dos últimos meses, para o gráfico do "presente/tendência".
 *
 *  (3) FUTURO — projeção mês a mês do que JÁ ESTÁ LANÇADO: recebíveis previstos
 *      (liquidações de cartão a repassar) menos contas a pagar previstas
 *      (parcelas de despesa a vencer), com saldo projetado acumulado. Não é
 *      previsão estatística de vendas — apenas o que já está contratado.
 */
@Data
public class FinanceForecastResponse {

    /** Foto do momento (valores em aberto e do mês corrente). */
    private BigDecimal currentMonthNet;        // saldo de caixa realizado no mês atual
    private BigDecimal currentMonthInflow;     // entradas do mês atual
    private BigDecimal currentMonthOutflow;    // saídas do mês atual
    private BigDecimal receivablesOpen;        // total a receber em aberto (settlements PENDENTE)
    private BigDecimal payablesOpen;           // total a pagar em aberto (parcelas PENDENTE)
    private BigDecimal openBalance;            // receivablesOpen - payablesOpen
    private BigDecimal overduePayables;        // parcelas PENDENTE vencidas (dueDate < hoje)
    private BigDecimal currentMonthResult;     // resultado do mês (DRE: netResult)

    /** Série de caixa realizado dos últimos meses. */
    private List<MonthPoint> history;

    /** Projeção dos próximos meses (inclui o mês corrente como 1º ponto). */
    private List<ForecastPoint> forecast;

    /** Ponto de caixa realizado de um mês (histórico). */
    @Data
    public static class MonthPoint {
        private String period;                 // yyyy-MM
        private BigDecimal inflow;
        private BigDecimal outflow;
        private BigDecimal net;                // inflow - outflow
    }

    /** Ponto de projeção de um mês futuro (o que já está lançado). */
    @Data
    public static class ForecastPoint {
        private String period;                 // yyyy-MM
        private BigDecimal expectedReceivables; // liquidações previstas a receber no mês
        private BigDecimal expectedPayables;    // parcelas de despesa a vencer no mês
        private BigDecimal net;                 // recebíveis - a pagar do mês
        private BigDecimal cumulativeNet;       // saldo projetado acumulado (soma dos net)
    }
}
