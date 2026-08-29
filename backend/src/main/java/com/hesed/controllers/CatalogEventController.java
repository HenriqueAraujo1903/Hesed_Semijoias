package com.hesed.controllers;

import com.hesed.dto.CatalogEventRequest;
import com.hesed.services.CatalogEventService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class CatalogEventController {

    private final CatalogEventService service;

    public CatalogEventController(CatalogEventService service) {
        this.service = service;
    }

    /**
     * Registro de evento de engajamento do catálogo (público, telemetria).
     * Nunca deve quebrar o catálogo: erros são silenciados (retorna 202 mesmo assim).
     */
    @PostMapping("/api/catalog-events")
    public ResponseEntity<Void> record(@RequestBody CatalogEventRequest request) {
        try {
            service.record(request);
        } catch (RuntimeException e) {
            // Telemetria não deve falhar visível para o cliente; apenas ignora.
        }
        return ResponseEntity.status(HttpStatus.ACCEPTED).build();
    }
}
