package com.hesed.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ExpenseCategoryRequest {
    @NotBlank(message = "Informe o nome da categoria.")
    @Size(max = 80)
    private String name;

    private Boolean active;
    private Integer sortOrder;
}
