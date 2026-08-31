package com.hesed.services;

import com.hesed.dto.ProductRequest;
import com.hesed.dto.ProductResponse;
import com.hesed.models.Product;
import com.hesed.repositories.ProductRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Testes unitários puros do ProductService (sem contexto Spring, sem banco).
 * Cobrem a lógica de galeria de imagens (capa = 1ª foto, dedup, limite 5,
 * retrocompatibilidade com imageUrl) e as regras de create/update/upsert.
 *
 * Rodam em qualquer ambiente pois não dependem de PostgreSQL — o repository
 * é mockado. Isso protege o pipeline de homolog/produção de falsas quebras.
 */
@ExtendWith(MockitoExtension.class)
class ProductServiceTest {

    @Mock
    private ProductRepository productRepository;

    @InjectMocks
    private ProductService productService;

    private ProductRequest baseRequest;

    @BeforeEach
    void setUp() {
        baseRequest = new ProductRequest();
        baseRequest.setSku("SKU-001");
        baseRequest.setName("Anel de Teste");
        baseRequest.setDescription("descrição");
        baseRequest.setCategory("Anel");
        baseRequest.setCostPrice(new BigDecimal("10.00"));
        baseRequest.setSalePrice(new BigDecimal("25.00"));
        baseRequest.setStockStatus("DISPONIVEL");
    }

    /** Faz o save devolver o próprio objeto passado, como o JPA faria. */
    private void stubSaveEcho() {
        when(productRepository.save(any(Product.class)))
                .thenAnswer(inv -> inv.getArgument(0));
    }

    @Nested
    @DisplayName("create() — galeria de imagens")
    class CreateImages {

        @Test
        @DisplayName("usa imageUrls e define a capa como a primeira foto")
        void createWithGallery_setsCoverToFirst() {
            baseRequest.setImageUrls(List.of("/a.jpg", "/b.jpg", "/c.jpg"));
            when(productRepository.existsBySku("SKU-001")).thenReturn(false);
            stubSaveEcho();

            ProductResponse res = productService.create(baseRequest);

            assertThat(res.getImageUrl()).isEqualTo("/a.jpg");
            assertThat(res.getImageUrls()).containsExactly("/a.jpg", "/b.jpg", "/c.jpg");
        }

        @Test
        @DisplayName("remove URLs duplicadas e vazias/nulas, preservando a ordem")
        void createDeduplicatesAndDropsBlanks() {
            baseRequest.setImageUrls(java.util.Arrays.asList("/a.jpg", "", "/a.jpg", null, "/b.jpg"));
            when(productRepository.existsBySku("SKU-001")).thenReturn(false);
            stubSaveEcho();

            ProductResponse res = productService.create(baseRequest);

            assertThat(res.getImageUrls()).containsExactly("/a.jpg", "/b.jpg");
            assertThat(res.getImageUrl()).isEqualTo("/a.jpg");
        }

        @Test
        @DisplayName("retrocompatibilidade: só imageUrl gera galeria com essa foto")
        void createWithOnlyImageUrl_backfillsGallery() {
            baseRequest.setImageUrl("/solo.jpg");
            baseRequest.setImageUrls(null);
            when(productRepository.existsBySku("SKU-001")).thenReturn(false);
            stubSaveEcho();

            ProductResponse res = productService.create(baseRequest);

            assertThat(res.getImageUrls()).containsExactly("/solo.jpg");
            assertThat(res.getImageUrl()).isEqualTo("/solo.jpg");
        }

        @Test
        @DisplayName("sem nenhuma imagem: galeria vazia e capa nula")
        void createWithoutImages_emptyGalleryNullCover() {
            when(productRepository.existsBySku("SKU-001")).thenReturn(false);
            stubSaveEcho();

            ProductResponse res = productService.create(baseRequest);

            assertThat(res.getImageUrls()).isEmpty();
            assertThat(res.getImageUrl()).isNull();
        }

