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
 * Lote de compra (entrada de mercadoria). Representa uma compra do fornecedor
 * que: (1) dá entrada no estoque dos produtos (novos ou existentes) e (2) gera
 * UMA conta a pagar ({@link Expense}) parcelável ao fornecedor.
 *
 * O valor total é a soma automática de (custo unitário × quantidade) dos itens.
 * A compra NÃO afeta o DRE como despesa — vira estoque (ativo); o custo só é
 * reconhecido como CMV quando a peça é vendida.
 */
@Entity
@Table(name = "purchase_batches", indexes = {
        @Index(name = "idx_purchase_batches_date", columnList = "purchase_date"),
        @Index(name = "idx_purchase_batches_supplier", columnList = "supplier_id")
})
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class PurchaseBatch {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "supplier_id", nullable = false)
    private Supplier supplier;

    @Column(name = "purchase_date", nullable = false)
    private LocalDate purchaseDate;

    /** Valor total da compra = soma dos itens. */
    @Column(name = "total_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalAmount;

    /** Número de parcelas da conta a pagar gerada. */
    @Column(name = "installments_count", nullable = false, columnDefinition = "integer default 1")
    @Builder.Default
    private Integer installmentsCount = 1;

    /** Conta a pagar gerada por esta compra (fornecedor). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "expense_id")
    private Expense expense;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @OneToMany(mappedBy = "batch", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<PurchaseBatchItem> items = new ArrayList<>();

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
