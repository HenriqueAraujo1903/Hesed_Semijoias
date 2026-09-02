package com.hesed.services;

import com.hesed.dto.GoalRequest;
import com.hesed.dto.GoalResponse;
import com.hesed.models.GoalChangeLog;
import com.hesed.models.MonthlyGoal;
import com.hesed.repositories.GoalChangeLogRepository;
import com.hesed.repositories.MonthlyGoalRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Testes unitários do GoalService: resolução por mês, herança do último mês,
 * upsert (create/update) e mês sem meta. Repositório mockado — não sobe Spring.
 */
@ExtendWith(MockitoExtension.class)
class GoalServiceTest {

    @Mock
    private MonthlyGoalRepository goalRepository;

    @Mock
    private GoalChangeLogRepository changeLogRepository;

    @InjectMocks
    private GoalService goalService;

    private MonthlyGoal goal(int year, int month, String revenue, Integer orders) {
        return MonthlyGoal.builder()
                .year(year)
                .month(month)
                .revenueTarget(revenue == null ? null : new BigDecimal(revenue))
                .ordersTarget(orders)
                .build();
    }

    @Test
    @DisplayName("resolveEffective retorna a meta exata do mês (não herdada)")
    void resolveEffective_exactMonth() {
        when(goalRepository.findByYearAndMonth(2026, 8))
                .thenReturn(Optional.of(goal(2026, 8, "5000", 30)));

        GoalResponse r = goalService.resolveEffective(2026, 8);

        assertThat(r.getRevenueTarget()).isEqualByComparingTo("5000");
        assertThat(r.getOrdersTarget()).isEqualTo(30);
        assertThat(r.isInherited()).isFalse();
        assertThat(r.getYear()).isEqualTo(2026);
        assertThat(r.getMonth()).isEqualTo(8);
    }

    @Test
    @DisplayName("resolveEffective herda a última meta quando o mês não tem meta própria")
    void resolveEffective_inheritsFromPrevious() {
        // mês alvo (agosto) sem meta própria
        when(goalRepository.findByYearAndMonth(2026, 8)).thenReturn(Optional.empty());
        // herança: meta de junho é a mais recente <= agosto
        when(goalRepository.findEffective(2026, 8))
                .thenReturn(Optional.of(goal(2026, 6, "4000", 25)));

        GoalResponse r = goalService.resolveEffective(2026, 8);

        assertThat(r.isInherited()).isTrue();
        assertThat(r.getRevenueTarget()).isEqualByComparingTo("4000");
        assertThat(r.getOrdersTarget()).isEqualTo(25);
        // reporta o mês consultado, não o mês de origem
        assertThat(r.getYear()).isEqualTo(2026);
        assertThat(r.getMonth()).isEqualTo(8);
    }

    @Test
    @DisplayName("resolveEffective devolve meta vazia quando nunca houve meta")
    void resolveEffective_noGoalEver() {
        when(goalRepository.findByYearAndMonth(2026, 8)).thenReturn(Optional.empty());
        when(goalRepository.findEffective(2026, 8)).thenReturn(Optional.empty());

        GoalResponse r = goalService.resolveEffective(2026, 8);

        assertThat(r.isInherited()).isFalse();
        assertThat(r.getRevenueTarget()).isNull();
        assertThat(r.getOrdersTarget()).isNull();
        assertThat(r.getYear()).isEqualTo(2026);
        assertThat(r.getMonth()).isEqualTo(8);
    }

    @Test
    @DisplayName("effectiveEntity prioriza a meta exata sobre a herdada")
    void effectiveEntity_prefersExact() {
        when(goalRepository.findByYearAndMonth(2026, 8))
                .thenReturn(Optional.of(goal(2026, 8, "9000", 50)));

        MonthlyGoal r = goalService.effectiveEntity(2026, 8);

        assertThat(r.getRevenueTarget()).isEqualByComparingTo("9000");
        assertThat(r.getMonth()).isEqualTo(8);
    }

    @Test
    @DisplayName("effectiveEntity cai para herança quando não há meta exata")
    void effectiveEntity_fallsBackToInheritance() {
        when(goalRepository.findByYearAndMonth(2026, 8)).thenReturn(Optional.empty());
        when(goalRepository.findEffective(2026, 8))
                .thenReturn(Optional.of(goal(2026, 5, "3000", 20)));

        MonthlyGoal r = goalService.effectiveEntity(2026, 8);

        assertThat(r.getMonth()).isEqualTo(5);
        assertThat(r.getRevenueTarget()).isEqualByComparingTo("3000");
    }

    @Test
    @DisplayName("effectiveEntity retorna null quando nunca houve meta")
    void effectiveEntity_null() {
        when(goalRepository.findByYearAndMonth(2026, 8)).thenReturn(Optional.empty());
        when(goalRepository.findEffective(2026, 8)).thenReturn(Optional.empty());

        assertThat(goalService.effectiveEntity(2026, 8)).isNull();
    }

    @Test
    @DisplayName("upsert cria uma nova meta quando o mês ainda não tem")
    void upsert_createsNew() {
        when(goalRepository.findByYearAndMonth(2026, 9)).thenReturn(Optional.empty());
        when(goalRepository.save(any(MonthlyGoal.class))).thenAnswer(inv -> inv.getArgument(0));

        GoalRequest req = new GoalRequest();
        req.setYear(2026);
        req.setMonth(9);
        req.setRevenueTarget(new BigDecimal("7000"));
        req.setOrdersTarget(40);

        GoalResponse r = goalService.upsert(req, "admin-1");

        ArgumentCaptor<MonthlyGoal> captor = ArgumentCaptor.forClass(MonthlyGoal.class);
        org.mockito.Mockito.verify(goalRepository).save(captor.capture());
        assertThat(captor.getValue().getYear()).isEqualTo(2026);
        assertThat(captor.getValue().getMonth()).isEqualTo(9);
        assertThat(captor.getValue().getRevenueTarget()).isEqualByComparingTo("7000");
        assertThat(r.getRevenueTarget()).isEqualByComparingTo("7000");
        assertThat(r.getOrdersTarget()).isEqualTo(40);
    }

