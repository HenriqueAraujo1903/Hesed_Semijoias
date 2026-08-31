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

    boolean existsBySupplierId(UUID supplierId);

    @Query("SELECT p FROM Product p WHERE " +
           "(:category IS NULL OR p.category = :category) AND " +
           "(:stockStatus IS NULL OR p.stockStatus = :stockStatus) AND " +
           "(:search IS NULL OR (LOWER(p.name) LIKE LOWER(CONCAT('%', CAST(:search AS string), '%')) " +
           "OR LOWER(p.sku) LIKE LOWER(CONCAT('%', CAST(:search AS string), '%')))) " +
           "ORDER BY p.createdAt DESC")
    List<Product> findFiltered(@Param("category") String category,
                               @Param("stockStatus") String stockStatus,
                               @Param("search") String search);

    // Esgotados vão para o fim; o restante mantém a ordem por categoria e nome.
    @Query("SELECT p FROM Product p " +
           "ORDER BY CASE WHEN p.stockStatus = 'ESGOTADO' THEN 1 ELSE 0 END ASC, " +
           "p.category ASC, p.name ASC")
    List<Product> findAllForCatalog();

    // Produtos com estoque baixo ou esgotado (para o painel de reposição).
    @Query("SELECT p FROM Product p WHERE p.stockQuantity <= p.lowStockThreshold " +
           "ORDER BY p.stockQuantity ASC, p.name ASC")
    List<Product> findLowStock();

    // Produtos com data de compra definida (para cálculo de garantia).
    @Query("SELECT p FROM Product p WHERE p.purchaseDate IS NOT NULL ORDER BY p.purchaseDate ASC")
    List<Product> findWithPurchaseDate();
}
