package com.hesed.controllers;

import com.hesed.dto.PurchaseBatchRequest;
import com.hesed.dto.PurchaseBatchResponse;
import com.hesed.services.PurchaseService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Entrada de compra em lote. Sob /api/admin/stock/purchases — herda ROLE_ADMIN.
 */
@RestController
@RequestMapping("/api/admin/stock/purchases")
public class PurchaseController {

    private final PurchaseService purchaseService;

    public PurchaseController(PurchaseService purchaseService) {
        this.purchaseService = purchaseService;
    }

    @GetMapping
    public ResponseEntity<List<PurchaseBatchResponse>> list() {
        return ResponseEntity.ok(purchaseService.listBatches());
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> get(@PathVariable UUID id) {
        try {
            return ResponseEntity.ok(purchaseService.getBatch(id));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping
    public ResponseEntity<?> create(@Valid @RequestBody PurchaseBatchRequest req) {
        try {
            return ResponseEntity.status(HttpStatus.CREATED).body(purchaseService.createBatch(req));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
