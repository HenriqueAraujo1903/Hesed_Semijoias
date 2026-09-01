package com.hesed.controllers;

import com.hesed.dto.ProductRequest;
import com.hesed.dto.ProductResponse;
import com.hesed.services.CsvImportService;
import com.hesed.services.FileStorageService;
import com.hesed.services.ProductService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/products")
public class AdminProductController {

    private final ProductService productService;
    private final CsvImportService csvImportService;
    private final FileStorageService fileStorageService;

    public AdminProductController(ProductService productService,
                                  CsvImportService csvImportService,
                                  FileStorageService fileStorageService) {
        this.productService = productService;
        this.csvImportService = csvImportService;
        this.fileStorageService = fileStorageService;
    }

    /**
     * Listagem ADMIN (autenticada): retorna a visão completa do produto,
     * incluindo custo, estoque numérico e fornecedor. Substitui o uso do
     * endpoint público GET /api/products pelo painel admin.
     */
    @GetMapping
    public ResponseEntity<List<ProductResponse>> list(
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String stockStatus,
            @RequestParam(required = false) String search) {
        return ResponseEntity.ok(productService.findAllAdmin(category, stockStatus, search));
    }

    @PostMapping
    public ResponseEntity<?> create(@Valid @RequestBody ProductRequest request) {
        try {
            ProductResponse response = productService.create(request);
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable UUID id, @Valid @RequestBody ProductRequest request) {
        try {
            ProductResponse response = productService.update(id, request);
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable UUID id) {
        try {
            productService.delete(id);
            return ResponseEntity.ok(Map.of("ok", true));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/import")
    public ResponseEntity<?> importFromSheets(@RequestBody Map<String, String> body) {
        try {
            String url = body.get("url");
            if (url == null || url.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("error", "URL obrigatória."));
            }
            Map<String, Object> result = csvImportService.importFromUrl(url);
            return ResponseEntity.ok(result);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/upload")
    public ResponseEntity<?> upload(@RequestParam("file") MultipartFile file) {
        try {
            String url = fileStorageService.store(file);
            return ResponseEntity.ok(Map.of("url", url));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
