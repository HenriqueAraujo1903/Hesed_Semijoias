package com.hesed.models;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Registro de auditoria de alteração de uma meta mensal já existente. Toda
 * alteração de uma meta salva exige justificativa, que fica gravada aqui junto
 * dos valores anteriores e novos, para rastreabilidade.
 */
@Entity
@Table(name = "goal_change_logs")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class GoalChangeLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "goal_year", nullable = false)
    private int year;

    @Column(name = "goal_month", nullable = false)
    private int month;

    @Column(name = "old_revenue_target", precision = 12, scale = 2)
    private BigDecimal oldRevenueTarget;

    @Column(name = "new_revenue_target", precision = 12, scale = 2)
    private BigDecimal newRevenueTarget;

    @Column(name = "old_orders_target")
    private Integer oldOrdersTarget;

    @Column(name = "new_orders_target")
    private Integer newOrdersTarget;

    @Column(name = "reason", nullable = false, length = 500)
    private String reason;

    /** Quem alterou (nome/email do usuário admin), quando disponível. */
    @Column(name = "changed_by", length = 160)
    private String changedBy;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
