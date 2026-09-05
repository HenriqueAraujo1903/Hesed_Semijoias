package com.hesed.controllers;

import com.hesed.dto.PublicProductResponse;
import com.hesed.services.CategoryService;
import com.hesed.services.ProductService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Endpoints PÚBLICOS de produto (catálogo, sem autenticação).
 * Retornam a visão pública, que NÃO expõe custo, estoque numérico nem
 * fornecedor (dados internos de negócio).
 */
@RestController
@RequestMapping("/api/products")
public class ProductController {

    private final ProductService productService;
    private final CategoryService categoryService;

    public ProductController(ProductService productService, CategoryService categoryService) {
        this.productService = productService;
        this.categoryService = categoryService;
    }

    /** Nomes das categorias ativas (fonte dos seletores/filtros). Público. */
    @GetMapping("/categories")
    public ResponseEntity<List<String>> categories() {
        return ResponseEntity.ok(categoryService.activeNames());
    }

    @GetMapping
    public ResponseEntity<List<PublicProductResponse>> getAll(
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String stockStatus,
            @RequestParam(required = false) String search) {
        return ResponseEntity.ok(productService.findAllPublic(category, stockStatus, search));
    }

    @GetMapping("/catalog")
    public ResponseEntity<List<PublicProductResponse>> getCatalog() {
        return ResponseEntity.ok(productService.findForCatalog());
    }
}
