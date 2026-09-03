package com.hesed.repositories;

import com.hesed.models.OrderItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Consultas analíticas sobre os itens de pedido (snapshot).
 *
 * Receita = SUM(effectivePrice * quantity). Itens = SUM(quantity).
 *
 * Convenções para evitar parâmetros null (PostgreSQL não infere o tipo de
 * parâmetros null em comparações):
 *  - from/to: sempre valores concretos (o service normaliza).
 *  - allCategories = true ignora o filtro de categoria; senão usa :category.
 *  - promoOnly = true considera apenas itens que estavam em promoção.
 * A data usada é a do pedido pai (o.orderedAt).
 */
public interface OrderItemRepository extends JpaRepository<OrderItem, UUID> {

    // ---- Série temporal ----
    // Retorna: [periodo, receita, qtde itens, nº pedidos distintos]
    @Query("SELECT FUNCTION('to_char', o.orderedAt, 'YYYY-MM-DD') AS periodo, " +
           "SUM(oi.effectivePrice * oi.quantity) AS receita, SUM(oi.quantity) AS itens, COUNT(DISTINCT o.id) AS pedidos " +
           "FROM OrderItem oi JOIN oi.order o " +
           "WHERE o.status = :status AND o.orderedAt >= :from AND o.orderedAt <= :to " +
           "AND (:allCategories = true OR oi.productCategory = :category) " +
           "AND (:promoOnly = false OR oi.wasPromotion = true) " +
           "GROUP BY FUNCTION('to_char', o.orderedAt, 'YYYY-MM-DD') ORDER BY periodo ASC")
    List<Object[]> timeSeriesByDay(@Param("status") String status,
                                   @Param("from") LocalDateTime from,
                                   @Param("to") LocalDateTime to,
                                   @Param("allCategories") boolean allCategories,
                                   @Param("category") String category,
                                   @Param("promoOnly") boolean promoOnly);

    @Query("SELECT FUNCTION('to_char', o.orderedAt, 'YYYY-MM') AS periodo, " +
           "SUM(oi.effectivePrice * oi.quantity) AS receita, SUM(oi.quantity) AS itens, COUNT(DISTINCT o.id) AS pedidos " +
           "FROM OrderItem oi JOIN oi.order o " +
           "WHERE o.status = :status AND o.orderedAt >= :from AND o.orderedAt <= :to " +
           "AND (:allCategories = true OR oi.productCategory = :category) " +
           "AND (:promoOnly = false OR oi.wasPromotion = true) " +
           "GROUP BY FUNCTION('to_char', o.orderedAt, 'YYYY-MM') ORDER BY periodo ASC")
    List<Object[]> timeSeriesByMonth(@Param("status") String status,
                                     @Param("from") LocalDateTime from,
                                     @Param("to") LocalDateTime to,
                                     @Param("allCategories") boolean allCategories,
                                     @Param("category") String category,
                                     @Param("promoOnly") boolean promoOnly);

    @Query("SELECT FUNCTION('to_char', o.orderedAt, 'YYYY') AS periodo, " +
           "SUM(oi.effectivePrice * oi.quantity) AS receita, SUM(oi.quantity) AS itens, COUNT(DISTINCT o.id) AS pedidos " +
           "FROM OrderItem oi JOIN oi.order o " +
           "WHERE o.status = :status AND o.orderedAt >= :from AND o.orderedAt <= :to " +
           "AND (:allCategories = true OR oi.productCategory = :category) " +
           "AND (:promoOnly = false OR oi.wasPromotion = true) " +
           "GROUP BY FUNCTION('to_char', o.orderedAt, 'YYYY') ORDER BY periodo ASC")
    List<Object[]> timeSeriesByYear(@Param("status") String status,
                                    @Param("from") LocalDateTime from,
                                    @Param("to") LocalDateTime to,
                                    @Param("allCategories") boolean allCategories,
                                    @Param("category") String category,
                                    @Param("promoOnly") boolean promoOnly);

