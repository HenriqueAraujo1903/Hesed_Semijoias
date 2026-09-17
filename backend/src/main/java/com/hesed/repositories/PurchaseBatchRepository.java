package com.hesed.repositories;

import com.hesed.models.PurchaseBatch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PurchaseBatchRepository extends JpaRepository<PurchaseBatch, UUID> {

    @Query("SELECT DISTINCT b FROM PurchaseBatch b JOIN FETCH b.supplier " +
           "LEFT JOIN FETCH b.expense ORDER BY b.purchaseDate DESC, b.createdAt DESC")
    List<PurchaseBatch> findAllWithSupplier();

    @Query("SELECT b FROM PurchaseBatch b JOIN FETCH b.supplier LEFT JOIN FETCH b.expense " +
           "LEFT JOIN FETCH b.items i LEFT JOIN FETCH i.product WHERE b.id = :id")
    Optional<PurchaseBatch> findByIdWithItems(@Param("id") UUID id);
}
