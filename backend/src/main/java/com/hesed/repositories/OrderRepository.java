package com.hesed.repositories;

import com.hesed.models.Order;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface OrderRepository extends JpaRepository<Order, UUID> {

    boolean existsByOrderNumber(String orderNumber);

    @Query("SELECT o FROM Order o WHERE (:status IS NULL OR o.status = :status) " +
           "ORDER BY o.orderedAt DESC")
    List<Order> findByStatusFiltered(@Param("status") String status);

    long countByStatus(String status);

    // Contagem de pedidos por status dentro de um intervalo (para taxa de conversão).
    // Retorna: [status, quantidade]. from/to sempre concretos (service normaliza).
    @Query("SELECT o.status, COUNT(o.id) FROM Order o " +
           "WHERE o.orderedAt >= :from AND o.orderedAt <= :to " +
           "GROUP BY o.status")
    List<Object[]> countByStatusInRange(@Param("from") LocalDateTime from,
                                         @Param("to") LocalDateTime to);
}
