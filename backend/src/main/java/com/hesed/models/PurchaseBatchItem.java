package com.hesed.models;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Item de um {@link PurchaseBatch}: um produto comprado, sua quantidade e o
 * custo unitário pago ao fornecedor. Guarda um snapshot de SKU/nome no momento
 * da compra (o produto pode mudar/ser excluído depois).
 */
@Entity
@Table(name = "purchase_batch_items", indexes = {
        @Index(name = "idx_purchase_batch_items_batch", columnList = "batch_id")
})
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class PurchaseBatchItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "batch_id", nullable = false)
    private PurchaseBatch batch;

    /** Produto afetado (criado agora se era novo). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id")
    private Product product;

    @Column(name = "product_sku", nullable = false, length = 50)
    private String productSku;

    @Column(name = "product_name", nullable = false, length = 120)
    private String productName;

    /** Custo unitário pago ao fornecedor nesta compra. */
    @Column(name = "unit_cost", nullable = false, precision = 12, scale = 2)
    private BigDecimal unitCost;

    @Column(nullable = false)
    private Integer quantity;

    /** true se o produto foi criado por esta compra (era SKU novo). */
    @Column(name = "created_product", nullable = false, columnDefinition = "boolean default false")
    @Builder.Default
    private Boolean createdProduct = false;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
