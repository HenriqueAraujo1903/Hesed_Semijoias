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

@Entity
@Table(name = "products")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true, length = 50)
    private String sku;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false, length = 50)
    @Builder.Default
    private String category = "Brinco";

    /** Foto principal (capa). Mantida por retrocompatibilidade; espelha a 1ª de imageUrls. */
    @Column(name = "image_url", length = 500)
    private String imageUrl;

    /** Galeria de fotos do produto (até 5). A primeira é a capa (= imageUrl). */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "product_images", joinColumns = @JoinColumn(name = "product_id"))
    @OrderColumn(name = "position")
    @Column(name = "image_url", length = 500)
    @Builder.Default
    private List<String> imageUrls = new ArrayList<>();

    /** Preço de tabela no site do fornecedor (referência de compra). Opcional. */
    @Column(name = "supplier_price", precision = 10, scale = 2)
    private BigDecimal supplierPrice;

    /** Preço que efetivamente pagamos ao fornecedor (nosso custo). */
    @Column(name = "cost_price", nullable = false, precision = 10, scale = 2)
    private BigDecimal costPrice;

    /** Preço de venda ao cliente (cheio, salvo promoção). */
    @Column(name = "sale_price", nullable = false, precision = 10, scale = 2)
    private BigDecimal salePrice;

    @Column(nullable = false, length = 50)
    @Builder.Default
    private String status = "DISPONIVEL";

    /**
     * Situação de estoque. DERIVADA de stockQuantity:
     * 0 = ESGOTADO, <= lowStockThreshold = BAIXO, senão DISPONIVEL.
     * Persistida para não quebrar filtros/ordenação existentes do catálogo.
     */
    @Column(name = "stock_status", nullable = false, length = 50)
    @Builder.Default
    private String stockStatus = "DISPONIVEL";

    /** Quantidade em estoque (peças disponíveis). Fonte da verdade do estoque. */
    @Column(name = "stock_quantity", nullable = false, columnDefinition = "integer default 0")
    @Builder.Default
    private Integer stockQuantity = 0;

    /** Limiar para considerar o estoque "baixo" (default 3). */
    @Column(name = "low_stock_threshold", nullable = false, columnDefinition = "integer default 3")
    @Builder.Default
    private Integer lowStockThreshold = 3;

    /** Fornecedor da peça (opcional). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "supplier_id")
    private Supplier supplier;

    /** Data da nossa compra do fornecedor (início da garantia). */
    @Column(name = "purchase_date")
    private LocalDate purchaseDate;

    /** Prazo de garantia em meses a partir da data de compra (default 12). */
    @Column(name = "warranty_months", nullable = false, columnDefinition = "integer default 12")
    @Builder.Default
    private Integer warrantyMonths = 12;

    /**
     * Produto SOB ENCOMENDA: anunciado no catálogo mas sem estoque próprio.
     * Quando true: fica sempre comprável (não vira ESGOTADO por quantidade 0),
     * não consome/estorna estoque na venda e não entra nos alertas de reposição.
     * O costPrice é uma ESTIMATIVA do que se pagará ao fornecedor.
     */
    @Column(name = "on_demand", nullable = false, columnDefinition = "boolean default false")
    @Builder.Default
    private Boolean onDemand = false;

    /** Prazo de entrega estimado em dias úteis (só faz sentido p/ sob encomenda). Opcional. */
    @Column(name = "lead_time_days")
    private Integer leadTimeDays;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
