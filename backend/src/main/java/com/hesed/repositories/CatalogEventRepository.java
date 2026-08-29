package com.hesed.repositories;

import com.hesed.models.CatalogEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Consultas de engajamento do catálogo. from/to sempre concretos (service normaliza),
 * para evitar parâmetros null não tipados no PostgreSQL.
 */
public interface CatalogEventRepository extends JpaRepository<CatalogEvent, UUID> {

    // Total de eventos de um tipo no período
    @Query("SELECT COUNT(e.id) FROM CatalogEvent e " +
           "WHERE e.type = :type AND e.createdAt >= :from AND e.createdAt <= :to")
    long countByTypeInRange(@Param("type") String type,
                            @Param("from") LocalDateTime from,
                            @Param("to") LocalDateTime to);

    // Sessões distintas (visitantes únicos aproximados) no período
    @Query("SELECT COUNT(DISTINCT e.sessionId) FROM CatalogEvent e " +
           "WHERE e.createdAt >= :from AND e.createdAt <= :to AND e.sessionId IS NOT NULL")
    long countDistinctSessionsInRange(@Param("from") LocalDateTime from,
                                      @Param("to") LocalDateTime to);

    // Série temporal por dia: [periodo, tipo, total]
    @Query("SELECT FUNCTION('to_char', e.createdAt, 'YYYY-MM-DD'), e.type, COUNT(e.id) " +
           "FROM CatalogEvent e WHERE e.createdAt >= :from AND e.createdAt <= :to " +
           "GROUP BY FUNCTION('to_char', e.createdAt, 'YYYY-MM-DD'), e.type " +
           "ORDER BY 1 ASC")
    List<Object[]> dailyByType(@Param("from") LocalDateTime from,
                               @Param("to") LocalDateTime to);

    // Produtos mais selecionados: [sku, nome, categoria, seleções, sessões distintas]
    @Query("SELECT e.productSku, e.productName, e.productCategory, " +
           "COUNT(e.id), COUNT(DISTINCT e.sessionId) " +
           "FROM CatalogEvent e WHERE e.type = 'SELECT' " +
           "AND e.createdAt >= :from AND e.createdAt <= :to AND e.productSku IS NOT NULL " +
           "GROUP BY e.productSku, e.productName, e.productCategory " +
           "ORDER BY COUNT(e.id) DESC")
    List<Object[]> topSelectedProducts(@Param("from") LocalDateTime from,
                                       @Param("to") LocalDateTime to);
}
