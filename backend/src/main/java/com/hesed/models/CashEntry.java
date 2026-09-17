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
 * Lançamento manual de caixa: entrada ou saída avulsa que NÃO vem de um
 * pagamento de pedido nem de uma despesa parcelada — por exemplo, um aporte
 * do sócio, uma retirada (pró-labore), um ajuste de caixa, um estorno.
 *
 * O fluxo de caixa consolidado é a união de:
 *   (+) pagamentos recebidos (Payment.netAmount)
 *   (-) parcelas de despesa pagas (ExpenseInstallment paga)
 *   (±) estes lançamentos manuais
 *
 * Assim evitamos duplicar dados: vendas e despesas têm sua própria origem, e
 * esta entidade cobre só o que não se encaixa nelas.
 */
@Entity
@Table(name = "cash_entries", indexes = {
        @Index(name = "idx_cash_entries_date", columnList = "entry_date")
})
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class CashEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** ENTRADA | SAIDA */
    @Column(nullable = false, length = 10)
    private String type;

    @Column(nullable = false, length = 200)
    private String description;

    /** Valor sempre positivo; o sinal no caixa vem do {@code type}. */
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Column(name = "entry_date", nullable = false)
    private LocalDate entryDate;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
