package com.hesed.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;
import java.util.UUID;

/**
 * Acerto de um lote: para cada item, quantas unidades foram vendidas.
 * O restante (quantity - soldQuantity) é devolvido ao estoque no fechamento.
 */
@Data
public class ConsignmentSettleRequest {

    @NotNull
    private List<Item> items;

    @Data
    public static class Item {
        @NotNull private UUID itemId;
        @NotNull private Integer soldQuantity;
    }
}
