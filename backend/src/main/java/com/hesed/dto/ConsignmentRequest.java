package com.hesed.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/** Abertura de um lote de consignação (revendedora + itens + comissão do lote). */
@Data
public class ConsignmentRequest {

    @NotNull(message = "Revendedora obrigatória")
    private UUID consigneeId;

    /** Comissão do lote (0..1). Opcional; se ausente, usa a taxa da revendedora. */
    @DecimalMin(value = "0.0", message = "Comissão não pode ser negativa")
    @DecimalMax(value = "1.0", message = "Comissão não pode ultrapassar 100%")
    private BigDecimal commissionRate;

    private String notes;

    @NotEmpty(message = "O lote deve conter ao menos um item.")
    private List<Item> items;

    @Data
    public static class Item {
        @NotNull(message = "Produto obrigatório")
        private UUID productId;
        /** Quantidade levada. */
        @NotNull(message = "Quantidade obrigatória")
        private Integer quantity;
        /** Preço de venda unitário sugerido (editável). Se ausente, usa o salePrice do produto. */
        private BigDecimal unitSalePrice;
    }
}
