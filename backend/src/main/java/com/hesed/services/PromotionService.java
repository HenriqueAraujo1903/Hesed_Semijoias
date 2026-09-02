package com.hesed.services;

import com.hesed.dto.PromotionRequest;
import com.hesed.dto.PromotionResponse;
import com.hesed.models.Product;
import com.hesed.models.Promotion;
import com.hesed.repositories.ProductRepository;
import com.hesed.repositories.PromotionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class PromotionService {

    private final PromotionRepository promotionRepository;
    private final ProductRepository productRepository;

    public PromotionService(PromotionRepository promotionRepository, ProductRepository productRepository) {
        this.promotionRepository = promotionRepository;
        this.productRepository = productRepository;
    }

    public List<PromotionResponse> findAll() {
        return promotionRepository.findAllByOrderBySortOrderAscCreatedAtDesc()
                .stream()
                .map(PromotionResponse::from)
                .toList();
    }

    public List<PromotionResponse> findActive() {
        // Não anuncia no carrossel promoções de produtos esgotados — o cliente
        // não conseguiria comprar. Voltam a aparecer sozinhas quando repostos.
        return promotionRepository.findActivePromotions(LocalDateTime.now())
                .stream()
                .filter(p -> p.getProduct() != null
                        && !"ESGOTADO".equalsIgnoreCase(p.getProduct().getStockStatus()))
                .map(PromotionResponse::from)
                .toList();
    }

    @Transactional
    public PromotionResponse create(PromotionRequest request) {
        Product product = productRepository.findById(request.getProductId())
                .orElseThrow(() -> new RuntimeException("Produto não encontrado."));

        Promotion promotion = Promotion.builder()
                .product(product)
                .title(request.getTitle())
                .subtitle(request.getSubtitle())
                .discountPercent(request.getDiscountPercent())
                .promoPrice(request.getPromoPrice())
                .bannerUrl(request.getBannerUrl())
                .active(request.getActive() != null ? request.getActive() : true)
                .startsAt(request.getStartsAt())
                .endsAt(request.getEndsAt())
                .sortOrder(request.getSortOrder() != null ? request.getSortOrder() : 0)
                .build();

        return PromotionResponse.from(promotionRepository.save(promotion));
    }

    @Transactional
    public PromotionResponse update(UUID id, PromotionRequest request) {
        Promotion promotion = promotionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Promoção não encontrada."));

        Product product = productRepository.findById(request.getProductId())
                .orElseThrow(() -> new RuntimeException("Produto não encontrado."));

        promotion.setProduct(product);
        promotion.setTitle(request.getTitle());
        promotion.setSubtitle(request.getSubtitle());
        promotion.setDiscountPercent(request.getDiscountPercent());
        promotion.setPromoPrice(request.getPromoPrice());
        promotion.setBannerUrl(request.getBannerUrl());
        promotion.setActive(request.getActive() != null ? request.getActive() : true);
        promotion.setStartsAt(request.getStartsAt());
        promotion.setEndsAt(request.getEndsAt());
        promotion.setSortOrder(request.getSortOrder() != null ? request.getSortOrder() : 0);

        return PromotionResponse.from(promotionRepository.save(promotion));
    }

    @Transactional
    public void delete(UUID id) {
        if (!promotionRepository.existsById(id)) {
            throw new RuntimeException("Promoção não encontrada.");
        }
        promotionRepository.deleteById(id);
    }

    @Transactional
    public PromotionResponse toggleActive(UUID id) {
        Promotion promotion = promotionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Promoção não encontrada."));
        promotion.setActive(!promotion.getActive());
        return PromotionResponse.from(promotionRepository.save(promotion));
    }
}
