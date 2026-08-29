package com.hesed.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.UUID;

/**
 * Evento de engajamento enviado pelo catálogo público.
 * type: VIEW (visita) ou SELECT (produto selecionado).
 * Para SELECT, productId é usado para snapshot server-side.
 */
@Data
public class CatalogEventRequest {

    @NotBlank(message = "Tipo de evento obrigatório.")
    private String type;

    private String sessionId;

    private UUID productId;
}