    // ---- Breakdown por categoria ----
    // Retorna: [categoria, receita, qtde itens]
    @Query("SELECT oi.productCategory AS categoria, SUM(oi.effectivePrice * oi.quantity) AS receita, SUM(oi.quantity) AS itens " +
           "FROM OrderItem oi JOIN oi.order o " +
           "WHERE o.status = :status AND o.orderedAt >= :from AND o.orderedAt <= :to " +
           "AND (:allCategories = true OR oi.productCategory = :category) " +
           "AND (:promoOnly = false OR oi.wasPromotion = true) " +
           "GROUP BY oi.productCategory ORDER BY receita DESC")
    List<Object[]> byCategory(@Param("status") String status,
                              @Param("from") LocalDateTime from,
                              @Param("to") LocalDateTime to,
                              @Param("allCategories") boolean allCategories,
                              @Param("category") String category,
                              @Param("promoOnly") boolean promoOnly);

    // ---- Top produtos ----
    // Retorna: [sku, nome, categoria, receita, qtde itens]
    @Query("SELECT oi.productSku AS sku, oi.productName AS nome, oi.productCategory AS categoria, " +
           "SUM(oi.effectivePrice * oi.quantity) AS receita, SUM(oi.quantity) AS itens " +
           "FROM OrderItem oi JOIN oi.order o " +
           "WHERE o.status = :status AND o.orderedAt >= :from AND o.orderedAt <= :to " +
           "AND (:allCategories = true OR oi.productCategory = :category) " +
           "AND (:promoOnly = false OR oi.wasPromotion = true) " +
           "GROUP BY oi.productSku, oi.productName, oi.productCategory ORDER BY receita DESC")
    List<Object[]> topProducts(@Param("status") String status,
                               @Param("from") LocalDateTime from,
                               @Param("to") LocalDateTime to,
                               @Param("allCategories") boolean allCategories,
                               @Param("category") String category,
                               @Param("promoOnly") boolean promoOnly);

    // ---- Split promoção vs não-promoção ----
    // Retorna: [wasPromotion, receita, qtde itens]
    @Query("SELECT oi.wasPromotion AS promo, SUM(oi.effectivePrice * oi.quantity) AS receita, SUM(oi.quantity) AS itens " +
           "FROM OrderItem oi JOIN oi.order o " +
           "WHERE o.status = :status AND o.orderedAt >= :from AND o.orderedAt <= :to " +
           "AND (:allCategories = true OR oi.productCategory = :category) " +
           "GROUP BY oi.wasPromotion")
    List<Object[]> byPromotion(@Param("status") String status,
                               @Param("from") LocalDateTime from,
                               @Param("to") LocalDateTime to,
                               @Param("allCategories") boolean allCategories,
                               @Param("category") String category);

    // ---- Desconto concedido em itens que estavam em promoção ----
    // Quanto de "preço cheio" foi abdicado: SUM((unitPrice - effectivePrice) * qty)
    // apenas para itens com wasPromotion = true. Retorna 0 se não houver.
    @Query("SELECT COALESCE(SUM((oi.unitPrice - oi.effectivePrice) * oi.quantity),0) " +
           "FROM OrderItem oi JOIN oi.order o " +
           "WHERE o.status = :status AND o.orderedAt >= :from AND o.orderedAt <= :to " +
           "AND (:allCategories = true OR oi.productCategory = :category) " +
           "AND oi.wasPromotion = true")
    java.math.BigDecimal discountGranted(@Param("status") String status,
                                         @Param("from") LocalDateTime from,
                                         @Param("to") LocalDateTime to,
                                         @Param("allCategories") boolean allCategories,
                                         @Param("category") String category);

    // ---- KPIs agregados ----
    // Retorna: [receita, custo, qtde itens, nº pedidos distintos]
    @Query("SELECT COALESCE(SUM(oi.effectivePrice * oi.quantity),0), COALESCE(SUM(oi.costPrice * oi.quantity),0), " +
           "COALESCE(SUM(oi.quantity),0), COUNT(DISTINCT o.id) " +
           "FROM OrderItem oi JOIN oi.order o " +
           "WHERE o.status = :status AND o.orderedAt >= :from AND o.orderedAt <= :to " +
           "AND (:allCategories = true OR oi.productCategory = :category) " +
           "AND (:promoOnly = false OR oi.wasPromotion = true)")
    List<Object[]> kpis(@Param("status") String status,
                        @Param("from") LocalDateTime from,
                        @Param("to") LocalDateTime to,
                        @Param("allCategories") boolean allCategories,
                        @Param("category") String category,
                        @Param("promoOnly") boolean promoOnly);
}
