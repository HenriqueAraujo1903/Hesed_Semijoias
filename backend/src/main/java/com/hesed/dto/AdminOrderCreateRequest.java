package com.hesed.dto;

import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * Criação de pedido pela operadora (venda direta, fora do catálogo).
 * Canal = DIRETA. Pode já nascer CONFIRMADO (confirm=true), caso em que
 * o nome do cliente é obrigatório.
 */
@Data
public class AdminOrderCreateRequest {

    @NotEmpty(message = "O pedido deve conter ao menos um item.")
    private List<Item> items;

    private String customerName;
    private String customerPhone;
    private String notes;

    /** Se true, o pedido já é criado como CONFIRMADO (venda efetivada). */
    private Boolean confirm = false;

    @Data
    public static class Item {
        private UUID productId;
        private Integer quantity;
        /** Preço efetivo por unidade. Se ausente, usa o preço atual do produto (com promoção). */
        private BigDecimal effectivePrice;
    }
}