        @Test
        @DisplayName("mais de 5 fotos: lança exceção e não salva")
        void createWithMoreThanFive_throws() {
            baseRequest.setImageUrls(List.of("/1.jpg", "/2.jpg", "/3.jpg", "/4.jpg", "/5.jpg", "/6.jpg"));
            when(productRepository.existsBySku("SKU-001")).thenReturn(false);

            assertThatThrownBy(() -> productService.create(baseRequest))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("5 fotos");

            verify(productRepository, never()).save(any());
        }

        @Test
        @DisplayName("exatamente 5 fotos: permitido")
        void createWithExactlyFive_ok() {
            baseRequest.setImageUrls(List.of("/1.jpg", "/2.jpg", "/3.jpg", "/4.jpg", "/5.jpg"));
            when(productRepository.existsBySku("SKU-001")).thenReturn(false);
            stubSaveEcho();

            ProductResponse res = productService.create(baseRequest);

            assertThat(res.getImageUrls()).hasSize(5);
        }
    }

    @Nested
    @DisplayName("create() — regras de SKU")
    class CreateSku {

        @Test
        @DisplayName("SKU já existente: lança exceção e não salva")
        void duplicateSku_throws() {
            when(productRepository.existsBySku("SKU-001")).thenReturn(true);

            assertThatThrownBy(() -> productService.create(baseRequest))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("SKU");

            verify(productRepository, never()).save(any());
        }
    }

    @Nested
    @DisplayName("update()")
    class Update {

        private UUID id;
        private Product existing;

        @BeforeEach
        void seedExisting() {
            id = UUID.randomUUID();
            existing = Product.builder()
                    .id(id)
                    .sku("SKU-001")
                    .name("Antigo")
                    .category("Anel")
                    .costPrice(new BigDecimal("5.00"))
                    .salePrice(new BigDecimal("10.00"))
                    .stockStatus("DISPONIVEL")
                    .imageUrl("/old.jpg")
                    .imageUrls(new java.util.ArrayList<>(List.of("/old.jpg")))
                    .build();
        }

        @Test
        @DisplayName("produto inexistente: lança exceção")
        void updateNotFound_throws() {
            when(productRepository.findById(id)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> productService.update(id, baseRequest))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("não encontrado");
        }

        @Test
        @DisplayName("substitui a galeria e reordena a capa")
        void updateReplacesGallery() {
            baseRequest.setImageUrls(List.of("/new1.jpg", "/new2.jpg"));
            when(productRepository.findById(id)).thenReturn(Optional.of(existing));
            stubSaveEcho();

            ProductResponse res = productService.update(id, baseRequest);

            assertThat(res.getImageUrls()).containsExactly("/new1.jpg", "/new2.jpg");
            assertThat(res.getImageUrl()).isEqualTo("/new1.jpg");
        }

        @Test
        @DisplayName("SKU alterado para um já existente: lança exceção")
        void updateToExistingSku_throws() {
            baseRequest.setSku("SKU-OUTRO");
            when(productRepository.findById(id)).thenReturn(Optional.of(existing));
            when(productRepository.existsBySku("SKU-OUTRO")).thenReturn(true);

            assertThatThrownBy(() -> productService.update(id, baseRequest))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("SKU");
        }
    }

    @Nested
    @DisplayName("upsertBySku() — usado no import CSV")
    class Upsert {

