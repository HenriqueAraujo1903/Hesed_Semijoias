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
                .costPrice(request.getCostPrice())
                .salePrice(request.getSalePrice())
                .stockStatus(request.getStockStatus())
                .build();

        applyImages(product, request);

        return ProductResponse.from(productRepository.save(product));
    }

    /**
     * Normaliza a galeria de imagens: prioriza imageUrls; se ausente, usa imageUrl
     * (retrocompatibilidade). Remove nulos/duplicados, limita a 5 e mantém a capa
     * (imageUrl) sincronizada com a primeira foto da galeria.
     */
    private void applyImages(Product product, ProductRequest request) {
        java.util.List<String> gallery = new java.util.ArrayList<>();
        if (request.getImageUrls() != null && !request.getImageUrls().isEmpty()) {
            for (String url : request.getImageUrls()) {
                if (url != null && !url.isBlank() && !gallery.contains(url)) gallery.add(url);
            }
        } else if (request.getImageUrl() != null && !request.getImageUrl().isBlank()) {
            gallery.add(request.getImageUrl());
        }

        if (gallery.size() > 5) {
            throw new RuntimeException("Um produto pode ter no máximo 5 fotos.");
        }

        product.setImageUrls(gallery);
        product.setImageUrl(gallery.isEmpty() ? null : gallery.get(0));
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
        product.setCostPrice(request.getCostPrice());
        product.setSalePrice(request.getSalePrice());
        product.setStockStatus(request.getStockStatus());
        applyImages(product, request);

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

        boolean hasImages = (request.getImageUrls() != null && !request.getImageUrls().isEmpty())
                || (request.getImageUrl() != null && !request.getImageUrl().isBlank());

        if (existing != null) {
            existing.setName(request.getName());
            existing.setCategory(request.getCategory());
            existing.setCostPrice(request.getCostPrice());
            existing.setSalePrice(request.getSalePrice());
            existing.setStockStatus(request.getStockStatus());
            if (request.getDescription() != null) existing.setDescription(request.getDescription());
            // Só mexe nas imagens se o request trouxer alguma (evita apagar galeria em reimport sem fotos)
            if (hasImages) applyImages(existing, request);
            return ProductResponse.from(productRepository.save(existing));
        }

        Product product = Product.builder()
                .sku(request.getSku())
                .name(request.getName())
                .description(request.getDescription())
                .category(request.getCategory())
                .costPrice(request.getCostPrice())
                .salePrice(request.getSalePrice())
                .stockStatus(request.getStockStatus())
                .build();

        applyImages(product, request);

        return ProductResponse.from(productRepository.save(product));
    }
}
