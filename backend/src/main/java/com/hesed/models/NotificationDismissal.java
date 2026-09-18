package com.hesed.models;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Registro de dispensa de uma notificação. As notificações em si são DERIVADAS
 * (calculadas em tempo real — ex.: aniversários na janela dos próximos dias),
 * não são persistidas. O que persistimos é apenas o que o usuário "dispensou",
 * para não mostrar de novo.
 *
 * A {@code notificationKey} identifica a ocorrência de forma estável e única.
 * Para aniversário usamos {@code BIRTHDAY:{customerId}:{ano}} — o ano do
 * aniversário faz a notificação reaparecer no ano seguinte automaticamente
 * (a dispensa de 2026 não silencia o aniversário de 2027).
 */
@Entity
@Table(name = "notification_dismissals",
        uniqueConstraints = @UniqueConstraint(name = "uk_notif_dismissal_key",
                columnNames = {"notification_key"}))
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class NotificationDismissal {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "notification_key", nullable = false, length = 120)
    private String notificationKey;

    /** Usuário que dispensou (userId do JWT). Auditoria — a dispensa vale para todos. */
    @Column(name = "dismissed_by", length = 60)
    private String dismissedBy;

    @CreationTimestamp
    @Column(name = "dismissed_at", updatable = false)
    private LocalDateTime dismissedAt;
}
