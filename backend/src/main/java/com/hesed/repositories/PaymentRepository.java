package com.hesed.repositories;

import com.hesed.models.Payment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface PaymentRepository extends JpaRepository<Payment, UUID> {

    List<Payment> findByOrderIdOrderByPaidAtAsc(UUID orderId);

    /** Soma do bruto já recebido de um pedido (para status pago/parcial). */
    @Query("SELECT COALESCE(SUM(p.grossAmount),0) FROM Payment p WHERE p.order.id = :orderId")
    java.math.BigDecimal sumGrossByOrder(@Param("orderId") UUID orderId);

    /** Totais recebidos no período: [somaBruto, somaTaxa, somaLiquido]. */
    @Query("SELECT COALESCE(SUM(p.grossAmount),0), COALESCE(SUM(p.feeAmount),0), " +
           "COALESCE(SUM(p.netAmount),0) FROM Payment p " +
           "WHERE p.paidAt >= :from AND p.paidAt <= :to")
    List<Object[]> totalsInRange(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    /** Recebido líquido por método no período: [method, somaLiquido, somaTaxa, qtd]. */
    @Query("SELECT p.method, COALESCE(SUM(p.netAmount),0), COALESCE(SUM(p.feeAmount),0), COUNT(p) " +
           "FROM Payment p WHERE p.paidAt >= :from AND p.paidAt <= :to GROUP BY p.method")
    List<Object[]> byMethodInRange(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    /**
     * Pedidos CONFIRMADO que ainda não possuem NENHUM pagamento registrado.
     * Usado pelo backfill (DataInitializer) para trazer ao fluxo de caixa as
     * vendas anteriores à introdução do módulo financeiro. Idempotente: uma vez
     * que o pedido ganha um Payment, deixa de aparecer aqui.
     */
    @Query("SELECT o FROM Order o WHERE o.status = 'CONFIRMADO' " +
           "AND NOT EXISTS (SELECT 1 FROM Payment p WHERE p.order = o)")
    List<com.hesed.models.Order> findConfirmedOrdersWithoutPayment();
}
