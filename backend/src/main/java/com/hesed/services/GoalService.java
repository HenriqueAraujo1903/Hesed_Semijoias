package com.hesed.services;

import com.hesed.dto.GoalRequest;
import com.hesed.dto.GoalResponse;
import com.hesed.models.MonthlyGoal;
import com.hesed.repositories.MonthlyGoalRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Service
public class GoalService {

    private final MonthlyGoalRepository goalRepository;

    public GoalService(MonthlyGoalRepository goalRepository) {
        this.goalRepository = goalRepository;
    }

    /**
     * Resolve a meta EFETIVA de um mês, com herança: se o mês não tem meta
     * própria, herda a última meta definida em um mês anterior. Retorna uma
     * GoalResponse marcada como `inherited=true` quando herdada, ou uma meta
     * vazia (inherited=false, targets null) se nunca houve meta.
     */
    public GoalResponse resolveEffective(int year, int month) {
        // 1. meta exata do mês
        var exact = goalRepository.findByYearAndMonth(year, month);
        if (exact.isPresent()) {
            return GoalResponse.from(exact.get(), false);
        }
        // 2. herança: última meta <= mês alvo
        var inherited = goalRepository.findEffective(year, month);
        if (inherited.isPresent()) {
            GoalResponse r = GoalResponse.from(inherited.get(), true);
            // reporta o mês consultado, mas mantém os valores herdados
            r.setYear(year);
            r.setMonth(month);
            return r;
        }
        // 3. nenhuma meta ainda
        GoalResponse empty = new GoalResponse();
        empty.setYear(year);
        empty.setMonth(month);
        empty.setInherited(false);
        return empty;
    }

    /** Meta efetiva do mês corrente. */
    public GoalResponse currentEffective() {
        LocalDate now = LocalDate.now();
        return resolveEffective(now.getYear(), now.getMonthValue());
    }

    /** Retorna a entidade MonthlyGoal efetiva (com herança) ou null. */
    public MonthlyGoal effectiveEntity(int year, int month) {
        return goalRepository.findByYearAndMonth(year, month)
                .or(() -> goalRepository.findEffective(year, month))
                .orElse(null);
    }

    public List<GoalResponse> findAll() {
        return goalRepository.findAllByOrderByYearDescMonthDesc()
                .stream()
                .map(g -> GoalResponse.from(g, false))
                .toList();
    }

    /**
     * Cria ou atualiza a meta de um mês (upsert por year/month).
     */
    @Transactional
    public GoalResponse upsert(GoalRequest request) {
        MonthlyGoal goal = goalRepository.findByYearAndMonth(request.getYear(), request.getMonth())
                .orElseGet(MonthlyGoal::new);
        goal.setYear(request.getYear());
        goal.setMonth(request.getMonth());
        goal.setRevenueTarget(request.getRevenueTarget());
        goal.setOrdersTarget(request.getOrdersTarget());
        return GoalResponse.from(goalRepository.save(goal), false);
    }
}
