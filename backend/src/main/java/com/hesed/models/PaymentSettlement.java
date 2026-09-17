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
 * Liquidação (recebível) de um {@link Payment}. Representa uma entrada de caixa
 * PREVISTA para uma data futura, conforme o repasse da administradora do cartão.
 *
 * Regras de repasse (definidas no FinanceService ao registrar o pagamento):
 *  - Crédito parcelado (Nx): N liquidações, uma a cada 30 dias (D+30, D+60...).
 *  - Crédito à vista (1x):   1 liquidação em D+30.
 *  - Débito:                 1 liquidação em D+1 dia útil.
 *  - Demais métodos (Pix, dinheiro, etc.): 1 liquidação em D+0 (imediata).
 *
 * O fluxo de caixa usa a {@code expectedDate} de cada liquidação (quando o
 * dinheiro entra), enquanto o DRE reconhece a receita na data da venda.
 */
@Entity
@Table(name = "payment_settlements", indexes = {
        @Index(name = "idx_payment_settlements_expected", columnList = "expected_date"),
        @Index(name = "idx_payment_settlements_payment", columnList = "payment_id")
})
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class PaymentSettlement {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "payment_id", nullable = false)
    private Payment payment;

    /** Número da parcela do repasse (1..N). Para não-parcelado é sempre 1. */
    @Column(name = "installment_number", nullable = false)
    private Integer installmentNumber;

    /** Valor líquido desta liquidação (parte do líquido total do pagamento). */
    @Column(name = "net_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal netAmount;

    /** Data prevista de crédito na conta (repasse da administradora). */
    @Column(name = "expected_date", nullable = false)
    private LocalDate expectedDate;

    /** PENDENTE | RECEBIDO. */
    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = "PENDENTE";

    /** Data em que o repasse efetivamente caiu (null enquanto pendente). */
    @Column(name = "received_at")
    private LocalDate receivedAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
