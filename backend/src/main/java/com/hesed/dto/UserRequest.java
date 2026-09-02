package com.hesed.dto;

import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class UserRequest {

    @NotBlank(message = "Nome obrigatório")
    @Size(min = 3, max = 100, message = "Nome deve ter entre 3 e 100 caracteres")
    private String name;

    @NotBlank(message = "E-mail obrigatório")
    @Email(message = "E-mail inválido")
    private String email;

    // Telefone opcional e informativo. Aceita formatos BR comuns: com/sem DDD,
    // com/sem parênteses, espaço, traço. 10 a 11 dígitos numéricos no total.
    @Pattern(regexp = "^$|^\\(?\\d{2}\\)?[\\s-]?\\d{4,5}[\\s-]?\\d{4}$", message = "Telefone inválido")
    private String phone;

    /**
     * Senha inicial (obrigatória na criação; opcional na edição — se em branco,
     * mantém a senha atual). O mesmo DTO serve create e update, por isso o
     * padrão aceita vazio (mantém a atual) OU 6–100 caracteres. A
     * obrigatoriedade na criação é validada no service.
     */
    @Pattern(regexp = "^$|^.{6,100}$", message = "Senha deve ter entre 6 e 100 caracteres")
    private String password;

    @NotBlank(message = "Papel obrigatório")
    @Pattern(regexp = "ROLE_ADMIN|ROLE_OPERATOR", message = "Papel inválido")
    private String role;
}
