package com.hesed.models;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Categoria de produto. É a fonte de verdade das opções de categoria dos
 * seletores do sistema (cadastro de produto, filtros, catálogo, dashboards).
 *
 * Opção A: o Product continua guardando a categoria como texto (String). Esta
 * entidade apenas alimenta as listas de opções — não há FK. Renomear/excluir
 * aqui não altera os produtos já existentes; a exclusão é bloqueada quando há
 * produto usando o nome (regra no service).
 */
@Entity
@Table(name = "categories")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Category {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true, length = 50)
    private String name;

    /** Categoria ativa aparece nos seletores; inativa fica só no cadastro. */
    @Column(nullable = false)
    @Builder.Default
    private Boolean active = true;

    /** Ordem de exibição nos seletores (menor primeiro; empate resolve por nome). */
    @Column(name = "sort_order", nullable = false)
    @Builder.Default
    private Integer sortOrder = 0;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
