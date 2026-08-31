package com.hesed.dto;

import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class SupplierRequest {

    @NotBlank(message = "Nome obrigatório")
    @Size(min = 2, max = 120, message = "Nome deve ter entre 2 e 120 caracteres")
    private String name;

    @Size(max = 60, message = "Telefone deve ter no máximo 60 caracteres")
    private String phone;

    @Email(message = "E-mail inválido")
    @Size(max = 120, message = "E-mail deve ter no máximo 120 caracteres")
    private String email;

    @Size(max = 300, message = "Site deve ter no máximo 300 caracteres")
    private String website;

    @Size(max = 1000, message = "Notas devem ter no máximo 1000 caracteres")
    private String notes;
}
