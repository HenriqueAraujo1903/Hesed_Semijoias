package com.hesed.dto;

import com.hesed.models.Product;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Testa o mapeamento Product -> ProductResponse, incluindo os campos novos
 * (imageUrls) e os já existentes (retrocompatibilidade com o catálogo/pedidos).
 */
class ProductResponseTest {

    @Test
    @DisplayName("mapeia todos os campos, incluindo imageUrls e description")
    void mapsAllFields() {
        UUID id = UUID.randomUUID();
        Product p = Product.builder()
                .id(id)
                .sku("SKU-XYZ")
                .name("Colar")
                .description("um colar bonito")
                .category("Corrente")
                .imageUrl("/capa.jpg")
                .imageUrls(new java.util.ArrayList<>(List.of("/capa.jpg", "/2.jpg")))
                .costPrice(new BigDecimal("12.50"))
                .salePrice(new BigDecimal("39.90"))
                .status("DISPONIVEL")
                .stockStatus("BAIXO")
                .build();

        ProductResponse r = ProductResponse.from(p);

        assertThat(r.getId()).isEqualTo(id);
        assertThat(r.getSku()).isEqualTo("SKU-XYZ");
        assertThat(r.getName()).isEqualTo("Colar");
        assertThat(r.getDescription()).isEqualTo("um colar bonito");
        assertThat(r.getCategory()).isEqualTo("Corrente");
        assertThat(r.getImageUrl()).isEqualTo("/capa.jpg");
        assertThat(r.getImageUrls()).containsExactly("/capa.jpg", "/2.jpg");
        assertThat(r.getCostPrice()).isEqualByComparingTo("12.50");
        assertThat(r.getSalePrice()).isEqualByComparingTo("39.90");
        assertThat(r.getStockStatus()).isEqualTo("BAIXO");
    }

    @Test
    @DisplayName("galeria vazia é mapeada como lista vazia, não nula")
    void mapsEmptyGallery() {
        Product p = Product.builder()
                .id(UUID.randomUUID())
                .sku("SKU-1")
                .name("Sem foto")
                .category("Anel")
                .costPrice(new BigDecimal("1.00"))
                .salePrice(new BigDecimal("2.00"))
                .stockStatus("DISPONIVEL")
                .build();

        ProductResponse r = ProductResponse.from(p);

        assertThat(r.getImageUrls()).isEmpty();
        assertThat(r.getImageUrl()).isNull();
    }
}
