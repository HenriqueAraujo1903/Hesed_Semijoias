package com.hesed.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class StockAdjustRequest {

    /** "ENTRADA" (soma quantity) ou "AJUSTE" (define quantity como valor absoluto). */
    @NotNull(message = "Modo obrigatório (ENTRADA ou AJUSTE)")
    private String mode;

    @NotNull(message = "Quantidade obrigatória")
    private Integer quantity;

    private String reason;
}
