package com.hesed.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

/**
 * DRE simplificada de um período (tipicamente um mês):
 *
 *   Receita de vendas (pedidos CONFIRMADO, inclui consignados)
 *   (-) CMV (custo dos produtos vendidos — conta uma única vez)
 *   = Margem bruta
 *   (-) Comissões de consignação (dedução de venda, separada do CMV)
 *   (-) Despesas operacionais (por competência, agrupadas por categoria)
 *   (-) Taxas de pagamento (maquininha etc.)
 *   = Resultado líquido
 *
 * Importante (regra do custo consignado): o CMV já inclui o costPrice dos itens
 * vendidos em pedidos CONSIGNADO — o custo do fornecedor conta UMA vez, na venda.
 * A comissão da revendedora NÃO é custo do produto; entra como dedução separada.
 */
@Data
public class IncomeStatementResponse {
    private int year;
    private int month;

    private BigDecimal revenue;
    private BigDecimal cogs;              // CMV
    private BigDecimal grossMargin;       // revenue - cogs
    private BigDecimal grossMarginPercent;

    private BigDecimal consignmentCommissions;
    private BigDecimal paymentFees;
    private BigDecimal operatingExpenses; // soma das despesas por competência

    private BigDecimal netResult;         // grossMargin - comissões - taxas - despesas
    private BigDecimal netResultPercent;

    private List<ExpenseCategoryTotal> expensesByCategory;

    @Data
    public static class ExpenseCategoryTotal {
        private String category;
        private BigDecimal total;
    }
}
