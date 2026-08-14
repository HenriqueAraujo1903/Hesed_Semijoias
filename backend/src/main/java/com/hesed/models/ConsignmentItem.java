package com.hesed.models;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "consignment_items",
       uniqueConstraints = @UniqueConstraint(columnNames = {"product_id", "consignment_id"}))
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class ConsignmentItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "consignment_id", nullable = false)
    private Consignment consignment;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(length = 50)
    private String outcome; // DEVOLVIDO | VENDIDO | null

    @Column(name = "returned_at")
    private LocalDateTime returnedAt;

    @Column(name = "sold_at")
    private LocalDateTime soldAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
