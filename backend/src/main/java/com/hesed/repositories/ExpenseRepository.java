package com.hesed.repositories;

import com.hesed.models.Expense;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ExpenseRepository extends JpaRepository<Expense, UUID> {

    @Query("SELECT DISTINCT e FROM Expense e JOIN FETCH e.category " +
           "LEFT JOIN FETCH e.supplier " +
           "WHERE (:status IS NULL OR e.status = :status) " +
           "ORDER BY e.competenceDate DESC")
    List<Expense> findFiltered(@Param("status") String status);

    @Query("SELECT e FROM Expense e JOIN FETCH e.category LEFT JOIN FETCH e.supplier " +
           "LEFT JOIN FETCH e.installments WHERE e.id = :id")
    Optional<Expense> findByIdWithInstallments(@Param("id") UUID id);

    long countByCategoryId(UUID categoryId);

    /**
     * Total de despesas por competência no período, agrupado por categoria:
     * [categoryName, total]. Base do DRE (despesas operacionais do mês).
     */
    @Query("SELECT e.category.name, COALESCE(SUM(e.totalAmount),0) FROM Expense e " +
           "WHERE e.competenceDate >= :from AND e.competenceDate <= :to " +
           "AND e.category.operational = true " +
           "GROUP BY e.category.name ORDER BY SUM(e.totalAmount) DESC")
    List<Object[]> totalByCategoryInRange(@Param("from") LocalDate from, @Param("to") LocalDate to);
}
