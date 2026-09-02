package com.hesed.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * Edição de um template de mensagem. Só o corpo e o estado (ativo) são
 * editáveis — a chave e o título são fixos (definidos no seed).
 */
@Data
public class MessageTemplateRequest {

    @NotBlank(message = "A mensagem não pode ficar vazia")
    @Size(max = 2000, message = "A mensagem é muito longa (máx. 2000 caracteres)")
    private String body;

    @NotNull(message = "Informe se a mensagem está ativa")
    private Boolean active;
}
