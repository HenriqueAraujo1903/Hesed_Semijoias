package com.hesed.models;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "consignment_items",
       uniqueConstraints = @UniqueConstraint(columnNames = {"product_id", "consignment_id"}))
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class ConsignmentItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "consignment_id", nullable = false)
    private Consignment consignment;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    /** Snapshot do produto (preserva o histórico mesmo se o produto mudar/for excluído). */
    @Column(name = "product_sku", length = 50)
    private String productSku;

    @Column(name = "product_name", length = 120)
    private String productName;

    /** Quantidade levada no lote (consignada). */
    @Column(nullable = false)
    @Builder.Default
    private Integer quantity = 1;

    /** Quantidade vendida (definida no acerto). O restante é devolvido. */
    @Column(name = "sold_quantity", nullable = false)
    @Builder.Default
    private Integer soldQuantity = 0;

    /** Quantidade devolvida (apurada no fechamento = quantity - soldQuantity). */
    @Column(name = "returned_quantity", nullable = false)
    @Builder.Default
    private Integer returnedQuantity = 0;

    /** Preço de venda unitário no lote (sugerido do salePrice, editável por lote). */
    @Column(name = "unit_sale_price", precision = 10, scale = 2)
    private BigDecimal unitSalePrice;

    @Column(name = "returned_at")
    private LocalDateTime returnedAt;

    @Column(name = "sold_at")
    private LocalDateTime soldAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
