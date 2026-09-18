package com.hesed.dto;

import lombok.Data;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Notificação exibida no sino do painel. Hoje há um tipo (BIRTHDAY), mas a
 * estrutura é genérica para acomodar outros no futuro (ex.: conta a pagar
 * vencendo, estoque baixo).
 */
@Data
public class NotificationResponse {

    /** Chave estável e única da ocorrência (usada para dispensar). */
    private String key;

    /** Tipo da notificação. Ex.: BIRTHDAY. */
    private String type;

    private String title;
    private String message;

    /** Dias até o evento: 0 = hoje, 1 = amanhã, ... */
    private Integer daysUntil;

    // ---- Dados do cliente (para o tipo BIRTHDAY / ação de parabéns) ----
    private UUID customerId;
    private String customerName;
    private String customerPhone;
    private LocalDate birthDate;
}
