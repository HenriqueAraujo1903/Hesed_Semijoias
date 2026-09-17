package com.hesed.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Registro de um pagamento recebido de um pedido. O valor líquido é derivado
 * no serviço (grossAmount - feeAmount); o cliente não o informa.
 */
@Data
public class PaymentRequest {

    @NotBlank(message = "Informe a forma de pagamento.")
    private String method;

    @NotNull(message = "Informe o valor recebido.")
    @DecimalMin(value = "0.01", message = "O valor deve ser maior que zero.")
    private BigDecimal grossAmount;

    /** Taxa cobrada pelo meio de pagamento (ex.: maquininha). Opcional, default 0. */
    private BigDecimal feeAmount;

    /**
     * Nº de parcelas (só relevante para cartão de crédito). Default 1.
     * Cada parcela gera uma liquidação a cada 30 dias a partir de D+30.
     */
    private Integer installments;

    /** Momento do recebimento. Opcional; default = agora. */
    private LocalDateTime paidAt;

    private String notes;
}
