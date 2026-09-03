package com.hesed.repositories;

import com.hesed.models.Consignment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface ConsignmentRepository extends JpaRepository<Consignment, UUID> {
    List<Consignment> findByStatusOrderByOpenedAtDesc(String status);
    List<Consignment> findAllByOrderByOpenedAtDesc();

    @Query("SELECT DISTINCT c FROM Consignment c LEFT JOIN FETCH c.consignee " +
        "WHERE (:status IS NULL OR c.status = :status) ORDER BY c.openedAt DESC")
    List<Consignment> findFiltered(@Param("status") String status);

    @Query("SELECT c FROM Consignment c LEFT JOIN FETCH c.items i LEFT JOIN FETCH i.product " +
        "LEFT JOIN FETCH c.consignee WHERE c.id = :id")
    java.util.Optional<Consignment> findByIdWithItems(@Param("id") UUID id);

    // ===========================================================================
    // Agregações para o dashboard de Revendedoras.
    // "Fechados no período" = status FECHADO com closedAt entre :from e :to.
    // ===========================================================================

    /** KPIs financeiros dos lotes FECHADOS no período: [totalSold, commission, net, qtdLotes]. */
    @Query("SELECT COALESCE(SUM(c.totalSold),0), COALESCE(SUM(c.commissionAmount),0), " +
        "COALESCE(SUM(c.netAmount),0), COUNT(c) " +
        "FROM Consignment c WHERE c.status = 'FECHADO' AND c.closedAt >= :from AND c.closedAt <= :to")
    List<Object[]> closedKpis(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    /** Peças dos itens de lotes FECHADOS no período: [consignadas, vendidas, devolvidas]. */
    @Query("SELECT COALESCE(SUM(i.quantity),0), COALESCE(SUM(i.soldQuantity),0), " +
        "COALESCE(SUM(i.returnedQuantity),0) " +
        "FROM ConsignmentItem i WHERE i.consignment.status = 'FECHADO' " +
        "AND i.consignment.closedAt >= :from AND i.consignment.closedAt <= :to")
    List<Object[]> closedItemPieces(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    /** Contagem de lotes ABERTOS agora (independe do período). */
    long countByStatus(String status);

    /**
     * Ranking por revendedora dos lotes FECHADOS no período:
     * [consigneeName, totalSold, commission, net, qtdLotes]. Ordenado por totalSold desc.
     */
    @Query("SELECT c.consignee.name, COALESCE(SUM(c.totalSold),0), COALESCE(SUM(c.commissionAmount),0), " +
        "COALESCE(SUM(c.netAmount),0), COUNT(c) " +
        "FROM Consignment c WHERE c.status = 'FECHADO' AND c.closedAt >= :from AND c.closedAt <= :to " +
        "GROUP BY c.consignee.name ORDER BY SUM(c.totalSold) DESC")
    List<Object[]> rankingByConsignee(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    /** Peças vendidas/consignadas por revendedora (lotes FECHADOS no período): [name, consignadas, vendidas]. */
    @Query("SELECT c.consignee.name, COALESCE(SUM(i.quantity),0), COALESCE(SUM(i.soldQuantity),0) " +
        "FROM ConsignmentItem i JOIN i.consignment c WHERE c.status = 'FECHADO' " +
        "AND c.closedAt >= :from AND c.closedAt <= :to GROUP BY c.consignee.name")
    List<Object[]> rankingPiecesByConsignee(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    /**
     * Lotes ABERTOS agora com valor potencial (soma quantity * unitSalePrice) e peças:
     * [id, consigneeName, openedAt, pecas, valorPotencial]. Sempre "agora".
     */
    @Query("SELECT c.id, c.consignee.name, c.openedAt, " +
        "COALESCE(SUM(i.quantity),0), COALESCE(SUM(i.quantity * i.unitSalePrice),0) " +
        "FROM Consignment c LEFT JOIN c.items i WHERE c.status = 'ABERTO' " +
        "GROUP BY c.id, c.consignee.name, c.openedAt ORDER BY c.openedAt DESC")
    List<Object[]> openConsignments();
}
