package com.hesed.controllers;

import com.hesed.dto.ProductResponse;
import com.hesed.services.ProductService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/products")
public class ProductController {

    private final ProductService productService;

    public ProductController(ProductService productService) {
        this.productService = productService;
    }

    @GetMapping
    public ResponseEntity<List<ProductResponse>> getAll(
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String stockStatus,
            @RequestParam(required = false) String search) {
        return ResponseEntity.ok(productService.findAll(category, stockStatus, search));
    }

    @GetMapping("/catalog")
    public ResponseEntity<List<ProductResponse>> getCatalog() {
        return ResponseEntity.ok(productService.findForCatalog());
    }
}
