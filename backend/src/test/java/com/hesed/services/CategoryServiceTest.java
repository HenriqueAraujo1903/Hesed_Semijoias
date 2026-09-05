package com.hesed.services;

import com.hesed.dto.CategoryRequest;
import com.hesed.dto.CategoryResponse;
import com.hesed.models.Category;
import com.hesed.repositories.CategoryRepository;
import com.hesed.repositories.ProductRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Testes do CategoryService: nome único, e a regra de exclusão — só permite
 * excluir categoria sem vínculo (nenhum produto usando o nome).
 */
@ExtendWith(MockitoExtension.class)
class CategoryServiceTest {

    @Mock private CategoryRepository categoryRepository;
    @Mock private ProductRepository productRepository;

    @InjectMocks private CategoryService service;

    private CategoryRequest req(String name) {
        CategoryRequest r = new CategoryRequest();
        r.setName(name);
        return r;
    }

    @Test
    @DisplayName("create: nome novo é aceito (trim + default ativo)")
    void create_ok() {
        when(categoryRepository.existsByNameIgnoreCase("Anel")).thenReturn(false);
        when(categoryRepository.save(any(Category.class))).thenAnswer(inv -> {
            Category c = inv.getArgument(0);
            if (c.getId() == null) c.setId(UUID.randomUUID());
            return c;
        });

        CategoryResponse r = service.create(req("  Anel  "));

        assertThat(r.getName()).isEqualTo("Anel");   // trim aplicado
        assertThat(r.getActive()).isTrue();          // default
        verify(categoryRepository).save(any(Category.class));
    }

    @Test
    @DisplayName("create: nome duplicado (case-insensitive) é bloqueado")
    void create_duplicateName() {
        when(categoryRepository.existsByNameIgnoreCase("Anel")).thenReturn(true);

        assertThatThrownBy(() -> service.create(req("Anel")))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Já existe");

        verify(categoryRepository, never()).save(any());
    }

    @Test
    @DisplayName("delete: bloqueado quando há produto usando a categoria")
    void delete_blockedWhenInUse() {
        UUID id = UUID.randomUUID();
        Category c = Category.builder().id(id).name("Brinco").active(true).sortOrder(0).build();
        when(categoryRepository.findById(id)).thenReturn(Optional.of(c));
        when(productRepository.existsByCategoryIgnoreCase("Brinco")).thenReturn(true);

        assertThatThrownBy(() -> service.delete(id))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("produtos usando");

        verify(categoryRepository, never()).deleteById(any());
    }

    @Test
    @DisplayName("delete: permitido quando não há produto vinculado")
    void delete_okWhenUnused() {
        UUID id = UUID.randomUUID();
        Category c = Category.builder().id(id).name("Sem Uso").active(true).sortOrder(0).build();
        when(categoryRepository.findById(id)).thenReturn(Optional.of(c));
        when(productRepository.existsByCategoryIgnoreCase("Sem Uso")).thenReturn(false);

        service.delete(id);

        verify(categoryRepository).deleteById(id);
    }

    @Test
    @DisplayName("update: renomear para nome existente (de outra categoria) é bloqueado")
    void update_renameToExisting() {
        UUID id = UUID.randomUUID();
        Category c = Category.builder().id(id).name("Anel").active(true).sortOrder(0).build();
        when(categoryRepository.findById(id)).thenReturn(Optional.of(c));
        when(categoryRepository.existsByNameIgnoreCase("Brinco")).thenReturn(true);

        assertThatThrownBy(() -> service.update(id, req("Brinco")))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Já existe");
    }

    @Test
    @DisplayName("update: manter o mesmo nome (só muda ordem/ativo) é aceito")
    void update_sameName() {
        UUID id = UUID.randomUUID();
        Category c = Category.builder().id(id).name("Anel").active(true).sortOrder(0).build();
        when(categoryRepository.findById(id)).thenReturn(Optional.of(c));
        when(categoryRepository.save(any(Category.class))).thenAnswer(inv -> inv.getArgument(0));

        CategoryRequest r = req("Anel");
        r.setSortOrder(5);
        r.setActive(false);
        CategoryResponse resp = service.update(id, r);

        assertThat(resp.getSortOrder()).isEqualTo(5);
        assertThat(resp.getActive()).isFalse();
        // não checou duplicidade porque o nome não mudou
        verify(categoryRepository, never()).existsByNameIgnoreCase(any());
    }
}
