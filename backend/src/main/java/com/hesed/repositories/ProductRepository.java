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
    // Sob encomenda não tem estoque próprio → fora do alerta de reposição.
    @Query("SELECT p FROM Product p WHERE (p.onDemand IS NULL OR p.onDemand = false) " +
           "AND p.stockQuantity <= p.lowStockThreshold " +
           "ORDER BY p.stockQuantity ASC, p.name ASC")
    List<Product> findLowStock();

    // Produtos com data de compra definida (para cálculo de garantia).
    @Query("SELECT p FROM Product p WHERE p.purchaseDate IS NOT NULL ORDER BY p.purchaseDate ASC")
    List<Product> findWithPurchaseDate();

    // ---- Analytics de estoque (dashboard) ----
    // Considera apenas produtos de estoque próprio (exclui sob encomenda).

    /**
     * KPIs agregados do estoque próprio (exclui onDemand):
     * [0] total de SKUs, [1] soma de unidades, [2] valor a custo (custo*qtd),
     * [3] valor potencial de venda (venda*qtd).
     */
    @Query("SELECT COUNT(p), COALESCE(SUM(p.stockQuantity),0), " +
           "COALESCE(SUM(p.costPrice * p.stockQuantity),0), " +
           "COALESCE(SUM(p.salePrice * p.stockQuantity),0) " +
           "FROM Product p WHERE (p.onDemand IS NULL OR p.onDemand = false) " +
           "AND (:category IS NULL OR p.category = :category) " +
           "AND (:status IS NULL OR p.stockStatus = :status)")
    List<Object[]> stockKpis(@Param("category") String category, @Param("status") String status);

    /** Contagem de produtos de estoque próprio por stockStatus (DISPONIVEL/BAIXO/ESGOTADO). */
    @Query("SELECT p.stockStatus, COUNT(p) FROM Product p " +
           "WHERE (p.onDemand IS NULL OR p.onDemand = false) " +
           "AND (:category IS NULL OR p.category = :category) " +
           "AND (:status IS NULL OR p.stockStatus = :status) GROUP BY p.stockStatus")
    List<Object[]> stockCountByStatus(@Param("category") String category, @Param("status") String status);

    /**
     * Distribuição por categoria (estoque próprio):
     * [0] categoria, [1] nº de SKUs, [2] unidades, [3] valor a custo, [4] valor de venda.
     */
    @Query("SELECT p.category, COUNT(p), COALESCE(SUM(p.stockQuantity),0), " +
           "COALESCE(SUM(p.costPrice * p.stockQuantity),0), " +
           "COALESCE(SUM(p.salePrice * p.stockQuantity),0) " +
           "FROM Product p WHERE (p.onDemand IS NULL OR p.onDemand = false) " +
           "AND (:category IS NULL OR p.category = :category) " +
           "AND (:status IS NULL OR p.stockStatus = :status) " +
           "GROUP BY p.category ORDER BY SUM(p.costPrice * p.stockQuantity) DESC")
    List<Object[]> stockByCategory(@Param("category") String category, @Param("status") String status);

    /**
     * Itens críticos: baixo ou esgotado (estoque próprio), mais críticos primeiro.
     * Se status informado (BAIXO ou ESGOTADO), restringe a ele; senão traz ambos.
     */
    @Query("SELECT p FROM Product p WHERE (p.onDemand IS NULL OR p.onDemand = false) " +
           "AND p.stockStatus IN ('BAIXO','ESGOTADO') " +
           "AND (:category IS NULL OR p.category = :category) " +
           "AND (:status IS NULL OR p.stockStatus = :status) " +
           "ORDER BY p.stockQuantity ASC, p.name ASC")
    List<Product> findCriticalStock(@Param("category") String category, @Param("status") String status);
}
