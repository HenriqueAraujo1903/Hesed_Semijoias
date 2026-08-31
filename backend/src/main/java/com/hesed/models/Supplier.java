package com.hesed.models;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Fornecedor de peças. Cada produto pode referenciar um fornecedor, permitindo
 * relatórios de compra, garantia por fornecedor e rastreabilidade de origem.
 */
@Entity
@Table(name = "suppliers")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Supplier {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(length = 60)
    private String phone;

    @Column(length = 120)
    private String email;

    /** Site / loja online do fornecedor (onde consultamos o preço de tabela). */
    @Column(name = "website", length = 300)
    private String website;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
