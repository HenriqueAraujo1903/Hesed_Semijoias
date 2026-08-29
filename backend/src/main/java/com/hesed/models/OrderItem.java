package com.hesed.models;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Item de um pedido. É um SNAPSHOT imutável: copia os dados do produto
 * (SKU, nome, categoria, preço) e o estado de promoção NO MOMENTO do pedido.
 *
 * Isso é intencional: promoções expiram e preços mudam, mas o histórico de
 * vendas precisa refletir o que realmente foi ofertado naquele instante.
 *
 * Mantém também a referência ao Product (para joins/relatórios), mas as
 * análises devem usar os campos de snapshot, não o produto atual.
 */
@Entity
@Table(name = "order_items")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class OrderItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;

    /** Referência ao produto (pode ser null se o produto for excluído depois). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id")
    private Product product;

    // ---- Snapshot do produto no momento do pedido ----

    @Column(name = "product_sku", nullable = false, length = 50)
    private String productSku;

    @Column(name = "product_name", nullable = false, length = 120)
    private String productName;

    @Column(name = "product_category", nullable = false, length = 50)
    private String productCategory;

    /** Preço "cheio" do produto (sale_price) no momento do pedido. */
    @Column(name = "unit_price", nullable = false, precision = 10, scale = 2)
    private BigDecimal unitPrice;

    /** Preço efetivamente cobrado (promo_price se em promoção, senão unit_price). */
    @Column(name = "effective_price", nullable = false, precision = 10, scale = 2)
    private BigDecimal effectivePrice;

    /** Custo do produto no momento do pedido (para margem no dashboard). */
    @Column(name = "cost_price", precision = 10, scale = 2)
    private BigDecimal costPrice;

    /** Quantidade. Hoje sempre 1 (peça única). Preparado para evolução futura. */
    @Column(nullable = false)
    @Builder.Default
    private Integer quantity = 1;

    // ---- Snapshot da promoção (se havia) ----

    @Column(name = "was_promotion", nullable = false)
    @Builder.Default
    private Boolean wasPromotion = false;

    @Column(name = "discount_percent", precision = 5, scale = 2)
    private BigDecimal discountPercent;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
