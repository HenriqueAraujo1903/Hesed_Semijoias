package com.hesed.models;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Linha de produto (ex.: Kids, Pet, Inverno, Verão). É a fonte de verdade das
 * opções de linha dos seletores do sistema. Segue o mesmo modelo da Category
 * (Opção A): quando os pontos de uso forem plugados, o Product guardará a linha
 * como texto — esta entidade apenas alimenta as listas de opções.
 *
 * A flag {@code luxo} marca linhas de produtos de luxo (usada futuramente pelos
 * pontos que consomem este cadastro).
 */
@Entity
@Table(name = "product_lines")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Line {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true, length = 50)
    private String name;

    /** Linha ativa aparece nos seletores; inativa fica só no cadastro. */
    @Column(nullable = false)
    @Builder.Default
    private Boolean active = true;

    /** Marca a linha como de luxo. */
    @Column(nullable = false)
    @Builder.Default
    private Boolean luxo = false;

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