    @Test
    @DisplayName("upsert atualiza a meta existente com justificativa e registra auditoria")
    void upsert_updatesExistingWithReason() {
        MonthlyGoal existing = goal(2026, 9, "1000", 5);
        when(goalRepository.findByYearAndMonth(2026, 9)).thenReturn(Optional.of(existing));
        when(goalRepository.save(any(MonthlyGoal.class))).thenAnswer(inv -> inv.getArgument(0));

        GoalRequest req = new GoalRequest();
        req.setYear(2026);
        req.setMonth(9);
        req.setRevenueTarget(new BigDecimal("8000"));
        req.setOrdersTarget(45);
        req.setChangeReason("ajuste por campanha de dia das mães");

        GoalResponse r = goalService.upsert(req, "admin-1");

        // mesma entidade atualizada
        assertThat(existing.getRevenueTarget()).isEqualByComparingTo("8000");
        assertThat(existing.getOrdersTarget()).isEqualTo(45);
        assertThat(r.getRevenueTarget()).isEqualByComparingTo("8000");

        // auditoria registrada com valores antes/depois e justificativa
        ArgumentCaptor<GoalChangeLog> logCaptor = ArgumentCaptor.forClass(GoalChangeLog.class);
        verify(changeLogRepository).save(logCaptor.capture());
        GoalChangeLog log = logCaptor.getValue();
        assertThat(log.getOldRevenueTarget()).isEqualByComparingTo("1000");
        assertThat(log.getNewRevenueTarget()).isEqualByComparingTo("8000");
        assertThat(log.getOldOrdersTarget()).isEqualTo(5);
        assertThat(log.getNewOrdersTarget()).isEqualTo(45);
        assertThat(log.getReason()).isEqualTo("ajuste por campanha de dia das mães");
        assertThat(log.getChangedBy()).isEqualTo("admin-1");
    }

    @Test
    @DisplayName("upsert rejeita alteração de meta travada sem justificativa")
    void upsert_rejectsUpdateWithoutReason() {
        MonthlyGoal existing = goal(2026, 9, "1000", 5);
        when(goalRepository.findByYearAndMonth(2026, 9)).thenReturn(Optional.of(existing));

        GoalRequest req = new GoalRequest();
        req.setYear(2026);
        req.setMonth(9);
        req.setRevenueTarget(new BigDecimal("8000"));
        req.setOrdersTarget(45);
        // sem changeReason

        assertThatThrownBy(() -> goalService.upsert(req, "admin-1"))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("justificativa");

        // nada foi salvo nem auditado
        verify(goalRepository, never()).save(any());
        verify(changeLogRepository, never()).save(any());
    }

    @Test
    @DisplayName("upsert com justificativa mas sem mudança de valores não registra auditoria")
    void upsert_noValueChange_noAudit() {
        MonthlyGoal existing = goal(2026, 9, "1000", 5);
        when(goalRepository.findByYearAndMonth(2026, 9)).thenReturn(Optional.of(existing));

        GoalRequest req = new GoalRequest();
        req.setYear(2026);
        req.setMonth(9);
        req.setRevenueTarget(new BigDecimal("1000"));
        req.setOrdersTarget(5);
        req.setChangeReason("revisão sem mudança");

        GoalResponse r = goalService.upsert(req, "admin-1");

        assertThat(r.getRevenueTarget()).isEqualByComparingTo("1000");
        verify(changeLogRepository, never()).save(any());
        verify(goalRepository, never()).save(any());
    }

    @Test
    @DisplayName("upsert aceita metas parciais (só receita, pedidos nulo)")
    void upsert_partialTargets() {
        when(goalRepository.findByYearAndMonth(2026, 10)).thenReturn(Optional.empty());
        when(goalRepository.save(any(MonthlyGoal.class))).thenAnswer(inv -> inv.getArgument(0));

        GoalRequest req = new GoalRequest();
        req.setYear(2026);
        req.setMonth(10);
        req.setRevenueTarget(new BigDecimal("6000"));
        req.setOrdersTarget(null);

        GoalResponse r = goalService.upsert(req, "admin-1");

        assertThat(r.getRevenueTarget()).isEqualByComparingTo("6000");
        assertThat(r.getOrdersTarget()).isNull();
    }

    @Test
    @DisplayName("resolveEffective marca locked=true para meta própria e false para herdada")
    void resolveEffective_lockedFlag() {
        // meta própria → locked
        when(goalRepository.findByYearAndMonth(2026, 8))
                .thenReturn(Optional.of(goal(2026, 8, "5000", 30)));
        assertThat(goalService.resolveEffective(2026, 8).isLocked()).isTrue();

        // herdada → não travada (mês ainda sem meta própria)
        when(goalRepository.findByYearAndMonth(2026, 11)).thenReturn(Optional.empty());
        when(goalRepository.findEffective(2026, 11))
                .thenReturn(Optional.of(goal(2026, 6, "4000", 25)));
        assertThat(goalService.resolveEffective(2026, 11).isLocked()).isFalse();
    }
}
