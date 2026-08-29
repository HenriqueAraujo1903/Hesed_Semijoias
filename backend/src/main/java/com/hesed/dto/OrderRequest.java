package com.hesed.dto;

import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;
import java.util.UUID;

/**
 * Payload enviado pelo catálogo público ao finalizar um pedido.
 * Enviamos apenas os IDs dos produtos: o backend é a fonte da verdade
 * sobre preços e promoções (nunca confiar em valores vindos do cliente).
 */
@Data
public class OrderRequest {

    @NotEmpty(message = "O pedido deve conter ao menos um item.")
    private List<UUID> productIds;

    /** Número do pedido gerado no front (HSD-...). Opcional; se ausente, o backend gera. */
    private String orderNumber;

    private String notes;
}
