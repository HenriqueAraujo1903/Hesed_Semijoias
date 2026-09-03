package com.hesed.repositories;

import com.hesed.models.StockMovement;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface StockMovementRepository extends JpaRepository<StockMovement, UUID> {

    List<StockMovement> findByProductIdOrderByCreatedAtDesc(UUID productId);

    List<StockMovement> findTop100ByOrderByCreatedAtDesc();

    /**
     * Movimentações a partir de uma data (inclusiva), com o produto carregado
     * (evita LAZY/N+1 no dashboard). Ordena da mais recente para a mais antiga.
     * O chamador normaliza `from` (usa uma data bem antiga quando "todo período")
     * para não depender de bind null — o PostgreSQL não infere tipo de null.
     */
    @Query("SELECT m FROM StockMovement m JOIN FETCH m.product " +
           "WHERE m.createdAt >= :from ORDER BY m.createdAt DESC")
    List<StockMovement> findRecentWithProduct(@Param("from") LocalDateTime from, Pageable pageable);
}
