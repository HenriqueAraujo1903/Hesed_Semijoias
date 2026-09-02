package com.hesed.dto;

import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class GoalRequest {

    @NotNull(message = "Ano obrigatório")
    @Min(value = 2020, message = "Ano inválido")
    @Max(value = 2100, message = "Ano inválido")
    private Integer year;

    @NotNull(message = "Mês obrigatório")
    @Min(value = 1, message = "Mês deve ser entre 1 e 12")
    @Max(value = 12, message = "Mês deve ser entre 1 e 12")
    private Integer month;

    @PositiveOrZero(message = "Meta de receita não pode ser negativa")
    private BigDecimal revenueTarget;

    @PositiveOrZero(message = "Meta de pedidos não pode ser negativa")
    private Integer ordersTarget;

    /**
     * Justificativa da alteração. Obrigatória apenas quando já existe uma meta
     * salva para o mês (a meta fica "travada" após criada). Ignorada na criação.
     */
    @Size(max = 500, message = "Justificativa muito longa (máx. 500 caracteres)")
    private String changeReason;
}
