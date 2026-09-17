package com.hesed.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

/**
 * Fluxo de caixa consolidado de um período. Entradas e saídas vêm de três
 * fontes unificadas:
 *   Entradas: pagamentos recebidos (líquido) + lançamentos manuais ENTRADA
 *   Saídas:   parcelas de despesa pagas + taxas de pagamento + lançamentos manuais SAIDA
 *
 * Traz os totais, o resultado líquido do período e a lista de movimentos
 * individuais (para o extrato), ordenados por data.
 */
@Data
public class CashFlowResponse {
    private BigDecimal totalInflow;
    private BigDecimal totalOutflow;
    private BigDecimal net;              // inflow - outflow
    private List<Movement> movements;

    @Data
    public static class Movement {
        private String date;             // yyyy-MM-dd
        private String type;             // ENTRADA | SAIDA
        private String source;           // PAGAMENTO | DESPESA | TAXA | MANUAL
        private String description;
        private BigDecimal amount;       // sempre positivo
    }
}
