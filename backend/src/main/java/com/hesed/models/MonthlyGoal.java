package com.hesed.models;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Meta de vendas de um mês específico (year/month). Há no máximo uma meta por
 * mês (unique constraint). Quando um mês não tem meta própria, o serviço herda
 * a última meta definida em um mês anterior.
 *
 * Extensível: novos indicadores de meta podem ser adicionados como colunas
 * (ex.: ticket médio, margem) sem quebrar os existentes.
 */
@Entity
@Table(name = "monthly_goals",
        uniqueConstraints = @UniqueConstraint(name = "uk_goal_year_month", columnNames = {"goal_year", "goal_month"}))
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class MonthlyGoal {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "goal_year", nullable = false)
    private int year;

    /** 1 = janeiro ... 12 = dezembro. */
    @Column(name = "goal_month", nullable = false)
    private int month;

    /** Meta de receita (vendas confirmadas) do mês, em R$. */
    @Column(name = "revenue_target", precision = 12, scale = 2)
    private BigDecimal revenueTarget;

    /** Meta de número de pedidos confirmados do mês. */
    @Column(name = "orders_target")
    private Integer ordersTarget;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
