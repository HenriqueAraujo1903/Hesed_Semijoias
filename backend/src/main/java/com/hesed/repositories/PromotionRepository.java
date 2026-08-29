package com.hesed.repositories;

import com.hesed.models.Promotion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface PromotionRepository extends JpaRepository<Promotion, UUID> {

    List<Promotion> findAllByOrderBySortOrderAscCreatedAtDesc();

    @Query("SELECT p FROM Promotion p WHERE p.active = true " +
           "AND (p.startsAt IS NULL OR p.startsAt <= :now) " +
           "AND (p.endsAt IS NULL OR p.endsAt >= :now) " +
           "ORDER BY p.sortOrder ASC, p.createdAt DESC")
    List<Promotion> findActivePromotions(LocalDateTime now);

    @Query("SELECT p FROM Promotion p WHERE p.product.id = :productId AND p.active = true " +
           "AND (p.startsAt IS NULL OR p.startsAt <= :now) " +
           "AND (p.endsAt IS NULL OR p.endsAt >= :now) " +
           "ORDER BY p.sortOrder ASC, p.createdAt DESC")
    List<Promotion> findActiveByProduct(UUID productId, LocalDateTime now);
}