        @Test
        @DisplayName("produto existente SEM imagens no request: preserva a galeria atual")
        void upsertWithoutImages_keepsGallery() {
            Product existing = Product.builder()
                    .id(UUID.randomUUID())
                    .sku("SKU-001")
                    .name("Antigo")
                    .category("Anel")
                    .costPrice(new BigDecimal("5.00"))
                    .salePrice(new BigDecimal("10.00"))
                    .stockStatus("DISPONIVEL")
                    .imageUrl("/old.jpg")
                    .imageUrls(new java.util.ArrayList<>(List.of("/old.jpg", "/old2.jpg")))
                    .build();
            when(productRepository.findBySku("SKU-001")).thenReturn(Optional.of(existing));
            stubSaveEcho();
            // request sem imageUrl nem imageUrls
            baseRequest.setImageUrl(null);
            baseRequest.setImageUrls(null);

            ProductResponse res = productService.upsertBySku(baseRequest);

            assertThat(res.getImageUrls()).containsExactly("/old.jpg", "/old2.jpg");
            assertThat(res.getImageUrl()).isEqualTo("/old.jpg");
        }

        @Test
        @DisplayName("produto existente COM imagens no request: substitui a galeria")
        void upsertWithImages_replacesGallery() {
            Product existing = Product.builder()
                    .id(UUID.randomUUID())
                    .sku("SKU-001")
                    .name("Antigo")
                    .category("Anel")
                    .costPrice(new BigDecimal("5.00"))
                    .salePrice(new BigDecimal("10.00"))
                    .stockStatus("DISPONIVEL")
                    .imageUrl("/old.jpg")
                    .imageUrls(new java.util.ArrayList<>(List.of("/old.jpg")))
                    .build();
            when(productRepository.findBySku("SKU-001")).thenReturn(Optional.of(existing));
            stubSaveEcho();
            baseRequest.setImageUrls(List.of("/nova.jpg"));

            ProductResponse res = productService.upsertBySku(baseRequest);

            assertThat(res.getImageUrls()).containsExactly("/nova.jpg");
            assertThat(res.getImageUrl()).isEqualTo("/nova.jpg");
        }

        @Test
        @DisplayName("produto novo: cria com a galeria informada")
        void upsertNew_createsWithGallery() {
            when(productRepository.findBySku("SKU-001")).thenReturn(Optional.empty());
            stubSaveEcho();
            baseRequest.setImageUrls(List.of("/x.jpg", "/y.jpg"));

            ProductResponse res = productService.upsertBySku(baseRequest);

            assertThat(res.getImageUrls()).containsExactly("/x.jpg", "/y.jpg");
            assertThat(res.getImageUrl()).isEqualTo("/x.jpg");
        }

        @Test
        @DisplayName("produto existente: campos básicos são atualizados")
        void upsertUpdatesBasicFields() {
            Product existing = Product.builder()
                    .id(UUID.randomUUID())
                    .sku("SKU-001")
                    .name("Antigo")
                    .category("Anel")
                    .costPrice(new BigDecimal("5.00"))
                    .salePrice(new BigDecimal("10.00"))
                    .stockStatus("DISPONIVEL")
                    .build();
            when(productRepository.findBySku("SKU-001")).thenReturn(Optional.of(existing));
            stubSaveEcho();
            baseRequest.setName("Nome Novo");
            baseRequest.setStockStatus("ESGOTADO");

            ArgumentCaptor<Product> captor = ArgumentCaptor.forClass(Product.class);
            productService.upsertBySku(baseRequest);
            verify(productRepository).save(captor.capture());

            assertThat(captor.getValue().getName()).isEqualTo("Nome Novo");
            assertThat(captor.getValue().getStockStatus()).isEqualTo("ESGOTADO");
        }
    }

    @Nested
    @DisplayName("delete()")
    class Delete {

        @Test
        @DisplayName("produto inexistente: lança exceção e não deleta")
        void deleteNotFound_throws() {
            UUID id = UUID.randomUUID();
            when(productRepository.existsById(id)).thenReturn(false);

            assertThatThrownBy(() -> productService.delete(id))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("não encontrado");

            verify(productRepository, never()).deleteById(any());
        }

        @Test
        @DisplayName("produto existente: deleta")
        void deleteExisting_ok() {
            UUID id = UUID.randomUUID();
            when(productRepository.existsById(id)).thenReturn(true);

            productService.delete(id);

            verify(productRepository).deleteById(id);
        }
    }
}
