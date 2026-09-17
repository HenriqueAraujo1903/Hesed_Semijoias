package com.hesed.models;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Despesa / conta a pagar. É o coração das saídas financeiras.
 *
 * O valor total ({@code totalAmount}) pode ser dividido em parcelas
 * ({@link ExpenseInstallment}) controladas mês a mês. Quando não há
 * parcelamento (installmentsCount = 1), ainda assim há uma única parcela,
 * uniformizando o controle de vencimento/pagamento.
 *
 * O status é DERIVADO das parcelas (ver FinanceService): PENDENTE (nenhuma
 * paga), PARCIAL (algumas pagas) ou PAGO (todas pagas). É persistido para
 * facilitar filtros/listagens, mas recalculado a cada mudança de parcela.
 */
@Entity
@Table(name = "expenses", indexes = {
        @Index(name = "idx_expenses_competence", columnList = "competence_date"),
        @Index(name = "idx_expenses_status", columnList = "status")
})
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Expense {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 200)
    private String description;

    /** Categoria da despesa (obrigatória). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id", nullable = false)
    private ExpenseCategory category;

    /** Fornecedor associado (opcional — ex.: dívida parcelada com fornecedor). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "supplier_id")
    private Supplier supplier;

    /** Valor total da despesa (soma das parcelas). */
    @Column(name = "total_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalAmount;

    /** Data de competência (quando a despesa foi incorrida/registrada). */
    @Column(name = "competence_date", nullable = false)
    private LocalDate competenceDate;

    /** Número de parcelas (1 = à vista). */
    @Column(name = "installments_count", nullable = false, columnDefinition = "integer default 1")
    @Builder.Default
    private Integer installmentsCount = 1;

    /** PENDENTE | PARCIAL | PAGO — derivado das parcelas. */
    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = "PENDENTE";

    @Column(columnDefinition = "TEXT")
    private String notes;

    @OneToMany(mappedBy = "expense", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<ExpenseInstallment> installments = new ArrayList<>();

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
