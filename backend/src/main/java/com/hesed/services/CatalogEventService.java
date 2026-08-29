package com.hesed.services;

import com.hesed.dto.CatalogEventRequest;
import com.hesed.models.CatalogEvent;
import com.hesed.models.Product;
import com.hesed.repositories.CatalogEventRepository;
import com.hesed.repositories.ProductRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Set;

@Service
public class CatalogEventService {

    private static final Set<String> VALID_TYPES = Set.of("VIEW", "SELECT");

    private final CatalogEventRepository repository;
    private final ProductRepository productRepository;

    public CatalogEventService(CatalogEventRepository repository, ProductRepository productRepository) {
        this.repository = repository;
        this.productRepository = productRepository;
    }

    @Transactional
    public void record(CatalogEventRequest request) {
        String type = request.getType() == null ? "" : request.getType().trim().toUpperCase();
        if (!VALID_TYPES.contains(type)) {
            throw new RuntimeException("Tipo de evento inválido.");
        }

        CatalogEvent.CatalogEventBuilder builder = CatalogEvent.builder()
                .type(type)
                .sessionId(sanitizeSession(request.getSessionId()));

        // Para SELECT, resolve o produto e grava snapshot
        if ("SELECT".equals(type) && request.getProductId() != null) {
            Product p = productRepository.findById(request.getProductId()).orElse(null);
            if (p != null) {
                builder.productId(p.getId())
                        .productSku(p.getSku())
                        .productName(p.getName())
                        .productCategory(p.getCategory());
            }
        }

        repository.save(builder.build());
    }

    /** Limita o tamanho do sessionId para evitar abuso. */
    private String sanitizeSession(String s) {
        if (s == null) return null;
        String t = s.trim();
        if (t.isEmpty()) return null;
        return t.length() > 64 ? t.substring(0, 64) : t;
    }
}
