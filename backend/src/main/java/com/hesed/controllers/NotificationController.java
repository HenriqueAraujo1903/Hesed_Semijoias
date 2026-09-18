package com.hesed.controllers;

import com.hesed.dto.NotificationResponse;
import com.hesed.services.NotificationService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Notificações do painel (sino). Sob /api/admin/** → herda ROLE_ADMIN.
 * São as mesmas para qualquer usuário logado (dizem respeito à loja, não a um
 * usuário específico); a dispensa vale para todos.
 */
@RestController
@RequestMapping("/api/admin/notifications")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping
    public ResponseEntity<List<NotificationResponse>> list() {
        return ResponseEntity.ok(notificationService.list());
    }

    /** Dispensa uma notificação. Body: { "key": "BIRTHDAY:{customerId}:{ano}" }. */
    @PostMapping("/dismiss")
    public ResponseEntity<?> dismiss(@RequestBody Map<String, String> body, Authentication auth) {
        try {
            String userId = auth != null ? auth.getName() : null;
            notificationService.dismiss(body.get("key"), userId);
            return ResponseEntity.ok(Map.of("ok", true));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
