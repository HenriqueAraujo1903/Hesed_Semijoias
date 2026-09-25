package com.hesed.repositories;

import com.hesed.models.Line;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface LineRepository extends JpaRepository<Line, UUID> {

    boolean existsByNameIgnoreCase(String name);

    /** Todas as linhas, ordenadas para exibição (ordem manual, depois nome). */
    List<Line> findAllByOrderBySortOrderAscNameAsc();

    /** Só as ativas, ordenadas — usadas nos seletores públicos/filtros. */
    List<Line> findByActiveTrueOrderBySortOrderAscNameAsc();

    /** Linhas ativas marcadas como luxo — para a seção de luxo do catálogo. */
    List<Line> findByLuxoTrueAndActiveTrueOrderBySortOrderAscNameAsc();
}
