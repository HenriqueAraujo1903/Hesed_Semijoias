package com.hesed.dto;

import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class CategoryRequest {

    @NotBlank(message = "Nome obrigatório")
    @Size(min = 2, max = 50, message = "Nome deve ter entre 2 e 50 caracteres")
    private String name;

    /** Opcional; default true. */
    private Boolean active;

    /** Opcional; default 0. */
    @PositiveOrZero(message = "Ordem não pode ser negativa")
    private Integer sortOrder;
}
