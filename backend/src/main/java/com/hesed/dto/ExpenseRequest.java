package com.hesed.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Criação/edição de uma despesa. Quando {@code installmentsCount > 1}, o
 * serviço gera as parcelas automaticamente a partir de {@code firstDueDate}
 * (uma por mês). Se {@code firstDueDate} não vier, usa a data de competência.
 */
@Data
public class ExpenseRequest {

    @NotBlank(message = "Informe a descrição da despesa.")
    @Size(max = 200)
    private String description;

    @NotNull(message = "Informe a categoria da despesa.")
    private UUID categoryId;

    /** Opcional: fornecedor associado à despesa. */
    private UUID supplierId;

    @NotNull(message = "Informe o valor total.")
    @DecimalMin(value = "0.01", message = "O valor deve ser maior que zero.")
    private BigDecimal totalAmount;

    @NotNull(message = "Informe a data de competência.")
    private LocalDate competenceDate;

    @Min(value = 1, message = "O número de parcelas deve ser ao menos 1.")
    private Integer installmentsCount;

    /** Vencimento da primeira parcela (as demais caem no mesmo dia dos meses seguintes). */
    private LocalDate firstDueDate;

    private String notes;
}
