package com.hesed.repositories;

import com.hesed.models.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProductRepository extends JpaRepository<Product, UUID> {

    Optional<Product> findBySku(String sku);

    boolean existsBySku(String sku);

    @Query("SELECT p FROM Product p WHERE " +
           "(:category IS NULL OR p.category = :category) AND " +
           "(:stockStatus IS NULL OR p.stockStatus = :stockStatus) AND " +
           "(:search IS NULL OR (LOWER(p.name) LIKE LOWER(CONCAT('%', CAST(:search AS string), '%')) " +
           "OR LOWER(p.sku) LIKE LOWER(CONCAT('%', CAST(:search AS string), '%')))) " +
           "ORDER BY p.createdAt DESC")
    List<Product> findFiltered(@Param("category") String category,
                               @Param("stockStatus") String stockStatus,
                               @Param("search") String search);

    @Query("SELECT p FROM Product p ORDER BY p.category ASC, p.name ASC")
    List<Product> findAllForCatalog();
}
