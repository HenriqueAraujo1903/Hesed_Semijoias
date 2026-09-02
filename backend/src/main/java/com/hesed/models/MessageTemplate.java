package com.hesed.models;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Template de mensagem configurável pela operadora (ex.: agradecimento ao
 * confirmar um pedido, aviso ao cancelar). O corpo aceita variáveis que são
 * substituídas no envio: {cliente}, {pedido}, {total}, {itens}.
 *
 * Identificado por uma chave estável (templateKey) — o código referencia a
 * chave, e o texto/estado é editável pela tela de Configurações.
 */
@Entity
@Table(name = "message_templates")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class MessageTemplate {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** Chave estável do template (ex.: ORDER_CONFIRMED, ORDER_CANCELLED). */
    @Column(name = "template_key", nullable = false, unique = true, length = 60)
    private String templateKey;

    /** Rótulo amigável exibido na tela de configuração (não editável pelo usuário). */
    @Column(nullable = false, length = 120)
    private String title;

    /** Corpo da mensagem, com variáveis {cliente} {pedido} {total} {itens}. */
    @Column(nullable = false, columnDefinition = "TEXT")
    private String body;

    /** Quando false, o envio automático daquele evento fica desligado. */
    @Column(nullable = false)
    @Builder.Default
    private Boolean active = true;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
