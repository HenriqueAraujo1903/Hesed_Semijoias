package com.hesed.repositories;

import com.hesed.models.Category;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface CategoryRepository extends JpaRepository<Category, UUID> {

    boolean existsByNameIgnoreCase(String name);

    /** Todas as categorias, ordenadas para exibição (ordem manual, depois nome). */
    List<Category> findAllByOrderBySortOrderAscNameAsc();

    /** Só as ativas, ordenadas — usadas nos seletores públicos/filtros. */
    List<Category> findByActiveTrueOrderBySortOrderAscNameAsc();
}
