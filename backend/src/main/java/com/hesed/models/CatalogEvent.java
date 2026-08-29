package com.hesed.models;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Evento anônimo de engajamento no catálogo público (topo/meio do funil).
 *
 *   VIEW   → abertura da página do catálogo (productId nulo)
 *   SELECT → um produto foi selecionado (interesse), mesmo sem virar pedido
 *
 * Não identifica a pessoa: sessionId é um id anônimo gerado no navegador.
 * Para SELECT, guardamos snapshot de SKU/nome/categoria para relatórios
 * mesmo que o produto seja alterado/excluído depois.
 */
@Entity
@Table(name = "catalog_events", indexes = {
        @Index(name = "idx_catalog_events_type_created", columnList = "type, created_at"),
        @Index(name = "idx_catalog_events_product", columnList = "product_id")
})
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class CatalogEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** VIEW | SELECT */
    @Column(nullable = false, length = 20)
    private String type;

    /** Id anônimo da sessão do navegador (sem identificar a pessoa). */
    @Column(name = "session_id", length = 64)
    private String sessionId;

    /** Produto relacionado (só para SELECT). */
    @Column(name = "product_id")
    private UUID productId;

    @Column(name = "product_sku", length = 50)
    private String productSku;

    @Column(name = "product_name", length = 120)
    private String productName;

    @Column(name = "product_category", length = 50)
    private String productCategory;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
