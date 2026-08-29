package com.hesed.models;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Pedido originado no catálogo público e enviado via WhatsApp.
 *
 * Ciclo de vida:
 *   PENDENTE   → recém-criado quando o cliente clica em "Finalizar" no catálogo
 *   CONFIRMADO → a venda foi efetivada (confirmação manual da operadora)
 *   CANCELADO  → o pedido não virou venda
 *
 * Só pedidos CONFIRMADO entram nas métricas de receita do dashboard.
 */
@Entity
@Table(name = "orders")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** Número legível do pedido, ex: HSD-20260829-1234 */
    @Column(name = "order_number", nullable = false, unique = true, length = 40)
    private String orderNumber;

    /** PENDENTE | CONFIRMADO | CANCELADO */
    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = "PENDENTE";

    /** Canal de origem do pedido. Hoje apenas WHATSAPP. */
    @Column(nullable = false, length = 20)
    @Builder.Default
    private String channel = "WHATSAPP";

    /** Soma dos preços dos itens no momento do pedido (snapshot). */
    @Column(name = "total_amount", nullable = false, precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal totalAmount = BigDecimal.ZERO;

    /** Momento em que o pedido foi enviado pelo cliente (catálogo). */
    @Column(name = "ordered_at", nullable = false)
    @Builder.Default
    private LocalDateTime orderedAt = LocalDateTime.now();

    /** Momento em que a operadora confirmou/cancelou o pedido. */
    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    /** Nome do cliente que comprou (obrigatório ao confirmar a venda). */
    @Column(name = "customer_name", length = 120)
    private String customerName;

    /** Telefone do cliente (opcional). */
    @Column(name = "customer_phone", length = 30)
    private String customerPhone;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<OrderItem> items = new ArrayList<>();

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
