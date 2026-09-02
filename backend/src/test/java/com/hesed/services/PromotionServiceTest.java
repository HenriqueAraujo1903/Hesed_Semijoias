package com.hesed.services;

import com.hesed.dto.PromotionResponse;
import com.hesed.models.Product;
import com.hesed.models.Promotion;
import com.hesed.repositories.ProductRepository;
import com.hesed.repositories.PromotionRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PromotionServiceTest {

    @Mock private PromotionRepository promotionRepository;
    @Mock private ProductRepository productRepository;

    @InjectMocks
    private PromotionService promotionService;

    private Promotion promoFor(String sku, String stockStatus) {
        Product product = Product.builder()
                .id(UUID.randomUUID())
                .sku(sku)
                .name("Produto " + sku)
                .category("Anel")
                .salePrice(new BigDecimal("100.00"))
                .stockStatus(stockStatus)
                .build();
        return Promotion.builder()
                .id(UUID.randomUUID())
                .product(product)
                .title("Promo " + sku)
                .discountPercent(new BigDecimal("10"))
                .active(true)
                .build();
    }

    @Test
    @DisplayName("findActive omite promoções de produto esgotado e mantém as compráveis")
    void findActive_filtersEsgotado() {
        when(promotionRepository.findActivePromotions(any())).thenReturn(List.of(
                promoFor("DISP-1", "DISPONIVEL"),
                promoFor("BAIXO-1", "BAIXO"),
                promoFor("ESG-1", "ESGOTADO")));

        List<PromotionResponse> result = promotionService.findActive();

        assertThat(result).hasSize(2);
        assertThat(result).extracting(PromotionResponse::getProductSku)
                .containsExactlyInAnyOrder("DISP-1", "BAIXO-1")
                .doesNotContain("ESG-1");
    }

    @Test
    @DisplayName("findActive não quebra com lista vazia")
    void findActive_empty() {
        when(promotionRepository.findActivePromotions(any())).thenReturn(List.of());
        assertThat(promotionService.findActive()).isEmpty();
    }
}
