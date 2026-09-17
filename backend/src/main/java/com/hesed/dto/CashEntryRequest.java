package com.hesed.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class CashEntryRequest {

    /** ENTRADA | SAIDA */
    @NotBlank(message = "Informe o tipo (ENTRADA ou SAIDA).")
    private String type;

    @NotBlank(message = "Informe a descrição do lançamento.")
    @Size(max = 200)
    private String description;

    @NotNull(message = "Informe o valor.")
    @DecimalMin(value = "0.01", message = "O valor deve ser maior que zero.")
    private BigDecimal amount;

    @NotNull(message = "Informe a data do lançamento.")
    private LocalDate entryDate;

    private String notes;
}
