package com.hesed.dto;

import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class ConsigneeRequest {

    @NotBlank(message = "Nome obrigatório")
    @Size(min = 3, max = 100, message = "Nome deve ter entre 3 e 100 caracteres")
    private String name;

    @NotBlank(message = "Telefone obrigatório")
    @Pattern(regexp = "^\\(?\\d{2}\\)?[\\s-]?[\\d\\s-]{8,9}$", message = "Telefone inválido")
    private String phone;

    @Email(message = "E-mail inválido")
    private String email;

    @NotNull(message = "Taxa de comissão obrigatória")
    @DecimalMin(value = "0.0", message = "Comissão não pode ser negativa")
    @DecimalMax(value = "1.0", message = "Comissão não pode ultrapassar 100%")
    private BigDecimal commissionRate;
}
