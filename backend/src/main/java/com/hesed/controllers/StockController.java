package com.hesed.controllers;

import com.hesed.dto.ProductResponse;
import com.hesed.dto.StockAdjustRequest;
import com.hesed.models.Product;
import com.hesed.models.StockMovement;
import com.hesed.repositories.ProductRepository;
import com.hesed.repositories.StockMovementRepository;
import com.hesed.services.StockService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/stock")
public class StockController {

    private final StockService stockService;
    private final ProductRepository productRepository;
    private final StockMovementRepository movementRepository;

    public StockController(StockService stockService,
                           ProductRepository productRepository,
                           StockMovementRepository movementRepository) {
        this.stockService = stockService;
        this.productRepository = productRepository;
        this.movementRepository = movementRepository;
    }

    /** Ajuste manual de estoque: ENTRADA (soma) ou AJUSTE (define valor absoluto). */
    @PostMapping("/{productId}/adjust")
    public ResponseEntity<?> adjust(@PathVariable UUID productId, @Valid @RequestBody StockAdjustRequest req) {
        try {
            String mode = req.getMode() == null ? "" : req.getMode().trim().toUpperCase();
            Product updated;
            if ("ENTRADA".equals(mode)) {
                updated = stockService.addStock(productId, req.getQuantity(), req.getReason());
            } else if ("AJUSTE".equals(mode)) {
                updated = stockService.setAbsolute(productId, req.getQuantity(), req.getReason());
            } else {
                return ResponseEntity.badRequest().body(Map.of("error", "Modo inválido. Use ENTRADA ou AJUSTE."));
            }
            return ResponseEntity.ok(ProductResponse.from(updated));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /** Histórico de movimentações de um produto. */
    @GetMapping("/{productId}/movements")
    public ResponseEntity<?> movements(@PathVariable UUID productId) {
        List<Map<String, Object>> out = movementRepository.findByProductIdOrderByCreatedAtDesc(productId)
                .stream().map(this::movementToMap).toList();
        return ResponseEntity.ok(out);
    }

    /** Produtos com estoque baixo ou esgotado (reposição). */
    @GetMapping("/low")
    public ResponseEntity<List<ProductResponse>> lowStock() {
        return ResponseEntity.ok(productRepository.findLowStock().stream().map(ProductResponse::from).toList());
    }

    /**
     * Alertas de garantia. Retorna produtos cuja garantia vence dentro de `days`
     * dias (default 30) ou já venceu, classificados.
     */
    @GetMapping("/warranty")
    public ResponseEntity<?> warranty(@RequestParam(required = false, defaultValue = "30") int days) {
        LocalDate today = LocalDate.now();
        LocalDate limit = today.plusDays(Math.max(0, days));
        List<Map<String, Object>> expiring = new java.util.ArrayList<>();
        List<Map<String, Object>> expired = new java.util.ArrayList<>();

        for (Product p : productRepository.findWithPurchaseDate()) {
            if (p.getWarrantyMonths() == null) continue;
            LocalDate expiresAt = p.getPurchaseDate().plusMonths(p.getWarrantyMonths());
            Map<String, Object> row = Map.of(
                    "id", p.getId(),
                    "sku", p.getSku(),
                    "name", p.getName(),
                    "purchaseDate", p.getPurchaseDate().toString(),
                    "warrantyExpiresAt", expiresAt.toString()
            );
            if (expiresAt.isBefore(today)) {
                expired.add(row);
            } else if (!expiresAt.isAfter(limit)) {
                expiring.add(row);
            }
        }
        return ResponseEntity.ok(Map.of("expiring", expiring, "expired", expired));
    }

    private Map<String, Object> movementToMap(StockMovement m) {
        Map<String, Object> row = new java.util.HashMap<>();
        row.put("id", m.getId());
        row.put("type", m.getType());
        row.put("delta", m.getDelta());
        row.put("resultingQuantity", m.getResultingQuantity());
        row.put("reason", m.getReason());
        row.put("orderId", m.getOrderId());
        row.put("createdAt", m.getCreatedAt() != null ? m.getCreatedAt().toString() : null);
        return row;
    }
}
