package com.hesed.repositories;

import com.hesed.models.PaymentSettlement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface PaymentSettlementRepository extends JpaRepository<PaymentSettlement, UUID> {

    List<PaymentSettlement> findByPaymentIdOrderByInstallmentNumberAsc(UUID paymentId);

    /**
     * Liquidações com repasse previsto no período, trazendo o pagamento e o
     * pedido (para descrever o movimento no extrato do fluxo de caixa).
     */
    @Query("SELECT s FROM PaymentSettlement s " +
           "JOIN FETCH s.payment p JOIN FETCH p.order " +
           "WHERE s.expectedDate >= :from AND s.expectedDate <= :to " +
           "ORDER BY s.expectedDate ASC")
    List<PaymentSettlement> findExpectedBetween(@Param("from") LocalDate from, @Param("to") LocalDate to);

    /** Total líquido previsto para entrar no período (por data de repasse). */
    @Query("SELECT COALESCE(SUM(s.netAmount),0) FROM PaymentSettlement s " +
           "WHERE s.expectedDate >= :from AND s.expectedDate <= :to")
    java.math.BigDecimal sumExpectedBetween(@Param("from") LocalDate from, @Param("to") LocalDate to);

    /** Total ainda a receber (PENDENTE) com repasse previsto até a data. */
    @Query("SELECT COALESCE(SUM(s.netAmount),0) FROM PaymentSettlement s " +
           "WHERE s.status = 'PENDENTE' AND s.expectedDate <= :until")
    java.math.BigDecimal sumPendingUntil(@Param("until") LocalDate until);

    /** Total ainda a receber (PENDENTE) com repasse previsto no intervalo. */
    @Query("SELECT COALESCE(SUM(s.netAmount),0) FROM PaymentSettlement s " +
           "WHERE s.status = 'PENDENTE' AND s.expectedDate >= :from AND s.expectedDate <= :to")
    java.math.BigDecimal sumPendingBetween(@Param("from") LocalDate from, @Param("to") LocalDate to);

    /** Total a receber ainda em aberto (PENDENTE), sem limite de data. */
    @Query("SELECT COALESCE(SUM(s.netAmount),0) FROM PaymentSettlement s WHERE s.status = 'PENDENTE'")
    java.math.BigDecimal sumAllPending();
}
