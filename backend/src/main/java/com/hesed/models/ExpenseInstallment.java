package com.hesed.models;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Parcela de uma {@link Expense}. Permite controlar dívidas (ex.: com
 * fornecedores) mês a mês: cada parcela tem seu vencimento, valor e status
 * de pagamento próprio.
 *
 * O status ATRASADO é derivado em tempo de leitura (vencimento no passado e
 * ainda PENDENTE) — persistimos apenas PENDENTE/PAGO, e o service/DTO calcula
 * "ATRASADO" comparando dueDate com a data atual, evitando um job de varredura.
 */
@Entity
@Table(name = "expense_installments", indexes = {
        @Index(name = "idx_expense_installments_due", columnList = "due_date"),
        @Index(name = "idx_expense_installments_status", columnList = "status")
})
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class ExpenseInstallment {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "expense_id", nullable = false)
    private Expense expense;

    /** Número da parcela (1..N). */
    @Column(name = "installment_number", nullable = false)
    private Integer installmentNumber;

    /** Valor desta parcela. */
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    /** Vencimento da parcela. */
    @Column(name = "due_date", nullable = false)
    private LocalDate dueDate;

    /** PENDENTE | PAGO. (ATRASADO é derivado: PENDENTE + dueDate no passado.) */
    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = "PENDENTE";

    /** Data em que a parcela foi efetivamente paga (null enquanto pendente). */
    @Column(name = "paid_at")
    private LocalDate paidAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
