package com.hesed.controllers;

import com.hesed.dto.CatalogEventRequest;
import com.hesed.services.CatalogEventService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class CatalogEventController {

    private static final Logger log = LoggerFactory.getLogger(CatalogEventController.class);

    private final CatalogEventService service;

    public CatalogEventController(CatalogEventService service) {
        this.service = service;
    }

    /**
     * Registro de evento de engajamento do catálogo (público, telemetria).
     * Nunca deve quebrar o catálogo: erros são logados e silenciados para o cliente
     * (retorna 202 mesmo assim). O log preserva visibilidade de falhas reais.
     */
    @PostMapping("/api/catalog-events")
    public ResponseEntity<Void> record(@RequestBody CatalogEventRequest request) {
        try {
            service.record(request);
        } catch (RuntimeException e) {
            // Não falha visível para o cliente, mas registra para diagnóstico.
            log.warn("Falha ao registrar evento de catálogo: {}", e.getMessage());
        }
        return ResponseEntity.status(HttpStatus.ACCEPTED).build();
    }
}
