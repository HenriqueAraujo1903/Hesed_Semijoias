package com.hesed.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDate;

@Data
public class CustomerRequest {

    @NotBlank(message = "Nome obrigatório")
    @Size(min = 3, max = 120, message = "Nome deve ter entre 3 e 120 caracteres")
    private String name;

    /**
     * Telefone brasileiro. Aceita fixo (10 díg.) e celular (11 díg.), com ou sem
     * DDD entre parênteses, espaço ou traço. A validação é sobre a QUANTIDADE de
     * dígitos (10 ou 11), ignorando a máscara — cobre "(51) 98888-7777",
     * "51988887777", "51 3333-0000" etc.
     */
    @NotBlank(message = "Telefone obrigatório")
    @Pattern(regexp = "^\\(?\\d{2}\\)?[\\s-]?9?\\d{4}[\\s-]?\\d{4}$",
             message = "Telefone inválido. Use DDD + número, ex: (51) 98888-7777")
    private String phone;

    @Email(message = "E-mail inválido")
    private String email;

    /** Data de nascimento (opcional). Não pode ser no futuro. */
    @Past(message = "Data de nascimento deve ser no passado")
    private LocalDate birthDate;

    @Size(max = 1000, message = "Observações muito longas (máx. 1000 caracteres)")
    private String notes;
}
