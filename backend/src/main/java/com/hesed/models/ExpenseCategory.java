package com.hesed.models;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Categoria de despesa (saída de caixa): infraestrutura de sistemas, taxa de
 * maquininha, embalagens, mostruário, etc. Semeadas no primeiro startup, mas
 * editáveis pela operadora. Cada {@link Expense} referencia uma categoria.
 */
@Entity
@Table(name = "expense_categories",
        uniqueConstraints = @UniqueConstraint(name = "uk_expense_category_name", columnNames = {"name"}))
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class ExpenseCategory {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 80)
    private String name;

    /** Categoria ativa aparece nos seletores. Inativa é mantida para histórico. */
    @Column(nullable = false)
    @Builder.Default
    private Boolean active = true;

    /**
     * Despesa OPERACIONAL entra no resultado do DRE. Categorias não-operacionais
     * (ex.: "Compra de mercadoria") NÃO entram no DRE como despesa — o custo da
     * mercadoria já é reconhecido como CMV no momento da venda; contá-lo também
     * aqui duplicaria o custo. Compra vira estoque (ativo), não despesa.
     */
    @Column(nullable = false, columnDefinition = "boolean default true")
    @Builder.Default
    private Boolean operational = true;

    /** Ordem de exibição nos seletores. */
    @Column(name = "sort_order", nullable = false, columnDefinition = "integer default 0")
    @Builder.Default
    private Integer sortOrder = 0;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
