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
        return r;
    }
}
