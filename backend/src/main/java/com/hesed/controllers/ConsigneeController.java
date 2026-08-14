package com.hesed.controllers;

import com.hesed.dto.ConsigneeRequest;
import com.hesed.dto.ConsigneeResponse;
import com.hesed.services.ConsigneeService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/consignees")
public class ConsigneeController {

    private final ConsigneeService consigneeService;

    public ConsigneeController(ConsigneeService consigneeService) {
        this.consigneeService = consigneeService;
    }

    @GetMapping
    public ResponseEntity<List<ConsigneeResponse>> getAll(
            @RequestParam(required = false) String search) {
        return ResponseEntity.ok(consigneeService.findAll(search));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getById(@PathVariable UUID id) {
        try {
            return ResponseEntity.ok(consigneeService.findById(id));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping
    public ResponseEntity<?> create(@Valid @RequestBody ConsigneeRequest request) {
        try {
            ConsigneeResponse response = consigneeService.create(request);
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable UUID id, @Valid @RequestBody ConsigneeRequest request) {
        try {
            ConsigneeResponse response = consigneeService.update(id, request);
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable UUID id) {
        try {
            consigneeService.delete(id);
            return ResponseEntity.ok(Map.of("ok", true));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
