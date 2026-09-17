package com.hesed.models;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Pagamento recebido de um pedido (conta a receber concretizada). Um pedido
 * pode ter vários pagamentos (pagamento parcial / múltiplos métodos).
 *
 * Registra a forma de pagamento, o valor bruto recebido, a taxa cobrada pelo
 * meio (ex.: taxa da maquininha de cartão) e o valor líquido que efetivamente
 * entra no caixa (bruto - taxa). O líquido é o que alimenta o fluxo de caixa;
 * a taxa aparece como custo financeiro no DRE.
 */
@Entity
@Table(name = "payments", indexes = {
        @Index(name = "idx_payments_order", columnList = "order_id"),
        @Index(name = "idx_payments_paid_at", columnList = "paid_at")
})
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Payment {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;

    /** PIX | CARTAO_CREDITO | CARTAO_DEBITO | DINHEIRO | BOLETO | TRANSFERENCIA */
    @Column(nullable = false, length = 30)
    private String method;

    /** Valor bruto recebido do cliente. */
    @Column(name = "gross_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal grossAmount;

    /** Taxa cobrada pelo meio de pagamento (ex.: maquininha). Default zero. */
    @Column(name = "fee_amount", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal feeAmount = BigDecimal.ZERO;

    /** Valor líquido no caixa = grossAmount - feeAmount. Persistido (snapshot). */
    @Column(name = "net_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal netAmount;

    /**
     * Número de parcelas do pagamento. Só é > 1 para cartão de crédito parcelado.
     * Cada parcela vira uma liquidação (PaymentSettlement) com sua data de repasse.
     */
    @Column(nullable = false, columnDefinition = "integer default 1")
    @Builder.Default
    private Integer installments = 1;

    /** Data/hora da venda (competência). É a base para calcular as datas de repasse. */
    @Column(name = "paid_at", nullable = false)
    @Builder.Default
    private LocalDateTime paidAt = LocalDateTime.now();

    @Column(columnDefinition = "TEXT")
    private String notes;

    /** Liquidações (recebíveis) — quando o dinheiro entra no caixa, por parcela. */
    @OneToMany(mappedBy = "payment", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private java.util.List<PaymentSettlement> settlements = new java.util.ArrayList<>();

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
