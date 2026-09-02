package com.hesed.dto;

import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * Edição de um pedido PENDENTE: itens (quantidade e preço), dados do cliente e notas.
 * Cada item referencia um produto do estoque (productId) e permite ajustar
 * quantidade e preço efetivo (negociação). O snapshot é recalculado ao salvar.
 */
@Data
public class OrderUpdateRequest {

    @NotEmpty(message = "O pedido deve conter ao menos um item.")
    private List<Item> items;

    /** Cliente cadastrado (opcional). Se informado, nome/telefone são preenchidos a partir dele. */
    private UUID customerId;
    private String customerName;
    private String customerPhone;
    private String notes;

    @Data
    public static class Item {
        /** Produto do estoque. */
        private UUID productId;
        /** Quantidade (>= 1). */
        private Integer quantity;
        /** Preço efetivo por unidade (pode ser ajustado na negociação). Opcional:
         *  se ausente, o backend usa o preço atual do produto (com promoção se houver). */
        private BigDecimal effectivePrice;
    }
}
