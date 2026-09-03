package com.hesed.controllers;

import com.hesed.dto.ConsignmentRequest;
import com.hesed.dto.ConsignmentResponse;
import com.hesed.dto.ConsignmentSettleRequest;
import com.hesed.services.ConsignmentService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Gestão de lotes de consignação (admin). Rotas sob /api/admin/** já herdam o
 * RBAC de ROLE_ADMIN do SecurityConfig.
 */
@RestController
public class ConsignmentController {

    private final ConsignmentService consignmentService;

    public ConsignmentController(ConsignmentService consignmentService) {
        this.consignmentService = consignmentService;
    }

    /** Lista lotes; filtro opcional por status (ABERTO/FECHADO/CANCELADO). */
    @GetMapping("/api/admin/consignments")
    public ResponseEntity<List<ConsignmentResponse>> list(@RequestParam(required = false) String status) {
        return ResponseEntity.ok(consignmentService.findAll(status));
    }

    @GetMapping("/api/admin/consignments/{id}")
    public ResponseEntity<?> get(@PathVariable UUID id) {
        try {
            return ResponseEntity.ok(consignmentService.findById(id));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /** Abre um lote: reserva o estoque dos itens. */
    @PostMapping("/api/admin/consignments")
    public ResponseEntity<?> open(@Valid @RequestBody ConsignmentRequest request) {
        try {
            ConsignmentResponse response = consignmentService.open(request);
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /** Salva o acerto (quantidades vendidas) sem fechar o lote. */
    @PutMapping("/api/admin/consignments/{id}/settle")
    public ResponseEntity<?> settle(@PathVariable UUID id, @Valid @RequestBody ConsignmentSettleRequest request) {
        try {
            return ResponseEntity.ok(consignmentService.settle(id, request));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /** Fecha o lote: baixa vendidos, devolve o resto, gera venda CONSIGNADO e apura comissão. */
    @PostMapping("/api/admin/consignments/{id}/close")
    public ResponseEntity<?> close(@PathVariable UUID id, @RequestBody(required = false) ConsignmentSettleRequest request) {
        try {
            return ResponseEntity.ok(consignmentService.close(id, request));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /** Cancela um lote aberto: libera todo o estoque reservado. */
    @PostMapping("/api/admin/consignments/{id}/cancel")
    public ResponseEntity<?> cancel(@PathVariable UUID id) {
        try {
            return ResponseEntity.ok(consignmentService.cancel(id));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
