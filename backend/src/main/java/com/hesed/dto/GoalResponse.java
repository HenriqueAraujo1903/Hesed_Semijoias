package com.hesed.dto;

import com.hesed.models.MonthlyGoal;
import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

@Data
public class GoalResponse {
    private UUID id;
    private int year;
    private int month;
    private BigDecimal revenueTarget;
    private Integer ordersTarget;
    /** true se esta meta foi herdada de um mês anterior (não definida para o mês consultado). */
    private boolean inherited;
    /**
     * true quando existe uma meta salva especificamente para o mês consultado.
     * Uma meta travada só pode ser alterada com justificativa. Metas herdadas ou
     * inexistentes têm locked=false (o mês consultado ainda não tem meta própria).
     */
    private boolean locked;

    public static GoalResponse from(MonthlyGoal g, boolean inherited) {
        GoalResponse r = new GoalResponse();
        if (g != null) {
            r.setId(g.getId());
            r.setYear(g.getYear());
            r.setMonth(g.getMonth());
            r.setRevenueTarget(g.getRevenueTarget());
            r.setOrdersTarget(g.getOrdersTarget());
        }
        r.setInherited(inherited);
        // locked é true apenas para meta própria do mês (não herdada, não vazia)
        r.setLocked(g != null && !inherited);
        return r;
    }
}
