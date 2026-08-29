package com.hesed.controllers;

import com.hesed.dto.AdminOrderCreateRequest;
import com.hesed.dto.OrderRequest;
import com.hesed.dto.OrderResponse;
import com.hesed.dto.OrderUpdateRequest;
import com.hesed.services.OrderService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
public class OrderController {

    private final OrderService orderService;

    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    // ---- Público: registro de pedido do catálogo (antes de abrir o WhatsApp) ----
    @PostMapping("/api/orders")
    public ResponseEntity<?> create(@Valid @RequestBody OrderRequest request) {
        try {
            OrderResponse response = orderService.create(request);
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ---- Admin: criar pedido de venda direta (fora do catálogo) ----
    @PostMapping("/api/admin/orders")
    public ResponseEntity<?> createDirect(@Valid @RequestBody AdminOrderCreateRequest request) {
        try {
            OrderResponse response = orderService.createDirect(request);
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ---- Admin: listar pedidos (com filtro opcional de status) ----
    @GetMapping("/api/admin/orders")
    public ResponseEntity<List<OrderResponse>> list(@RequestParam(required = false) String status) {
        String normalized = (status != null && !status.isBlank()) ? status.trim().toUpperCase() : null;
        return ResponseEntity.ok(orderService.findAll(normalized));
    }

    // ---- Admin: resumo de contagem por status ----
    @GetMapping("/api/admin/orders/summary")
    public ResponseEntity<Map<String, Long>> summary() {
        return ResponseEntity.ok(Map.of(
                "pendente", orderService.countByStatus("PENDENTE"),
                "confirmado", orderService.countByStatus("CONFIRMADO"),
                "cancelado", orderService.countByStatus("CANCELADO")
        ));
    }

    // ---- Admin: editar pedido pendente (itens, cliente, notas) ----
    @PutMapping("/api/admin/orders/{id}")
    public ResponseEntity<?> update(@PathVariable UUID id, @Valid @RequestBody OrderUpdateRequest request) {
        try {
            return ResponseEntity.ok(orderService.update(id, request));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ---- Admin: alterar status (confirmar/cancelar/reabrir) ----
    @PatchMapping("/api/admin/orders/{id}/status")
    public ResponseEntity<?> updateStatus(@PathVariable UUID id, @RequestBody Map<String, String> body) {
        try {
            OrderResponse response = orderService.updateStatus(id, body.get("status"));
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
