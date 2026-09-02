package com.hesed.services;

import com.hesed.dto.GoalRequest;
import com.hesed.dto.GoalResponse;
import com.hesed.models.GoalChangeLog;
import com.hesed.models.MonthlyGoal;
import com.hesed.repositories.GoalChangeLogRepository;
import com.hesed.repositories.MonthlyGoalRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Objects;

@Service
public class GoalService {

    private final MonthlyGoalRepository goalRepository;
    private final GoalChangeLogRepository changeLogRepository;

    public GoalService(MonthlyGoalRepository goalRepository,
                       GoalChangeLogRepository changeLogRepository) {
        this.goalRepository = goalRepository;
        this.changeLogRepository = changeLogRepository;
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
     *
     * Regra de travamento: uma vez criada, a meta do mês fica travada. Para
     * ALTERAR uma meta já existente é obrigatório informar uma justificativa
     * (changeReason). A alteração é registrada em GoalChangeLog. Na criação
     * (mês sem meta própria) a justificativa é dispensada.
     *
     * @param changedBy identificação de quem alterou (pode ser null)
     */
    @Transactional
    public GoalResponse upsert(GoalRequest request, String changedBy) {
        var existingOpt = goalRepository.findByYearAndMonth(request.getYear(), request.getMonth());

        if (existingOpt.isPresent()) {
            MonthlyGoal existing = existingOpt.get();

            // Alteração de meta travada exige justificativa.
            String reason = request.getChangeReason() == null ? "" : request.getChangeReason().trim();
            if (reason.isEmpty()) {
                throw new RuntimeException("Esta meta já está definida. Informe uma justificativa para alterá-la.");
            }

            boolean changed = !sameAmount(existing.getRevenueTarget(), request.getRevenueTarget())
                    || !Objects.equals(existing.getOrdersTarget(), request.getOrdersTarget());

            if (changed) {
                // Registra auditoria antes de aplicar a mudança.
                changeLogRepository.save(GoalChangeLog.builder()
                        .year(existing.getYear())
                        .month(existing.getMonth())
                        .oldRevenueTarget(existing.getRevenueTarget())
                        .newRevenueTarget(request.getRevenueTarget())
                        .oldOrdersTarget(existing.getOrdersTarget())
                        .newOrdersTarget(request.getOrdersTarget())
                        .reason(reason)
                        .changedBy(changedBy)
                        .build());

                existing.setRevenueTarget(request.getRevenueTarget());
                existing.setOrdersTarget(request.getOrdersTarget());
                existing = goalRepository.save(existing);
            }
            return GoalResponse.from(existing, false);
        }

        // Criação: sem meta prévia para o mês → livre, sem justificativa.
        MonthlyGoal goal = new MonthlyGoal();
        goal.setYear(request.getYear());
        goal.setMonth(request.getMonth());
        goal.setRevenueTarget(request.getRevenueTarget());
        goal.setOrdersTarget(request.getOrdersTarget());
        return GoalResponse.from(goalRepository.save(goal), false);
    }

    /** Histórico de alterações de uma meta específica. */
    public List<GoalChangeLog> changeHistory(int year, int month) {
        return changeLogRepository.findByYearAndMonthOrderByCreatedAtDesc(year, month);
    }

    /**
     * Compara dois valores monetários por VALOR, ignorando a escala (casas
     * decimais). Ex.: 2000 e 2000.00 são o mesmo valor. Usar Objects.equals em
     * BigDecimal daria falso-negativo porque considera a escala, gerando logs
     * de auditoria espúrios ao re-salvar a mesma meta.
     */
    private static boolean sameAmount(java.math.BigDecimal a, java.math.BigDecimal b) {
        if (a == null && b == null) return true;
        if (a == null || b == null) return false;
        return a.compareTo(b) == 0;
    }
}
