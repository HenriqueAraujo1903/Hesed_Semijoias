package com.hesed.models;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Registro imutável de uma movimentação de estoque de um produto.
 * Serve de auditoria/rastreabilidade: entradas (compra), saídas (venda),
 * estornos e ajustes manuais.
 */
@Entity
@Table(name = "stock_movements")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class StockMovement {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    /** ENTRADA | SAIDA | AJUSTE | ESTORNO */
    @Column(nullable = false, length = 20)
    private String type;

    /** Variação aplicada ao estoque (positiva para entrada, negativa para saída). */
    @Column(nullable = false)
    private Integer delta;

    /** Quantidade em estoque após a movimentação (snapshot). */
    @Column(name = "resulting_quantity", nullable = false)
    private Integer resultingQuantity;

    /** Motivo/observação (ex.: "compra fornecedor", "venda pedido HSD-...", "correção"). */
    @Column(length = 300)
    private String reason;

    /** Referência opcional ao pedido que gerou a movimentação. */
    @Column(name = "order_id")
    private UUID orderId;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
