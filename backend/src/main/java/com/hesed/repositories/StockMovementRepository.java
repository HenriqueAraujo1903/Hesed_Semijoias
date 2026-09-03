package com.hesed.repositories;

import com.hesed.models.StockMovement;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface StockMovementRepository extends JpaRepository<StockMovement, UUID> {

    List<StockMovement> findByProductIdOrderByCreatedAtDesc(UUID productId);

    List<StockMovement> findTop100ByOrderByCreatedAtDesc();

    /** Movimentações recentes com o produto carregado (evita LAZY/N+1 no dashboard). */
    @Query("SELECT m FROM StockMovement m JOIN FETCH m.product ORDER BY m.createdAt DESC")
    List<StockMovement> findRecentWithProduct(Pageable pageable);
}
