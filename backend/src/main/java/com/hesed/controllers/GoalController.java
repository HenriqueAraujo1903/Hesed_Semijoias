package com.hesed.controllers;

import com.hesed.dto.GoalRequest;
import com.hesed.dto.GoalResponse;
import com.hesed.services.GoalService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/goals")
public class GoalController {

    private final GoalService goalService;

    public GoalController(GoalService goalService) {
        this.goalService = goalService;
    }

    /** Meta efetiva do mês corrente (com herança). */
    @GetMapping("/current")
    public ResponseEntity<GoalResponse> current() {
        return ResponseEntity.ok(goalService.currentEffective());
    }

    /** Meta efetiva de um mês específico (com herança). */
    @GetMapping
    public ResponseEntity<GoalResponse> byMonth(@RequestParam int year, @RequestParam int month) {
        return ResponseEntity.ok(goalService.resolveEffective(year, month));
    }

    /** Histórico de metas definidas (mais recente primeiro). */
    @GetMapping("/history")
    public ResponseEntity<List<GoalResponse>> history() {
        return ResponseEntity.ok(goalService.findAll());
    }

    /** Cria/atualiza a meta de um mês. */
    @PutMapping
    public ResponseEntity<?> upsert(@Valid @RequestBody GoalRequest request) {
        try {
            return ResponseEntity.ok(goalService.upsert(request));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
