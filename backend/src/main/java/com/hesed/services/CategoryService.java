package com.hesed.services;

import com.hesed.dto.CategoryRequest;
import com.hesed.dto.CategoryResponse;
import com.hesed.models.Category;
import com.hesed.repositories.CategoryRepository;
import com.hesed.repositories.ProductRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * CRUD das categorias de produto. As categorias alimentam os seletores do
 * sistema; o Product continua guardando a categoria como texto (Opção A).
 * A exclusão é bloqueada quando há produto usando aquele nome de categoria.
 */
@Service
public class CategoryService {

    private final CategoryRepository categoryRepository;
    private final ProductRepository productRepository;

    public CategoryService(CategoryRepository categoryRepository,
                           ProductRepository productRepository) {
        this.categoryRepository = categoryRepository;
        this.productRepository = productRepository;
    }

    /** Todas (admin). */
    public List<CategoryResponse> findAll() {
        return categoryRepository.findAllByOrderBySortOrderAscNameAsc()
                .stream().map(CategoryResponse::from).toList();
    }

    /** Só as ativas — usada para popular seletores/filtros. */
    public List<String> activeNames() {
        return categoryRepository.findByActiveTrueOrderBySortOrderAscNameAsc()
                .stream().map(Category::getName).toList();
    }

    public CategoryResponse findById(UUID id) {
        Category c = categoryRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Categoria não encontrada."));
        return CategoryResponse.from(c);
    }

    @Transactional
    public CategoryResponse create(CategoryRequest request) {
        String name = request.getName().trim();
        if (categoryRepository.existsByNameIgnoreCase(name)) {
            throw new RuntimeException("Já existe uma categoria com este nome.");
        }
        Category c = Category.builder()
                .name(name)
                .active(request.getActive() != null ? request.getActive() : true)
                .sortOrder(request.getSortOrder() != null ? request.getSortOrder() : 0)
                .build();
        return CategoryResponse.from(categoryRepository.save(c));
    }

    @Transactional
    public CategoryResponse update(UUID id, CategoryRequest request) {
        Category c = categoryRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Categoria não encontrada."));
        String name = request.getName().trim();
        // Nome único (ignorando a própria categoria).
        if (!c.getName().equalsIgnoreCase(name) && categoryRepository.existsByNameIgnoreCase(name)) {
            throw new RuntimeException("Já existe uma categoria com este nome.");
        }
        c.setName(name);
        if (request.getActive() != null) c.setActive(request.getActive());
        if (request.getSortOrder() != null) c.setSortOrder(request.getSortOrder());
        return CategoryResponse.from(categoryRepository.save(c));
    }

    @Transactional
    public void delete(UUID id) {
        Category c = categoryRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Categoria não encontrada."));
        // Só exclui categorias sem vínculo: nenhum produto pode estar usando o nome.
        if (productRepository.existsByCategoryIgnoreCase(c.getName())) {
            throw new RuntimeException("Não é possível excluir: há produtos usando esta categoria.");
        }
        categoryRepository.deleteById(id);
    }
}
