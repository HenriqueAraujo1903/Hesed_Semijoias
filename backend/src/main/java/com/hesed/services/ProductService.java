package com.hesed.services;

import com.hesed.dto.ProductRequest;
import com.hesed.dto.ProductResponse;
import com.hesed.models.Product;
import com.hesed.repositories.ProductRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class ProductService {

    private final ProductRepository productRepository;

    public ProductService(ProductRepository productRepository) {
        this.productRepository = productRepository;
    }

    public List<ProductResponse> findAll(String category, String stockStatus, String search) {
        return productRepository.findFiltered(category, stockStatus, search)
                .stream()
                .map(ProductResponse::from)
                .toList();
    }

    public List<ProductResponse> findForCatalog() {
        return productRepository.findAllForCatalog()
                .stream()
                .map(ProductResponse::from)
                .toList();
    }

    public ProductResponse findById(UUID id) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Produto não encontrado."));
        return ProductResponse.from(product);
    }

    @Transactional
    public ProductResponse create(ProductRequest request) {
        if (productRepository.existsBySku(request.getSku())) {
            throw new RuntimeException("Já existe um produto com este SKU.");
        }

        Product product = Product.builder()
                .sku(request.getSku())
                .name(request.getName())
                .description(request.getDescription())
                .category(request.getCategory())
                .imageUrl(request.getImageUrl())
                .costPrice(request.getCostPrice())
                .salePrice(request.getSalePrice())
                .stockStatus(request.getStockStatus())
                .build();

        return ProductResponse.from(productRepository.save(product));
    }

    @Transactional
    public ProductResponse update(UUID id, ProductRequest request) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Produto não encontrado."));

        // Check SKU uniqueness if changed
        if (!product.getSku().equals(request.getSku()) && productRepository.existsBySku(request.getSku())) {
            throw new RuntimeException("Já existe um produto com este SKU.");
        }

        product.setSku(request.getSku());
        product.setName(request.getName());
        product.setDescription(request.getDescription());
        product.setCategory(request.getCategory());
        product.setImageUrl(request.getImageUrl());
        product.setCostPrice(request.getCostPrice());
        product.setSalePrice(request.getSalePrice());
        product.setStockStatus(request.getStockStatus());

        return ProductResponse.from(productRepository.save(product));
    }

    @Transactional
    public void delete(UUID id) {
        if (!productRepository.existsById(id)) {
            throw new RuntimeException("Produto não encontrado.");
        }
        productRepository.deleteById(id);
    }

    @Transactional
    public ProductResponse upsertBySku(ProductRequest request) {
        Product existing = productRepository.findBySku(request.getSku()).orElse(null);

        if (existing != null) {
            existing.setName(request.getName());
            existing.setCategory(request.getCategory());
            existing.setCostPrice(request.getCostPrice());
            existing.setSalePrice(request.getSalePrice());
            existing.setStockStatus(request.getStockStatus());
            if (request.getDescription() != null) existing.setDescription(request.getDescription());
            if (request.getImageUrl() != null) existing.setImageUrl(request.getImageUrl());
            return ProductResponse.from(productRepository.save(existing));
        }

        Product product = Product.builder()
                .sku(request.getSku())
                .name(request.getName())
                .description(request.getDescription())
                .category(request.getCategory())
                .imageUrl(request.getImageUrl())
                .costPrice(request.getCostPrice())
                .salePrice(request.getSalePrice())
                .stockStatus(request.getStockStatus())
                .build();

        return ProductResponse.from(productRepository.save(product));
    }
}
