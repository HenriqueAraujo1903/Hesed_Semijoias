package com.hesed.controllers;

import com.hesed.dto.UserRequest;
import com.hesed.dto.UserResponse;
import com.hesed.services.UserService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * CRUD de usuários do sistema. Protegido por /api/admin/** (ROLE_ADMIN) no
 * SecurityConfig. Usa o Authentication para aplicar regras de autoproteção
 * (o admin não pode se excluir/rebaixar; não remover o último admin).
 */
@RestController
@RequestMapping("/api/admin/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping
    public ResponseEntity<List<UserResponse>> getAll(@RequestParam(required = false) String search) {
        return ResponseEntity.ok(userService.findAll(search));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getById(@PathVariable UUID id) {
        try {
            return ResponseEntity.ok(userService.findById(id));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping
    public ResponseEntity<?> create(@Valid @RequestBody UserRequest request) {
        try {
            return ResponseEntity.status(HttpStatus.CREATED).body(userService.create(request));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable UUID id,
                                    @Valid @RequestBody UserRequest request,
                                    Authentication auth) {
        try {
            UUID currentUserId = currentUserId(auth);
            return ResponseEntity.ok(userService.update(id, request, currentUserId));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable UUID id, Authentication auth) {
        try {
            UUID currentUserId = currentUserId(auth);
            userService.delete(id, currentUserId);
            return ResponseEntity.ok(Map.of("ok", true));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /** O JwtAuthFilter coloca o userId como principal (auth.getName()). */
    private static UUID currentUserId(Authentication auth) {
        try {
            return auth != null ? UUID.fromString(auth.getName()) : null;
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
