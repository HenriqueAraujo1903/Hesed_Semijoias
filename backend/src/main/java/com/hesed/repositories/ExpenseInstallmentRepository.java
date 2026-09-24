package com.hesed.repositories;

import com.hesed.models.ExpenseInstallment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface ExpenseInstallmentRepository extends JpaRepository<ExpenseInstallment, UUID> {

    List<ExpenseInstallment> findByExpenseIdOrderByInstallmentNumberAsc(UUID expenseId);

    /**
     * Parcelas com vencimento no período, ordenadas por vencimento. Usado para
     * a agenda de contas a pagar (mês a mês). Traz a despesa/categoria/fornecedor.
     */
    @Query("SELECT i FROM ExpenseInstallment i " +
           "JOIN FETCH i.expense e JOIN FETCH e.category " +
           "LEFT JOIN FETCH e.supplier " +
           "WHERE i.dueDate >= :from AND i.dueDate <= :to " +
           "ORDER BY i.dueDate ASC")
    List<ExpenseInstallment> findDueBetween(@Param("from") LocalDate from, @Param("to") LocalDate to);

    /** Total de parcelas PAGAS (por paidAt) no período — saída de caixa efetiva. */
    @Query("SELECT COALESCE(SUM(i.amount),0) FROM ExpenseInstallment i " +
           "WHERE i.status = 'PAGO' AND i.paidAt >= :from AND i.paidAt <= :to")
    java.math.BigDecimal sumPaidInRange(@Param("from") LocalDate from, @Param("to") LocalDate to);

    /** Total ainda em aberto (PENDENTE) com vencimento até a data informada. */
    @Query("SELECT COALESCE(SUM(i.amount),0) FROM ExpenseInstallment i " +
           "WHERE i.status = 'PENDENTE' AND i.dueDate <= :until")
    java.math.BigDecimal sumPendingDueUntil(@Param("until") LocalDate until);

    /** Total em aberto (PENDENTE) com vencimento no intervalo. */
    @Query("SELECT COALESCE(SUM(i.amount),0) FROM ExpenseInstallment i " +
           "WHERE i.status = 'PENDENTE' AND i.dueDate >= :from AND i.dueDate <= :to")
    java.math.BigDecimal sumPendingDueBetween(@Param("from") LocalDate from, @Param("to") LocalDate to);

    /** Total a pagar ainda em aberto (PENDENTE), sem limite de data. */
    @Query("SELECT COALESCE(SUM(i.amount),0) FROM ExpenseInstallment i WHERE i.status = 'PENDENTE'")
    java.math.BigDecimal sumAllPending();
}
