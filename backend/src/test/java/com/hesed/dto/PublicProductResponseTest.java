package com.hesed.dto;

import com.hesed.models.Product;
import com.hesed.models.Promotion;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Verifica o preço efetivo exposto ao catálogo público — o valor que o cliente
 * realmente paga. Deve refletir a promoção ativa (preço fixo ou desconto %) e,
 * sem promoção, ser igual ao preço cheio.
 */
class PublicProductResponseTest {

    private Product product(String salePrice) {
        return Product.builder()
                .id(UUID.randomUUID())
                .sku("SKU-1")
                .name("Anel")
                .category("Anel")
                .salePrice(new BigDecimal(salePrice))
                .stockStatus("DISPONIVEL")
                .build();
    }

    @Test
    @DisplayName("sem promoção: effectivePrice = salePrice e onSale=false")
    void noPromotion() {
        PublicProductResponse r = PublicProductResponse.from(product("100.00"), null);

        assertThat(r.getSalePrice()).isEqualByComparingTo("100.00");
        assertThat(r.getEffectivePrice()).isEqualByComparingTo("100.00");
        assertThat(r.isOnSale()).isFalse();
        assertThat(r.getDiscountPercent()).isNull();
    }

    @Test
    @DisplayName("promoção com preço fixo: effectivePrice = promoPrice")
    void promoWithFixedPrice() {
        Promotion promo = Promotion.builder()
                .promoPrice(new BigDecimal("79.90"))
                .build();

        PublicProductResponse r = PublicProductResponse.from(product("100.00"), promo);

        assertThat(r.getSalePrice()).isEqualByComparingTo("100.00");  // referência riscada
        assertThat(r.getEffectivePrice()).isEqualByComparingTo("79.90");
        assertThat(r.isOnSale()).isTrue();
    }

    @Test
    @DisplayName("promoção com desconto %: effectivePrice = salePrice * (1 - %/100), 2 casas")
    void promoWithPercent() {
        Promotion promo = Promotion.builder()
                .discountPercent(new BigDecimal("25"))
                .build();

        PublicProductResponse r = PublicProductResponse.from(product("100.00"), promo);

        assertThat(r.getEffectivePrice()).isEqualByComparingTo("75.00");
        assertThat(r.isOnSale()).isTrue();
        assertThat(r.getDiscountPercent()).isEqualByComparingTo("25");
    }

    @Test
    @DisplayName("desconto % com arredondamento HALF_UP em 2 casas")
    void promoPercentRounding() {
        // 33.33 * (1 - 0.15) = 28.3305 -> 28.33
        Promotion promo = Promotion.builder()
                .discountPercent(new BigDecimal("15"))
                .build();

        PublicProductResponse r = PublicProductResponse.from(product("33.33"), promo);

        assertThat(r.getEffectivePrice()).isEqualByComparingTo("28.33");
    }

    @Test
    @DisplayName("preço fixo tem precedência sobre desconto % quando ambos existem")
    void promoFixedPriceTakesPrecedence() {
        Promotion promo = Promotion.builder()
                .promoPrice(new BigDecimal("50.00"))
                .discountPercent(new BigDecimal("10"))
                .build();

        PublicProductResponse r = PublicProductResponse.from(product("100.00"), promo);

        assertThat(r.getEffectivePrice()).isEqualByComparingTo("50.00");
    }
}
