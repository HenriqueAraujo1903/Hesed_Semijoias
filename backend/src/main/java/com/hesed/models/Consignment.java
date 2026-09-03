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

@Entity
@Table(name = "consignments")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Consignment {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "consignee_id", nullable = false)
    private Consignee consignee;

    /** ABERTO (peças com a revendedora) | FECHADO (acertado). */
    @Column(nullable = false, length = 50)
    @Builder.Default
    private String status = "ABERTO";

    /** Comissão do lote (0..1). Snapshot editável por lote; default vem da revendedora. */
    @Column(name = "commission_rate", precision = 5, scale = 4)
    private BigDecimal commissionRate;

    // ── Apurados no fechamento ──
    /** Receita total das peças vendidas (soma unitSalePrice * soldQuantity). */
    @Column(name = "total_sold", precision = 10, scale = 2)
    private BigDecimal totalSold;

    /** Comissão apurada = totalSold * commissionRate. */
    @Column(name = "commission_amount", precision = 10, scale = 2)
    private BigDecimal commissionAmount;

    /** Líquido da loja = totalSold - commissionAmount. */
    @Column(name = "net_amount", precision = 10, scale = 2)
    private BigDecimal netAmount;

    @Column(name = "opened_at")
    @Builder.Default
    private LocalDateTime openedAt = LocalDateTime.now();

    @Column(name = "closed_at")
    private LocalDateTime closedAt;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @OneToMany(mappedBy = "consignment", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<ConsignmentItem> items = new ArrayList<>();

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
