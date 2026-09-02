package com.hesed.repositories;

import com.hesed.models.MonthlyGoal;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MonthlyGoalRepository extends JpaRepository<MonthlyGoal, UUID> {

    /** Meta exata de um mês, se existir. */
    Optional<MonthlyGoal> findByYearAndMonth(int year, int month);

    /**
     * Meta efetiva de um mês com HERANÇA: a meta definida mais recente cujo
     * (ano, mês) seja <= (ano, mês) alvo. Ordena por ano e mês descrescente e
     * pega a primeira. Retorna vazio se não houver nenhuma meta anterior/igual.
     */
    @Query("SELECT g FROM MonthlyGoal g " +
           "WHERE (g.year * 12 + g.month) <= (:year * 12 + :month) " +
           "ORDER BY g.year DESC, g.month DESC")
    List<MonthlyGoal> findEffectiveCandidates(@Param("year") int year, @Param("month") int month, PageRequest page);

    default Optional<MonthlyGoal> findEffective(int year, int month) {
        List<MonthlyGoal> found = findEffectiveCandidates(year, month, PageRequest.of(0, 1));
        return found.isEmpty() ? Optional.empty() : Optional.of(found.get(0));
    }

    List<MonthlyGoal> findAllByOrderByYearDescMonthDesc();
}
