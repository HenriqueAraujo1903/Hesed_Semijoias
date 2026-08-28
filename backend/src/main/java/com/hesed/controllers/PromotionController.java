package com.hesed.controllers;

import com.hesed.dto.PromotionRequest;
import com.hesed.dto.PromotionResponse;
import com.hesed.services.PromotionService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
public class PromotionController {

    private final PromotionService promotionService;

    public PromotionController(PromotionService promotionService) {
        this.promotionService = promotionService;
    }

    // Public: active promotions for catalog carousel
    @GetMapping("/api/promotions")
    public ResponseEntity<List<PromotionResponse>> getActive() {
        return ResponseEntity.ok(promotionService.findActive());
    }

    // Admin: all promotions (including inactive/expired)
    @GetMapping("/api/admin/promotions")
    public ResponseEntity<List<PromotionResponse>> getAll() {
        return ResponseEntity.ok(promotionService.findAll());
    }

    @PostMapping("/api/admin/promotions")
    public ResponseEntity<?> create(@Valid @RequestBody PromotionRequest request) {
        try {
            PromotionResponse response = promotionService.create(request);
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/api/admin/promotions/{id}")
    public ResponseEntity<?> update(@PathVariable UUID id, @Valid @RequestBody PromotionRequest request) {
        try {
            PromotionResponse response = promotionService.update(id, request);
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PatchMapping("/api/admin/promotions/{id}/toggle")
    public ResponseEntity<?> toggleActive(@PathVariable UUID id) {
        try {
            PromotionResponse response = promotionService.toggleActive(id);
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/api/admin/promotions/{id}")
    public ResponseEntity<?> delete(@PathVariable UUID id) {
        try {
            promotionService.delete(id);
            return ResponseEntity.ok(Map.of("ok", true));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
