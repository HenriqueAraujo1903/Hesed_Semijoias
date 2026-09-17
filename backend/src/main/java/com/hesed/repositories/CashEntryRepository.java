package com.hesed.repositories;

import com.hesed.models.CashEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface CashEntryRepository extends JpaRepository<CashEntry, UUID> {

    List<CashEntry> findByEntryDateBetweenOrderByEntryDateDesc(LocalDate from, LocalDate to);

    /** Soma dos lançamentos manuais por tipo no período: [type, total]. */
    @Query("SELECT e.type, COALESCE(SUM(e.amount),0) FROM CashEntry e " +
           "WHERE e.entryDate >= :from AND e.entryDate <= :to GROUP BY e.type")
    List<Object[]> sumByTypeInRange(@Param("from") LocalDate from, @Param("to") LocalDate to);
}
