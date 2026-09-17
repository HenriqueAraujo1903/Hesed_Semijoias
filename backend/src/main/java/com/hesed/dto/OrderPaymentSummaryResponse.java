package com.hesed.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * Situação de pagamento de um pedido: total do pedido, quanto já foi recebido,
 * o que falta, o status derivado (PENDENTE/PARCIAL/PAGO) e a lista de pagamentos.
 */
@Data
public class OrderPaymentSummaryResponse {
    private UUID orderId;
    private String orderNumber;
    private String customerName;
    private BigDecimal orderTotal;
    private BigDecimal paidGross;
    private BigDecimal remaining;
    /** PENDENTE | PARCIAL | PAGO */
    private String paymentStatus;
    private List<PaymentResponse> payments;
}
